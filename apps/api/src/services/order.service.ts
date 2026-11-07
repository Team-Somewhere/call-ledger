import { desc, eq } from "drizzle-orm";
import { db, orders, type OrderSelect } from "@call-ledger/database";
import {
  type FlashOrderStatusResponse,
  type FlashQuoteResponse,
  type FlashSubmitOrderResponse,
} from "@call-ledger/definitive";
import {
  type FlashQuoteRequestInput,
  type FlashSubmitOrderRequestOutput,
} from "@call-ledger/shared";
import { env } from "../config/env";
import {
  getDefinitiveClient,
  isDefinitiveConfigured,
  setDefinitiveClientForTesting,
} from "./definitive-client";
import {
  applyFlashStatus,
  assertQuoteUsable,
  dbOrderType,
  expectedCancelMessage,
  findStoredQuote,
  markQuoteConsumed,
  persistFlashQuote,
  portfolioForUser,
  submissionFromStoredQuote,
} from "./flash-ledger.service";

export {
  getDefinitiveClient,
  isDefinitiveConfigured,
  setDefinitiveClientForTesting,
};

export class OrderServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

/**
 * Request a live price quote and EIP-712 signable payload from Definitive Flash.
 * Security: Validates that the requested funderAddress matches the authenticated user's wallet.
 */
export async function requestFlashQuote(
  userAddress: string,
  input: FlashQuoteRequestInput,
  userId?: string,
): Promise<FlashQuoteResponse> {
  const normUserAddress = userAddress.toLowerCase();
  const normFunder = input.funderAddress.toLowerCase();

  if (normUserAddress !== normFunder) {
    throw new OrderServiceError(
      "UNAUTHORIZED_WALLET",
      `Funder address '${input.funderAddress}' does not match your authenticated wallet '${userAddress}'.`,
      403,
    );
  }

  const client = getDefinitiveClient();
  const feeBps = input.flashIntegratorFeeBps ?? env.DEFINITIVE_INTEGRATOR_FEE_BPS;

  try {
    const quote = await client.getQuote({
      targetChain: input.targetChain,
      contraChain: input.contraChain,
      targetAsset: input.targetAsset,
      contraAsset: input.contraAsset,
      side: input.side,
      qty: input.qty,
      orderType: input.orderType,
      limitNotionalPrice: input.limitNotionalPrice,
      limitCrossPrice: input.limitCrossPrice,
      funderAddress: normFunder,
      maxSlippage: input.maxSlippage,
      maxPriceImpact: input.maxPriceImpact,
      expireTime: input.expireTime,
      flashIntegratorFeeBps: feeBps,
      startTime: input.startTime,
      durationSeconds: input.durationSeconds,
      twapBucketCount: input.twapBucketCount,
      triggers: input.triggers,
      attachedBracket: input.attachedBracket,
      forceMinimalAllowance: true,
      evmUsePermit2: false,
    });

    if (userId) {
      try {
        await persistFlashQuote({
          userId,
          walletAddress: normFunder,
          request: { ...input, flashIntegratorFeeBps: feeBps },
          quote,
        });
      } catch (persistError) {
        console.error(
          "[flash] quote persistence failed",
          persistError instanceof Error ? persistError.message : "unknown",
        );
      }
    }

    return quote;
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err) {
      const anyErr = err as { code?: string; statusCode?: number; details?: unknown };
      console.error(
        `[flash] quote failed ${anyErr.statusCode ?? 502}: ${err.message}`,
      );
      throw new OrderServiceError(
        anyErr.code ?? "QUOTE_FAILED",
        err.message,
        anyErr.statusCode ?? 502,
        anyErr.details,
      );
    }
    throw new OrderServiceError(
      "QUOTE_FAILED",
      err instanceof Error ? err.message : "Failed to obtain quote from Definitive Flash",
      502,
    );
  }
}

/**
 * Submit a signed trade order to Definitive Flash and persist in CallLedger's database.
 * Security: Validates funderAddress matches authenticated user, and order is submitted once.
 */
export async function submitFlashOrder(
  userId: string,
  userAddress: string,
  input: FlashSubmitOrderRequestOutput,
): Promise<{ order: OrderSelect; flashResponse: FlashSubmitOrderResponse }> {
  const normUserAddress = userAddress.toLowerCase();
  const normFunder = input.funderAddress.toLowerCase();

  if (normUserAddress !== normFunder) {
    throw new OrderServiceError(
      "UNAUTHORIZED_WALLET",
      `Funder address '${input.funderAddress}' does not match your authenticated wallet '${userAddress}'.`,
      403,
    );
  }

  const stored = await findStoredQuote(normFunder, input.quoteId).catch(() => null);
  if (!stored) {
    throw new OrderServiceError(
      "QUOTE_NOT_FOUND",
      "This quote is not on file for your wallet. Request a fresh quote and review it before signing.",
      409,
    );
  }
  try {
    assertQuoteUsable(stored);
  } catch (expiry) {
    const code = expiry instanceof Error ? expiry.message : "QUOTE_EXPIRED";
    throw new OrderServiceError(
      code,
      code === "QUOTE_EXPIRED"
        ? "This quote has expired. Request a new quote and review it before submitting."
        : "This quote was already used. Request a new quote.",
      409,
    );
  }

  const storedRequest = stored.quoteRequest as FlashQuoteRequestInput;
  const storedResponse = stored.quoteResponse as FlashQuoteResponse;
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.flashQuoteId, input.quoteId))
    .limit(1);
  if (existing) {
    return {
      order: existing,
      flashResponse: {
        orderId: existing.providerOrderId || existing.id,
        status: existing.status as FlashSubmitOrderResponse["status"],
      },
    };
  }

  const client = getDefinitiveClient();
  let flashRes: FlashSubmitOrderResponse;
  try {
    flashRes = await client.submitOrder(
      submissionFromStoredQuote(storedResponse, storedRequest, {
        userSignature: input.userSignature,
        evmPermitTypedData: input.evmPermitTypedData,
        evmPermitSignature: input.evmPermitSignature,
        attachedBracket: input.attachedBracket as Record<string, unknown> | undefined,
      }),
    );
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err) {
      const anyErr = err as { code?: string; statusCode?: number; details?: unknown };
      const uncertain = anyErr.code === "TIMEOUT" || anyErr.statusCode === 504;
      throw new OrderServiceError(
        uncertain ? "SUBMISSION_UNCERTAIN" : (anyErr.code ?? "SUBMISSION_FAILED"),
        uncertain
          ? "Flash did not confirm whether the order was accepted. It was not submitted again. Refresh your orders before trying a new quote."
          : err.message,
        anyErr.statusCode ?? 502,
        anyErr.details,
      );
    }
    throw new OrderServiceError(
      "SUBMISSION_FAILED",
      err instanceof Error ? err.message : "Failed to submit order to Definitive Flash",
      502,
    );
  }

  // Persist order record in PostgreSQL
  const inputTokenAddress = storedRequest.side === "buy" ? storedRequest.contraAsset : storedRequest.targetAsset;
  const outputTokenAddress = storedRequest.side === "buy" ? storedRequest.targetAsset : storedRequest.contraAsset;

  const [savedOrder] = await db
    .insert(orders)
    .values({
      userId,
      signalId: stored.signalId ?? input.signalId ?? null,
      strategyId: input.strategyId ?? null,
      provider: "DEFINITIVE",
      providerOrderId: flashRes.orderId,
      chainId: storedRequest.targetChain,
      walletAddress: normUserAddress,
      inputToken: inputTokenAddress,
      outputToken: outputTokenAddress,
      inputAmount: storedRequest.qty,
      orderType: dbOrderType(storedRequest.orderType),
      status: flashRes.status || "SUBMITTED",
      flashQuoteId: stored.flashQuoteId,
      orderParameters: {
        side: storedRequest.side,
        orderType: storedRequest.orderType,
        limitNotionalPrice: storedRequest.limitNotionalPrice,
        triggers: storedRequest.triggers,
        attachedBracket: storedRequest.attachedBracket,
        signalId: stored.signalId,
      },
      rawStatus: flashRes.raw?.status ? String(flashRes.raw.status) : null,
    })
    .returning();
  await markQuoteConsumed(stored.id);

  if (!savedOrder) {
    throw new OrderServiceError("DATABASE_ERROR", "Failed to persist order record.", 500);
  }

  return {
    order: savedOrder,
    flashResponse: flashRes,
  };
}

/**
 * Fetch an order by ID, poll Definitive Flash for execution updates, and synchronize on-chain tx hash.
 */
export async function getOrderWithStatusSync(
  userId: string,
  orderId: string,
  isAdmin: boolean = false,
): Promise<{ order: OrderSelect; flashStatus?: FlashOrderStatusResponse }> {
  const [found] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!found) {
    throw new OrderServiceError("ORDER_NOT_FOUND", `Order '${orderId}' was not found.`, 404);
  }

  if (!isAdmin && found.userId !== userId) {
    throw new OrderServiceError(
      "FORBIDDEN",
      "You do not have permission to view this order.",
      403,
    );
  }

  let flashStatus: FlashOrderStatusResponse | undefined;

  // If order is active/submitted and has a providerOrderId, poll Flash for latest execution status & txHash
  const isTerminal = ["FILLED", "CANCELLED", "FAILED"].includes(found.status);
  if (!isTerminal && found.providerOrderId && isDefinitiveConfigured()) {
    try {
      const client = getDefinitiveClient();
      flashStatus = await client.getOrderStatus(found.providerOrderId);
      const updated = await applyFlashStatus(found, flashStatus);
      return { order: updated, flashStatus };
    } catch {
      // Non-fatal if Flash status check fails temporarily; return persisted database record
    }
  }

  return { order: found, flashStatus };
}

/**
 * List all orders for the authenticated user, ordered from newest to oldest.
 */
export async function listUserOrders(userId: string): Promise<OrderSelect[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function portfolioSummary(userId: string) {
  return portfolioForUser(userId);
}

export async function cancelUserOrder(
  userId: string,
  orderId: string,
  walletAddress: string,
  cancelMessage: string,
  userSignature: string,
) {
  const [found] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!found) {
    throw new OrderServiceError("ORDER_NOT_FOUND", "Order was not found.", 404);
  }
  if (found.userId !== userId || found.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new OrderServiceError("FORBIDDEN", "This order belongs to a different wallet.", 403);
  }
  if (!found.providerOrderId) {
    throw new OrderServiceError("NOT_CANCELLABLE", "This order has no Flash identifier yet.", 409);
  }
  const expected = expectedCancelMessage(found.providerOrderId);
  if (cancelMessage !== expected) {
    throw new OrderServiceError(
      "INVALID_CANCEL_MESSAGE",
      "The cancellation message does not match the Flash order.",
      400,
    );
  }
  const client = getDefinitiveClient();
  try {
    await client.cancelOrder(found.providerOrderId, { cancelMessage, userSignature });
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err) {
      const anyErr = err as { code?: string; statusCode?: number };
      throw new OrderServiceError(
        anyErr.code ?? "CANCEL_FAILED",
        err.message,
        anyErr.statusCode ?? 502,
      );
    }
    throw new OrderServiceError("CANCEL_FAILED", "Flash did not accept the cancellation.", 502);
  }
  const flashStatus = await client.getOrderStatus(found.providerOrderId);
  const updated = await applyFlashStatus(
    { ...found, status: "PENDING_CANCELLATION" },
    flashStatus,
  );
  return { order: updated, flashStatus };
}

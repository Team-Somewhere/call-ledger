import { desc, eq } from "drizzle-orm";
import { db, orders, type OrderSelect } from "@call-ledger/database";
import {
  createDefinitiveClient,
  type FlashOrderStatusResponse,
  type FlashQuoteResponse,
  type FlashSubmitOrderResponse,
  type IDefinitiveClient,
} from "@call-ledger/definitive";
import {
  type FlashQuoteRequestInput,
  type FlashSubmitOrderRequestOutput,
  type OrderType,
} from "@call-ledger/shared";
import { env } from "../config/env";

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
 * Singleton Definitive Flash client configured with server-side environment variables.
 */
let definitiveClientInstance: IDefinitiveClient | null = null;

export function getDefinitiveClient(): IDefinitiveClient {
  if (!definitiveClientInstance) {
    definitiveClientInstance = createDefinitiveClient({
      apiKey: env.DEFINITIVE_API_KEY,
      baseUrl: env.DEFINITIVE_BASE_URL,
    });
  }
  return definitiveClientInstance;
}

/** Set a mock/custom client for unit tests. */
export function setDefinitiveClientForTesting(client: IDefinitiveClient | null): void {
  definitiveClientInstance = client;
}

export function isDefinitiveConfigured(): boolean {
  return getDefinitiveClient().isConfigured();
}

/**
 * Request a live price quote and EIP-712 signable payload from Definitive Flash.
 * Security: Validates that the requested funderAddress matches the authenticated user's wallet.
 */
export async function requestFlashQuote(
  userAddress: string,
  input: FlashQuoteRequestInput,
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
      expireTime: input.expireTime,
      flashIntegratorFeeBps: feeBps,
    });

    return quote;
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err) {
      const anyErr = err as { code?: string; statusCode?: number; details?: unknown };
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

  const client = getDefinitiveClient();
  const feeBps = input.flashIntegratorFeeBps ?? env.DEFINITIVE_INTEGRATOR_FEE_BPS;

  let flashRes: FlashSubmitOrderResponse;
  try {
    flashRes = await client.submitOrder({
      targetChain: input.targetChain,
      contraChain: input.contraChain,
      targetAsset: input.targetAsset,
      contraAsset: input.contraAsset,
      side: input.side,
      qty: input.qty,
      orderType: input.orderType,
      funderAddress: normFunder,
      quoteId: input.quoteId,
      userSignature: input.userSignature,
      evmOrderTypedData: input.evmOrderTypedData,
      limitNotionalPrice: input.limitNotionalPrice,
      expireTime: input.expireTime,
      flashIntegratorFeeBps: feeBps,
    });
  } catch (err: unknown) {
    if (err instanceof Error && "statusCode" in err) {
      const anyErr = err as { code?: string; statusCode?: number; details?: unknown };
      throw new OrderServiceError(
        anyErr.code ?? "SUBMISSION_FAILED",
        err.message,
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
  const inputTokenAddress = input.side === "buy" ? input.contraAsset : input.targetAsset;
  const outputTokenAddress = input.side === "buy" ? input.targetAsset : input.contraAsset;

  const [savedOrder] = await db
    .insert(orders)
    .values({
      userId,
      signalId: input.signalId ?? null,
      strategyId: input.strategyId ?? null,
      provider: "DEFINITIVE",
      providerOrderId: flashRes.orderId,
      chainId: input.targetChain,
      walletAddress: normUserAddress,
      inputToken: inputTokenAddress,
      outputToken: outputTokenAddress,
      inputAmount: input.qty,
      orderType: (input.orderType.toUpperCase() as OrderType) || "LIMIT",
      status: flashRes.status || "SUBMITTED",
    })
    .returning();

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

      const updates: Partial<typeof orders.$inferInsert> = {};
      if (flashStatus.status && flashStatus.status !== found.status) {
        updates.status = flashStatus.status;
      }
      if (flashStatus.transactionHash && flashStatus.transactionHash !== found.transactionHash) {
        updates.transactionHash = flashStatus.transactionHash;
      }
      if (flashStatus.executedQty && flashStatus.executedQty !== found.outputAmount) {
        updates.outputAmount = flashStatus.executedQty;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        const [updated] = await db
          .update(orders)
          .set(updates)
          .where(eq(orders.id, orderId))
          .returning();
        if (updated) {
          return { order: updated, flashStatus };
        }
      }
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

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  flashQuotes,
  orderFills,
  orders,
  positions,
  type OrderSelect,
} from "@call-ledger/database";
import {
  applyFill,
  fillKey,
  flashCancelMessage,
  type FlashOrderFill,
  type FlashOrderStatusResponse,
  type FlashQuoteResponse,
  type FlashSubmitOrderResponse,
} from "@call-ledger/definitive";
import type { FlashQuoteRequestInput, OrderType } from "@call-ledger/shared";
import { getDefinitiveClient } from "./definitive-client";

const OPEN_STATUSES = [
  "SUBMITTED",
  "PENDING",
  "PARTIALLY_FILLED",
  "PENDING_CANCELLATION",
];

export function dbOrderType(orderType: string): OrderType {
  switch (orderType) {
    case "market":
      return "MARKET";
    case "twap":
      return "TWAP";
    case "stop":
      return "STOP";
    case "stop-loss":
      return "STOP_LOSS";
    case "take-profit":
      return "TAKE_PROFIT";
    case "bracket":
      return "BRACKET";
    default:
      return "LIMIT";
  }
}

export async function persistFlashQuote(input: {
  userId: string;
  walletAddress: string;
  request: FlashQuoteRequestInput;
  quote: FlashQuoteResponse;
}): Promise<void> {
  const expiresAt = input.quote.validUntil
    ? new Date(input.quote.validUntil)
    : input.request.orderType === "market" || !input.request.orderType
      ? new Date(Date.now() + 4 * 60 * 1000)
      : input.request.expireTime
        ? new Date(input.request.expireTime)
        : null;

  await db
    .insert(flashQuotes)
    .values({
      userId: input.userId,
      walletAddress: input.walletAddress.toLowerCase(),
      signalId: input.request.signalId ?? null,
      chain: input.request.targetChain,
      flashQuoteId: input.quote.quoteId,
      orderType: input.quote.orderType || input.request.orderType,
      side: input.request.side,
      targetAsset: input.request.targetAsset,
      contraAsset: input.request.contraAsset,
      qty: input.request.qty,
      quoteRequest: input.request,
      quoteResponse: input.quote,
      status: "ACTIVE",
      expiresAt,
    })
    .onConflictDoNothing();
}

export async function findStoredQuote(walletAddress: string, quoteId: string) {
  const [row] = await db
    .select()
    .from(flashQuotes)
    .where(
      and(
        eq(flashQuotes.walletAddress, walletAddress.toLowerCase()),
        eq(flashQuotes.flashQuoteId, quoteId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function assertQuoteUsable(row: {
  status: string;
  expiresAt: Date | null;
}): void {
  if (row.status === "CONSUMED") {
    throw new Error("QUOTE_ALREADY_USED");
  }
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw new Error("QUOTE_EXPIRED");
  }
}

function typedDataEcho(quote: FlashQuoteResponse): string | undefined {
  const raw = quote.evm?.orderTypedDataRaw;
  if (typeof raw === "string" && raw.length > 0) return raw;
  const typed = quote.evm?.orderTypedData;
  if (typeof typed === "string") return typed;
  if (typed && typeof typed === "object") return JSON.stringify(typed);
  return undefined;
}

export function submissionFromStoredQuote(
  quote: FlashQuoteResponse,
  request: FlashQuoteRequestInput,
  signature: {
    userSignature: string;
    evmPermitTypedData?: string;
    evmPermitSignature?: string;
    attachedBracket?: Record<string, unknown>;
  },
) {
  return {
    targetChain: request.targetChain,
    contraChain: request.contraChain,
    targetAsset: quote.targetAsset || request.targetAsset,
    contraAsset: quote.contraAsset || request.contraAsset,
    side: request.side,
    qty: request.qty,
    orderType: (quote.orderType || request.orderType) as FlashQuoteRequestInput["orderType"],
    funderAddress: request.funderAddress,
    quoteId: quote.quoteId,
    userSignature: signature.userSignature,
    evmOrderTypedData: typedDataEcho(quote),
    evmPermitTypedData:
      signature.evmPermitTypedData || quote.evm?.permitTypedData || undefined,
    evmPermitSignature: signature.evmPermitSignature,
    limitNotionalPrice: request.limitNotionalPrice,
    limitCrossPrice: request.limitCrossPrice,
    maxSlippage: request.maxSlippage,
    maxPriceImpact: request.maxPriceImpact,
    expireTime: request.expireTime,
    flashIntegratorFeeBps: request.flashIntegratorFeeBps,
    startTime: request.startTime,
    twapBucketCount: request.twapBucketCount,
    triggers: request.triggers,
    bridgeQuoteId: quote.bridgeQuoteId || undefined,
    attachedBracket: signature.attachedBracket,
  };
}

export async function markQuoteConsumed(id: string): Promise<void> {
  await db
    .update(flashQuotes)
    .set({ status: "CONSUMED" })
    .where(eq(flashQuotes.id, id));
}

export function expectedCancelMessage(flashOrderId: string): string {
  return flashCancelMessage(flashOrderId);
}

export async function applyFlashStatus(
  order: OrderSelect,
  flashStatus: FlashOrderStatusResponse,
): Promise<OrderSelect> {
  const updates: Partial<typeof orders.$inferInsert> = {};
  if (flashStatus.status && flashStatus.status !== order.status) {
    updates.status = flashStatus.status;
  }
  if (flashStatus.rawStatus && flashStatus.rawStatus !== order.rawStatus) {
    updates.rawStatus = flashStatus.rawStatus;
  }
  if (flashStatus.transactionHash && flashStatus.transactionHash !== order.transactionHash) {
    updates.transactionHash = flashStatus.transactionHash;
  }
  if (flashStatus.closeReason) updates.closeReason = flashStatus.closeReason;
  const output =
    flashStatus.filled?.targetAmount || flashStatus.executedQty || null;
  if (output && output !== order.outputAmount) updates.outputAmount = output;

  let current = order;
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, order.id))
      .returning();
    if (updated) current = updated;
  }

  for (const fill of flashStatus.fills ?? []) {
    await persistFill(current, fill);
  }
  return current;
}

async function persistFill(order: OrderSelect, fill: FlashOrderFill): Promise<void> {
  const targetAmount = String(fill.targetAmount ?? fill.amount ?? "0");
  const contraAmount = String(fill.contraAmount ?? "0");
  const key = fillKey({
    flashOrderId: order.providerOrderId || fill.rootOrderId || order.id,
    transactionId: fill.transactionId || fill.txHash,
    filledAt: fill.filledAt || fill.timestamp,
    targetAmount,
  });
  const side = order.inputToken.toLowerCase() === order.outputToken.toLowerCase()
    ? "buy"
    : inferSide(order);

  const inserted = await db
    .insert(orderFills)
    .values({
      orderId: order.id,
      flashOrderId: order.providerOrderId || key,
      fillKey: key,
      transactionHash: fill.transactionId || fill.txHash || null,
      chain: String(order.chainId),
      inputAmount: side === "buy" ? contraAmount : targetAmount,
      outputAmount: side === "buy" ? targetAmount : contraAmount,
      executionPrice: fill.fillPrice || fill.price || null,
      fees: {
        feeAmount: fill.feeAmount ?? null,
        feeNotional: fill.feeNotional ?? null,
        integratorFeeNotional: fill.integratorFeeNotional ?? null,
      },
      fillTimestamp: fill.filledAt ? new Date(fill.filledAt) : null,
      status: fill.status ?? null,
      raw: fill,
    })
    .onConflictDoNothing()
    .returning({ id: orderFills.id });

  if (inserted.length === 0) return;

  await upsertPosition(order, {
    side,
    targetAmount,
    contraAmount,
    fillPrice: fill.fillPrice || fill.price,
  });
}

function inferSide(order: OrderSelect): "buy" | "sell" {
  const params = order.orderParameters as { side?: string } | null;
  return params?.side === "sell" ? "sell" : "buy";
}

async function upsertPosition(
  order: OrderSelect,
  fill: { side: "buy" | "sell"; targetAmount: string; contraAmount: string; fillPrice?: string },
): Promise<void> {
  const asset = fill.side === "buy" ? order.outputToken : order.inputToken;
  const quoteAsset = fill.side === "buy" ? order.inputToken : order.outputToken;
  const [existing] = await db
    .select()
    .from(positions)
    .where(
      and(
        eq(positions.userId, order.userId),
        eq(positions.chainId, order.chainId),
        eq(positions.assetAddress, asset),
        eq(positions.status, "OPEN"),
      ),
    )
    .limit(1);

  const next = applyFill(
    existing
      ? {
          quantity: existing.totalFilledQuantity || existing.quantity,
          investedAmount: existing.investedAmount || "0",
          averageEntryPrice: existing.averageEntryPrice,
          realizedPnl: existing.realizedPnl || "0",
          remainingQuantity: existing.remainingQuantity || existing.quantity,
          totalFilledQuantity: existing.totalFilledQuantity || existing.quantity,
          status: existing.status === "CLOSED" ? "CLOSED" : "OPEN",
        }
      : null,
    fill,
  );

  if (!existing) {
    await db.insert(positions).values({
      userId: order.userId,
      orderId: order.id,
      assetAddress: asset,
      chainId: order.chainId,
      walletAddress: order.walletAddress,
      quoteAsset,
      quantity: next.remainingQuantity,
      averageEntryPrice: next.averageEntryPrice || "0",
      realizedPnl: next.realizedPnl,
      investedAmount: next.investedAmount,
      remainingQuantity: next.remainingQuantity,
      totalFilledQuantity: next.totalFilledQuantity,
      status: next.status,
    });
    return;
  }

  await db
    .update(positions)
    .set({
      quantity: next.remainingQuantity,
      averageEntryPrice: next.averageEntryPrice || existing.averageEntryPrice,
      realizedPnl: next.realizedPnl,
      investedAmount: next.investedAmount,
      remainingQuantity: next.remainingQuantity,
      totalFilledQuantity: next.totalFilledQuantity,
      status: next.status,
      closedAt: next.status === "CLOSED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(positions.id, existing.id));
}

export async function reconcileOpenOrders(limit = 25): Promise<number> {
  const client = getDefinitiveClient();
  if (!client.isConfigured()) return 0;
  const rows = await db
    .select()
    .from(orders)
    .where(inArray(orders.status, OPEN_STATUSES))
    .orderBy(desc(orders.updatedAt))
    .limit(limit);

  let updated = 0;
  for (const row of rows) {
    if (!row.providerOrderId) continue;
    try {
      const status = await client.getOrderStatus(row.providerOrderId);
      await applyFlashStatus(row, status);
      updated += 1;
    } catch (error) {
      console.error(
        "[flash] reconcile failed",
        row.id,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return updated;
}

export async function portfolioForUser(userId: string) {
  const [orderRows, positionRows, fillRows] = await Promise.all([
    db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)),
    db.select().from(positions).where(eq(positions.userId, userId)).orderBy(desc(positions.updatedAt)),
    db
      .select()
      .from(orderFills)
      .innerJoin(orders, eq(orderFills.orderId, orders.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(orderFills.fillTimestamp)),
  ]);

  const completed = orderRows.filter((order) => order.status === "FILLED");
  const realized = positionRows.reduce(
    (sum, position) => sum + Number(position.realizedPnl || 0),
    0,
  );
  const unrealized = positionRows.reduce(
    (sum, position) => sum + Number(position.unrealizedPnl || 0),
    0,
  );
  const invested = positionRows.reduce(
    (sum, position) => sum + Number(position.investedAmount || 0),
    0,
  );
  const wins = positionRows.filter(
    (position) => position.status === "CLOSED" && Number(position.realizedPnl || 0) > 0,
  ).length;
  const closed = positionRows.filter((position) => position.status === "CLOSED").length;

  return {
    orders: orderRows,
    positions: positionRows,
    fills: fillRows.map((row) => row.order_fills),
    performance: {
      investedCapital: invested,
      realizedPnl: realized,
      unrealizedPnl: unrealized,
      totalPnl: realized + unrealized,
      completedTrades: completed.length,
      closedPositions: closed,
      winRate: closed > 0 ? wins / closed : null,
    },
  };
}

export type StoredSubmission = FlashSubmitOrderResponse;

/**
 * Pure fill and position math. Re-running the same fill key must not change a position.
 */

export interface FillAmounts {
  side: "buy" | "sell";
  targetAmount: string;
  contraAmount: string;
  fillPrice?: string | null;
}

export interface PositionSnapshot {
  quantity: string;
  investedAmount: string;
  averageEntryPrice: string;
  realizedPnl: string;
  remainingQuantity: string;
  totalFilledQuantity: string;
  status: "OPEN" | "CLOSED";
}

export function fillKey(parts: {
  flashOrderId: string;
  transactionId?: string | null;
  filledAt?: string | null;
  targetAmount?: string | null;
}): string {
  return [
    parts.flashOrderId,
    parts.transactionId || "no-tx",
    parts.filledAt || "no-time",
    parts.targetAmount || "0",
  ].join(":");
}

function num(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dec(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(12).replace(/\.?0+$/, "") || "0";
}

export function applyFill(
  position: PositionSnapshot | null,
  fill: FillAmounts,
): PositionSnapshot {
  const target = num(fill.targetAmount);
  const contra = num(fill.contraAmount);
  const current = position ?? {
    quantity: "0",
    investedAmount: "0",
    averageEntryPrice: "0",
    realizedPnl: "0",
    remainingQuantity: "0",
    totalFilledQuantity: "0",
    status: "OPEN" as const,
  };

  if (fill.side === "buy") {
    const quantity = num(current.remainingQuantity) + target;
    const invested = num(current.investedAmount) + contra;
    const average = quantity > 0 ? invested / quantity : 0;
    return {
      quantity: dec(num(current.quantity) + target),
      investedAmount: dec(invested),
      averageEntryPrice: dec(average),
      realizedPnl: current.realizedPnl,
      remainingQuantity: dec(quantity),
      totalFilledQuantity: dec(num(current.totalFilledQuantity) + target),
      status: "OPEN",
    };
  }

  const remaining = Math.max(0, num(current.remainingQuantity) - target);
  const average = num(current.averageEntryPrice);
  const cost = average * target;
  const realized = num(current.realizedPnl) + (contra - cost);
  const invested = Math.max(0, num(current.investedAmount) - cost);
  return {
    quantity: current.quantity,
    investedAmount: dec(invested),
    averageEntryPrice: current.averageEntryPrice,
    realizedPnl: dec(realized),
    remainingQuantity: dec(remaining),
    totalFilledQuantity: dec(num(current.totalFilledQuantity) + target),
    status: remaining <= 0.000000000001 ? "CLOSED" : "OPEN",
  };
}

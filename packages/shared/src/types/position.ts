import type { PositionStatus } from "../constants/statuses";

export interface Position {
  id: string;
  userId: string;
  orderId: string | null;
  assetAddress: string;
  chainId: number | string;
  quantity: string;
  averageEntryPrice: string;
  currentPrice: string | null;
  unrealizedPnl: string | null;
  realizedPnl: string | null;
  status: PositionStatus;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

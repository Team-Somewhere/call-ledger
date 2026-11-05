import type { ExecutionMode, StrategyStatus } from "../constants/statuses";

export interface Strategy {
  id: string;
  userId: string;
  creatorId: string;
  name: string;
  description: string | null;
  status: StrategyStatus;
  executionMode: ExecutionMode;
  maxTradeAmount: string; // Safe representation for financial amount
  maxDailyTrades: number;
  minCreatorWinRate: string | null;
  allowedDirections: string;
  entryOrderType: string;
  stopLossPercentage: string | null;
  takeProfitPercentage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStrategyInput = {
  creatorId: string;
  name: string;
  description?: string | null;
  status?: StrategyStatus;
  executionMode?: ExecutionMode;
  maxTradeAmount: string;
  maxDailyTrades?: number;
  minCreatorWinRate?: string | null;
  allowedDirections?: string;
  entryOrderType?: string;
  stopLossPercentage?: string | null;
  takeProfitPercentage?: string | null;
};

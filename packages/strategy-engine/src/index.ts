import type { CreatorMetrics, Signal, Strategy } from "@call-ledger/shared";

/**
 * Context input for evaluating a strategy against an incoming trade signal.
 */
export interface StrategyEvaluationContext {
  strategy: Strategy;
  signal: Signal;
  creatorMetrics?: CreatorMetrics | null;
  dailyTradesExecutedSoFar: number;
  currentPortfolioValueUsd?: string;
}

/**
 * Reason for rejecting signal execution.
 */
export type StrategyRejectionReason =
  | "STRATEGY_INACTIVE"
  | "CREATOR_MISMATCH"
  | "DIRECTION_NOT_ALLOWED"
  | "DAILY_TRADE_LIMIT_EXCEEDED"
  | "WIN_RATE_BELOW_THRESHOLD"
  | "SIGNAL_NOT_TRADEABLE"
  | "INSUFFICIENT_LIQUIDITY"
  | "RISK_LIMIT_EXCEEDED";

/**
 * Result of evaluating a trading signal against a user strategy.
 */
export interface StrategyEvaluationResult {
  isEligible: boolean;
  strategyId: string;
  signalId: string;
  rejectionReason?: StrategyRejectionReason;
  recommendedTradeAmount?: string;
  stopLossPercentage?: string;
  takeProfitPercentage?: string;
  notes?: string;
}

/**
 * Strategy engine interface contract.
 * Implementation will be completed in Phase 4.
 */
export interface IStrategyEngine {
  evaluateSignal(
    context: StrategyEvaluationContext,
  ): Promise<StrategyEvaluationResult>;
  validateConstraints(strategy: Strategy): { valid: boolean; errors: string[] };
}

/**
 * Baseline rules validator for strategy configurations.
 */
export function validateStrategyConstraints(strategy: Partial<Strategy>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (strategy.maxTradeAmount && parseFloat(strategy.maxTradeAmount) <= 0) {
    errors.push("maxTradeAmount must be greater than 0");
  }

  if (strategy.maxDailyTrades !== undefined && strategy.maxDailyTrades < 1) {
    errors.push("maxDailyTrades must be at least 1");
  }

  if (strategy.minCreatorWinRate) {
    const winRate = parseFloat(strategy.minCreatorWinRate);
    if (winRate < 0 || winRate > 100) {
      errors.push("minCreatorWinRate must be between 0 and 100");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Factory placeholder to instantiate the Strategy Engine.
 */
export function createStrategyEngine(): IStrategyEngine {
  return {
    validateConstraints(strategy: Strategy) {
      return validateStrategyConstraints(strategy);
    },
    async evaluateSignal(
      context: StrategyEvaluationContext,
    ): Promise<StrategyEvaluationResult> {
      const { strategy, signal, creatorMetrics, dailyTradesExecutedSoFar } =
        context;

      if (strategy.status !== "ACTIVE") {
        return {
          isEligible: false,
          strategyId: strategy.id,
          signalId: signal.id,
          rejectionReason: "STRATEGY_INACTIVE",
        };
      }

      if (strategy.creatorId !== signal.creatorId) {
        return {
          isEligible: false,
          strategyId: strategy.id,
          signalId: signal.id,
          rejectionReason: "CREATOR_MISMATCH",
        };
      }

      if (dailyTradesExecutedSoFar >= strategy.maxDailyTrades) {
        return {
          isEligible: false,
          strategyId: strategy.id,
          signalId: signal.id,
          rejectionReason: "DAILY_TRADE_LIMIT_EXCEEDED",
        };
      }

      if (
        strategy.allowedDirections !== "BOTH" &&
        strategy.allowedDirections !== signal.direction
      ) {
        return {
          isEligible: false,
          strategyId: strategy.id,
          signalId: signal.id,
          rejectionReason: "DIRECTION_NOT_ALLOWED",
        };
      }

      if (strategy.minCreatorWinRate && creatorMetrics) {
        const minWinRate = parseFloat(strategy.minCreatorWinRate);
        const actualWinRate = parseFloat(creatorMetrics.winRate);
        if (actualWinRate < minWinRate) {
          return {
            isEligible: false,
            strategyId: strategy.id,
            signalId: signal.id,
            rejectionReason: "WIN_RATE_BELOW_THRESHOLD",
          };
        }
      }

      return {
        isEligible: true,
        strategyId: strategy.id,
        signalId: signal.id,
        recommendedTradeAmount: strategy.maxTradeAmount,
        stopLossPercentage: strategy.stopLossPercentage ?? undefined,
        takeProfitPercentage: strategy.takeProfitPercentage ?? undefined,
      };
    },
  };
}

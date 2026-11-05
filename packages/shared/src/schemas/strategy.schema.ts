import { z } from "zod";
import { EXECUTION_MODES, STRATEGY_STATUSES } from "../constants/statuses";

export const strategyStatusSchema = z.enum(STRATEGY_STATUSES);
export const executionModeSchema = z.enum(EXECUTION_MODES);

export const createStrategySchema = z.object({
  creatorId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  status: strategyStatusSchema.default("ACTIVE"),
  executionMode: executionModeSchema.default("MANUAL"),
  maxTradeAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid financial amount"),
  maxDailyTrades: z.number().int().positive().default(5),
  minCreatorWinRate: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional()
    .nullable(),
  allowedDirections: z.enum(["BUY", "SELL", "BOTH"]).default("BOTH"),
  entryOrderType: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  stopLossPercentage: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional()
    .nullable(),
  takeProfitPercentage: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional()
    .nullable(),
});

export const updateStrategySchema = createStrategySchema.partial();

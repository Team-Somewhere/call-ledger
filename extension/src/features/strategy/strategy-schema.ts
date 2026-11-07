import { z } from "zod";

/** Zod schema for a strategy draft. Used to validate every analysis result before the UI sees it. */

const known = <T extends z.ZodTypeAny>(value: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("known"), value, source: z.string().max(400) }),
    z.object({ status: z.literal("unknown"), reason: z.string().max(200) }),
  ]);

export const classificationSchema = z.enum([
  "trading_instruction",
  "incomplete_instruction",
  "opinion",
  "hypothetical",
  "historical_report",
  "joke_or_sarcasm",
  "discussion",
  "not_trading",
]);

export const strategyDraftSchema = z.object({
  classification: classificationSchema,
  confidence: z.number().min(0).max(1),
  assets: z.array(known(z.string().min(1).max(12))).max(5),
  chain: known(z.enum(["ethereum", "base", "solana", "arbitrum", "bsc", "polygon", "optimism"])),
  contractAddress: known(z.string().max(66)),
  direction: known(z.enum(["long", "sell", "short", "unspecified"])),
  entryPrice: known(z.number().positive().finite()),
  entryHigh: known(z.number().positive().finite()),
  entryCondition: known(z.string().max(200)),
  stopLoss: known(z.number().positive().finite()),
  takeProfit: known(z.number().positive().finite()),
  positionSize: known(
    z.object({
      amount: z.number().positive().finite(),
      unit: z.enum(["usd", "token", "percent"]),
    }),
  ),
  leverage: known(z.number().positive().max(125).finite()),
  orderType: known(z.enum(["market", "limit", "unspecified"])),
  timeframe: known(z.string().max(60)),
  dca: known(z.string().max(200)),
  executionConditions: z.array(z.string().max(200)).max(10),
  ambiguities: z.array(z.string().max(200)).max(10),
  warnings: z.array(z.string().max(200)).max(10),
});

export type StrategyDraftParsed = z.infer<typeof strategyDraftSchema>;

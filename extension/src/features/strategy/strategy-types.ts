/**
 * Strategy model. Every extracted value carries the exact source text it came
 * from, and missing values are explicit `unknown` rather than invented.
 */

export type Field<T> =
  | { status: "known"; value: T; source: string }
  | { status: "unknown"; reason: string };

export type Direction = "long" | "sell" | "short" | "unspecified";
export type OrderType = "market" | "limit" | "unspecified";
export type Classification =
  | "trading_instruction"
  | "incomplete_instruction"
  | "opinion"
  | "hypothetical"
  | "historical_report"
  | "joke_or_sarcasm"
  | "discussion"
  | "not_trading";

export interface StrategyDraft {
  classification: Classification;
  /** 0..1, from deterministic rule scores. Not a probability of profit. */
  confidence: number;
  assets: Field<string>[];
  chain: Field<string>;
  contractAddress: Field<string>;
  direction: Field<Direction>;
  entryPrice: Field<number>;
  /** Upper bound when the post states an entry range. Unknown for a single price. */
  entryHigh: Field<number>;
  entryCondition: Field<string>;
  stopLoss: Field<number>;
  takeProfit: Field<number>;
  positionSize: Field<{ amount: number; unit: "usd" | "token" | "percent" }>;
  leverage: Field<number>;
  orderType: Field<OrderType>;
  timeframe: Field<string>;
  dca: Field<string>;
  executionConditions: string[];
  ambiguities: string[];
  warnings: string[];
}

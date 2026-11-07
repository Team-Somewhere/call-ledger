export const CREATOR_STATUSES = [
  "DISCOVERED",
  "PENDING_VERIFICATION",
  "QUALIFIED",
  "MONITORING",
  "INACTIVE",
  "REJECTED",
  "SUSPENDED",
] as const;
export type CreatorStatus = (typeof CREATOR_STATUSES)[number];

export const STRATEGY_STATUSES = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

export const EXECUTION_MODES = ["MANUAL", "AUTOMATED"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const SIGNAL_DIRECTIONS = ["BUY", "SELL"] as const;
export type SignalDirection = (typeof SIGNAL_DIRECTIONS)[number];

export const SIGNAL_CLASSIFICATIONS = [
  "TRADE_SIGNAL",
  "MARKET_COMMENTARY",
  "TRADE_UPDATE",
  "NEWS",
  "IRRELEVANT",
] as const;
export type SignalClassification = (typeof SIGNAL_CLASSIFICATIONS)[number];

export const SIGNAL_STATUSES = [
  "ACTIVE",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "INVALID",
  "EXPIRED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_OUTCOMES = [
  "WIN",
  "LOSS",
  "BREAKEVEN",
  "PENDING",
] as const;
export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number];

export const ORDER_PROVIDERS = ["DEFINITIVE"] as const;
export type OrderProvider = (typeof ORDER_PROVIDERS)[number];

export const ORDER_STATUSES = [
  "PENDING_SIGNATURE",
  "AWAITING_SETUP",
  "SUBMITTED",
  "PENDING",
  "PARTIALLY_FILLED",
  "FILLED",
  "PENDING_CANCELLATION",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = [
  "MARKET",
  "LIMIT",
  "TWAP",
  "STOP",
  "STOP_LOSS",
  "TAKE_PROFIT",
  "BRACKET",
] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/** Flash order-type enum. DCA is not a current Flash order type. */
export const FLASH_ORDER_TYPES = [
  "market",
  "limit",
  "twap",
  "stop",
  "stop-loss",
  "take-profit",
  "bracket",
] as const;
export type FlashOrderTypeName = (typeof FLASH_ORDER_TYPES)[number];

export const POSITION_STATUSES = ["OPEN", "CLOSED"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export const ARKIV_RECORD_TYPES = [
  "CREATOR_PROFILE",
  "SIGNAL_ATTESTATION",
  "PERFORMANCE_SNAPSHOT",
] as const;
export type ArkivRecordType = (typeof ARKIV_RECORD_TYPES)[number];

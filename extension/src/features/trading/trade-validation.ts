/**
 * Pre-signing checks. Every condition here must pass before the wallet is
 * asked to sign. These are pure functions so they can be unit tested.
 */

export interface QuoteForValidation {
  quoteId: string;
  chain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  /** ISO timestamp after which the quote must not be used. */
  expiresAt: string;
  estimatedPriceImpact: number | null;
}

export interface TradeIntent {
  chain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  /** Amount of the spent asset, as a decimal token quantity string. Never an INR figure. */
  qty: string;
  maxSlippage: number;
}

export type ValidationIssue =
  | { code: "QUOTE_EXPIRED"; message: string }
  | { code: "QUOTE_MISMATCH"; message: string }
  | { code: "INVALID_ADDRESS"; message: string }
  | { code: "INVALID_QTY"; message: string }
  | { code: "SLIPPAGE_TOO_HIGH"; message: string }
  | { code: "PRICE_IMPACT_HIGH"; message: string };

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Maximum price impact a user can approve without an extra warning. */
export const PRICE_IMPACT_WARN_PCT = 2;
/** Hard ceiling on slippage the UI will let a user set. */
export const MAX_SLIPPAGE_PCT = 5;

export function isValidAddress(chain: string, address: string): boolean {
  return chain === "solana" ? SOLANA_ADDRESS.test(address) : EVM_ADDRESS.test(address);
}

/** A quantity must be a positive decimal string with no scientific notation. */
export function isValidQty(qty: string): boolean {
  return /^(0|[1-9]\d*)(\.\d{1,18})?$/.test(qty) && Number(qty) > 0;
}

/** Validate a quote against the intent it was requested for. */
export function validateQuote(
  intent: TradeIntent,
  quote: QuoteForValidation,
  now: number = Date.now(),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!isValidQty(intent.qty)) {
    issues.push({ code: "INVALID_QTY", message: "The amount must be a positive token quantity." });
  }
  if (!isValidAddress(intent.chain, intent.targetAsset) || !isValidAddress(intent.chain, intent.contraAsset)) {
    issues.push({ code: "INVALID_ADDRESS", message: "Token address is not valid for this chain." });
  }
  if (intent.maxSlippage < 0 || intent.maxSlippage > MAX_SLIPPAGE_PCT) {
    issues.push({ code: "SLIPPAGE_TOO_HIGH", message: `Slippage must be between 0% and ${MAX_SLIPPAGE_PCT}%.` });
  }

  // The quote must describe exactly what the user approved.
  if (
    quote.chain !== intent.chain ||
    quote.targetAsset.toLowerCase() !== intent.targetAsset.toLowerCase() ||
    quote.contraAsset.toLowerCase() !== intent.contraAsset.toLowerCase() ||
    quote.side !== intent.side
  ) {
    issues.push({ code: "QUOTE_MISMATCH", message: "The quote does not match the trade you reviewed. Request a new quote." });
  }

  const expires = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) {
    issues.push({ code: "QUOTE_EXPIRED", message: "This quote has expired. Request a new quote before signing." });
  }

  if (quote.estimatedPriceImpact != null && quote.estimatedPriceImpact * 100 > PRICE_IMPACT_WARN_PCT) {
    issues.push({
      code: "PRICE_IMPACT_HIGH",
      message: `Estimated price impact is ${(quote.estimatedPriceImpact * 100).toFixed(2)}%. Review carefully.`,
    });
  }

  return issues;
}

/** A blocking issue prevents signing. Price impact is a warning the user can acknowledge. */
export function hasBlockingIssue(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.code !== "PRICE_IMPACT_HIGH");
}

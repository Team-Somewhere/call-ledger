import type { Classification, Direction, Field, OrderType, StrategyDraft } from "./strategy-types";
import { TRADE_SIGNAL_MIN_SCORE } from "../../config/constants";

/**
 * Deterministic strategy parser. It never invents values: a parameter is
 * `known` only when the post states it explicitly, and the matched source
 * snippet is kept so the user can verify it.
 *
 * It is intentionally conservative. Anything it cannot justify becomes
 * `unknown`, and posts without a concrete instruction are not treated as trades.
 */

const UNKNOWN = (reason: string) => ({ status: "unknown" as const, reason });
const KNOWN = <T>(value: T, source: string) => ({ status: "known" as const, value, source });

const KNOWN_SYMBOLS = new Set([
  "ETH", "BTC", "SOL", "USDC", "USDT", "WETH", "BNB", "AVAX", "ARB", "OP", "MATIC", "DAI", "PEPE", "DOGE", "XRP",
]);

const CHAIN_WORDS: Record<string, "ethereum" | "base" | "solana" | "arbitrum" | "bsc" | "polygon" | "optimism"> = {
  ethereum: "ethereum", eth: "ethereum", mainnet: "ethereum",
  base: "base",
  solana: "solana", sol: "solana",
  arbitrum: "arbitrum", arb: "arbitrum",
  bsc: "bsc", bnb: "bsc",
  polygon: "polygon", matic: "polygon",
  optimism: "optimism", op: "optimism",
};

const BUY_RE = /\b(buy|buying|long|accumulate|ape(?:\s+in)?|enter|entry|entries|re-?entry)\b/i;
const SELL_RE = /\b(sell|selling|short|exit|exits|close|closing|take\s+profit)\b/i;
const OPINION_RE = /\b(i think|imo|looks? (bullish|bearish|good|strong)|bullish on|bearish on|could|might|maybe|probably|in my opinion|thinking about)\b/i;
const HYPOTHETICAL_RE = /\b(if|hypothetically|for example|e\.g\.|example|imagine|what if)\b/i;
const HISTORICAL_RE = /\b(i (bought|sold|entered|exited)|we (bought|sold)|bought (at|for|in)|sold (at|for)|made \$?\d|up \d+%|pnl|closed (my|the) (trade|position))\b/i;
const JOKE_RE = /\b(lol|lmao|haha|joke|kidding|meme)\b|\/s\b|😂|🤣/i;

const STOP_RE = /\b(stop ?loss|stop|sl)\b\s*(?:at|@|:|to)?\s*\$?\s*([\d,]*\.?\d+)\s*(k)?/i;
const TARGET_RE = /\b(take ?profit|target|tp|tgt)\b\s*(?:at|@|:|to)?\s*\$?\s*([\d,]*\.?\d+)\s*(k)?/i;
const ENTRY_RE = /\b(?:entry|buy|enter|long|at|around|near)\b\s*(?:at|@|around|near|~)?\s*\$\s*([\d,]*\.?\d+)\s*(k)?|\b(?:entry|enter|buy|long)\b[^$\n]{0,20}?\b(?:at|@|around|near|~)\s*\$?\s*([\d,]*\.?\d+)\s*(k)?/i;
/** A dollar amount is only a position size when a size word is attached to it (e.g. "$5k worth", "$100 position"). */
const SIZE_USD_RE = /\$\s*([\d,]*\.?\d+)\s*(k)?\s*(?:worth|position|size|allocation|bag|in\b)/i;
const SIZE_PCT_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:my|the)\s+(?:portfolio|bag|stack|balance))?/i;
const LEVERAGE_RE = /\b(\d{1,3})\s*x\s*(?:leverage|lev|long|short)?\b/i;
const TIMEFRAME_RE = /\b(\d+\s*(?:m|min|minutes?|h|hr|hours?|d|days?|w|weeks?))\b|\b(scalp|swing|daily|weekly|intraday|long[- ]term)\b/i;
const DCA_RE = /\b(dca|dollar[- ]cost[- ]average|every (day|week|hour|\d+\s*\w+)|weekly buys?|daily buys?)\b/i;
const CONTRACT_RE = /\b0x[a-fA-F0-9]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const ASSET_RE = /(?:^|[\s(])(?:\$([A-Za-z]{2,10})|#([A-Za-z]{2,10})|\b([A-Z]{2,10})\b)(?=$|[\s.,!?)])/g;

function parseNumber(raw: string, k?: string): number {
  const n = Number(raw.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

function extractAssets(text: string): Field<string>[] {
  const found = new Set<string>();
  for (const m of text.matchAll(ASSET_RE)) {
    const sym = (m[1] ?? m[2] ?? m[3] ?? "").toUpperCase();
    // Plain uppercase words are only accepted when they are known symbols.
    // The $ and # forms are explicit, so they are accepted as written.
    if (!sym) continue;
    const explicit = Boolean(m[1] || m[2]);
    if (explicit || KNOWN_SYMBOLS.has(sym)) found.add(sym);
  }
  if (found.size === 0) return [{ status: "unknown", reason: "No asset symbol found" }];
  return [...found].map((s) => ({ status: "known" as const, value: s, source: s }));
}

function extractChain(text: string): Field<StrategyDraft["chain"] extends Field<infer V> ? V : never> {
  // 1) Explicit phrasing wins: "on Base", "on Solana", "Base chain", "network: arbitrum".
  const explicit = text.match(/\b(?:on|chain|network)\s*:?\s*([A-Za-z]+)\b|\b([A-Za-z]+)\s+(?:chain|network)\b/i);
  if (explicit) {
    const word = (explicit[1] ?? explicit[2]).toLowerCase();
    if (CHAIN_WORDS[word]) return KNOWN(CHAIN_WORDS[word], explicit[0]);
  }
  // 2) Otherwise only unambiguous full chain names count ("eth"/"sol" alone are too ambiguous).
  for (const word of ["solana", "arbitrum", "polygon", "optimism", "ethereum", "base", "bsc"]) {
    const hit = text.match(new RegExp(`\\b${word}\\b`, "i"));
    if (hit) return KNOWN(CHAIN_WORDS[word], hit[0]);
  }
  return UNKNOWN("No chain stated");
}

function classify(text: string, direction: Direction, hasPrice: boolean): { classification: Classification; reasons: string[] } {
  const reasons: string[] = [];
  if (JOKE_RE.test(text)) return { classification: "joke_or_sarcasm", reasons: ["Joke or sarcasm marker"] };
  if (HISTORICAL_RE.test(text)) return { classification: "historical_report", reasons: ["Describes a past trade"] };
  if (HYPOTHETICAL_RE.test(text) && !hasPrice) return { classification: "hypothetical", reasons: ["Hypothetical wording"] };
  if (OPINION_RE.test(text) && direction === "unspecified") return { classification: "opinion", reasons: ["Opinion without a trade action"] };
  if (direction === "unspecified") return { classification: "discussion", reasons: ["No trade action found"] };
  if (!hasPrice) return { classification: "incomplete_instruction", reasons: ["Trade action without a price or condition"] };
  if (OPINION_RE.test(text)) return { classification: "incomplete_instruction", reasons: ["Hedged wording reduces certainty"] };
  return { classification: "trading_instruction", reasons };
}

/** Parse a single X post. Pure function: no network, no DOM. */
export function parseStrategy(postText: string): StrategyDraft {
  const text = postText.trim();
  const warnings: string[] = [];
  const ambiguities: string[] = [];

  const direction: Field<Direction> = BUY_RE.test(text)
    ? KNOWN("long" as Direction, text.match(BUY_RE)![0])
    : SELL_RE.test(text)
      ? KNOWN("short" as Direction, text.match(SELL_RE)![0])
      : UNKNOWN("No buy or sell action stated");

  const stop = text.match(STOP_RE);
  const target = text.match(TARGET_RE);
  const entry = text.match(ENTRY_RE);
  const sizeUsd = text.match(SIZE_USD_RE);
  const sizePct = text.match(SIZE_PCT_RE);
  const lev = text.match(LEVERAGE_RE);
  const tf = text.match(TIMEFRAME_RE);
  const dca = text.match(DCA_RE);
  const contract = text.match(CONTRACT_RE);

  const entryPrice: Field<number> = entry
    ? KNOWN(parseNumber(entry[1] ?? entry[3], entry[2] ?? entry[4]), entry[0])
    : UNKNOWN("No entry price stated");
  const stopLoss: Field<number> = stop
    ? KNOWN(parseNumber(stop[2], stop[3]), stop[0])
    : UNKNOWN("No stop loss stated");
  const takeProfit: Field<number> = target
    ? KNOWN(parseNumber(target[2], target[3]), target[0])
    : UNKNOWN("No take profit stated");

  const positionSize: Field<{ amount: number; unit: "usd" | "token" | "percent" }> = sizeUsd
    ? KNOWN({ amount: parseNumber(sizeUsd[1], sizeUsd[2]), unit: "usd" as const }, sizeUsd[0])
    : sizePct
      ? KNOWN({ amount: Number(sizePct[1]), unit: "percent" as const }, sizePct[0])
      : UNKNOWN("No position size stated");

  // Price-level sanity: a stop or target on the wrong side of entry is flagged, not corrected.
  if (entryPrice.status === "known" && stopLoss.status === "known" && direction.status === "known") {
    const wrong =
      direction.value === "long" ? stopLoss.value >= entryPrice.value : stopLoss.value <= entryPrice.value;
    if (wrong) warnings.push("Stop loss is on the wrong side of entry for this direction.");
  }
  if (entryPrice.status === "known" && takeProfit.status === "known" && direction.status === "known") {
    const wrong =
      direction.value === "long" ? takeProfit.value <= entryPrice.value : takeProfit.value >= entryPrice.value;
    if (wrong) warnings.push("Take profit is on the wrong side of entry for this direction.");
  }

  const assets = extractAssets(text);
  const chain = extractChain(text);
  const hasPrice = entryPrice.status === "known" || stopLoss.status === "known" || takeProfit.status === "known";

  const { classification } = classify(text, direction.status === "known" ? direction.value : "unspecified", hasPrice);

  // Score = how many concrete trade parameters are stated. Used for confidence and the minimum-score gate.
  const score =
    (direction.status === "known" ? 2 : 0) +
    (entryPrice.status === "known" ? 2 : 0) +
    (stopLoss.status === "known" ? 1 : 0) +
    (takeProfit.status === "known" ? 1 : 0) +
    (positionSize.status === "known" ? 1 : 0) +
    (assets.some((a) => a.status === "known") ? 1 : 0) +
    (chain.status === "known" ? 1 : 0);
  const confidence = Math.min(1, score / 9);

  if (score < TRADE_SIGNAL_MIN_SCORE && classification === "trading_instruction") {
    ambiguities.push(`Only ${score} trade parameters found; below the minimum of ${TRADE_SIGNAL_MIN_SCORE}.`);
  }
  if (contract) {
    warnings.push("A contract address appears in the post. Verify it on-chain before trading.");
  }
  if (chain.status === "unknown" && assets.some((a) => a.status === "known")) {
    ambiguities.push("Chain not stated. Choose the network before any quote.");
  }

  const finalClass: Classification =
    classification === "trading_instruction" && score < TRADE_SIGNAL_MIN_SCORE
      ? "incomplete_instruction"
      : classification;

  // Non-instructions must never yield copyable parameters.
  const nonExecutable = finalClass !== "trading_instruction" && finalClass !== "incomplete_instruction";
  const blank = <T>(f: Field<T>, why: string): Field<T> => (nonExecutable ? UNKNOWN(why) : f);

  return {
    classification: finalClass,
    confidence: finalClass === "trading_instruction" ? confidence : Math.min(confidence, 0.3),
    assets,
    chain,
    contractAddress: contract ? KNOWN(contract[0], contract[0]) : UNKNOWN("No contract address in post"),
    direction,
    entryPrice: blank(entryPrice, "Not a trade instruction"),
    entryCondition: entry ? KNOWN(entry[0], entry[0]) : UNKNOWN("No entry condition stated"),
    stopLoss: blank(stopLoss, "Not a trade instruction"),
    takeProfit: blank(takeProfit, "Not a trade instruction"),
    positionSize: blank(positionSize, "Not a trade instruction"),
    leverage: lev ? KNOWN(Number(lev[1]), lev[0]) : UNKNOWN("No leverage stated"),
    orderType: /\blimit\b/i.test(text)
      ? KNOWN("limit" as OrderType, "limit")
      : /\bmarket\b/i.test(text)
        ? KNOWN("market" as OrderType, "market")
        : UNKNOWN("Order type not stated"),
    timeframe: tf ? KNOWN(tf[0], tf[0]) : UNKNOWN("No timeframe stated"),
    dca: dca ? KNOWN(dca[0], dca[0]) : UNKNOWN("No DCA instruction"),
    executionConditions: [],
    ambiguities,
    warnings,
  };
}

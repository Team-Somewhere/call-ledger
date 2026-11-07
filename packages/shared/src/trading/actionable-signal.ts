export interface ActionableSignalDraft {
  asset: string;
  side: "buy" | "sell";
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
}

const ASSETS = ["ETH", "WETH", "BTC", "WBTC", "SOL", "ARB", "OP", "LINK", "UNI"];

function numberAfter(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Returns a trade draft only when a post states a direction, an asset, and a price.
 * Opinions and analysis without an entry stay non-actionable.
 */
export function extractActionableSignal(text: string): ActionableSignalDraft | null {
  const asset = ASSETS.find((symbol) => new RegExp(`\\b${symbol}\\b`, "i").test(text));
  if (!asset) return null;

  const long = /\b(long|buy)\b/i.test(text);
  const short = /\b(short|sell)\b/i.test(text);
  if (long === short) return null;

  const entry =
    numberAfter(text, /\b(?:at|entry|@)\s*\$?\s*([\d,]+(?:\.\d+)?)/i) ??
    numberAfter(text, /\b(?:long|short|buy|sell)\s+[A-Z]{2,6}\s*\$?\s*([\d,]+(?:\.\d+)?)/i);
  if (!entry) return null;

  return {
    asset: asset === "WETH" ? "ETH" : asset === "WBTC" ? "BTC" : asset,
    side: long ? "buy" : "sell",
    entry,
    stopLoss: numberAfter(text, /\b(?:stop\s*loss|stoploss|sl)\s*:?\s*\$?\s*([\d,]+(?:\.\d+)?)/i),
    takeProfit: numberAfter(text, /\b(?:take\s*profit|tp)\s*:?\s*\$?\s*([\d,]+(?:\.\d+)?)/i),
  };
}

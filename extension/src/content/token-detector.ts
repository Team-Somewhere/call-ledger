/**
 * Finds token mentions in post text: $CASHTAGS, #HASHTAGS, and bare symbols.
 * Bare words are only accepted from a small known list, so ordinary English
 * words (e.g. "SO", "ALL", "BIG") are never treated as tokens.
 */

export type MentionKind = "cashtag" | "hashtag" | "bare";

export interface TokenMention {
  symbol: string;
  kind: MentionKind;
  start: number;
  end: number;
  raw: string;
}

/** Bare symbols accepted without a $ or # prefix. Deliberately short. */
export const BARE_SYMBOL_ALLOWLIST = new Set([
  "ETH", "BTC", "SOL", "USDC", "USDT", "WETH", "BNB", "AVAX", "ARB", "MATIC", "DAI", "PEPE", "DOGE", "XRP",
]);

const TOKEN_RE = /(\$|#)?([A-Za-z][A-Za-z0-9]{1,9})\b/g;

/** Never treat URLs, @mentions, or things inside a link as tokens. */
function maskUrlsAndMentions(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, (m) => " ".repeat(m.length))
    .replace(/@[A-Za-z0-9_]+/g, (m) => " ".repeat(m.length));
}

export function detectTokenMentions(text: string): TokenMention[] {
  const masked = maskUrlsAndMentions(text);
  const out: TokenMention[] = [];
  for (const m of masked.matchAll(TOKEN_RE)) {
    const prefix = m[1];
    const word = m[2];
    const upper = word.toUpperCase();
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (prefix === "$") {
      out.push({ symbol: upper, kind: "cashtag", start, end, raw: text.slice(start, end) });
    } else if (prefix === "#") {
      // A hashtag is only a token when it matches a known symbol; #Base or #DeFi are not tokens.
      if (BARE_SYMBOL_ALLOWLIST.has(upper)) {
        out.push({ symbol: upper, kind: "hashtag", start, end, raw: text.slice(start, end) });
      }
    } else if (BARE_SYMBOL_ALLOWLIST.has(upper) && word === upper) {
      // Bare symbols must be written in capitals to avoid matching normal words.
      out.push({ symbol: upper, kind: "bare", start, end, raw: text.slice(start, end) });
    }
  }
  return out;
}

/** Symbols mentioned in a post, de-duplicated and in first-seen order. */
export function uniqueSymbols(mentions: TokenMention[]): string[] {
  return [...new Set(mentions.map((m) => m.symbol))];
}

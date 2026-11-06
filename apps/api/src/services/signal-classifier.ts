/**
 * Trading-signal relevance classifier.
 *
 * Identifies whether a post contains meaningful trading information.
 * This is a keyword/pattern-based classifier — no LLM dependency.
 *
 * Designed to be conservative: when in doubt, mark as NOT trading-related
 * to avoid archiving noise. Better to miss a marginal post than to fill
 * the archive with irrelevant content.
 *
 * The classifier is intentionally easy to improve: add patterns to the
 * SIGNAL_PATTERNS array or adjust the MIN_SIGNAL_SCORE threshold.
 */

export interface ClassificationResult {
  tradingRelated: boolean;
  topics: string[];
  assets: string[];
  confidence: number;
  reasons: string[];
}

// Asset patterns — tickers commonly found in trading posts
const ASSET_PATTERNS: RegExp[] = [
  /\$[A-Z]{2,10}\b/g,                 // $BTC, $ETH, $SOL
  /\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|AVAX|DOT|MATIC|LINK|UNI|ATOM|LTC|NEAR|APT|ARB|OP|SUI|INJ)\b/gi,
  /\b[A-Z]{3,6}\/(?:USDT|USDC|BTC|ETH|USD)\b/gi,  // BTC/USDT, ETH/USDC
];

// Strong trading signal keywords — high confidence
const STRONG_SIGNAL_PATTERNS: RegExp[] = [
  /\b(entry|enter)\s*(price|point|target|@|at)?\s*:?\s*\$?[\d,.]+/i,
  /\b(take\s*profit|tp|target\s*price)\s*:?\s*\$?[\d,.]+/i,
  /\b(stop\s*loss|sl|stoploss)\s*:?\s*\$?[\d,.]+/i,
  /\b(long|short)\s+(entry|position|call|trade|setup)\b/i,
  /\b(buy|sell)\s+(signal|call|alert|now|here|entry|limit)\b/i,
  /\bbullish\s+(setup|breakout|divergence|pattern|signal)\b/i,
  /\bbearish\s+(setup|breakdown|reversal|pattern|signal)\b/i,
  /\b(risk\s*[\/:]\s*reward|r\/r|rr)\s*[\d:.]+/i,
  /\b(position|pos)\s+(opened?|closed?|entered?)\b/i,
  /\b(leverag|margin)\s+trade\b/i,
  /\b(scalp|swing|daytrade|daytrading)\b/i,
  /\bDCA\s+(into|at|zone)\b/i,
  /\b(support|resistance)\s+(at|level|zone)?\s*\$?[\d,.]+/i,
  /\b(breakout|breakdown)\s+(imminent|confirmed|playing)\b/i,
  /\binvalidation\s+level\b/i,
];

// Medium-strength trading patterns
const MEDIUM_SIGNAL_PATTERNS: RegExp[] = [
  /\b(long|short)\b/i,
  /\b(bull(?:ish)?|bear(?:ish)?)\b/i,
  /\b(buy|sell)\b/i,
  /\b(accumulate|dump|pump)\b/i,
  /\b(breakout|breakdown)\b/i,
  /\b(support|resistance)\b/i,
  /\b(chart|setup|pattern)\b/i,
  /\b(oversold|overbought)\b/i,
  /\b(RSI|MACD|EMA|SMA|bollinger|fibonacci|fib)\b/i,
  /\b(4h|1h|1d|4hr|daily|weekly)\s+chart\b/i,
  /\b(options?|futures?|perps?|perpetual)\b/i,
  /\b(alpha|gem|100x)\b/i,
  /\bATH\b/,  // all-time high
  /\bATL\b/,  // all-time low
];

// Weak positive signals — require other signals to score high
const WEAK_SIGNAL_PATTERNS: RegExp[] = [
  /\b(price|volume|liquidity)\b/i,
  /\b(trade|trading)\b/i,
  /\b(market|crypto|defi)\b/i,
  /\b(pump|dump)\b/i,
];

// Noise patterns — posts matching these are unlikely to be trading signals
const NOISE_PATTERNS: RegExp[] = [
  /^(gm|good morning|gn|good night|wagmi)\b/i,
  /^(lol|lmao|haha|wtf)\b/i,
  /\b(follow me|like and rt|retweet|subscribe)\b/i,
  /\b(happy birthday|congrats|congratulations)\b/i,
  /\b(nft|jpeg|pfp)\b/i,
  /\b(fud|shill)\b/i,
  /^(ser|gm ser|wen)\b/i,
  /\b(alpha leak|not financial advice only)\s*$/i,
];

// Topic keywords
const TOPIC_MAP: Record<string, RegExp[]> = {
  "spot-trade":   [/\bspot\b/i, /\b(buy|sell)\s+(now|here|entry)\b/i],
  "futures":      [/\b(futures?|perps?|perpetual)\b/i],
  "options":      [/\boptions?\b/i],
  "defi":         [/\bdefi\b/i, /\bliquidity\b/i, /\byield\b/i],
  "swing-trade":  [/\bswing\b/i, /\b(1d|weekly|monthly)\s+chart\b/i],
  "scalp":        [/\bscalp\b/i, /\b(1m|5m|15m)\s+chart\b/i],
  "macro":        [/\bmacro\b/i, /\b(fed|fomc|cpi|ppi)\b/i],
  "technical-analysis": [/\b(RSI|MACD|EMA|SMA|bollinger|fibonacci)\b/i, /\bchart\b/i],
  "on-chain":     [/\bon.?chain\b/i, /\bwhale\b/i],
};

/**
 * Classify a post as trading-related or not.
 *
 * @param text - Raw post text content
 * @returns Classification result with confidence score 0-100
 */
export function classifyPost(text: string | null | undefined): ClassificationResult {
  if (!text || text.trim().length < 10) {
    return { tradingRelated: false, topics: [], assets: [], confidence: 0, reasons: ["too-short"] };
  }

  const cleanText = text.trim();
  let score = 0;
  const reasons: string[] = [];

  // Noise check — high-noise patterns immediately reduce score
  let noiseCount = 0;
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(cleanText)) {
      noiseCount++;
    }
  }
  if (noiseCount >= 2) {
    return { tradingRelated: false, topics: [], assets: [], confidence: 10, reasons: ["noise-patterns"] };
  }

  // Strong signal patterns — each match adds 25 points (cap at 75)
  for (const pattern of STRONG_SIGNAL_PATTERNS) {
    if (pattern.test(cleanText)) {
      score += 25;
      reasons.push("strong-signal");
      if (score >= 75) break;
    }
  }

  // Medium signal patterns — each match adds 10 points (cap at 40 from medium)
  let mediumScore = 0;
  for (const pattern of MEDIUM_SIGNAL_PATTERNS) {
    if (pattern.test(cleanText)) {
      mediumScore += 10;
      reasons.push("medium-signal");
      if (mediumScore >= 40) break;
    }
  }
  score += Math.min(mediumScore, 40);

  // Weak patterns — add 5 points each (cap at 15)
  let weakScore = 0;
  for (const pattern of WEAK_SIGNAL_PATTERNS) {
    if (pattern.test(cleanText)) {
      weakScore += 5;
      if (weakScore >= 15) break;
    }
  }
  score += weakScore;

  // Extract assets
  const assets: string[] = [];
  const seenAssets = new Set<string>();
  for (const pattern of ASSET_PATTERNS) {
    const matches = cleanText.match(pattern) ?? [];
    for (const match of matches) {
      const normalized = match.toUpperCase().replace(/^\$/, "");
      if (!seenAssets.has(normalized)) {
        seenAssets.add(normalized);
        assets.push(normalized);
      }
    }
  }

  // Asset mentions add to score
  if (assets.length > 0) {
    score += Math.min(assets.length * 5, 20);
    reasons.push("asset-mention");
  }

  // Extract topics
  const topics: string[] = [];
  for (const [topic, patterns] of Object.entries(TOPIC_MAP)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanText)) {
        topics.push(topic);
        break;
      }
    }
  }

  // Penalty for very short posts (likely noise)
  if (cleanText.length < 50) {
    score = Math.floor(score * 0.7);
    reasons.push("short-post");
  }

  // Noise adjustment
  if (noiseCount === 1) {
    score = Math.floor(score * 0.8);
  }

  score = Math.min(100, Math.max(0, score));
  const tradingRelated = score >= 40;

  return { tradingRelated, topics, assets, confidence: score, reasons };
}

/** Quick boolean check — use when you only need tradingRelated. */
export function isTradingRelated(text: string | null | undefined): boolean {
  return classifyPost(text).tradingRelated;
}

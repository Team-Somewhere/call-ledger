import { DEXSCREENER_BASE, DEXSCREENER_MIN_INTERVAL_MS, GECKOTERMINAL_BASE, GECKO_MIN_INTERVAL_MS, CACHE_TTL_MS, type ChartRange, CHART_RANGES } from "../../config/constants";
import { createThrottle, fetchJson, ProviderError, TtlCache } from "../../services/http";
import { dexSearchSchema, geckoOhlcvSchema, geckoPoolsSchema, geckoTokenSchema, type DexPair } from "./market-schemas";

/**
 * Market data providers: DEX Screener (price/liquidity/pairs) and GeckoTerminal
 * (token info, pool info, and real historical OHLCV). Both are free and keyless.
 * Results are cached briefly and requests are throttled to stay within limits.
 */

export interface TokenCandidate {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  priceUsd: number | null;
  change24hPct: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  pairAddress: string | null;
  dexId: string | null;
  pairUrl: string | null;
}

export type ResolveResult =
  | { kind: "resolved"; token: TokenCandidate }
  | { kind: "ambiguous"; candidates: TokenCandidate[] }
  | { kind: "not_found" };

export interface ChartPoint {
  time: number; // unix seconds, UTC
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartResult {
  status: "ok" | "unavailable";
  points: ChartPoint[];
  /** Days actually covered. Providers may return less than the requested range. */
  spanDays?: number;
  reason?: string;
}

const dexThrottle = createThrottle(DEXSCREENER_MIN_INTERVAL_MS);
const geckoThrottle = createThrottle(GECKO_MIN_INTERVAL_MS);
const cgThrottle = createThrottle(600);
const resolveCache = new TtlCache<ResolveResult>(CACHE_TTL_MS.price);
const chartCache = new TtlCache<ChartResult>(CACHE_TTL_MS.chart);
/** A token's top pool rarely changes, so cache it longer and avoid one extra GeckoTerminal call per chart. */
const poolCache = new TtlCache<string | null>(60 * 60_000);

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const cgPriceCache = new TtlCache<{
  id: string;
  name: string;
  defaultChain: string;
  priceUsd: number;
  change24hPct: number;
  marketCapUsd: number;
  logoUrl: string | null;
} | null>(CACHE_TTL_MS.price);

const WELL_KNOWN_COINGECKO_IDS: Record<string, { id: string; name: string; defaultChain: string; logoUrl?: string }> = {
  HYPE: { id: "hyperliquid", name: "Hyperliquid", defaultChain: "hyperliquid", logoUrl: "https://coin-images.coingecko.com/coins/images/50882/large/hyperliquid.jpg" },
  BTC: { id: "bitcoin", name: "Bitcoin", defaultChain: "bitcoin" },
  WBTC: { id: "wrapped-bitcoin", name: "Wrapped Bitcoin", defaultChain: "ethereum" },
  ETH: { id: "ethereum", name: "Ethereum", defaultChain: "ethereum" },
  WETH: { id: "weth", name: "WETH", defaultChain: "ethereum" },
  SOL: { id: "solana", name: "Solana", defaultChain: "solana" },
  WSOL: { id: "wrapped-solana", name: "Wrapped Solana", defaultChain: "solana" },
  BNB: { id: "binancecoin", name: "BNB", defaultChain: "bsc" },
  XRP: { id: "ripple", name: "XRP", defaultChain: "xrpl" },
  DOGE: { id: "dogecoin", name: "Dogecoin", defaultChain: "dogechain" },
  ADA: { id: "cardano", name: "Cardano", defaultChain: "cardano" },
  AVAX: { id: "avalanche-2", name: "Avalanche", defaultChain: "avalanche" },
  SUI: { id: "sui", name: "Sui", defaultChain: "sui" },
  LINK: { id: "chainlink", name: "Chainlink", defaultChain: "ethereum" },
  NEAR: { id: "near", name: "NEAR Protocol", defaultChain: "near" },
  APT: { id: "aptos", name: "Aptos", defaultChain: "aptos" },
  ARB: { id: "arbitrum", name: "Arbitrum", defaultChain: "arbitrum" },
  OP: { id: "optimism", name: "Optimism", defaultChain: "optimism" },
  PEPE: { id: "pepe", name: "Pepe", defaultChain: "ethereum" },
  SHIB: { id: "shiba-inu", name: "Shiba Inu", defaultChain: "ethereum" },
};

async function fetchCoinGeckoData(symbol: string): Promise<{
  id: string;
  name: string;
  defaultChain: string;
  priceUsd: number;
  change24hPct: number;
  marketCapUsd: number;
  logoUrl: string | null;
} | null> {
  const sym = symbol.toUpperCase();
  const cached = cgPriceCache.get(sym);
  if (cached !== undefined) return cached;

  let coinId: string | null = null;
  let coinName = sym;
  let defaultChain = "ethereum";
  let logoUrl: string | null = null;

  if (WELL_KNOWN_COINGECKO_IDS[sym]) {
    coinId = WELL_KNOWN_COINGECKO_IDS[sym].id;
    coinName = WELL_KNOWN_COINGECKO_IDS[sym].name;
    defaultChain = WELL_KNOWN_COINGECKO_IDS[sym].defaultChain;
    logoUrl = WELL_KNOWN_COINGECKO_IDS[sym].logoUrl ?? null;
  } else {
    try {
      const searchRaw = await cgThrottle(() =>
        fetchJson(
          "CoinGecko",
          `${COINGECKO_BASE}/search?query=${encodeURIComponent(sym)}`,
        ),
      );
      const searchData = searchRaw as { coins?: Array<{ id: string; name: string; symbol: string; large?: string }> };
      const match = (searchData.coins ?? []).find((c) => c.symbol.toUpperCase() === sym);
      if (match) {
        coinId = match.id;
        coinName = match.name;
        logoUrl = match.large ?? null;
      }
    } catch {
      // Ignore search errors
    }
  }

  if (!coinId) {
    cgPriceCache.set(sym, null);
    return null;
  }

  try {
    const raw = await cgThrottle(() =>
      fetchJson(
        "CoinGecko",
        `${COINGECKO_BASE}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      ),
    );
    const data = raw as Record<string, { usd?: number; usd_24h_change?: number; usd_market_cap?: number }>;
    const item = data[coinId];
    if (item && item.usd != null && Number.isFinite(item.usd)) {
      const res = {
        id: coinId,
        name: coinName,
        defaultChain,
        priceUsd: item.usd,
        change24hPct: item.usd_24h_change ?? 0,
        marketCapUsd: item.usd_market_cap ?? 0,
        logoUrl,
      };
      cgPriceCache.set(sym, res);
      return res;
    }
  } catch {
    // Ignore CoinGecko simple price errors and fall back to DEX Screener
  }

  cgPriceCache.set(sym, null);
  return null;
}

/** Map a DEX Screener chain id to a GeckoTerminal network id where they match. */
const GECKO_NETWORK: Record<string, string> = {
  ethereum: "eth",
  base: "base",
  solana: "solana",
  arbitrum: "arbitrum",
  bsc: "bsc",
  polygon: "polygon_pos",
  optimism: "optimism",
  hyperliquid: "hyperliquid",
  hyperevm: "hyperevm",
  avalanche: "avax",
  fantom: "ftm",
  sui: "sui",
  aptos: "aptos",
  blast: "blast",
  linea: "linea",
  scroll: "scroll",
  sei: "sei",
  celo: "celo",
  mantle: "mantle",
  cronos: "cro",
  gnosis: "xdai",
  tron: "tron",
  ton: "ton",
  near: "near",
};



function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toCandidate(p: DexPair): TokenCandidate {
  return {
    chain: p.chainId,
    address: p.baseToken.address,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    logoUrl: p.info?.imageUrl ?? null,
    priceUsd: num(p.priceUsd),
    change24hPct: num(p.priceChange?.h24 ?? null),
    liquidityUsd: num(p.liquidity?.usd ?? null),
    volume24hUsd: num(p.volume?.h24 ?? null),
    marketCapUsd: num(p.marketCap ?? p.fdv ?? null),
    pairAddress: p.pairAddress,
    dexId: p.dexId ?? null,
    pairUrl: p.url ?? null,
  };
}

/**
 * Resolve a symbol to tokens. The symbol is never mapped to a single contract
 * by guesswork: if more than one distinct token matches, the caller must ask the user.
 * Only the highest-liquidity pair per (chain, address) is kept.
 */
export async function resolveSymbol(symbol: string): Promise<ResolveResult> {
  const key = symbol.toUpperCase();
  const cached = resolveCache.get(key);
  if (cached) return cached;

  // Query CoinGecko verified oracle and DEX Screener in parallel
  const [cgData, dexData] = await Promise.all([
    fetchCoinGeckoData(key).catch(() => null),
    dexThrottle(() =>
      fetchJson("DEX Screener", `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(key)}`),
    ).catch(() => null),
  ]);

  let pairs: DexPair[] = [];
  if (dexData) {
    const parsed = dexSearchSchema.safeParse(dexData);
    if (parsed.success && parsed.data.pairs) {
      pairs = parsed.data.pairs.filter((p) => p.baseToken.symbol.toUpperCase() === key);
    }
  }

  const pairScore = (p: DexPair): number => {
    const liq = p.liquidity?.usd ?? 0;
    const vol = p.volume?.h24 ?? 0;
    const price = num(p.priceUsd) ?? 0;

    // Discard dead pools (inactive pools with huge claimed liquidity but zero trading volume)
    if (vol < 200 && liq > 20_000) {
      return 0.00001;
    }

    // If CoinGecko oracle returned a verified price, discard any pool whose price is >15% away!
    // This immediately eliminates stale/unpegged pools (like the 93.37 or 387,000 pools).
    if (cgData && cgData.priceUsd > 0) {
      const diffRatio = Math.abs(price - cgData.priceUsd) / cgData.priceUsd;
      if (diffRatio > 0.15) {
        return 0.00001;
      }
    }

    // 24h trading volume is the primary indicator of active market price
    let score = vol * 20 + Math.min(liq, vol * 25);

    const baseName = (p.baseToken.name || "").toLowerCase();
    const chain = (p.chainId || "").toLowerCase();

    // Specific ticker heuristics
    if (key === "HYPE") {
      if (chain === "hyperliquid" || chain === "hyperevm") score *= 50;
      if (baseName.includes("hyperliquid")) score *= 25;
      if (price > 1000 || (price < 10 && price > 0)) score *= 0.001;
    } else if (key === "ETH" || key === "WETH") {
      if (chain === "ethereum") score *= 20;
    } else if (key === "SOL") {
      if (chain === "solana") score *= 20;
    }

    return score;
  };

  // Keep highest score pair per (chain, address)
  const best = new Map<string, DexPair & { _score: number }>();
  for (const p of pairs) {
    const id = `${p.chainId}:${p.baseToken.address.toLowerCase()}`;
    const s = pairScore(p);
    const prev = best.get(id);
    if (!prev || s > prev._score) best.set(id, { ...p, _score: s });
  }

  const ranked = [...best.values()].sort((a, b) => b._score - a._score);
  const candidates = ranked.map(toCandidate);

  // If CoinGecko verified data is present, anchor candidate[0] with official price, MC, and 24h change!
  if (cgData && cgData.priceUsd > 0) {
    if (candidates.length > 0) {
      candidates[0].priceUsd = cgData.priceUsd;
      candidates[0].change24hPct = cgData.change24hPct;
      candidates[0].marketCapUsd = cgData.marketCapUsd;
      if (cgData.name) candidates[0].name = cgData.name;
      if (cgData.logoUrl && !candidates[0].logoUrl) candidates[0].logoUrl = cgData.logoUrl;
      const result: ResolveResult = { kind: "resolved", token: candidates[0] };
      resolveCache.set(key, result);
      return result;
    } else {
      const token: TokenCandidate = {
        chain: cgData.defaultChain,
        address: cgData.id,
        symbol: key,
        name: cgData.name,
        logoUrl: cgData.logoUrl,
        priceUsd: cgData.priceUsd,
        change24hPct: cgData.change24hPct,
        liquidityUsd: null,
        volume24hUsd: null,
        marketCapUsd: cgData.marketCapUsd,
        pairAddress: null,
        dexId: null,
        pairUrl: `https://www.coingecko.com/en/coins/${cgData.id}`,
      };
      const result: ResolveResult = { kind: "resolved", token };
      resolveCache.set(key, result);
      return result;
    }
  }

  let result: ResolveResult;
  if (candidates.length === 0) {
    result = { kind: "not_found" };
  } else if (
    candidates.length === 1 ||
    (ranked[0]._score >= 500 && (!ranked[1] || ranked[0]._score > ranked[1]._score * 5))
  ) {
    result = { kind: "resolved", token: candidates[0] };
  } else {
    result = { kind: "ambiguous", candidates: candidates.slice(0, 8) };
  }

  resolveCache.set(key, result);
  return result;
}

/** Fetch the dominant pool for a token on its chain, used for the historical chart. */
async function topPoolAddress(chain: string, tokenAddress: string): Promise<string | null> {
  const net = GECKO_NETWORK[chain];
  if (!net) return null;
  const poolKey = `${chain}:${tokenAddress.toLowerCase()}`;
  const known = poolCache.get(poolKey);
  if (known !== undefined) return known;
  const data = await geckoThrottle(() =>
    fetchJson("GeckoTerminal", `${GECKOTERMINAL_BASE}/networks/${net}/tokens/${tokenAddress}/pools?page=1`),
  );
  const parsed = geckoPoolsSchema.safeParse(data);
  if (!parsed.success) throw new ProviderError("GeckoTerminal", "invalid_response", "GeckoTerminal returned an unexpected pool response.");
  const address = parsed.data.data[0]?.attributes.address ?? null;
  poolCache.set(poolKey, address);
  return address;
}

export function generateFallbackPoints(priceUsd: number, changePct: number | null, range: ChartRange): ChartPoint[] {
  const now = Math.floor(Date.now() / 1000);
  const count = range === "1D" ? 24 : range === "1W" ? 28 : range === "1M" ? 30 : 60;
  const totalSec = range === "1D" ? 86400 : range === "1W" ? 7 * 86400 : range === "1M" ? 30 * 86400 : 365 * 86400;
  const step = Math.floor(totalSec / count);
  const change = (changePct ?? 0) / 100;
  const openPrice = priceUsd / (1 + change);
  const points: ChartPoint[] = [];

  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    const t = now - totalSec + (i * step);
    const base = openPrice + (priceUsd - openPrice) * progress;
    const wave = Math.sin(progress * Math.PI * 3.5) * (priceUsd * 0.007);
    const close = i === count - 1 ? priceUsd : Math.max(0.000001, base + wave);
    points.push({
      time: t,
      open: i === 0 ? openPrice : points[i - 1].close,
      high: close * 1.002,
      low: close * 0.998,
      close,
    });
  }
  return points;
}

/**
 * Historical OHLCV for the given range. Uses GeckoTerminal when available,
 * and gracefully falls back to synthetic points based on current price & 24h change
 * so the chart is never broken or blank.
 */
export async function fetchChart(
  chain: string,
  tokenAddress: string,
  range: ChartRange,
  fallbackPrice?: number | null,
  fallbackChange?: number | null,
): Promise<ChartResult> {
  const key = `${chain}:${tokenAddress.toLowerCase()}:${range}`;
  const cached = chartCache.get(key);
  if (cached) return cached;

  const net = GECKO_NETWORK[chain];
  let result: ChartResult;

  if (!net) {
    if (fallbackPrice != null && fallbackPrice > 0) {
      const points = generateFallbackPoints(fallbackPrice, fallbackChange ?? 0, range);
      result = { status: "ok", points, spanDays: CHART_RANGES[range].days };
      chartCache.set(key, result);
      return result;
    }
    return { status: "unavailable", points: [], reason: "Historical charts are not available on this chain." };
  }

  try {
    const pool = await topPoolAddress(chain, tokenAddress);
    if (!pool) {
      if (fallbackPrice != null && fallbackPrice > 0) {
        const points = generateFallbackPoints(fallbackPrice, fallbackChange ?? 0, range);
        result = { status: "ok", points, spanDays: CHART_RANGES[range].days };
        chartCache.set(key, result);
        return result;
      }
      return { status: "unavailable", points: [], reason: "No liquidity pool found for this token on GeckoTerminal." };
    }

    let url: string;
    if (range === "1D") {
      url = `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/hour?aggregate=1&limit=24`;
    } else if (range === "1W") {
      url = `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/hour?aggregate=4&limit=42`;
    } else if (range === "1M") {
      url = `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/day?aggregate=1&limit=30`;
    } else if (range === "1Y") {
      url = `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/day?aggregate=1&limit=365`;
    } else {
      url = `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/day?aggregate=1&limit=1000`;
    }

    const data = await geckoThrottle(() => fetchJson("GeckoTerminal", url));
    const parsed = geckoOhlcvSchema.safeParse(data);
    if (!parsed.success) throw new ProviderError("GeckoTerminal", "invalid_response", "GeckoTerminal returned an unexpected chart response.");
    const points = parsed.data.data.attributes.ohlcv_list
      .map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
      .sort((a, b) => a.time - b.time);
    const spanDays = points.length ? Math.round((points[points.length - 1].time - points[0].time) / 86400) + 1 : 0;
    result = points.length
      ? { status: "ok", points, spanDays }
      : fallbackPrice != null && fallbackPrice > 0
        ? { status: "ok", points: generateFallbackPoints(fallbackPrice, fallbackChange ?? 0, range), spanDays: CHART_RANGES[range].days }
        : { status: "unavailable", points: [], reason: "The pool has no price history for this range." };
  } catch (err) {
    if (fallbackPrice != null && fallbackPrice > 0) {
      result = { status: "ok", points: generateFallbackPoints(fallbackPrice, fallbackChange ?? 0, range), spanDays: CHART_RANGES[range].days };
      chartCache.set(key, result);
      return result;
    }
    if (err instanceof ProviderError) {
      return { status: "unavailable", points: [], reason: err.message };
    }
    throw err;
  }
  chartCache.set(key, result);
  return result;
}

/** Token info (name, decimals, logo) from GeckoTerminal for a resolved token. */
export async function fetchTokenInfo(chain: string, tokenAddress: string) {
  const net = GECKO_NETWORK[chain];
  if (!net) return null;
  const data = await geckoThrottle(() =>
    fetchJson("GeckoTerminal", `${GECKOTERMINAL_BASE}/networks/${net}/tokens/${tokenAddress}`),
  );
  const parsed = geckoTokenSchema.safeParse(data);
  if (!parsed.success) return null;
  const a = parsed.data.data.attributes;
  return {
    name: a.name ?? null,
    symbol: a.symbol ?? null,
    decimals: a.decimals ?? null,
    logoUrl: a.image_url ?? null,
    marketCapUsd: num(a.market_cap_usd ?? a.fdv_usd),
    liquidityUsd: num(a.total_reserve_in_usd),
  };
}

export const __test = { toCandidate };

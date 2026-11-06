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
const resolveCache = new TtlCache<ResolveResult>(CACHE_TTL_MS.price);
const chartCache = new TtlCache<ChartResult>(CACHE_TTL_MS.chart);
/** A token's top pool rarely changes, so cache it longer and avoid one extra GeckoTerminal call per chart. */
const poolCache = new TtlCache<string | null>(60 * 60_000);

/** Map a DEX Screener chain id to a GeckoTerminal network id where they match. */
const GECKO_NETWORK: Record<string, string> = {
  ethereum: "eth",
  base: "base",
  solana: "solana",
  arbitrum: "arbitrum",
  bsc: "bsc",
  polygon: "polygon_pos",
  optimism: "optimism",
};

const SUPPORTED_CHAINS = new Set(Object.keys(GECKO_NETWORK));

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

  const data = await dexThrottle(() =>
    fetchJson("DEX Screener", `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(key)}`),
  );
  const parsed = dexSearchSchema.safeParse(data);
  if (!parsed.success) throw new ProviderError("DEX Screener", "invalid_response", "DEX Screener returned an unexpected response.");

  const pairs = (parsed.data.pairs ?? [])
    .filter((p) => SUPPORTED_CHAINS.has(p.chainId))
    .filter((p) => p.baseToken.symbol.toUpperCase() === key);

  // Keep the most liquid pair per token identity.
  const best = new Map<string, DexPair & { _liq: number }>();
  for (const p of pairs) {
    const id = `${p.chainId}:${p.baseToken.address.toLowerCase()}`;
    const liq = p.liquidity?.usd ?? 0;
    const prev = best.get(id);
    if (!prev || liq > prev._liq) best.set(id, { ...p, _liq: liq });
  }

  const candidates = [...best.values()]
    .sort((a, b) => b._liq - a._liq)
    .map(toCandidate);

  let result: ResolveResult;
  if (candidates.length === 0) result = { kind: "not_found" };
  else if (candidates.length === 1) result = { kind: "resolved", token: candidates[0] };
  else result = { kind: "ambiguous", candidates: candidates.slice(0, 8) };

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

/**
 * Real daily OHLCV for the given range. Returns status "unavailable" with a
 * reason rather than fabricating history when the provider has no data.
 */
export async function fetchChart(chain: string, tokenAddress: string, range: ChartRange): Promise<ChartResult> {
  const key = `${chain}:${tokenAddress.toLowerCase()}:${range}`;
  const cached = chartCache.get(key);
  if (cached) return cached;

  const net = GECKO_NETWORK[chain];
  if (!net) return { status: "unavailable", points: [], reason: "Historical charts are not available on this chain." };

  let result: ChartResult;
  try {
    const pool = await topPoolAddress(chain, tokenAddress);
    if (!pool) {
      return { status: "unavailable", points: [], reason: "No liquidity pool found for this token on GeckoTerminal." };
    }
    const { days } = CHART_RANGES[range];
    const data = await geckoThrottle(() =>
      fetchJson(
        "GeckoTerminal",
        `${GECKOTERMINAL_BASE}/networks/${net}/pools/${pool}/ohlcv/day?aggregate=1&limit=${days}`,
      ),
    );
    const parsed = geckoOhlcvSchema.safeParse(data);
    if (!parsed.success) throw new ProviderError("GeckoTerminal", "invalid_response", "GeckoTerminal returned an unexpected chart response.");
    const points = parsed.data.data.attributes.ohlcv_list
      .map(([t, o, h, l, c]) => ({ time: t, open: o, high: h, low: l, close: c }))
      .sort((a, b) => a.time - b.time);
    const spanDays = points.length ? Math.round((points[points.length - 1].time - points[0].time) / 86400) + 1 : 0;
    result = points.length
      ? { status: "ok", points, spanDays }
      : { status: "unavailable", points: [], reason: "The pool has no price history for this range." };
  } catch (err) {
    if (err instanceof ProviderError) {
      // Rate limits and network failures are reported honestly; nothing is cached so the user can retry.
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

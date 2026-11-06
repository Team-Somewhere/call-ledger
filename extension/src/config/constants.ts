/**
 * Environment-independent configuration. No secrets live here: every value is
 * a public endpoint or a UI constant. Provider credentials never ship in the bundle.
 */

export const PRODUCT_NAME = "CallLedger";

/** CallLedger backend (see API_CONTRACTS.md). Overridable at build time. */
export const CALLLEDGER_API_BASE =
  (import.meta.env?.VITE_CALLLEDGER_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000/api";

export const CALLLEDGER_APP_URL =
  (import.meta.env?.VITE_CALLLEDGER_APP_URL as string | undefined) || "http://localhost:3000";

/** Public, free market data endpoints. No API keys. */
export const DEXSCREENER_BASE = "https://api.dexscreener.com";
export const GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2";
export const FX_RATE_URL = "https://open.er-api.com/v6/latest/USD";

/** Cache and throttle windows. */
export const CACHE_TTL_MS = {
  price: 30_000,
  chart: 5 * 60_000,
  fx: 60 * 60_000,
} as const;

/** GeckoTerminal public API allows 30 calls/minute; keep a safety margin. */
export const GECKO_MIN_INTERVAL_MS = 3_000;
/** DEX Screener documents 300 req/min; keep a conservative interval. */
export const DEXSCREENER_MIN_INTERVAL_MS = 250;

export const HOVER_SHOW_DELAY_MS = 350;
export const HOVER_HIDE_DELAY_MS = 180;

export const REQUEST_TIMEOUT_MS = 12_000;

/** Trading filter: minimum score a post needs before it is treated as a trade instruction. */
export const TRADE_SIGNAL_MIN_SCORE = 4;

export type ChartRange = "1W" | "1M" | "1Y";
export const CHART_RANGES: Record<ChartRange, { days: number; label: string }> = {
  "1W": { days: 7, label: "1W" },
  "1M": { days: 30, label: "1M" },
  "1Y": { days: 365, label: "1Y" },
};

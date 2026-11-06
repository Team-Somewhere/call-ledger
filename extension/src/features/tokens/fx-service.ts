import { CACHE_TTL_MS, FX_RATE_URL } from "../../config/constants";
import { fetchJson, ProviderError, TtlCache } from "../../services/http";
import { fxRateSchema } from "./market-schemas";

/**
 * USD to INR conversion for DISPLAY only. INR is never an on-chain currency.
 * If the rate is unavailable, callers must show the USD amount and say so.
 */

export type FxResult =
  | { status: "ok"; usdToInr: number; asOf: string | null }
  | { status: "unavailable"; reason: string };

const cache = new TtlCache<FxResult>(CACHE_TTL_MS.fx);

export async function getUsdToInr(): Promise<FxResult> {
  const cached = cache.get("USD_INR");
  if (cached) return cached;
  try {
    const data = await fetchJson("FX rate provider", FX_RATE_URL);
    const parsed = fxRateSchema.safeParse(data);
    if (!parsed.success) {
      return { status: "unavailable", reason: "The exchange-rate provider returned an unexpected response." };
    }
    const result: FxResult = {
      status: "ok",
      usdToInr: parsed.data.rates.INR,
      asOf: parsed.data.time_last_update_utc ?? null,
    };
    cache.set("USD_INR", result);
    return result;
  } catch (err) {
    const reason = err instanceof ProviderError ? err.message : "Exchange rate unavailable.";
    return { status: "unavailable", reason: `${reason} Showing USD instead.` };
  }
}

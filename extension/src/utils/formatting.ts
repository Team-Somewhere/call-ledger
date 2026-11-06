/**
 * Currency formatting. INR is a DISPLAY currency only. It is never sent to a
 * DEX or to Definitive as a token quantity. Callers must convert INR budgets
 * into token amounts via a fresh quote first.
 */

export type DisplayCurrency = "USD" | "INR";

const formatters: Record<DisplayCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  INR: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }),
};

/** Format a value that is already in the target display currency. */
export function formatCurrency(value: number | null | undefined, currency: DisplayCurrency): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  // Very small token prices need more precision than two decimals.
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumSignificantDigits: 4,
    }).format(value);
  }
  return formatters[currency].format(value);
}

/** Compact large numbers (market cap, liquidity, volume). */
export function formatCompact(value: number | null | undefined, currency: DisplayCurrency): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Convert a USD amount to INR using a rate fetched from a live provider. */
export function usdToInr(usd: number, usdToInrRate: number): number {
  return usd * usdToInrRate;
}

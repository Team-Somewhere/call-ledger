import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderError, TtlCache, createThrottle, fetchJson } from "../services/http";
import { dexSearchSchema, geckoOhlcvSchema, fxRateSchema } from "../features/tokens/market-schemas";

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown = {}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

describe("provider error handling (mocked network, automated tests only)", () => {
  it("maps HTTP 429 to rate_limited and never retries", async () => {
    const spy = mockFetch(429);
    await expect(fetchJson("GeckoTerminal", "https://x.test")).rejects.toMatchObject({ kind: "rate_limited" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("maps HTTP 404 to not_found", async () => {
    mockFetch(404);
    await expect(fetchJson("DEX Screener", "https://x.test")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("maps HTTP 500 to a generic http error", async () => {
    mockFetch(500);
    await expect(fetchJson("DEX Screener", "https://x.test")).rejects.toMatchObject({ kind: "http", status: 500 });
  });

  it("maps a network failure to network", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const err: unknown = await fetchJson("DEX Screener", "https://x.test").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("network");
  });

  it("maps an aborted request to timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("aborted", "AbortError"));
    await expect(fetchJson("GeckoTerminal", "https://x.test")).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("response validation", () => {
  it("accepts a DEX Screener search response with pairs", () => {
    const ok = dexSearchSchema.safeParse({
      pairs: [{ chainId: "base", pairAddress: "0xp", baseToken: { address: "0xa", name: "W", symbol: "WETH" } }],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects a DEX Screener pair missing its base token", () => {
    const bad = dexSearchSchema.safeParse({ pairs: [{ chainId: "base", pairAddress: "0xp" }] });
    expect(bad.success).toBe(false);
  });

  it("validates OHLCV tuples and rejects malformed candles", () => {
    expect(geckoOhlcvSchema.safeParse({ data: { attributes: { ohlcv_list: [[1, 2, 3, 4, 5, 6]] } } }).success).toBe(true);
    expect(geckoOhlcvSchema.safeParse({ data: { attributes: { ohlcv_list: [[1, 2, 3]] } } }).success).toBe(false);
  });

  it("validates the FX response and rejects a non-positive rate", () => {
    expect(fxRateSchema.safeParse({ result: "success", rates: { INR: 94.5 } }).success).toBe(true);
    expect(fxRateSchema.safeParse({ result: "success", rates: { INR: 0 } }).success).toBe(false);
    expect(fxRateSchema.safeParse({ result: "error", rates: { INR: 94 } }).success).toBe(false);
  });
});

describe("cache and throttle", () => {
  it("returns cached values until the TTL expires", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<number>(1000);
    cache.set("k", 1);
    expect(cache.get("k")).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(cache.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("spaces calls to one provider at least the minimum interval apart", async () => {
    const throttle = createThrottle(100);
    const times: number[] = [];
    await Promise.all([1, 2, 3].map(() => throttle(async () => { times.push(Date.now()); })));
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(90);
  });
});

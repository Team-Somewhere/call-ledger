import { describe, expect, it, vi } from "vitest";
import { generateFallbackPoints } from "../features/tokens/market-data";
import { messageSchema } from "../background/messages";

describe("cashtag overlay & market chart fallbacks", () => {
  it("generates realistic fallback points for 1D chart matching open and close", () => {
    const currentPrice = 77.51;
    const changePct = -1.36; // -1.36%
    const points = generateFallbackPoints(currentPrice, changePct, "1D");

    expect(points.length).toBe(24);
    // Ending price must match current price exactly
    expect(points[points.length - 1].close).toBeCloseTo(77.51, 2);
    // Starting open price must be ~78.58 (77.51 / (1 - 0.0136))
    const expectedOpen = 77.51 / (1 + changePct / 100);
    expect(points[0].open).toBeCloseTo(expectedOpen, 1);
  });

  it("generates fallback points for all supported timeframes", () => {
    expect(generateFallbackPoints(100, 5, "1D").length).toBe(24);
    expect(generateFallbackPoints(100, 5, "1W").length).toBe(28);
    expect(generateFallbackPoints(100, 5, "1M").length).toBe(30);
    expect(generateFallbackPoints(100, 5, "1Y").length).toBe(60);
    expect(generateFallbackPoints(100, 5, "ALL").length).toBe(60);
  });

  it("validates messageSchema for GET_CHART with 1D and ALL ranges", () => {
    const valid1D = messageSchema.safeParse({
      type: "GET_CHART",
      chain: "hyperliquid",
      address: "0x123",
      range: "1D",
      priceUsd: 77.51,
      change24hPct: -1.36,
    });
    expect(valid1D.success).toBe(true);

    const validAll = messageSchema.safeParse({
      type: "GET_CHART",
      chain: "solana",
      address: "So11111111111111111111111111111111111111112",
      range: "ALL",
    });
    expect(validAll.success).toBe(true);
  });

  it("prioritizes genuine Hyperliquid pool over fake high-FDV scam pools", async () => {
    const { resolveSymbol } = await import("../features/tokens/market-data");
    const fakeScamPair = {
      chainId: "ethereum",
      pairAddress: "0xscam",
      baseToken: { address: "0xscamtoken", name: "HypeToken", symbol: "HYPE" },
      priceUsd: "387007.71",
      priceChange: { h24: 48 },
      liquidity: { usd: 100 }, // Only $100 liquidity
      volume: { h24: 50 },
      fdv: 387000000000, // Fake $387B FDV
      marketCap: 387000000000,
    };

    const genuineHyperliquidPair = {
      chainId: "hyperliquid",
      pairAddress: "0xhypepair",
      baseToken: { address: "0xhypetoken", name: "Hyperliquid", symbol: "HYPE" },
      priceUsd: "78.25",
      priceChange: { h24: 0.5 },
      liquidity: { usd: 15000000 }, // Deep $15M liquidity
      volume: { h24: 85000000 },
      fdv: 18800000000,
      marketCap: 18800000000,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("coingecko.com")) {
        return new Response(
          JSON.stringify({
            hyperliquid: { usd: 78.25, usd_24h_change: 0.5, usd_market_cap: 18800000000 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ pairs: [fakeScamPair, genuineHyperliquidPair] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const res = await resolveSymbol("HYPE");
    expect(res.kind).toBe("resolved");
    if (res.kind === "resolved") {
      expect(res.token.chain).toBe("hyperliquid");
      expect(res.token.name).toBe("Hyperliquid");
      expect(res.token.priceUsd).toBeCloseTo(78.25, 2);
    }
    fetchSpy.mockRestore();
  });
});


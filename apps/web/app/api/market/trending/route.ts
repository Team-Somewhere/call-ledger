import { NextResponse } from "next/server";

interface TickerPrice {
  symbol: string;
  id: string;
  priceUsd: number;
  change24h: number;
  lastUpdated: number;
}

const TOKEN_MAPPING: Record<string, { id: string; name: string; defaultChain: string }> = {
  BTC: { id: "bitcoin", name: "Bitcoin", defaultChain: "bitcoin" },
  ETH: { id: "ethereum", name: "Ethereum", defaultChain: "ethereum" },
  SOL: { id: "solana", name: "Solana", defaultChain: "solana" },
  HYPE: { id: "hyperliquid", name: "Hyperliquid", defaultChain: "hyperliquid" },
  AVAX: { id: "avalanche-2", name: "Avalanche", defaultChain: "avalanche" },
};

// In-memory server cache
let cachedPrices: Record<string, TickerPrice> | null = null;
let lastPricesFetch = 0;
const CACHE_TTL_MS = 15_000; // 15 seconds

const chartCache: Record<string, { data: Array<{ time: number; value: number }>; timestamp: number }> = {};
const CHART_CACHE_TTL_MS = 60_000; // 1 minute

async function fetchLivePrices(): Promise<Record<string, TickerPrice>> {
  const now = Date.now();
  if (cachedPrices && now - lastPricesFetch < CACHE_TTL_MS) {
    return cachedPrices;
  }

  const ids = Object.values(TOKEN_MAPPING)
    .map((m) => m.id)
    .join(",");

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 15 },
      },
    );

    if (!res.ok) {
      throw new Error(`CoinGecko responded with ${res.status}`);
    }

    const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
    const results: Record<string, TickerPrice> = {};

    for (const [sym, meta] of Object.entries(TOKEN_MAPPING)) {
      const coin = data[meta.id];
      if (coin && typeof coin.usd === "number") {
        results[sym] = {
          symbol: sym,
          id: meta.id,
          priceUsd: coin.usd,
          change24h: coin.usd_24h_change ?? 0,
          lastUpdated: now,
        };
      }
    }

    cachedPrices = results;
    lastPricesFetch = now;
    return results;
  } catch (err) {
    console.warn("CoinGecko price fetch failed, using fallback/cached:", err);
    if (cachedPrices) return cachedPrices;

    // Default safe fallback if network is unreachable
    return {
      BTC: { symbol: "BTC", id: "bitcoin", priceUsd: 75750, change24h: -0.15, lastUpdated: now },
      ETH: { symbol: "ETH", id: "ethereum", priceUsd: 2228, change24h: 0.12, lastUpdated: now },
      SOL: { symbol: "SOL", id: "solana", priceUsd: 89.9, change24h: 0.45, lastUpdated: now },
      HYPE: { symbol: "HYPE", id: "hyperliquid", priceUsd: 78.35, change24h: 0.82, lastUpdated: now },
      AVAX: { symbol: "AVAX", id: "avalanche-2", priceUsd: 8.38, change24h: 0.95, lastUpdated: now },
    };
  }
}

async function fetchHistoricalChart(
  symbol: string,
  days: number,
): Promise<Array<{ time: number; value: number }>> {
  const sym = symbol.toUpperCase().replace(/^\$/, "");
  const meta = TOKEN_MAPPING[sym] ?? TOKEN_MAPPING.BTC!;
  const cacheKey = `${sym}_${days}`;
  const now = Date.now();

  if (chartCache[cacheKey] && now - chartCache[cacheKey].timestamp < CHART_CACHE_TTL_MS) {
    return chartCache[cacheKey].data;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${meta.id}/market_chart?vs_currency=usd&days=${days}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      },
    );

    if (!res.ok) {
      throw new Error(`Market chart returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as { prices?: Array<[number, number]> };
    if (!json.prices || !Array.isArray(json.prices)) {
      throw new Error("Invalid market chart response");
    }

    // Deduplicate and convert to UTC seconds for Lightweight Charts
    const points: Array<{ time: number; value: number }> = [];
    const seenTimes = new Set<number>();

    for (const [timestampMs, price] of json.prices) {
      const timeSec = Math.floor(timestampMs / 1000);
      if (!seenTimes.has(timeSec)) {
        seenTimes.add(timeSec);
        points.push({ time: timeSec, value: Number(price.toFixed(price < 1 ? 6 : 2)) });
      }
    }

    chartCache[cacheKey] = { data: points, timestamp: now };
    return points;
  } catch (err) {
    console.warn(`Historical chart fetch failed for ${sym}:`, err);
    // Synthetic smooth fallback if CoinGecko is throttled
    const currentPrice = cachedPrices?.[sym]?.priceUsd || 100;
    const points: Array<{ time: number; value: number }> = [];
    const stepCount = days === 1 ? 24 : days * 4;
    const timeStepSec = Math.floor((days * 86400) / stepCount);
    const startSec = Math.floor(Date.now() / 1000) - days * 86400;

    for (let i = 0; i <= stepCount; i++) {
      const variance = (Math.sin(i * 0.3) + Math.cos(i * 0.7)) * 0.015;
      points.push({
        time: startSec + i * timeStepSec,
        value: Number((currentPrice * (1 + variance)).toFixed(2)),
      });
    }

    return points;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chartSymbol = searchParams.get("chart");
  const daysParam = parseInt(searchParams.get("days") || "1", 10);

  if (chartSymbol) {
    const points = await fetchHistoricalChart(chartSymbol, isNaN(daysParam) ? 1 : daysParam);
    return NextResponse.json({
      success: true,
      symbol: chartSymbol.toUpperCase(),
      points,
    });
  }

  const prices = await fetchLivePrices();
  return NextResponse.json({
    success: true,
    data: prices,
  });
}

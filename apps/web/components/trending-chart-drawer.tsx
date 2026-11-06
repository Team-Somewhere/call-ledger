"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  ExternalLink,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

export interface TrendingTickerInfo {
  rank: number;
  symbol: string;
  name: string;
  sentiment: "LONG" | "SHORT" | "MIXED";
  count: string;
  priceUsd?: number;
  change24h?: number;
}

interface TrendingChartDrawerProps {
  ticker: TrendingTickerInfo | null;
  onClose: () => void;
}

type ChartRange = "1D" | "1W" | "1M";

export function TrendingChartDrawer({ ticker, onClose }: TrendingChartDrawerProps) {
  const [range, setRange] = useState<ChartRange>("1D");
  const [isLoading, setIsLoading] = useState(false);
  const [points, setPoints] = useState<Array<{ time: number; value: number }>>([]);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // Fetch historical data when ticker or range changes
  useEffect(() => {
    if (!ticker) return;
    let active = true;
    setIsLoading(true);

    const cleanSymbol = ticker.symbol.replace(/^\$/, "");
    const days = range === "1D" ? 1 : range === "1W" ? 7 : 30;

    fetch(`/api/market/trending?chart=${cleanSymbol}&days=${days}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json.success && Array.isArray(json.points)) {
          setPoints(json.points);
        }
      })
      .catch((err) => {
        console.warn("Failed to load historical chart:", err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticker, range]);

  // Initialize and update Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#78716C",
        fontSize: 10,
        fontFamily: "monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(232, 223, 209, 0.4)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: range === "1D",
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(23, 23, 23, 0.2)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "rgba(23, 23, 23, 0.2)",
          width: 1,
          style: 3,
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    const isPositive = (ticker?.change24h ?? 0) >= 0;
    const lineColor = isPositive ? "#16A34A" : "#F62440";
    const topColor = isPositive ? "rgba(22, 163, 74, 0.25)" : "rgba(246, 36, 64, 0.25)";
    const bottomColor = isPositive ? "rgba(22, 163, 74, 0.01)" : "rgba(246, 36, 64, 0.01)";

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (val: number) =>
          val >= 1000 ? `$${val.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${val.toFixed(2)}`,
      },
    });

    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && param.seriesData.get(series)) {
        const dataPoint = param.seriesData.get(series) as { value: number } | undefined;
        if (dataPoint && typeof dataPoint.value === "number") {
          setHoveredPrice(dataPoint.value);
        }
      } else {
        setHoveredPrice(null);
      }
    });

    chartApiRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, [ticker?.change24h, range]);

  // Update data points
  useEffect(() => {
    if (!seriesRef.current || points.length === 0) return;

    // Filter strictly increasing timestamps for TradingView
    const formattedData = points.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));

    seriesRef.current.setData(formattedData);
    chartApiRef.current?.timeScale().fitContent();
  }, [points]);

  if (!ticker) return null;

  const currentPrice = hoveredPrice ?? ticker.priceUsd ?? 0;
  const isPositive = (ticker.change24h ?? 0) >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm max-w-lg w-full p-5 space-y-4 shadow-xl font-mono">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-sm bg-[#171717] text-[#FFFAF3] flex items-center justify-center font-bold text-xs">
              {ticker.symbol.replace(/^\$/, "")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#171717]">{ticker.symbol}</span>
                <span className="text-xs text-[#78716C]">{ticker.name}</span>
              </div>
              <div className="text-[10px] text-[#78716C] flex items-center gap-1.5 mt-0.5">
                <span>Rank #{ticker.rank} Trending</span>
                <span>•</span>
                <span
                  className={`font-bold ${
                    ticker.sentiment === "LONG"
                      ? "text-[#16A34A]"
                      : ticker.sentiment === "SHORT"
                        ? "text-[#F62440]"
                        : "text-[#78716C]"
                  }`}
                >
                  {ticker.sentiment}
                </span>
                <span>•</span>
                <span>{ticker.count}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-[#E8DFD1]/50 text-[#78716C] hover:text-[#171717] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Price & Range selector */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#171717]">
              {currentPrice > 0
                ? `$${currentPrice.toLocaleString("en-US", {
                    minimumFractionDigits: currentPrice < 1 ? 4 : 2,
                    maximumFractionDigits: currentPrice < 1 ? 4 : 2,
                  })}`
                : "Loading..."}
            </div>
            {ticker.change24h !== undefined && (
              <div
                className={`text-xs font-bold flex items-center gap-1 mt-0.5 ${
                  isPositive ? "text-[#16A34A]" : "text-[#F62440]"
                }`}
              >
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                <span>
                  {isPositive ? "+" : ""}
                  {ticker.change24h.toFixed(2)}% (24h)
                </span>
              </div>
            )}
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1 bg-[#FFF2DB]/60 p-1 border border-[#E8DFD1] rounded-sm">
            {(["1D", "1W", "1M"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-xs transition ${
                  range === r
                    ? "bg-[#171717] text-[#FFFAF3]"
                    : "text-[#78716C] hover:text-[#171717]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Lightweight Charts Canvas */}
        <div className="relative border border-[#E8DFD1] bg-white rounded-sm p-2">
          {isLoading && (
            <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center text-[11px] text-[#78716C]">
              Loading TradingView chart...
            </div>
          )}
          <div ref={chartContainerRef} className="w-full h-[200px]" />
          <div className="text-[9px] text-[#78716C] pt-1 flex items-center justify-between border-t border-[#E8DFD1]/40">
            <span>Powered by TradingView Lightweight Charts</span>
            <span>Live CoinGecko / DexScreener Oracle</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Link
            href={`/trade?draft=${encodeURIComponent(
              JSON.stringify({
                sourcePost: { author: "Trending", id: ticker.symbol },
                direction: ticker.sentiment === "SHORT" ? "sell" : "buy",
                targetSymbol: ticker.symbol.replace(/^\$/, ""),
                contraSymbol: "USDC",
                chain: "base",
                orderType: "limit",
                suggestedQty: "50",
              })
            )}`}
            className="py-2.5 px-3 rounded-sm bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>TRADE ON FLASH</span>
          </Link>

          <a
            href="https://app.definitive.fi"
            target="_blank"
            rel="noreferrer"
            className="py-2.5 px-3 rounded-sm border border-[#E8DFD1] bg-white hover:bg-[#FFF2DB]/60 text-[#171717] font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <span>DEFINITIVE APP</span>
            <ExternalLink className="w-3 h-3 text-[#78716C]" />
          </a>
        </div>
      </div>
    </div>
  );
}


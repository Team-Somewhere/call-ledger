import { useEffect, useRef, useState } from "react";
import { AreaSeries, ColorType, createChart, LineStyle, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import type { ChartRange } from "../config/constants";
import type { ChartResult, TokenCandidate } from "../features/tokens/market-data";
import { sendMessage } from "../services/extension-messaging";
import { formatCompact, formatCurrency, type DisplayCurrency } from "../utils/formatting";

export interface RichTokenCardProps {
  symbol: string;
  currency?: DisplayCurrency;
  onClose: () => void;
  onAnalyzeStrategy?: (symbol: string) => void;
}

type ResolveState =
  | { kind: "loading" }
  | { kind: "resolved"; token: TokenCandidate }
  | { kind: "ambiguous"; candidates: TokenCandidate[] }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

function formatCardTimestamp(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[date.getMonth()];
  const d = date.getDate();
  const y = date.getFullYear();
  let hours = date.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${m} ${d}, ${y} at ${hours}:${minutes} ${ampm}`;
}

export function getDefinitiveAppUrl(symbol: string, chain?: string | null): string {
  const sym = symbol.toUpperCase();
  const ch = (chain || "").toLowerCase();

  if (sym === "HYPE" || ch === "hyperevm" || ch === "hyperliquid") {
    return "https://app.definitive.fi/native/hyperevm";
  }
  if (sym === "SOL" || sym === "WSOL" || sym === "BONK" || sym === "JUP" || sym === "RAY" || ch === "solana") {
    return "https://app.definitive.fi/native/solana";
  }
  if (sym === "ETH" || sym === "WETH" || sym === "WBTC" || sym === "BTC" || sym === "PEPE" || ch === "ethereum" || ch === "eth") {
    return "https://app.definitive.fi/native/ethereum";
  }
  if (ch === "base") {
    return "https://app.definitive.fi/native/base";
  }
  if (sym === "ARB" || ch === "arbitrum") {
    return "https://app.definitive.fi/native/arbitrum";
  }
  if (sym === "AVAX" || ch === "avalanche" || ch === "avax") {
    return "https://app.definitive.fi/native/avalanche";
  }
  if (sym === "BNB" || ch === "bsc") {
    return "https://app.definitive.fi/native/bsc";
  }
  return "https://app.definitive.fi";
}

export function RichTokenCard({ symbol, currency = "USD", onClose, onAnalyzeStrategy }: RichTokenCardProps) {
  const [resolveState, setResolveState] = useState<ResolveState>({ kind: "loading" });
  const [range, setRange] = useState<ChartRange>("1D");
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [scrubPoint, setScrubPoint] = useState<{ price: number; time: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // 1. Resolve token on mount
  useEffect(() => {
    let cancelled = false;
    setResolveState({ kind: "loading" });
    sendMessage({ type: "RESOLVE_TOKEN", symbol })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResolveState({ kind: "error", message: res.error.message });
          return;
        }
        const data = res.data as { kind: string; token?: TokenCandidate; candidates?: TokenCandidate[] };
        if (data.kind === "resolved" && data.token) {
          setResolveState({ kind: "resolved", token: data.token });
        } else if (data.kind === "ambiguous" && data.candidates && data.candidates.length > 0) {
          // Default to the highest liquidity candidate
          setResolveState({ kind: "resolved", token: data.candidates[0] });
        } else {
          setResolveState({ kind: "not_found" });
        }
      })
      .catch((err) => {
        if (!cancelled) setResolveState({ kind: "error", message: err?.message ?? "Failed to resolve token." });
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const token = resolveState.kind === "resolved" ? resolveState.token : null;

  // 2. Fetch chart whenever token or range changes
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setChartLoading(true);

    sendMessage({
      type: "GET_CHART",
      chain: token.chain,
      address: token.address,
      range,
      priceUsd: token.priceUsd,
      change24hPct: token.change24hPct,
    })
      .then((res) => {
        if (cancelled) return;
        setChartLoading(false);
        if (res.ok) {
          setChart(res.data as ChartResult);
        } else {
          setChart(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChartLoading(false);
          setChart(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, range]);

  // 3. Initialize lightweight-chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartInstance = createChart(chartContainerRef.current, {
      autoSize: true,
      height: 190,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#71767b",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.05)", style: LineStyle.Dotted },
      },
      rightPriceScale: {
        visible: false,
        borderVisible: false,
      },
      timeScale: {
        visible: false,
        borderVisible: false,
      },
      crosshair: {
        vertLine: {
          visible: true,
          color: "rgba(255, 255, 255, 0.4)",
          width: 1,
          style: LineStyle.Solid,
          labelVisible: false,
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartApiRef.current = chartInstance;

    return () => {
      chartInstance.remove();
      chartApiRef.current = null;
      seriesRef.current = null;
    };
  }, [resolveState.kind]);

  // 4. Update series data and colors
  useEffect(() => {
    const api = chartApiRef.current;
    if (!api || !chart || chart.status !== "ok" || !chart.points.length || !token) return;

    if (seriesRef.current) {
      try {
        api.removeSeries(seriesRef.current);
      } catch {
        // ignore
      }
      seriesRef.current = null;
    }

    const firstPrice = chart.points[0].open || chart.points[0].close;
    const lastPrice = chart.points[chart.points.length - 1].close;
    const isDown = lastPrice < firstPrice;

    const lineColor = isDown ? "#f4212e" : "#00ba7c";
    const topColor = isDown ? "rgba(244, 33, 46, 0.22)" : "rgba(0, 186, 124, 0.22)";
    const bottomColor = isDown ? "rgba(244, 33, 46, 0.0)" : "rgba(0, 186, 124, 0.0)";

    const series = api.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (p: number) => formatCurrency(p, currency),
        minMove: 0.0000001,
      },
    });

    series.setData(chart.points.map((p) => ({ time: p.time as UTCTimestamp, value: p.close })));

    // Dashed baseline across the open price
    try {
      series.createPriceLine({
        price: firstPrice,
        color: "rgba(255, 255, 255, 0.2)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: false,
      });
    } catch {
      // ignore
    }

    // Crosshair scrub listener
    api.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData.get(series)) {
        setScrubPoint(null);
      } else {
        const val = (param.seriesData.get(series) as { value: number })?.value;
        const timeSec = typeof param.time === "number" ? param.time : Number(param.time);
        if (val != null) {
          setScrubPoint({ price: val, time: timeSec });
        }
      }
    });

    api.timeScale().fitContent();
    seriesRef.current = series;
  }, [chart, token, currency]);

  // Derived values for price header
  const currentPrice = scrubPoint ? scrubPoint.price : token?.priceUsd ?? 0;

  let diff: number;
  let diffPct: number;

  if (scrubPoint) {
    const base = chart?.points?.[0]?.open ?? chart?.points?.[0]?.close ?? currentPrice;
    diff = currentPrice - base;
    diffPct = base > 0 ? (diff / base) * 100 : 0;
  } else if (range === "1D" && token?.change24hPct != null) {
    diffPct = token.change24hPct;
    const openPrice = currentPrice / (1 + diffPct / 100);
    diff = currentPrice - openPrice;
  } else if (chart?.points?.length) {
    const base = chart.points[0].open ?? chart.points[0].close;
    diff = currentPrice - base;
    diffPct = base > 0 ? (diff / base) * 100 : 0;
  } else {
    diffPct = token?.change24hPct ?? 0;
    const openPrice = currentPrice / (1 + diffPct / 100);
    diff = currentPrice - openPrice;
  }

  const isDown = diff < 0;

  const displayTime = scrubPoint
    ? formatCardTimestamp(new Date(scrubPoint.time * 1000))
    : formatCardTimestamp(new Date());

  const ranges: ChartRange[] = ["1D", "1W", "1M", "1Y", "ALL"];

  return (
    <div className="cl-rich-card" role="dialog" aria-label={`${symbol} chart`}>
      {/* Top Header */}
      <div className="cl-rich-card__header">
        <div className="cl-rich-card__identity">
          {token?.logoUrl ? (
            <img src={token.logoUrl} alt="" className="cl-rich-card__logo" />
          ) : (
            <div className="cl-rich-card__logo-fallback">{symbol.slice(0, 2)}</div>
          )}
          <div className="cl-rich-card__titles">
            <span className="cl-rich-card__name">{token?.name ?? symbol}</span>
            <div className="cl-rich-card__subtitle">
              {symbol} · Crypto · {token?.marketCapUsd ? `${formatCompact(token.marketCapUsd, currency)} MC` : token?.chain ?? "Live"}
            </div>
          </div>
        </div>
        <button type="button" className="cl-rich-card__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {resolveState.kind === "loading" ? (
        <div className="cl-rich-card__state">
          <div className="cl-rich-card__spinner" />
          <span>Loading token data for ${symbol}…</span>
        </div>
      ) : resolveState.kind === "error" ? (
        <div className="cl-rich-card__state cl-error">{resolveState.message}</div>
      ) : resolveState.kind === "not_found" ? (
        <div className="cl-rich-card__state cl-muted">No trading pair found for ${symbol} on DEX Screener.</div>
      ) : (
        <>
          {/* Price & Change Section */}
          <div className="cl-rich-card__pricing">
            <div className="cl-rich-card__price">{formatCurrency(currentPrice, currency)}</div>
            <div className="cl-rich-card__delta-row">
              <span className={isDown ? "cl-rich-card__delta--down" : "cl-rich-card__delta--up"}>
                {isDown ? "↓" : "↑"} {formatCurrency(Math.abs(diff), currency)} ({isDown ? "" : "+"}{diffPct.toFixed(2)}%)
              </span>
              <span className="cl-rich-card__time">{displayTime}</span>
            </div>
          </div>

          {/* Interactive Chart */}
          <div className="cl-rich-card__chart-box">
            {chartLoading && <div className="cl-rich-card__chart-loading">Updating chart…</div>}
            <div ref={chartContainerRef} className="cl-rich-card__canvas" />
          </div>

          {/* Timeframe Selector Pills */}
          <div className="cl-rich-card__ranges" role="tablist" aria-label="Chart timeframe">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                className={`cl-rich-card__range-btn ${range === r ? "cl-rich-card__range-btn--active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRange(r);
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Footer Action Bar with Definitive */}
          <div className="cl-rich-card__footer">
            <div className="cl-rich-card__meta">
              <a
                href={getDefinitiveAppUrl(symbol, token?.chain)}
                target="_blank"
                rel="noreferrer"
                className="cl-rich-card__definitive-btn"
                title={`Trade ${symbol} on Definitive`}
                onClick={(e) => e.stopPropagation()}
              >
                <span>⚡</span> Trade on Definitive ↗
              </a>
              {token?.pairUrl && (
                <a
                  href={token.pairUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cl-rich-card__link"
                  style={{ marginLeft: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  DEX Screener ↗
                </a>
              )}
            </div>
            {onAnalyzeStrategy && (
              <button
                type="button"
                className="cl-rich-card__analyze-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnalyzeStrategy(symbol);
                }}
              >
                ✨ Analyze Strategy
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

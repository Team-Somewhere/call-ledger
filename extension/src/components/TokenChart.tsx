import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import type { ChartResult } from "../features/tokens/market-data";
import { formatCurrency, type DisplayCurrency } from "../utils/formatting";

/**
 * Historical chart from real OHLCV data. Chart is created once and destroyed on
 * unmount. Shows an honest unavailable state when there is no data, and labels the
 * real span if the provider returned less than the requested range.
 */

export function TokenChart({
  chart,
  error,
  currency,
}: {
  chart: ChartResult | null;
  error: string | null;
  currency: DisplayCurrency;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const api = createChart(hostRef.current, {
      autoSize: true,
      height: 120,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9ca3af", fontSize: 10 },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.05)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });
    apiRef.current = api;
    return () => {
      api.remove();
      apiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !chart || chart.status !== "ok") return;
    const series = api.addSeries(AreaSeries, {
      lineColor: "#F5B94E",
      topColor: "rgba(245,185,78,0.28)",
      bottomColor: "rgba(245,185,78,0.02)",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (p: number) => formatCurrency(p, currency), minMove: 0.0000001 },
    });
    // Lightweight Charts requires strictly ascending, unique times.
    series.setData(chart.points.map((p) => ({ time: p.time as UTCTimestamp, value: p.close })));
    api.timeScale().fitContent();
    return () => {
      api.removeSeries(series);
    };
  }, [chart, currency]);

  if (error) return <div className="cl-chart-state cl-error">{error}</div>;
  if (!chart) return <div className="cl-chart-state cl-muted">Loading chart…</div>;
  if (chart.status !== "ok") return <div className="cl-chart-state cl-muted">{chart.reason ?? "Chart unavailable for this range."}</div>;

  const span = chart.spanDays ?? chart.points.length;
  return (
    <div>
      <div ref={hostRef} className="cl-chart" aria-label="Price history chart" />
      <div className="cl-muted cl-small">Showing {span} day{span === 1 ? "" : "s"} of daily prices.</div>
    </div>
  );
}

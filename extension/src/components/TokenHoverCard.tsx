import { useEffect, useRef, useState } from "react";
import { HOVER_HIDE_DELAY_MS, HOVER_SHOW_DELAY_MS, type ChartRange } from "../config/constants";
import type { ChartResult, TokenCandidate } from "../features/tokens/market-data";
import { getPreferences } from "../services/storage";
import { formatCompact, formatCurrency, formatPercent, type DisplayCurrency } from "../utils/formatting";
import { TokenChart } from "./TokenChart";
import { sendMessage } from "../services/extension-messaging";
import { triggerTokenOverlay, hideTokenOverlay } from "./TokenOverlay";

/**
 * Chip for one token mention. Hover (or keyboard focus) shows a card with live
 * market data and a historical chart. Data is fetched only when the card opens.
 */

type ResolveState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "resolved"; token: TokenCandidate }
  | { kind: "ambiguous"; candidates: TokenCandidate[] }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

export function TokenHoverCard({ symbol }: { symbol: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ResolveState>({ kind: "idle" });
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  const scheduleShow = () => {
    window.clearTimeout(hideTimer.current);
    showTimer.current = window.setTimeout(() => setOpen(true), HOVER_SHOW_DELAY_MS);
  };
  const scheduleHide = () => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => setOpen(false), HOVER_HIDE_DELAY_MS);
  };

  // Resolve only when the card is first opened, then keep the result.
  useEffect(() => {
    if (!open || state.kind !== "idle") return;
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const [res, prefs] = await Promise.all([sendMessage({ type: "RESOLVE_TOKEN", symbol }), getPreferences()]);
        if (cancelled) return;
        setCurrency(prefs.currency);
        if (!res.ok) return setState({ kind: "error", message: res.error.message });
        const r = res.data as { kind: string; token?: TokenCandidate; candidates?: TokenCandidate[] };
        if (r.kind === "resolved" && r.token) setState({ kind: "resolved", token: r.token });
        else if (r.kind === "ambiguous" && r.candidates) setState({ kind: "ambiguous", candidates: r.candidates });
        else setState({ kind: "not_found" });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Could not load token data." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, state.kind, symbol]);

  return (
    <span
      className="cl-token"
      onMouseEnter={(e) => {
        scheduleShow();
        triggerTokenOverlay(symbol, e.currentTarget, false);
      }}
      onMouseLeave={() => {
        scheduleHide();
        hideTokenOverlay(false);
      }}
      onFocus={(e) => {
        scheduleShow();
        triggerTokenOverlay(symbol, e.currentTarget, false);
      }}
      onBlur={() => {
        scheduleHide();
        hideTokenOverlay(false);
      }}
    >
      <button
        type="button"
        className="cl-chip"
        data-callledger-token={symbol}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          setOpen((v) => !v);
          triggerTokenOverlay(symbol, e.currentTarget, true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            hideTokenOverlay(true);
          }
        }}
      >
        ${symbol}
      </button>
      {open && (
        <div className="cl-card" role="dialog" aria-label={`${symbol} token information`} onMouseEnter={() => window.clearTimeout(hideTimer.current)} onMouseLeave={scheduleHide}>
          <TokenCardBody symbol={symbol} state={state} currency={currency} />
        </div>
      )}
    </span>
  );
}

function TokenCardBody({ symbol, state, currency }: { symbol: string; state: ResolveState; currency: DisplayCurrency }) {
  if (state.kind === "loading" || state.kind === "idle") return <div className="cl-muted">Loading {symbol}…</div>;
  if (state.kind === "error") return <div className="cl-error">{state.message}</div>;
  if (state.kind === "not_found") return <div className="cl-muted">No trading pair found for {symbol} on supported chains.</div>;
  if (state.kind === "ambiguous") {
    return (
      <div>
        <div className="cl-strong">Several tokens use the symbol {symbol}</div>
        <p className="cl-muted cl-small">Choose the correct token and chain. CallLedger will not guess.</p>
        <ul className="cl-list">
          {state.candidates.map((c) => (
            <li key={`${c.chain}:${c.address}`} className="cl-list__item">
              <span>{c.name}</span>
              <span className="cl-muted">{c.chain}</span>
              <span className="cl-muted">{c.liquidityUsd != null ? formatCompact(c.liquidityUsd, "USD") + " liq" : ""}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return <ResolvedToken token={state.token} currency={currency} />;
}

function ResolvedToken({ token, currency }: { token: TokenCandidate; currency: DisplayCurrency }) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [chart, setChart] = useState<ChartResult | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChart(null);
    setChartError(null);
    sendMessage({ type: "GET_CHART", chain: token.chain, address: token.address, range })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) setChartError(res.error.message);
        else setChart(res.data as ChartResult);
      })
      .catch(() => !cancelled && setChartError("Chart could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [token.chain, token.address, range]);

  const change = token.change24hPct;
  return (
    <div className="cl-token-card">
      <div className="cl-token-card__head">
        {token.logoUrl ? <img src={token.logoUrl} alt="" width={28} height={28} className="cl-logo" /> : <span className="cl-logo cl-logo--fallback">{token.symbol.slice(0, 2)}</span>}
        <div>
          <div className="cl-strong">{token.name}</div>
          <div className="cl-muted cl-small">{token.symbol} · {token.chain}</div>
        </div>
      </div>
      <div className="cl-price-row">
        <span className="cl-price">{formatCurrency(token.priceUsd, currency)}</span>
        <span className={change == null ? "cl-muted" : change >= 0 ? "cl-up" : "cl-down"}>{formatPercent(change)} 24h</span>
      </div>
      <dl className="cl-stats">
        <div><dt>Market cap</dt><dd>{formatCompact(token.marketCapUsd, currency)}</dd></div>
        <div><dt>Liquidity</dt><dd>{formatCompact(token.liquidityUsd, currency)}</dd></div>
        <div><dt>24h volume</dt><dd>{formatCompact(token.volume24hUsd, currency)}</dd></div>
      </dl>
      <div className="cl-range" role="tablist" aria-label="Chart range">
        {(["1W", "1M", "1Y"] as ChartRange[]).map((r) => (
          <button key={r} role="tab" aria-selected={range === r} className={range === r ? "cl-range__btn cl-range__btn--on" : "cl-range__btn"} onClick={() => setRange(r)} type="button">
            {r}
          </button>
        ))}
      </div>
      <TokenChart chart={chart} error={chartError} currency={currency} />
      <div className="cl-muted cl-small">Prices: DEX Screener / GeckoTerminal. Not financial advice.</div>
    </div>
  );
}

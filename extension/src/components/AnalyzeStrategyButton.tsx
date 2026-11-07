import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react";
import type { DetectedPost } from "../content/post-detector";
import { parseStrategy } from "../features/strategy/strategy-parser";
import type { Field, StrategyDraft } from "../features/strategy/strategy-types";
import { cleanPostText } from "../utils/sanitization";
import { sendMessage } from "../services/extension-messaging";
import {
  buildQuoteRequest,
  spotLegs,
  type BuiltQuoteRequest,
  type OrderConfig,
} from "../features/trading/draft-to-quote";
import { signTypedDataV4 } from "../content/ethereum-bridge-client";

function Value<T>({
  label,
  field,
  render,
}: {
  label: string;
  field: Field<T>;
  render?: (v: T) => string;
}) {
  return (
    <div className="cl-kv">
      <span className="cl-kv__label">{label}</span>
      {field.status === "known" ? (
        <span className="cl-kv__value" title={`From post: "${field.source}"`}>
          {render ? render(field.value) : String(field.value)}
        </span>
      ) : (
        <span className="cl-kv__unknown">Not stated</span>
      )}
    </div>
  );
}

export function AnalyzeStrategyButton({
  post,
  onOpen,
  open,
}: {
  post: DetectedPost;
  onOpen: () => void;
  open: boolean;
}) {
  const draft = useMemo(() => parseStrategy(cleanPostText(post.text)), [post.text]);
  const isComplete = draft.classification === "trading_instruction";

  return (
    <button
      type="button"
      className={isComplete ? "cl-btn cl-btn--active" : "cl-btn cl-btn--ghost"}
      onClick={onOpen}
      aria-expanded={open}
      title={
        isComplete
          ? "Complete strategy detected. Implement trade without leaving X."
          : "Analyze post for trading parameters."
      }
    >
      {isComplete ? <Zap size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
      {open ? "Hide" : isComplete ? "Implement trade" : "Check strategy"}
    </button>
  );
}

type TradePhase =
  | "idle"
  | "quoting"
  | "review"
  | "signing"
  | "submitting"
  | "done"
  | "error";

AnalyzeStrategyButton.Panel = function StrategyAnalysisPanel({
  post,
}: {
  post: DetectedPost;
}) {
  const draft: StrategyDraft = useMemo(
    () => parseStrategy(cleanPostText(post.text)),
    [post.text],
  );
  const isComplete = draft.classification === "trading_instruction";

  const legs = spotLegs(draft);
  const amountUnit = legs.ok ? legs.legs.amountUnit : "USDC";
  const defaultQty =
    draft.positionSize.status === "known" &&
    draft.positionSize.value.unit === "token" &&
    legs.ok &&
    legs.legs.side === "sell"
      ? String(draft.positionSize.value.amount)
      : draft.positionSize.status === "known" &&
          draft.positionSize.value.unit === "usd" &&
          legs.ok &&
          legs.legs.side === "buy"
        ? String(draft.positionSize.value.amount)
        : legs.ok && legs.legs.side === "sell"
          ? "0.01"
          : "10";

  const [qtyUsd, setQtyUsd] = useState(defaultQty);
  const [phase, setPhase] = useState<TradePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Record<string, unknown> | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<BuiltQuoteRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runQuote = async () => {
    setError(null);
    setPhase("quoting");
    setOrderId(null);
    try {
      const session = await sendMessage<{
        connected: boolean;
        address?: string;
      }>({ type: "GET_SESSION" });
      if (!session.ok || !session.data.connected || !session.data.address) {
        const connect = await sendMessage({ type: "BEGIN_WALLET_CONNECT" });
        if (!connect.ok) {
          setPhase("error");
          setError(connect.error.message);
          return;
        }
      }

      const session2 = await sendMessage<{
        connected: boolean;
        address?: string;
      }>({ type: "GET_SESSION" });
      if (!session2.ok || !session2.data.address) {
        setPhase("error");
        setError("Connect your wallet first.");
        return;
      }

      const configRes = await sendMessage<OrderConfig>({ type: "GET_ORDER_CONFIG" });
      if (!configRes.ok) {
        setPhase("error");
        setError(configRes.error.message);
        return;
      }

      const built = buildQuoteRequest({
        draft,
        funderAddress: session2.data.address,
        qtyUsd,
        config: configRes.data,
      });
      if (!built.ok) {
        setPhase("error");
        setError(built.message);
        return;
      }
      setNotice(built.note ?? null);

      const quoteRes = await sendMessage<Record<string, unknown>>({
        type: "REQUEST_QUOTE",
        payload: { ...built.request },
      });
      if (!quoteRes.ok) {
        setPhase("error");
        setError(quoteRes.error.message);
        return;
      }

      setQuoteRequest(built.request);
      setQuote(quoteRes.data);
      setPhase("review");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Quote failed.");
    }
  };

  const confirmTrade = async () => {
    if (!quote || !quoteRequest) return;
    setError(null);
    setPhase("signing");
    try {
      const session = await sendMessage<{ address?: string; connected: boolean }>({
        type: "GET_SESSION",
      });
      if (!session.ok || !session.data.address) {
        setPhase("error");
        setError("Wallet session expired. Connect again.");
        return;
      }

      const typed =
        (quote.evm as { orderTypedData?: unknown } | undefined)?.orderTypedData ??
        quote.evmOrderTypedData;
      if (!typed) {
        setPhase("error");
        setError("Quote did not include EIP-712 typed data to sign.");
        return;
      }

      const signature = await signTypedDataV4(
        session.data.address,
        typed as string | Record<string, unknown>,
        quoteRequest.targetChain || "base",
      );
      setPhase("submitting");

      const submitRes = await sendMessage<{
        order: { id: string };
        flashResponse?: { orderId?: string };
      }>({
        type: "SUBMIT_ORDER",
        payload: {
          ...quoteRequest,
          quoteId: quote.quoteId,
          userSignature: signature,
          evmOrderTypedData: typed,
          limitNotionalPrice: quoteRequest.limitNotionalPrice,
        },
      });

      if (!submitRes.ok) {
        setPhase("error");
        setError(submitRes.error.message);
        return;
      }

      setOrderId(submitRes.data.order?.id ?? submitRes.data.flashResponse?.orderId ?? "submitted");
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Trade failed.");
    }
  };

  return (
    <div className="cl-strategy">
      <div className="cl-strategy__head">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isComplete ? <Zap size={14} color="#00ba7c" /> : <Sparkles size={14} color="#f5b94e" />}
          <strong>
            {isComplete ? "Ready to implement on X" : "Strategy analysis"}
          </strong>
        </div>
        <span className="cl-muted">Confidence {Math.round(draft.confidence * 100)}%</span>
      </div>

      <p className="cl-muted cl-small" style={{ margin: "4px 0 8px" }}>
        {isComplete
          ? "Execute this trade via CallLedger without leaving X. Review the quote, then confirm in MetaMask."
          : "Not enough explicit parameters for a safe one-click trade. Missing fields stay unknown."}
      </p>

      <div className="cl-grid">
        <Value label="Asset" field={draft.assets[0] ?? { status: "unknown", reason: "" }} />
        <Value label="Chain" field={draft.chain} />
        <Value
          label="Side"
          field={draft.direction}
          render={(v) => (v === "long" ? "BUY" : v === "sell" ? "SELL" : "SHORT")}
        />
        <div className="cl-kv">
          <span className="cl-kv__label">Source</span>
          <span className={legs.ok ? "cl-kv__value" : "cl-kv__unknown"}>
            {legs.ok ? legs.legs.sourceSymbol : "Not stated"}
          </span>
        </div>
        <div className="cl-kv">
          <span className="cl-kv__label">Destination</span>
          <span className={legs.ok ? "cl-kv__value" : "cl-kv__unknown"}>
            {legs.ok ? legs.legs.destinationSymbol : "Not stated"}
          </span>
        </div>
        {draft.entryHigh.status === "known" && draft.entryPrice.status === "known" ? (
          <div className="cl-kv">
            <span className="cl-kv__label">Entry</span>
            <span className="cl-kv__value">
              ${draft.entryPrice.value.toLocaleString("en-US")}–$
              {draft.entryHigh.value.toLocaleString("en-US")}
            </span>
          </div>
        ) : (
          <Value label="Entry" field={draft.entryPrice} render={(v) => `$${v.toLocaleString("en-US")}`} />
        )}
        <Value label="Stop loss" field={draft.stopLoss} render={(v) => `$${v.toLocaleString("en-US")}`} />
        <Value label="Take profit" field={draft.takeProfit} render={(v) => `$${v.toLocaleString("en-US")}`} />
        <Value
          label="Position size"
          field={draft.positionSize}
          render={(v) =>
            v.unit === "usd"
              ? `$${v.amount.toLocaleString("en-US")}`
              : `${v.amount}${v.unit === "percent" ? "%" : ""}`
          }
        />
        <Value label="Order type" field={draft.orderType} />
      </div>

      {draft.warnings.length > 0 && (
        <ul className="cl-warnings">
          {draft.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {isComplete && !legs.ok && <div className="cl-follow__error">{legs.message}</div>}

      {isComplete && legs.ok && (
        <div className="cl-trade">
          <label className="cl-trade__label">
            Amount ({amountUnit})
            <input
              className="cl-trade__input"
              type="text"
              inputMode="decimal"
              value={qtyUsd}
              onChange={(e) => setQtyUsd(e.target.value)}
              disabled={phase === "quoting" || phase === "signing" || phase === "submitting"}
            />
          </label>

          {phase === "review" && quote && (
            <div className="cl-trade__quote">
              <div className="cl-muted cl-small">Quote ready — confirm to sign & submit</div>
              <div className="cl-kv">
                <span className="cl-kv__label">Quote ID</span>
                <span className="cl-kv__value">{String(quote.quoteId ?? "").slice(0, 18)}…</span>
              </div>
              {quote.expectedOutputAmount != null && (
                <div className="cl-kv">
                  <span className="cl-kv__label">Expected out</span>
                  <span className="cl-kv__value">{String(quote.expectedOutputAmount)}</span>
                </div>
              )}
              {quote.priceImpactPercentage != null && (
                <div className="cl-kv">
                  <span className="cl-kv__label">Price impact</span>
                  <span className="cl-kv__value">{String(quote.priceImpactPercentage)}%</span>
                </div>
              )}
            </div>
          )}

          {phase === "done" && orderId && (
            <div className="cl-trade__done">
              <CheckCircle2 size={14} /> Order submitted · {orderId.slice(0, 12)}…
            </div>
          )}

          {notice && <div className="cl-muted cl-small">{notice}</div>}
          {error && <div className="cl-follow__error">{error}</div>}

          <div className="cl-trade__actions">
            {(phase === "idle" || (phase === "error" && !quote) || phase === "done") && (
              <button
                type="button"
                className="cl-btn cl-btn--active"
                onClick={() => void runQuote()}
              >
                {phase === "done" ? "Get new quote" : "Get quote"}
              </button>
            )}
            {phase === "error" && quote && (
              <button
                type="button"
                className="cl-btn cl-btn--active"
                onClick={() => void confirmTrade()}
              >
                Confirm & sign in MetaMask
              </button>
            )}
            {phase === "quoting" && (
              <button type="button" className="cl-btn" disabled>
                <Loader2 size={12} className="cl-spin" /> Quoting…
              </button>
            )}
            {phase === "review" && (
              <button
                type="button"
                className="cl-btn cl-btn--active"
                onClick={() => void confirmTrade()}
              >
                Confirm & sign in MetaMask
              </button>
            )}
            {(phase === "signing" || phase === "submitting") && (
              <button type="button" className="cl-btn" disabled>
                <Loader2 size={12} className="cl-spin" />
                {phase === "signing" ? "Switching to Base, then signing…" : "Submitting…"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

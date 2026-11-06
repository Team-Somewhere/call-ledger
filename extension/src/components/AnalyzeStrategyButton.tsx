import { useMemo } from "react";
import { Sparkles, Zap } from "lucide-react";
import type { DetectedPost } from "../content/post-detector";
import { parseStrategy } from "../features/strategy/strategy-parser";
import type { Field, StrategyDraft } from "../features/strategy/strategy-types";
import { cleanPostText } from "../utils/sanitization";

/**
 * Strategy Action Button & Panel:
 * 1. Complete Instruction (all parameters known: stop loss, entry, direction) -> "⚡ Copy strategy"
 * 2. Incomplete / Discretionary (missing parameters) -> "✨ Check strategy" (AI analyzes text + chart image)
 */

function Value<T>({ label, field, render }: { label: string; field: Field<T>; render?: (v: T) => string }) {
  return (
    <div className="cl-kv">
      <span className="cl-kv__label">{label}</span>
      {field.status === "known" ? (
        <span className="cl-kv__value" title={`From post: "${field.source}"`}>
          {render ? render(field.value) : String(field.value)}
        </span>
      ) : (
        <span className="cl-kv__unknown">Not stated (AI will extract)</span>
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
      title={isComplete ? "Complete strategy detected. Click to copy." : "Analyze post and chart image with AI agent."}
    >
      {isComplete ? <Zap size={12} aria-hidden /> : <Sparkles size={12} aria-hidden />}
      {open ? "Hide analysis" : isComplete ? "Copy strategy" : "Check strategy"}
    </button>
  );
}

/** The analysis detail panel. Values show their source text and unknowns trigger AI synthesis. */
AnalyzeStrategyButton.Panel = function StrategyAnalysisPanel({ post }: { post: DetectedPost }) {
  const draft: StrategyDraft = useMemo(() => parseStrategy(cleanPostText(post.text)), [post.text]);
  const isComplete = draft.classification === "trading_instruction";
  const primarySymbol = draft.assets[0]?.status === "known" ? draft.assets[0].value : "";

  return (
    <div className="cl-strategy">
      <div className="cl-strategy__head">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isComplete ? <Zap size={14} color="#00ba7c" /> : <Sparkles size={14} color="#f5b94e" />}
          <strong>{isComplete ? "Complete Strategy Detected" : "AI Strategy Analysis"}</strong>
        </div>
        <span className="cl-muted">Confidence {Math.round(draft.confidence * 100)}%</span>
      </div>

      <p className="cl-muted cl-small" style={{ margin: "4px 0 8px" }}>
        {isComplete
          ? "All execution parameters (Direction, Entry, Stop Loss) were stated by the trader. Ready for 1-click replication."
          : "Parameters like exact stop loss or direction were not fully stated in text. The CallLedger AI Agent will analyze the post rationale and attached chart image to synthesize the trade setup."}
      </p>

      <div className="cl-grid">
        <Value label="Asset" field={draft.assets[0] ?? { status: "unknown", reason: "" }} />
        <Value label="Chain" field={draft.chain} />
        <Value label="Direction" field={draft.direction} />
        <Value label="Entry" field={draft.entryPrice} render={(v) => `$${v.toLocaleString("en-US")}`} />
        <Value label="Stop loss" field={draft.stopLoss} render={(v) => `$${v.toLocaleString("en-US")}`} />
        <Value label="Take profit" field={draft.takeProfit} render={(v) => `$${v.toLocaleString("en-US")}`} />
        <Value label="Position size" field={draft.positionSize} render={(v) => (v.unit === "usd" ? `$${v.amount.toLocaleString("en-US")}` : `${v.amount}${v.unit === "percent" ? "%" : ""}`)} />
        <Value label="Order type" field={draft.orderType} />
        <Value label="Timeframe" field={draft.timeframe} />
      </div>

      {draft.warnings.length > 0 && (
        <ul className="cl-warnings">
          {draft.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {isComplete ? (
          <a
            href={`http://localhost:3000/strategies?token=${primarySymbol}&action=copy`}
            target="_blank"
            rel="noreferrer"
            className="cl-btn cl-btn--active"
            style={{ textDecoration: "none", padding: "6px 14px", fontWeight: 700 }}
          >
            ⚡ Copy Strategy to CallLedger ↗
          </a>
        ) : (
          <a
            href={`http://localhost:3000/strategies?token=${primarySymbol}&action=analyze`}
            target="_blank"
            rel="noreferrer"
            className="cl-btn"
            style={{ textDecoration: "none", padding: "6px 14px", fontWeight: 700, borderColor: "rgba(245, 185, 78, 0.7)" }}
          >
            🤖 Analyze Post & Image with AI ↗
          </a>
        )}
      </div>
    </div>
  );
};


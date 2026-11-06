import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { DetectedPost } from "../content/post-detector";
import { parseStrategy } from "../features/strategy/strategy-parser";
import type { Field, StrategyDraft } from "../features/strategy/strategy-types";
import { cleanPostText } from "../utils/sanitization";

/**
 * Analyze Strategy: runs the deterministic parser on the post text. Analysis is
 * local and free. Nothing is executed and nothing is sent to a provider.
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
  const actionable = draft.classification === "trading_instruction" || draft.classification === "incomplete_instruction";

  return (
    <button
      type="button"
      className={actionable ? "cl-btn cl-btn--active" : "cl-btn cl-btn--ghost"}
      onClick={onOpen}
      aria-expanded={open}
      title={actionable ? "Trading strategy detected" : "Analyze post for trading strategy"}
    >
      <Sparkles size={12} aria-hidden />
      {open ? "Hide analysis" : actionable ? "Analyze strategy" : "Check strategy"}
    </button>
  );
}

/** The analysis detail panel. Values show their source text and unknowns are never filled in. */
AnalyzeStrategyButton.Panel = function StrategyAnalysisPanel({ post }: { post: DetectedPost }) {
  const draft: StrategyDraft = useMemo(() => parseStrategy(cleanPostText(post.text)), [post.text]);
  const headline =
    draft.classification === "trading_instruction"
      ? "Strategy detected"
      : draft.classification === "incomplete_instruction"
        ? "Incomplete instruction"
        : "Not a trade instruction";

  return (
    <div className="cl-strategy">
      <div className="cl-strategy__head">
        <strong>{headline}</strong>
        <span className="cl-muted">Confidence {Math.round(draft.confidence * 100)}%</span>
      </div>
      <p className="cl-muted cl-small">
        Extracted from the post text only. Nothing is assumed. Review every value before acting.
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
    </div>
  );
};


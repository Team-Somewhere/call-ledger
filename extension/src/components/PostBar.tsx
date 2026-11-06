import { useState } from "react";
import type { DetectedPost } from "../content/post-detector";
import { AnalyzeStrategyButton } from "./AnalyzeStrategyButton";
import { TokenHoverCard } from "./TokenHoverCard";

/**
 * Compact action area under an X post. Renders only the actions that apply:
 * Analyze Strategy when the post has a trade-like signal, and token chips for each symbol.
 */
export function CallLedgerPostBar({ post, symbols }: { post: DetectedPost; symbols: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="cl-root cl-postbar" data-testid="callledger-post-bar">
      <div className="cl-postbar__row">
        <span className="cl-brand" title="CallLedger for X">
          <span className="cl-brand__tag">CALL</span>
          <span className="cl-brand__name">LEDGER</span>
        </span>
        <AnalyzeStrategyButton post={post} onOpen={() => setOpen((v) => !v)} open={open} />
        {symbols.map((s) => (
          <TokenHoverCard key={s} symbol={s} />
        ))}
      </div>
      {open && (
        <div className="cl-postbar__panel" role="region" aria-label="Strategy analysis">
          <AnalyzeStrategyButton.Panel post={post} />
        </div>
      )}
    </div>
  );
}

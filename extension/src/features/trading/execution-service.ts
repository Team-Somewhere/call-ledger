/**
 * Trade execution state machine. Guards against duplicate submission,
 * double-signing and expired quotes. The actual provider and wallet are
 * injected, so this logic is testable without network or a real wallet.
 *
 * Flow: idle -> quoting -> reviewing -> awaiting_signature -> submitting
 *       -> submitted | failed | cancelled
 */

import { hasBlockingIssue, validateQuote, type QuoteForValidation, type TradeIntent, type ValidationIssue } from "./trade-validation";

export type ExecutionState =
  | { status: "idle" }
  | { status: "quoting" }
  | { status: "reviewing"; quote: QuoteForValidation; warnings: ValidationIssue[] }
  | { status: "awaiting_signature"; quote: QuoteForValidation }
  | { status: "submitting"; quote: QuoteForValidation }
  | { status: "submitted"; orderId: string }
  | { status: "failed"; code: string; message: string }
  | { status: "cancelled" };

/** Ports the service depends on. Implemented by the proxy client and the wallet manager. */
export interface ExecutionPorts {
  requestQuote(intent: TradeIntent): Promise<QuoteForValidation>;
  /** Asks the user's wallet to sign the quote's typed data. Must throw if the user rejects. */
  signOrder(quote: QuoteForValidation): Promise<string>;
  submitOrder(quote: QuoteForValidation, signature: string): Promise<{ orderId: string }>;
}

export class ExecutionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ExecutionError";
  }
}

export class ExecutionService {
  private state: ExecutionState = { status: "idle" };
  /** Quote IDs already submitted. A quote can be executed at most once. */
  private readonly submittedQuoteIds = new Set<string>();
  private inFlight = false;

  constructor(private readonly ports: ExecutionPorts, private readonly now: () => number = Date.now) {}

  getState(): ExecutionState {
    return this.state;
  }

  async quote(intent: TradeIntent): Promise<void> {
    if (this.inFlight) throw new ExecutionError("BUSY", "A trade is already in progress.");
    this.inFlight = true;
    this.state = { status: "quoting" };
    try {
      const quote = await this.ports.requestQuote(intent);
      const issues = validateQuote(intent, quote, this.now());
      if (hasBlockingIssue(issues)) {
        const first = issues.find((i) => i.code !== "PRICE_IMPACT_HIGH")!;
        this.state = { status: "failed", code: first.code, message: first.message };
        return;
      }
      this.state = { status: "reviewing", quote, warnings: issues };
    } catch (err) {
      this.state = { status: "failed", ...toFailure(err) };
    } finally {
      this.inFlight = false;
    }
  }

  cancel(): void {
    if (this.state.status === "reviewing" || this.state.status === "awaiting_signature") {
      this.state = { status: "cancelled" };
    }
  }

  /**
   * Called only after the user explicitly confirms the reviewed trade.
   * Re-validates the quote (it may have expired while the user read it) before signing.
   */
  async confirmAndExecute(intent: TradeIntent): Promise<void> {
    if (this.state.status !== "reviewing") throw new ExecutionError("NOT_REVIEWED", "Review the trade before confirming.");
    if (this.inFlight) throw new ExecutionError("BUSY", "A trade is already in progress.");
    const { quote } = this.state;

    if (this.submittedQuoteIds.has(quote.quoteId)) {
      this.state = { status: "failed", code: "DUPLICATE", message: "This quote was already submitted." };
      return;
    }
    const issues = validateQuote(intent, quote, this.now());
    if (hasBlockingIssue(issues)) {
      const first = issues.find((i) => i.code !== "PRICE_IMPACT_HIGH")!;
      this.state = { status: "failed", code: first.code, message: first.message };
      return;
    }

    this.inFlight = true;
    // Reserve the quote before any await so a double click cannot submit it twice.
    this.submittedQuoteIds.add(quote.quoteId);
    try {
      this.state = { status: "awaiting_signature", quote };
      const signature = await this.ports.signOrder(quote);

      this.state = { status: "submitting", quote };
      const { orderId } = await this.ports.submitOrder(quote, signature);
      this.state = { status: "submitted", orderId };
    } catch (err) {
      // The quote stays reserved: a retry after a failure needs a fresh quote.
      this.state = { status: "failed", ...toFailure(err) };
    } finally {
      this.inFlight = false;
    }
  }
}

function toFailure(err: unknown): { code: string; message: string } {
  if (err instanceof ExecutionError) return { code: err.code, message: err.message };
  if (err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === 4001) {
    return { code: "USER_REJECTED", message: "You rejected the signature in your wallet. Nothing was submitted." };
  }
  const message = err instanceof Error ? err.message : "Unexpected error.";
  return { code: "FAILED", message };
}

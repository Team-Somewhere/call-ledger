import { describe, expect, it, vi } from "vitest";
import { ExecutionService, type ExecutionPorts } from "../features/trading/execution-service";
import { isValidAddress, isValidQty, validateQuote, type TradeIntent, type QuoteForValidation } from "../features/trading/trade-validation";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NOW = Date.parse("2026-11-06T10:00:00Z");

const intent: TradeIntent = { chain: "base", targetAsset: WETH, contraAsset: USDC, side: "buy", qty: "100", maxSlippage: 1 };
const quote = (over: Partial<QuoteForValidation> = {}): QuoteForValidation => ({
  quoteId: "q1",
  chain: "base",
  targetAsset: WETH,
  contraAsset: USDC,
  side: "buy",
  expiresAt: new Date(NOW + 60_000).toISOString(),
  estimatedPriceImpact: 0.001,
  ...over,
});

function ports(overrides: Partial<ExecutionPorts> = {}): ExecutionPorts {
  return {
    requestQuote: vi.fn(async () => quote()),
    signOrder: vi.fn(async () => "0xsig"),
    submitOrder: vi.fn(async () => ({ orderId: "ord_1" })),
    ...overrides,
  };
}

describe("trade validation", () => {
  it("accepts a matching, fresh quote", () => {
    expect(validateQuote(intent, quote(), NOW)).toEqual([]);
  });

  it("rejects an expired quote", () => {
    const issues = validateQuote(intent, quote({ expiresAt: new Date(NOW - 1).toISOString() }), NOW);
    expect(issues.map((i) => i.code)).toContain("QUOTE_EXPIRED");
  });

  it("rejects a quote for a different asset or chain than reviewed", () => {
    const issues = validateQuote(intent, quote({ targetAsset: "0x0000000000000000000000000000000000000001" }), NOW);
    expect(issues.map((i) => i.code)).toContain("QUOTE_MISMATCH");
  });

  it("rejects a non-decimal quantity such as an INR figure written as text", () => {
    expect(isValidQty("₹5000")).toBe(false);
    expect(isValidQty("1e3")).toBe(false);
    expect(isValidQty("0")).toBe(false);
    expect(isValidQty("12.5")).toBe(true);
  });

  it("rejects an invalid EVM address", () => {
    expect(isValidAddress("base", "0x123")).toBe(false);
    expect(isValidAddress("base", WETH)).toBe(true);
  });

  it("flags high price impact as a warning rather than a block", () => {
    const issues = validateQuote(intent, quote({ estimatedPriceImpact: 0.05 }), NOW);
    expect(issues.map((i) => i.code)).toEqual(["PRICE_IMPACT_HIGH"]);
  });
});

describe("execution service", () => {
  it("requests a quote and moves to reviewing", async () => {
    const svc = new ExecutionService(ports(), () => NOW);
    await svc.quote(intent);
    expect(svc.getState().status).toBe("reviewing");
  });

  it("does not sign before the user confirms", async () => {
    const p = ports();
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    expect(p.signOrder).not.toHaveBeenCalled();
  });

  it("signs and submits after confirmation and reports the order id", async () => {
    const p = ports();
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    await svc.confirmAndExecute(intent);
    expect(p.signOrder).toHaveBeenCalledTimes(1);
    expect(p.submitOrder).toHaveBeenCalledWith(expect.objectContaining({ quoteId: "q1" }), "0xsig");
    expect(svc.getState()).toEqual({ status: "submitted", orderId: "ord_1" });
  });

  it("prevents duplicate submission from a double click", async () => {
    const p = ports();
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    await Promise.all([svc.confirmAndExecute(intent), svc.confirmAndExecute(intent).catch(() => undefined)]);
    expect(p.submitOrder).toHaveBeenCalledTimes(1);
  });

  it("never submits the same quote twice", async () => {
    const p = ports({ submitOrder: vi.fn(async () => { throw new Error("network down"); }) });
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    await svc.confirmAndExecute(intent);
    expect(svc.getState().status).toBe("failed");
    // Re-confirming the same reserved quote must not sign or submit again.
    await svc.confirmAndExecute(intent).catch(() => undefined);
    expect(p.submitOrder).toHaveBeenCalledTimes(1);
  });

  it("handles a rejected wallet signature without submitting", async () => {
    const p = ports({ signOrder: vi.fn(async () => { throw Object.assign(new Error("denied"), { code: 4001 }); }) });
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    await svc.confirmAndExecute(intent);
    expect(svc.getState()).toMatchObject({ status: "failed", code: "USER_REJECTED" });
    expect(p.submitOrder).not.toHaveBeenCalled();
  });

  it("handles a failed submission", async () => {
    const p = ports({ submitOrder: vi.fn(async () => { throw new Error("slippage exceeded"); }) });
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    await svc.confirmAndExecute(intent);
    expect(svc.getState()).toMatchObject({ status: "failed", message: "slippage exceeded" });
  });

  it("rejects an expired quote at confirm time, without signing", async () => {
    let clock = NOW;
    const p = ports({ requestQuote: vi.fn(async () => quote({ expiresAt: new Date(NOW + 1000).toISOString() })) });
    const svc = new ExecutionService(p, () => clock);
    await svc.quote(intent);
    clock = NOW + 5000; // the user read the review for longer than the quote lives
    await svc.confirmAndExecute(intent);
    expect(svc.getState()).toMatchObject({ status: "failed", code: "QUOTE_EXPIRED" });
    expect(p.signOrder).not.toHaveBeenCalled();
  });

  it("fails cleanly when the quote request is rejected", async () => {
    const p = ports({ requestQuote: vi.fn(async () => { throw new Error("insufficient balance"); }) });
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    expect(svc.getState()).toMatchObject({ status: "failed", message: "insufficient balance" });
  });

  it("refuses to confirm when nothing was reviewed", async () => {
    const svc = new ExecutionService(ports(), () => NOW);
    await expect(svc.confirmAndExecute(intent)).rejects.toMatchObject({ code: "NOT_REVIEWED" });
  });

  it("can be cancelled during review without signing", async () => {
    const p = ports();
    const svc = new ExecutionService(p, () => NOW);
    await svc.quote(intent);
    svc.cancel();
    expect(svc.getState().status).toBe("cancelled");
    expect(p.signOrder).not.toHaveBeenCalled();
  });
});

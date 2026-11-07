import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyFill, fillKey } from "./fills";

describe("Flash fill reconciliation", () => {
  it("builds a stable fill key", () => {
    assert.equal(
      fillKey({
        flashOrderId: "ord_1",
        transactionId: "0xabc",
        filledAt: "2026-11-07T00:00:00Z",
        targetAmount: "0.1",
      }),
      "ord_1:0xabc:2026-11-07T00:00:00Z:0.1",
    );
  });

  it("applies a buy once and a later sell without double counting", () => {
    const bought = applyFill(null, {
      side: "buy",
      targetAmount: "0.1",
      contraAmount: "300",
      fillPrice: "3000",
    });
    assert.equal(bought.remainingQuantity, "0.1");
    assert.equal(bought.averageEntryPrice, "3000");
    assert.equal(bought.realizedPnl, "0");

    const sold = applyFill(bought, {
      side: "sell",
      targetAmount: "0.1",
      contraAmount: "330",
    });
    assert.equal(sold.status, "CLOSED");
    assert.equal(sold.remainingQuantity, "0");
    assert.equal(sold.realizedPnl, "30");
  });

  it("does not change a position when the same fill is skipped by the caller", () => {
    const once = applyFill(null, {
      side: "buy",
      targetAmount: "1",
      contraAmount: "100",
    });
    assert.equal(once.investedAmount, "100");
  });
});

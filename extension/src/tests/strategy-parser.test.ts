import { describe, expect, it } from "vitest";
import { parseStrategy } from "../features/strategy/strategy-parser";
import { strategyDraftSchema } from "../features/strategy/strategy-schema";

const known = (f: { status: string }) => f.status === "known";

describe("strategy parser: classification", () => {
  it("extracts a complete trading instruction", () => {
    const d = parseStrategy("Buy ETH on Base around $3,000. Stop loss $2,850. Target $3,400.");
    expect(d.classification).toBe("trading_instruction");
    expect(d.assets[0]).toMatchObject({ status: "known", value: "ETH" });
    expect(d.chain).toMatchObject({ status: "known", value: "base" });
    expect(d.entryPrice).toMatchObject({ status: "known", value: 3000 });
    expect(d.stopLoss).toMatchObject({ status: "known", value: 2850 });
    expect(d.takeProfit).toMatchObject({ status: "known", value: 3400 });
    expect(d.direction).toMatchObject({ status: "known", value: "long" });
  });

  it("treats a market opinion as not executable", () => {
    const d = parseStrategy("ETH looks bullish.");
    expect(d.classification).toBe("opinion");
    expect(known(d.entryPrice)).toBe(false);
    expect(known(d.stopLoss)).toBe(false);
  });

  it("flags a bare action with no price as incomplete", () => {
    const d = parseStrategy("Buy ETH.");
    expect(d.classification).toBe("incomplete_instruction");
    expect(known(d.entryPrice)).toBe(false);
    expect(known(d.positionSize)).toBe(false);
  });

  it("recognises a historical trade report and withholds parameters", () => {
    const d = parseStrategy("I bought ETH at $2,000 last week and made 20%");
    expect(d.classification).toBe("historical_report");
    expect(known(d.entryPrice)).toBe(false);
    expect(known(d.positionSize)).toBe(false);
  });

  it("recognises sarcasm and jokes", () => {
    expect(parseStrategy("lol buy ETH at $1 /s").classification).toBe("joke_or_sarcasm");
  });

  it("treats a conditional example as hypothetical", () => {
    expect(parseStrategy("If ETH drops to $2,500 I'd buy").classification).toBe("hypothetical");
  });

  it("returns discussion for a token mention with no action", () => {
    expect(parseStrategy("Solana had a wild week, what do you all think?").classification).toBe("discussion");
  });
});

describe("strategy parser: no invented values", () => {
  it("does not treat a plain price as a position size", () => {
    const d = parseStrategy("Buy ETH on Base around $3,000. Stop loss $2,850. Target $3,400.");
    expect(known(d.positionSize)).toBe(false);
  });

  it("reads a dollar amount as a position size only with a size word", () => {
    const d = parseStrategy("Long SOL at $150, stop $140, target $170, $500 worth");
    expect(d.positionSize).toMatchObject({ status: "known", value: { amount: 500, unit: "usd" } });
  });

  it("does not guess a chain from an ambiguous ticker", () => {
    const d = parseStrategy("Buy ETH at $3,000");
    expect(known(d.chain)).toBe(false);
  });

  it("keeps the source text for every known value", () => {
    const d = parseStrategy("Buy ETH on Base around $3,000. Stop loss $2,850.");
    if (d.stopLoss.status !== "known") throw new Error("expected stop loss");
    expect(d.stopLoss.source).toMatch(/2,850/);
  });
});

describe("strategy parser: price-level sanity", () => {
  it("warns when a long stop loss is above entry", () => {
    const d = parseStrategy("Buy ETH at $3,000, stop loss $3,200, target $3,400");
    expect(d.warnings.join(" ")).toMatch(/Stop loss is on the wrong side/);
  });

  it("warns when a long take profit is below entry", () => {
    const d = parseStrategy("Buy ETH at $3,000, stop loss $2,850, target $2,900");
    expect(d.warnings.join(" ")).toMatch(/Take profit is on the wrong side/);
  });
});

describe("strategy parser: sell, short, and entry", () => {
  const sellPost = [
    "Direction: SELL",
    "Asset: ETH",
    "Network: Base",
    "Entry: $3,000",
    "Stop Loss: $3,100",
    "Take Profit: $2,800",
    "Order Type: Limit",
  ].join("\n");

  it("extracts a spot sell without turning it into a long", () => {
    const d = parseStrategy(sellPost);
    expect(d.direction).toMatchObject({ status: "known", value: "sell" });
    expect(d.entryPrice).toMatchObject({ status: "known", value: 3000 });
    expect(d.entryHigh.status).toBe("unknown");
    expect(d.stopLoss).toMatchObject({ status: "known", value: 3100 });
    expect(d.takeProfit).toMatchObject({ status: "known", value: 2800 });
    expect(d.orderType).toMatchObject({ status: "known", value: "limit" });
    expect(d.assets[0]).toMatchObject({ status: "known", value: "ETH" });
    expect(d.chain).toMatchObject({ status: "known", value: "base" });
  });

  it("extracts a buy entry and leaves stops optional", () => {
    const d = parseStrategy("Buy ETH at $3000");
    expect(d.direction).toMatchObject({ status: "known", value: "long" });
    expect(d.entryPrice).toMatchObject({ status: "known", value: 3000 });
    expect(d.stopLoss.status).toBe("unknown");
    expect(d.takeProfit.status).toBe("unknown");
  });

  it("keeps a short distinct from a spot sell", () => {
    const d = parseStrategy("SHORT ETH at $3000");
    expect(d.direction).toMatchObject({ status: "known", value: "short" });
    expect(d.entryPrice).toMatchObject({ status: "known", value: 3000 });
  });

  it("keeps both boundaries of an entry zone", () => {
    const d = parseStrategy("Buy ETH. Entry zone: $2,950–$3,000");
    expect(d.entryPrice).toMatchObject({ status: "known", value: 2950 });
    expect(d.entryHigh).toMatchObject({ status: "known", value: 3000 });
  });

  it("reads sell-around and enter-at prices", () => {
    expect(parseStrategy("Sell ETH around $3000").entryPrice).toMatchObject({ status: "known", value: 3000 });
    expect(parseStrategy("Enter at 3000. Buy ETH.").entryPrice).toMatchObject({ status: "known", value: 3000 });
  });
});

describe("strategy schema", () => {
  it("accepts a parser result", () => {
    const d = parseStrategy("Buy ETH on Base around $3,000. Stop loss $2,850. Target $3,400.");
    expect(strategyDraftSchema.safeParse(d).success).toBe(true);
  });

  it("rejects an out-of-range confidence", () => {
    const d = { ...parseStrategy("Buy ETH"), confidence: 2 };
    expect(strategyDraftSchema.safeParse(d).success).toBe(false);
  });
});

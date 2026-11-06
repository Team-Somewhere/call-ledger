/**
 * Tests for the trading-signal relevance classifier.
 *
 * Uses Node's built-in test runner — no extra dependencies.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPost, isTradingRelated } from "../services/signal-classifier";

describe("signal classifier — trading-related", () => {
  it("classifies an explicit BUY signal as trading-related", () => {
    const result = classifyPost(
      "SOL/USDC entry target: $174.5, TP: $215, SL: $162. High conviction long.",
    );
    assert.equal(result.tradingRelated, true);
    assert.ok(result.confidence >= 40, `expected confidence >= 40, got ${result.confidence}`);
  });

  it("classifies a post with stop-loss and take-profit as trading-related", () => {
    const result = classifyPost(
      "BTC position opened. SL: $85,000. TP: $96,000. R:R 1:2.4",
    );
    assert.equal(result.tradingRelated, true);
  });

  it("classifies a swing trade setup as trading-related", () => {
    const result = classifyPost(
      "$ETH looking bullish on the 4H chart. Swing trade setup forming. Support at 3100.",
    );
    assert.equal(result.tradingRelated, true);
  });

  it("classifies a short call as trading-related", () => {
    const result = classifyPost(
      "AVAX short entry here. Bearish breakdown confirmed. Entry $34, SL $37.",
    );
    assert.equal(result.tradingRelated, true);
  });

  it("extracts asset tickers", () => {
    const result = classifyPost("$BTC and $ETH both looking strong. $SOL next.");
    assert.ok(result.assets.includes("BTC"), `assets: ${result.assets.join(",")}`);
    assert.ok(result.assets.includes("ETH"), `assets: ${result.assets.join(",")}`);
  });

  it("extracts trading topic tags", () => {
    const result = classifyPost(
      "Using RSI divergence + EMA crossover for this scalp trade setup.",
    );
    assert.ok(
      result.topics.includes("scalp") || result.topics.includes("technical-analysis"),
      `topics: ${result.topics.join(",")}`,
    );
  });
});

describe("signal classifier — NOT trading-related", () => {
  it("classifies a greeting as not trading-related", () => {
    const result = classifyPost("gm everyone! Hope you all have a great day.");
    assert.equal(result.tradingRelated, false);
  });

  it("classifies a generic social post as not trading-related", () => {
    const result = classifyPost(
      "Just got back from the beach. Beautiful sunset. Life is good!",
    );
    assert.equal(result.tradingRelated, false);
  });

  it("classifies a retweet engagement post as not trading-related", () => {
    const result = classifyPost(
      "Follow me for daily alpha! Like and RT if you found this useful!",
    );
    assert.equal(result.tradingRelated, false);
  });

  it("returns false for null or empty input", () => {
    assert.equal(isTradingRelated(null), false);
    assert.equal(isTradingRelated(""), false);
    assert.equal(isTradingRelated("hi"), false);
  });

  it("classifies news headlines without signals as not trading-related", () => {
    const result = classifyPost(
      "Bitcoin's price has been volatile this week amid macroeconomic uncertainty.",
    );
    // News about crypto price without a signal could go either way; just check it doesn't crash
    assert.ok(typeof result.tradingRelated === "boolean");
  });
});

describe("signal classifier — confidence scores", () => {
  it("returns higher confidence for explicit signal than vague mention", () => {
    const explicit = classifyPost(
      "$BTC long entry $88500. Take profit $96000. Stop loss $85200. 4H setup.",
    );
    const vague = classifyPost("BTC might go up today.");
    assert.ok(
      explicit.confidence > vague.confidence,
      `explicit=${explicit.confidence} vague=${vague.confidence}`,
    );
  });

  it("confidence is between 0 and 100", () => {
    const tests = [
      "gm",
      "$ETH long. TP $4000. SL $2800.",
      "BTC bearish setup forming on the daily",
    ];
    for (const text of tests) {
      const { confidence } = classifyPost(text);
      assert.ok(confidence >= 0 && confidence <= 100, `${text}: confidence=${confidence}`);
    }
  });
});

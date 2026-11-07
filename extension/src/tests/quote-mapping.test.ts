import { describe, expect, it } from "vitest";
import { parseStrategy } from "../features/strategy/strategy-parser";
import { buildQuoteRequest, type OrderConfig } from "../features/trading/draft-to-quote";

const WETH = "0x4200000000000000000000000000000000000006";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const config: OrderConfig = {
  configured: true,
  verifiedAssets: {
    base: {
      ETH: { symbol: "ETH", address: WETH, decimals: 18, chain: "base" },
      USDC: { symbol: "USDC", address: USDC, decimals: 6, chain: "base" },
    },
  },
};

const funder = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

function quote(text: string, qty: string) {
  return buildQuoteRequest({
    draft: parseStrategy(text),
    funderAddress: funder,
    qtyUsd: qty,
    config,
  });
}

describe("Flash quote mapping", () => {
  it("A. maps a spot ETH sell limit to target WETH, ETH qty, and limitNotionalPrice", () => {
    const built = quote(
      "SELL ETH on Base. Entry: $3,000. Stop Loss: $3,100. Take Profit: $2,800. Order Type: Limit",
      "0.05",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request).toMatchObject({
      targetChain: "base",
      contraChain: "base",
      targetAsset: WETH,
      contraAsset: USDC,
      side: "sell",
      qty: "0.05",
      orderType: "limit",
      limitNotionalPrice: "3000",
    });
    expect(built.request.limitNotionalPrice).toBe("3000");
    expect("limitCrossPrice" in built.request).toBe(false);
  });

  it("B. maps a buy limit to USDC qty and the same entry", () => {
    const built = quote(
      "BUY ETH on Base. Entry: $3,000. Stop Loss: $2,900. Take Profit: $3,300. Order Type: Limit",
      "10",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request).toMatchObject({
      side: "buy",
      qty: "10",
      orderType: "limit",
      limitNotionalPrice: "3000",
      targetAsset: WETH,
      contraAsset: USDC,
    });
  });

  it("C. uses the stated buy price as the limit price when stops are absent", () => {
    const built = quote("Buy ETH at $3000", "10");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.request.side).toBe("buy");
    expect(built.request.limitNotionalPrice).toBe("3000");
    expect(built.request.orderType).toBe("limit");
  });

  it("D. keeps a sell with no entry from becoming a limit order", () => {
    const parsed = parseStrategy("SELL ETH. Order Type: Limit");
    expect(parsed.direction).toMatchObject({ status: "known", value: "sell" });
    expect(parsed.entryPrice.status).toBe("unknown");
    const built = quote("SELL ETH. Order Type: Limit", "0.05");
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.message).toMatch(/entry price/i);
  });

  it("E. does not turn a short into a spot sell quote", () => {
    const parsed = parseStrategy("SHORT ETH at $3000");
    expect(parsed.direction).toMatchObject({ status: "known", value: "short" });
    const built = quote("SHORT ETH at $3000", "0.05");
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.message).toMatch(/SHORT/);
    expect(built.message).toMatch(/leveraged short/);
  });
});

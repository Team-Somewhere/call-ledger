import type { StrategyDraft } from "../strategy/strategy-types";

export interface VerifiedAsset {
  symbol: string;
  address: string;
  decimals: number;
  chain: string;
}

export interface OrderConfig {
  configured: boolean;
  verifiedAssets: Record<string, Record<string, VerifiedAsset>>;
}

export interface BuiltQuoteRequest {
  targetChain: string;
  contraChain: string;
  targetAsset: string;
  contraAsset: string;
  side: "buy" | "sell";
  qty: string;
  orderType: "market" | "limit";
  limitNotionalPrice?: string;
  funderAddress: string;
  maxSlippage?: string;
}

export interface SpotLegs {
  side: "buy" | "sell";
  /** Asset being traded. Flash calls this the target asset. */
  assetSymbol: string;
  /** Spent on a buy, received on a sell. */
  sourceSymbol: string;
  destinationSymbol: string;
  amountUnit: string;
}

function pickAsset(
  config: OrderConfig,
  chain: string,
  symbol: string,
): VerifiedAsset | null {
  const chainAssets = config.verifiedAssets[chain];
  if (!chainAssets) return null;
  const aliases: Record<string, string> = {
    BITCOIN: "BTC",
    XBT: "BTC",
    ETHER: "ETH",
    ETHERUM: "ETH",
  };
  const upper = symbol.toUpperCase();
  return chainAssets[upper] ?? chainAssets[aliases[upper] ?? ""] ?? null;
}

const STABLES = new Set(["USDC", "USDT", "DAI"]);

/** Spot legs from an already-parsed draft. Does not re-read the post. */
export function spotLegs(draft: StrategyDraft): { ok: true; legs: SpotLegs } | { ok: false; message: string } {
  if (draft.direction.status !== "known") {
    return { ok: false, message: "The post does not state whether to buy, sell, or short." };
  }
  if (draft.direction.value === "short") {
    return {
      ok: false,
      message:
        "This post opens a SHORT. A Base spot quote can buy or sell ETH, but it cannot open a leveraged short.",
    };
  }
  const asset = draft.assets.find(
    (item) => item.status === "known" && !STABLES.has(item.value.toUpperCase()),
  );
  const assetSymbol = asset?.status === "known" ? asset.value.toUpperCase() : "ETH";
  const side = draft.direction.value === "sell" ? "sell" : "buy";
  return {
    ok: true,
    legs: {
      side,
      assetSymbol,
      sourceSymbol: side === "sell" ? assetSymbol : "USDC",
      destinationSymbol: side === "sell" ? "USDC" : assetSymbol,
      amountUnit: side === "sell" ? assetSymbol : "USDC",
    },
  };
}

/** Convert a parsed strategy draft + amount into a Flash quote payload. */
export function buildQuoteRequest(params: {
  draft: StrategyDraft;
  funderAddress: string;
  qtyUsd: string;
  config: OrderConfig;
}): { ok: true; request: BuiltQuoteRequest; note?: string } | { ok: false; message: string } {
  const { draft, funderAddress, qtyUsd, config } = params;

  if (!config.configured) {
    return { ok: false, message: "Trading is not configured on this CallLedger deployment." };
  }

  const legsResult = spotLegs(draft);
  if (!legsResult.ok) return legsResult;
  const { side, assetSymbol, amountUnit } = legsResult.legs;

  const chain =
    draft.chain.status === "known" ? draft.chain.value.toLowerCase() : "base";
  const target = pickAsset(config, chain, assetSymbol) ?? pickAsset(config, "base", assetSymbol);
  const usdc =
    pickAsset(config, target?.chain ?? chain, "USDC") ??
    pickAsset(config, "base", "USDC");

  if (!target || !usdc) {
    return {
      ok: false,
      message: `Asset ${assetSymbol} on ${chain} is not in CallLedger verified assets.`,
    };
  }

  const qty = qtyUsd.trim();
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(qty) || Number(qty) <= 0) {
    return { ok: false, message: `Enter a valid positive ${amountUnit} amount.` };
  }

  if (side === "buy" && Number(qty) < 0.05) {
    return {
      ok: false,
      message:
        "Amount is too small. Flash rejects buys under about 0.05 USDC because the trading fee is larger than the tokens you would receive.",
    };
  }

  const explicitMarket =
    draft.orderType.status === "known" && draft.orderType.value === "market";
  const explicitLimit =
    draft.orderType.status === "known" && draft.orderType.value === "limit";
  const entryLow = draft.entryPrice.status === "known" ? draft.entryPrice.value : null;
  const entryHigh = draft.entryHigh.status === "known" ? draft.entryHigh.value : null;
  const ranged = entryLow != null && entryHigh != null && entryHigh !== entryLow;
  const singleEntry = entryLow != null && !ranged;

  if (ranged && !explicitMarket && entryLow != null && entryHigh != null) {
    return {
      ok: false,
      message: `Entry is a range ($${entryLow.toLocaleString("en-US")}–$${entryHigh.toLocaleString("en-US")}). A limit quote needs one of those prices.`,
    };
  }
  const orderType = explicitMarket ? "market" : explicitLimit || singleEntry ? "limit" : "market";
  if (orderType === "limit" && !singleEntry) {
    return {
      ok: false,
      message: "A limit order needs an entry price. This post does not state one.",
    };
  }

  const request: BuiltQuoteRequest = {
    targetChain: target.chain,
    contraChain: usdc.chain,
    targetAsset: target.address,
    contraAsset: usdc.address,
    side,
    qty,
    orderType,
    funderAddress: funderAddress.toLowerCase(),
  };
  if (orderType === "market") request.maxSlippage = "0.005";
  if (orderType === "limit" && draft.entryPrice.status === "known") {
    request.limitNotionalPrice = String(draft.entryPrice.value);
  }

  return { ok: true, request };
}

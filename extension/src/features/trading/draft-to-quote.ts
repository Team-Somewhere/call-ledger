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

function pickAsset(
  config: OrderConfig,
  chain: string,
  symbol: string,
): VerifiedAsset | null {
  const chainAssets = config.verifiedAssets[chain];
  if (!chainAssets) return null;
  const upper = symbol.toUpperCase();
  return chainAssets[upper] ?? null;
}

/** Convert a parsed strategy draft + amount into a Flash quote payload. */
export function buildQuoteRequest(params: {
  draft: StrategyDraft;
  funderAddress: string;
  qtyUsd: string;
  config: OrderConfig;
}): { ok: true; request: BuiltQuoteRequest } | { ok: false; message: string } {
  const { draft, funderAddress, qtyUsd, config } = params;

  if (!config.configured) {
    return { ok: false, message: "Trading is not configured on this CallLedger deployment." };
  }

  const chain =
    draft.chain.status === "known" ? draft.chain.value.toLowerCase() : "base";
  const symbol =
    draft.assets[0]?.status === "known" ? draft.assets[0].value.toUpperCase() : "WETH";

  const target = pickAsset(config, chain, symbol) ?? pickAsset(config, "base", symbol);
  const usdc =
    pickAsset(config, target?.chain ?? chain, "USDC") ??
    pickAsset(config, "base", "USDC");

  if (!target || !usdc) {
    return {
      ok: false,
      message: `Asset ${symbol} on ${chain} is not in CallLedger verified assets.`,
    };
  }

  const direction =
    draft.direction.status === "known" ? draft.direction.value : "long";
  const side: "buy" | "sell" = direction === "short" ? "sell" : "buy";

  // For buy: spend USDC qty. For sell: approximate token qty from USD/entry when known.
  let qty = qtyUsd;
  if (side === "sell") {
    if (draft.entryPrice.status === "known" && draft.entryPrice.value > 0) {
      const tokens = Number(qtyUsd) / draft.entryPrice.value;
      qty = tokens.toFixed(Math.min(6, target.decimals));
    } else {
      return {
        ok: false,
        message: "Sell/short needs an entry price in the post to size the order.",
      };
    }
  }

  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(qty) || Number(qty) <= 0) {
    return { ok: false, message: "Enter a valid positive amount." };
  }

  const orderType =
    draft.orderType.status === "known" && draft.orderType.value === "market"
      ? "market"
      : "limit";

  const request: BuiltQuoteRequest = {
    targetChain: target.chain,
    contraChain: usdc.chain,
    targetAsset: target.address,
    contraAsset: usdc.address,
    side,
    qty,
    orderType,
    funderAddress: funderAddress.toLowerCase(),
    maxSlippage: "0.005",
  };

  if (orderType === "limit" && draft.entryPrice.status === "known") {
    request.limitNotionalPrice = String(draft.entryPrice.value);
  }

  return { ok: true, request };
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RpcCall {
  to?: string;
  data?: string;
}

async function callRpc(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs = 4000,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 10000),
        method,
        params,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string };
    return json?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fallback public RPC lists
const RPC_ENDPOINTS: Record<string, string[]> = {
  base: ["https://mainnet.base.org", "https://base.publicnode.com"],
  ethereum: ["https://ethereum.publicnode.com", "https://cloudflare-eth.com"],
  arbitrum: ["https://arb1.arbitrum.io/rpc", "https://arbitrum.publicnode.com"],
};

// Verified USDC contracts
const USDC_ADDRESSES: Record<string, string> = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};

async function queryChainWithFallback(
  chainKey: "base" | "ethereum" | "arbitrum",
  method: string,
  params: unknown[],
): Promise<string | null> {
  const urls = RPC_ENDPOINTS[chainKey] || [];
  for (const url of urls) {
    const result = await callRpc(url, method, params);
    if (result !== null) return result;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.toLowerCase();

  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid EVM wallet address" },
      { status: 400 },
    );
  }

  const balanceOfData = "0x70a08231" + address.slice(2).padStart(64, "0");

  // Fetch ETH price or use oracle estimate
  let ethPriceUsd = 2240;
  try {
    const cgRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (cgRes.ok) {
      const cgJson = (await cgRes.json()) as { ethereum?: { usd?: number } };
      if (cgJson?.ethereum?.usd) {
        ethPriceUsd = cgJson.ethereum.usd;
      }
    }
  } catch {
    // fallback
  }

  // Query balances across Base, Ethereum, and Arbitrum in parallel
  const [
    baseEthHex,
    baseUsdcHex,
    ethEthHex,
    ethUsdcHex,
    arbEthHex,
    arbUsdcHex,
  ] = await Promise.all([
    queryChainWithFallback("base", "eth_getBalance", [address, "latest"]),
    queryChainWithFallback("base", "eth_call", [
      { to: USDC_ADDRESSES.base, data: balanceOfData },
      "latest",
    ]),
    queryChainWithFallback("ethereum", "eth_getBalance", [address, "latest"]),
    queryChainWithFallback("ethereum", "eth_call", [
      { to: USDC_ADDRESSES.ethereum, data: balanceOfData },
      "latest",
    ]),
    queryChainWithFallback("arbitrum", "eth_getBalance", [address, "latest"]),
    queryChainWithFallback("arbitrum", "eth_call", [
      { to: USDC_ADDRESSES.arbitrum, data: balanceOfData },
      "latest",
    ]),
  ]);

  const baseEth = baseEthHex ? Number(BigInt(baseEthHex)) / 1e18 : 0;
  const baseUsdc = baseUsdcHex ? Number(BigInt(baseUsdcHex)) / 1e6 : 0;
  const ethEth = ethEthHex ? Number(BigInt(ethEthHex)) / 1e18 : 0;
  const ethUsdc = ethUsdcHex ? Number(BigInt(ethUsdcHex)) / 1e6 : 0;
  const arbEth = arbEthHex ? Number(BigInt(arbEthHex)) / 1e18 : 0;
  const arbUsdc = arbUsdcHex ? Number(BigInt(arbUsdcHex)) / 1e6 : 0;

  const tokens = [
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "Base",
      chainId: 8453,
      amount: baseEth,
      amountFormatted: baseEth.toFixed(6),
      priceUsd: ethPriceUsd,
      valueUsd: baseEth * ethPriceUsd,
      valueUsdFormatted: `$${(baseEth * ethPriceUsd).toFixed(2)}`,
      explorerUrl: `https://basescan.org/address/${address}`,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "Base",
      chainId: 8453,
      amount: baseUsdc,
      amountFormatted: baseUsdc.toFixed(4),
      priceUsd: 1.0,
      valueUsd: baseUsdc,
      valueUsdFormatted: `$${baseUsdc.toFixed(2)}`,
      tokenAddress: USDC_ADDRESSES.base,
      explorerUrl: `https://basescan.org/token/${USDC_ADDRESSES.base}?a=${address}`,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "Ethereum",
      chainId: 1,
      amount: ethUsdc,
      amountFormatted: ethUsdc.toFixed(4),
      priceUsd: 1.0,
      valueUsd: ethUsdc,
      valueUsdFormatted: `$${ethUsdc.toFixed(2)}`,
      tokenAddress: USDC_ADDRESSES.ethereum,
      explorerUrl: `https://etherscan.io/token/${USDC_ADDRESSES.ethereum}?a=${address}`,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "Ethereum",
      chainId: 1,
      amount: ethEth,
      amountFormatted: ethEth.toFixed(6),
      priceUsd: ethPriceUsd,
      valueUsd: ethEth * ethPriceUsd,
      valueUsdFormatted: `$${(ethEth * ethPriceUsd).toFixed(2)}`,
      explorerUrl: `https://etherscan.io/address/${address}`,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      chain: "Arbitrum",
      chainId: 42161,
      amount: arbEth,
      amountFormatted: arbEth.toFixed(6),
      priceUsd: ethPriceUsd,
      valueUsd: arbEth * ethPriceUsd,
      valueUsdFormatted: `$${(arbEth * ethPriceUsd).toFixed(2)}`,
      explorerUrl: `https://arbiscan.io/address/${address}`,
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chain: "Arbitrum",
      chainId: 42161,
      amount: arbUsdc,
      amountFormatted: arbUsdc.toFixed(4),
      priceUsd: 1.0,
      valueUsd: arbUsdc,
      valueUsdFormatted: `$${arbUsdc.toFixed(2)}`,
      tokenAddress: USDC_ADDRESSES.arbitrum,
      explorerUrl: `https://arbiscan.io/token/${USDC_ADDRESSES.arbitrum}?a=${address}`,
    },
  ];

  // Filter out zero balances, sort by USD value descending
  const fundedTokens = tokens.filter((t) => t.amount > 0.000001);
  const totalUsd = fundedTokens.reduce((acc, t) => acc + t.valueUsd, 0);

  // Group by chain
  const chainMap: Record<string, { chain: string; chainId: number; valueUsd: number }> = {};
  for (const t of fundedTokens) {
    const existing = chainMap[t.chain] ?? { chain: t.chain, chainId: t.chainId, valueUsd: 0 };
    existing.valueUsd += t.valueUsd;
    chainMap[t.chain] = existing;
  }

  const chainBreakdown = Object.values(chainMap).map((c) => ({
    ...c,
    percentage: totalUsd > 0 ? (c.valueUsd / totalUsd) * 100 : 0,
  }));

  return NextResponse.json(
    {
      address,
      ethPriceUsd,
      totalUsd,
      totalUsdFormatted: `$${totalUsd.toFixed(2)}`,
      tokens: fundedTokens,
      allTrackedTokens: tokens,
      chainBreakdown,
      updatedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    },
  );
}

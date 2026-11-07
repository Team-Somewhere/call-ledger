import type {
  OrderProvider,
  OrderStatus,
  OrderType,
} from "../constants/statuses";

export interface Order {
  id: string;
  userId: string;
  signalId: string | null;
  strategyId: string | null;
  provider: OrderProvider;
  providerOrderId: string | null;
  chainId: number | string;
  walletAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string | null;
  orderType: OrderType;
  status: OrderStatus;
  transactionHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerifiedAsset {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  chain: string;
  chainId: number;
}

export const VERIFIED_CHAINS: Record<
  string,
  {
    name: string;
    chainId: number;
    explorerBaseUrl: string;
    nativeSymbol: string;
    nativeDecimals: number;
    rpcUrl: string;
    flashChain: string;
  }
> = {
  base: {
    name: "Base",
    chainId: 8453,
    explorerBaseUrl: "https://basescan.org",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrl: "https://mainnet.base.org",
    flashChain: "base",
  },
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    explorerBaseUrl: "https://etherscan.io",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    flashChain: "ethereum",
  },
  arbitrum: {
    name: "Arbitrum",
    chainId: 42161,
    explorerBaseUrl: "https://arbiscan.io",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    flashChain: "arbitrum",
  },
};

export const VERIFIED_ASSETS: Record<string, Record<string, VerifiedAsset>> = {
  base: {
    WETH: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      chain: "base",
      chainId: 8453,
    },
    ETH: {
      symbol: "ETH",
      name: "Ether",
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      chain: "base",
      chainId: 8453,
    },
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      chain: "base",
      chainId: 8453,
    },
    BTC: {
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      chain: "base",
      chainId: 8453,
    },
    BITCOIN: {
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      chain: "base",
      chainId: 8453,
    },
    CBBTC: {
      symbol: "cbBTC",
      name: "Coinbase Wrapped BTC",
      address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
      decimals: 8,
      chain: "base",
      chainId: 8453,
    },
    WBTC: {
      symbol: "WBTC",
      name: "Wrapped BTC",
      address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      decimals: 8,
      chain: "base",
      chainId: 8453,
    },
    CBETH: {
      symbol: "CBETH",
      name: "Coinbase Wrapped Staked ETH",
      address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
      decimals: 18,
      chain: "base",
      chainId: 8453,
    },
  },
  ethereum: {
    WETH: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      chain: "ethereum",
      chainId: 1,
    },
    ETH: {
      symbol: "ETH",
      name: "Ether",
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      chain: "ethereum",
      chainId: 1,
    },
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      chain: "ethereum",
      chainId: 1,
    },
    WBTC: {
      symbol: "WBTC",
      name: "Wrapped Bitcoin",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      chain: "ethereum",
      chainId: 1,
    },
    BTC: {
      symbol: "BTC",
      name: "Wrapped Bitcoin",
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      decimals: 8,
      chain: "ethereum",
      chainId: 1,
    },
  },
  arbitrum: {
    WETH: {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      decimals: 18,
      chain: "arbitrum",
      chainId: 42161,
    },
    ETH: {
      symbol: "ETH",
      name: "Ether",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      decimals: 18,
      chain: "arbitrum",
      chainId: 42161,
    },
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      chain: "arbitrum",
      chainId: 42161,
    },
    ARB: {
      symbol: "ARB",
      name: "Arbitrum",
      address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
      decimals: 18,
      chain: "arbitrum",
      chainId: 42161,
    },
  },
};

/** Resolve verified token metadata by symbol and chain. Returns null if unknown. */
export function resolveVerifiedAsset(
  symbol: string,
  chain: string = "base",
): VerifiedAsset | null {
  const normChain = chain.toLowerCase();
  const normSym = symbol.toUpperCase().replace(/^\$/, "");
  return VERIFIED_ASSETS[normChain]?.[normSym] ?? null;
}

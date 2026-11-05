/**
 * CallLedger Phase 1 - Mock Data Store
 *
 * NOTE: All data here is strictly for illustrative and UI prototype preview purposes.
 * None of these trades, creators, or metrics represent live financial advice or verified execution.
 */

export interface MockCreator {
  id: string;
  displayName: string;
  xUsername: string;
  xUserId: string;
  bio: string;
  avatarUrl: string;
  walletAddress: string;
  status: "QUALIFIED" | "MONITORING" | "DISCOVERED";
  winRate: number; // e.g. 78.5%
  totalSignals: number;
  verifiedSignals: number;
  winningSignals: number;
  losingSignals: number;
  averageReturn: number; // e.g. +24.8%
  cumulativeReturn: number; // e.g. +142.6%
  arkivAttestationKey: string;
  followersCount: number;
  isFollowed?: boolean;
}

export interface MockSignal {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  assetSymbol: string;
  assetPair: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  currentPrice: number;
  timeframe: string;
  confidence: number;
  classification: "TRADE_SIGNAL" | "MARKET_COMMENTARY" | "TRADE_UPDATE";
  status: "ACTIVE" | "CLOSED" | "CANCELLED";
  verificationStatus: "VERIFIED" | "PENDING" | "INVALID";
  capturedAt: string;
  arkivRecordKey?: string;
  sourceTweetUrl?: string;
}

export interface MockStrategy {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  executionMode: "MANUAL" | "AUTOMATED";
  maxTradeAmount: number;
  maxDailyTrades: number;
  minCreatorWinRate: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  totalTradesExecuted: number;
  totalPnl: number;
  pnlPercentage: number;
  createdAt: string;
}

export interface MockPosition {
  id: string;
  assetSymbol: string;
  assetPair: string;
  chain: string;
  quantity: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
}

export interface MockOrder {
  id: string;
  timestamp: string;
  assetPair: string;
  direction: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  provider: "DEFINITIVE FLASH";
  inputAmount: string;
  outputAmount: string;
  status: "FILLED" | "PENDING" | "CANCELLED";
  creatorName: string;
}

export interface MockActivity {
  id: string;
  type: "SIGNAL" | "STRATEGY" | "ORDER" | "VERIFICATION" | "FOLLOW";
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
}

export const MOCK_CREATORS: MockCreator[] = [
  {
    id: "c1",
    displayName: "Alex Thorne (Macro Trader)",
    xUsername: "ThorneMacro",
    xUserId: "184920491",
    bio: "Macro crypto strategist & high-timeframe swing trader. Focused on BTC, ETH, and major L1 rotations.",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    walletAddress: "0x71C8366420A023c02948646bF5E052864C6c49b2",
    status: "QUALIFIED",
    winRate: 81.4,
    totalSignals: 43,
    verifiedSignals: 38,
    winningSignals: 31,
    losingSignals: 7,
    averageReturn: 28.5,
    cumulativeReturn: 184.2,
    arkivAttestationKey: "ark-0x892a-c1-thornemacro",
    followersCount: 1420,
    isFollowed: true,
  },
  {
    id: "c2",
    displayName: "Elena Vance | DeFi Alpha",
    xUsername: "ElenaDeFi",
    xUserId: "928471940",
    bio: "On-chain derivatives & Solana ecosystem specialist. Algorithmic entries on liquidity sweeps.",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    walletAddress: "0x49B55294A23B995bcaE7480E1d53F33a69B3e90D",
    status: "QUALIFIED",
    winRate: 76.2,
    totalSignals: 63,
    verifiedSignals: 55,
    winningSignals: 42,
    losingSignals: 13,
    averageReturn: 21.4,
    cumulativeReturn: 146.8,
    arkivAttestationKey: "ark-0x38ef-c2-elenadefi",
    followersCount: 980,
    isFollowed: true,
  },
  {
    id: "c3",
    displayName: "SatoshiPulse",
    xUsername: "SatoshiPulseX",
    xUserId: "481928471",
    bio: "High probability momentum setups & volatility breakouts on BTC / ETH.",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    walletAddress: "0x1A2b3c4d5E6F708192A3b4c5D6e7F8091a2B3c4D",
    status: "QUALIFIED",
    winRate: 72.8,
    totalSignals: 37,
    verifiedSignals: 32,
    winningSignals: 23,
    losingSignals: 9,
    averageReturn: 17.9,
    cumulativeReturn: 98.4,
    arkivAttestationKey: "ark-0x118b-c3-satoshipulse",
    followersCount: 650,
    isFollowed: false,
  },
  {
    id: "c4",
    displayName: "Kaelen Cross",
    xUsername: "CrossTrades",
    xUserId: "739281940",
    bio: "Scalping order books, funding rate arbitrage, and perpetual futures execution.",
    avatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    walletAddress: "0x9928B3e1c2384a51A7F876E0d52A3C12b6f12C88",
    status: "MONITORING",
    winRate: 68.4,
    totalSignals: 28,
    verifiedSignals: 22,
    winningSignals: 15,
    losingSignals: 7,
    averageReturn: 14.2,
    cumulativeReturn: 64.5,
    arkivAttestationKey: "ark-0x772c-c4-crosstrades",
    followersCount: 412,
    isFollowed: false,
  },
  {
    id: "c5",
    displayName: "Nova Capital Desk",
    xUsername: "NovaCapDesk",
    xUserId: "558291039",
    bio: "Systematic trend following across top 20 crypto assets by market capitalization.",
    avatarUrl:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    walletAddress: "0x883C8aE1102947F19623bbE72A59fE5B6E4968C2",
    status: "QUALIFIED",
    winRate: 79.1,
    totalSignals: 52,
    verifiedSignals: 48,
    winningSignals: 38,
    losingSignals: 10,
    averageReturn: 23.1,
    cumulativeReturn: 165.7,
    arkivAttestationKey: "ark-0x449f-c5-novacapdesk",
    followersCount: 1120,
    isFollowed: false,
  },
];

export const MOCK_SIGNALS: MockSignal[] = [
  {
    id: "sig-01",
    creatorId: "c1",
    creatorName: "Alex Thorne",
    creatorHandle: "ThorneMacro",
    creatorAvatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    assetSymbol: "SOL",
    assetPair: "SOL/USDC",
    direction: "BUY",
    entryPrice: 174.5,
    takeProfit: 215.0,
    stopLoss: 162.0,
    currentPrice: 188.2,
    timeframe: "4H",
    confidence: 88,
    classification: "TRADE_SIGNAL",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    capturedAt: "2026-11-05T20:15:00Z",
    arkivRecordKey: "ark-sig-99201-sol",
  },
  {
    id: "sig-02",
    creatorId: "c2",
    creatorName: "Elena Vance",
    creatorHandle: "ElenaDeFi",
    creatorAvatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    assetSymbol: "ETH",
    assetPair: "ETH/USDC",
    direction: "BUY",
    entryPrice: 3120.0,
    takeProfit: 3580.0,
    stopLoss: 2980.0,
    currentPrice: 3260.5,
    timeframe: "1D",
    confidence: 84,
    classification: "TRADE_SIGNAL",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    capturedAt: "2026-11-05T18:40:00Z",
    arkivRecordKey: "ark-sig-99202-eth",
  },
  {
    id: "sig-03",
    creatorId: "c3",
    creatorName: "SatoshiPulse",
    creatorHandle: "SatoshiPulseX",
    creatorAvatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    assetSymbol: "BTC",
    assetPair: "BTC/USDT",
    direction: "BUY",
    entryPrice: 88500.0,
    takeProfit: 96000.0,
    stopLoss: 85200.0,
    currentPrice: 91400.0,
    timeframe: "1D",
    confidence: 91,
    classification: "TRADE_SIGNAL",
    status: "ACTIVE",
    verificationStatus: "VERIFIED",
    capturedAt: "2026-11-05T14:10:00Z",
    arkivRecordKey: "ark-sig-99203-btc",
  },
  {
    id: "sig-04",
    creatorId: "c5",
    creatorName: "Nova Capital Desk",
    creatorHandle: "NovaCapDesk",
    creatorAvatar:
      "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    assetSymbol: "AVAX",
    assetPair: "AVAX/USDC",
    direction: "SELL",
    entryPrice: 34.2,
    takeProfit: 28.5,
    stopLoss: 36.8,
    currentPrice: 32.8,
    timeframe: "4H",
    confidence: 76,
    classification: "TRADE_SIGNAL",
    status: "ACTIVE",
    verificationStatus: "PENDING",
    capturedAt: "2026-11-05T11:05:00Z",
  },
];

export const MOCK_STRATEGIES: MockStrategy[] = [
  {
    id: "strat-01",
    name: "Thorne Macro Swing Replicator",
    creatorId: "c1",
    creatorName: "Alex Thorne",
    creatorHandle: "ThorneMacro",
    status: "ACTIVE",
    executionMode: "AUTOMATED",
    maxTradeAmount: 2500,
    maxDailyTrades: 3,
    minCreatorWinRate: 75,
    stopLossPercentage: 6.5,
    takeProfitPercentage: 18.0,
    totalTradesExecuted: 14,
    totalPnl: 4890.25,
    pnlPercentage: 24.6,
    createdAt: "2026-10-12T09:00:00Z",
  },
  {
    id: "strat-02",
    name: "Elena Vance Solana Alpha",
    creatorId: "c2",
    creatorName: "Elena Vance",
    creatorHandle: "ElenaDeFi",
    status: "ACTIVE",
    executionMode: "MANUAL",
    maxTradeAmount: 1500,
    maxDailyTrades: 4,
    minCreatorWinRate: 70,
    stopLossPercentage: 5.0,
    takeProfitPercentage: 15.0,
    totalTradesExecuted: 21,
    totalPnl: 3420.8,
    pnlPercentage: 18.2,
    createdAt: "2026-10-20T14:30:00Z",
  },
  {
    id: "strat-03",
    name: "BTC Breakout Defender",
    creatorId: "c3",
    creatorName: "SatoshiPulse",
    creatorHandle: "SatoshiPulseX",
    status: "PAUSED",
    executionMode: "AUTOMATED",
    maxTradeAmount: 5000,
    maxDailyTrades: 2,
    minCreatorWinRate: 70,
    stopLossPercentage: 4.0,
    takeProfitPercentage: 10.0,
    totalTradesExecuted: 8,
    totalPnl: 1840.1,
    pnlPercentage: 8.9,
    createdAt: "2026-10-28T11:15:00Z",
  },
];

export const MOCK_POSITIONS: MockPosition[] = [
  {
    id: "pos-01",
    assetSymbol: "SOL",
    assetPair: "SOL/USDC",
    chain: "Solana",
    quantity: 14.32,
    averageEntryPrice: 174.5,
    currentPrice: 188.2,
    unrealizedPnl: 196.18,
    unrealizedPnlPercent: 7.85,
    status: "OPEN",
    openedAt: "2026-11-05T20:18:00Z",
  },
  {
    id: "pos-02",
    assetSymbol: "ETH",
    assetPair: "ETH/USDC",
    chain: "Base",
    quantity: 0.82,
    averageEntryPrice: 3120.0,
    currentPrice: 3260.5,
    unrealizedPnl: 115.21,
    unrealizedPnlPercent: 4.5,
    status: "OPEN",
    openedAt: "2026-11-05T18:42:00Z",
  },
  {
    id: "pos-03",
    assetSymbol: "BTC",
    assetPair: "BTC/USDT",
    chain: "Arbitrum",
    quantity: 0.056,
    averageEntryPrice: 88500.0,
    currentPrice: 91400.0,
    unrealizedPnl: 162.4,
    unrealizedPnlPercent: 3.28,
    status: "OPEN",
    openedAt: "2026-11-05T14:15:00Z",
  },
];

export const MOCK_ORDERS: MockOrder[] = [
  {
    id: "ord-8812",
    timestamp: "2026-11-05 20:18 UTC",
    assetPair: "SOL/USDC",
    direction: "BUY",
    orderType: "MARKET",
    provider: "DEFINITIVE FLASH",
    inputAmount: "2,500.00 USDC",
    outputAmount: "14.32 SOL",
    status: "FILLED",
    creatorName: "Alex Thorne",
  },
  {
    id: "ord-8811",
    timestamp: "2026-11-05 18:42 UTC",
    assetPair: "ETH/USDC",
    direction: "BUY",
    orderType: "MARKET",
    provider: "DEFINITIVE FLASH",
    inputAmount: "2,558.40 USDC",
    outputAmount: "0.82 ETH",
    status: "FILLED",
    creatorName: "Elena Vance",
  },
  {
    id: "ord-8810",
    timestamp: "2026-11-05 14:15 UTC",
    assetPair: "BTC/USDT",
    direction: "BUY",
    orderType: "LIMIT",
    provider: "DEFINITIVE FLASH",
    inputAmount: "4,956.00 USDT",
    outputAmount: "0.056 BTC",
    status: "FILLED",
    creatorName: "SatoshiPulse",
  },
  {
    id: "ord-8809",
    timestamp: "2026-11-04 16:30 UTC",
    assetPair: "SUI/USDC",
    direction: "BUY",
    orderType: "MARKET",
    provider: "DEFINITIVE FLASH",
    inputAmount: "1,200.00 USDC",
    outputAmount: "382.4 SUI",
    status: "FILLED",
    creatorName: "Elena Vance",
  },
];

export const MOCK_ACTIVITIES: MockActivity[] = [
  {
    id: "act-1",
    type: "SIGNAL",
    title: "New Signal: SOL/USDC BUY",
    description:
      "Alex Thorne published a new 4H swing trade signal for SOL at $174.50.",
    timestamp: "15 mins ago",
    badge: "Alex Thorne",
  },
  {
    id: "act-2",
    type: "STRATEGY",
    title: "Strategy Triggered: Thorne Macro Swing",
    description:
      "Auto-prepared Definitive Flash order for $2,500.00 USDC into SOL.",
    timestamp: "12 mins ago",
    badge: "Automated",
  },
  {
    id: "act-3",
    type: "ORDER",
    title: "Order Filled via Definitive Flash",
    description:
      "Executed swap of 2,500.00 USDC for 14.32 SOL at effective rate $174.58.",
    timestamp: "10 mins ago",
    badge: "Filled",
  },
  {
    id: "act-4",
    type: "VERIFICATION",
    title: "Arkiv Attestation Confirmed",
    description:
      "Signal hash anchored to Arkiv record ark-sig-99201-sol with block timestamp verification.",
    timestamp: "8 mins ago",
    badge: "Arkiv Verified",
  },
  {
    id: "act-5",
    type: "FOLLOW",
    title: "Followed Creator: Elena Vance",
    description: "Subscribed to real-time signals from @ElenaDeFi.",
    timestamp: "2 hours ago",
    badge: "Follow",
  },
];

export const MOCK_OVERVIEW_STATS = {
  totalPortfolioValue: 124580.42,
  totalPnl: 18320.15,
  pnlPercentage: 17.2,
  activeStrategiesCount: 3,
  followedCreatorsCount: 5,
  totalVerifiedSignalsToday: 12,
  simulatedTradeCount: 43,
};

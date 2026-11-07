"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { DataTable } from "../../components/data-table";
import {
  api,
  type WalletBalancesResponse,
  type WalletTokenBalance,
} from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";
import { VERIFIED_CHAINS, type Order } from "@call-ledger/shared";

export default function PortfolioPage() {
  const wallet = useWalletSession();

  // Multi-chain wallet balances from MetaMask/RPC
  const [walletBalances, setWalletBalances] = useState<WalletBalancesResponse | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Real orders from Definitive Flash & CallLedger DB
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Fetch live multi-chain balances from MetaMask connected address
  const fetchBalances = useCallback(async () => {
    if (!wallet.address) {
      setWalletBalances(null);
      return;
    }
    setIsLoadingBalances(true);
    try {
      const data = await api.getWalletBalances(wallet.address);
      setWalletBalances(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("Could not fetch multi-chain wallet balances:", err);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [wallet.address]);

  // Fetch real Definitive Flash orders
  const fetchOrders = useCallback(async () => {
    if (!wallet.address) {
      setOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const res = await api.getOrders();
      setOrders(res.data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("Could not load Definitive Flash orders:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [wallet.address]);

  const handleRefreshAll = () => {
    void fetchBalances();
    void fetchOrders();
  };

  useEffect(() => {
    handleRefreshAll();
  }, [wallet.address]);

  // Derived real metrics from Definitive Flash orders
  const definitiveMetrics = useMemo(() => {
    const totalOrders = orders.length;
    const filledOrders = orders.filter((o) => o.status === "FILLED");
    const pendingOrders = orders.filter((o) =>
      ["PENDING", "ACCEPTED"].includes(o.status),
    );
    const failedOrders = orders.filter((o) =>
      ["CANCELLED", "FAILED"].includes(o.status),
    );

    const totalDeployedUsd = orders.reduce((acc, o) => {
      const amount = parseFloat(o.inputAmount) || 0;
      return acc + amount;
    }, 0);

    const winRate =
      totalOrders > 0
        ? Math.round((filledOrders.length / totalOrders) * 100)
        : 100;

    return {
      totalOrders,
      filledOrders: filledOrders.length,
      pendingOrders: pendingOrders.length,
      failedOrders: failedOrders.length,
      totalDeployedUsd,
      winRate,
    };
  }, [orders]);

  const totalWalletUsd = walletBalances?.totalUsd ?? 0;
  const isRefreshing = isLoadingBalances || isLoadingOrders;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header with Live Status & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8DFD1]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#171717] flex items-center gap-2">
            <span>Portfolio</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-sm bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
              Live On-Chain
            </span>
          </h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            Real multi-chain asset balances from MetaMask &amp; executed trades from Definitive Flash.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-[#78716C]">
              Synced {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] hover:border-[#171717] text-xs font-mono text-[#78716C] hover:text-[#171717] transition disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "SYNCING..." : "REFRESH"}</span>
          </button>
        </div>
      </div>

      {/* Top Real Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-[#E8DFD1] rounded-sm divide-y md:divide-y-0 md:divide-x divide-[#E8DFD1] bg-[#FFF2DB]/30">
        {/* Total Wallet Balance */}
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1">
            <Wallet className="w-3 h-3 text-[#171717]" />
            <span>METAMASK TOTAL</span>
          </div>
          <div className="text-2xl font-bold text-[#171717]">
            {wallet.address ? (
              walletBalances?.totalUsdFormatted || `$${totalWalletUsd.toFixed(2)}`
            ) : (
              <span className="text-[#78716C] text-lg">Not Connected</span>
            )}
          </div>
          <div className="text-[10px] text-[#78716C]">
            {walletBalances?.tokens.length || 0} ASSETS ACROSS EVM
          </div>
        </div>

        {/* Definitive Deployed */}
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#16A34A]" />
            <span>FLASH DEPLOYED</span>
          </div>
          <div className="text-2xl font-bold text-[#16A34A]">
            ${definitiveMetrics.totalDeployedUsd.toFixed(2)}
          </div>
          <div className="text-[10px] text-[#78716C]">
            {definitiveMetrics.totalOrders} ORDERS SUBMITTED
          </div>
        </div>

        {/* Flash Settlement Rate */}
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#16A34A]" />
            <span>EXECUTION SUCCESS</span>
          </div>
          <div className="text-2xl font-bold text-[#171717]">
            {definitiveMetrics.totalOrders > 0
              ? `${definitiveMetrics.winRate}%`
              : "100%"}
          </div>
          <div className="text-[10px] text-[#78716C]">
            {definitiveMetrics.filledOrders} FILLED • {definitiveMetrics.pendingOrders} PENDING
          </div>
        </div>

        {/* Active EVM Networks */}
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#171717]" />
            <span>FUNDED NETWORKS</span>
          </div>
          <div className="text-2xl font-bold text-[#171717]">
            {walletBalances?.chainBreakdown.length || 0}{" "}
            <span className="text-sm font-normal text-[#78716C]">CHAINS</span>
          </div>
          <div className="text-[10px] text-[#78716C] truncate">
            {walletBalances?.chainBreakdown.map((c) => c.chain).join(", ") || "Base, Ethereum"}
          </div>
        </div>
      </div>

      {/* SECTION 1: METAMASK LIVE MULTI-CHAIN PORTFOLIO */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
          <div className="text-xs uppercase text-[#171717] font-bold tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#171717]" />
            <span>1. Connected Wallet Assets &amp; Networks (MetaMask)</span>
          </div>
          {wallet.address && (
            <div className="text-[10px] font-mono text-[#78716C] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span>{wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}</span>
              <a
                href={`https://basescan.org/address/${wallet.address}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#171717] hover:underline"
                title="View on BaseScan"
              >
                <ExternalLink className="w-2.5 h-2.5 inline" />
              </a>
            </div>
          )}
        </div>

        {wallet.address ? (
          <div className="space-y-3">
            {/* Multi-Chain Distribution Bar */}
            {walletBalances && walletBalances.chainBreakdown.length > 0 && (
              <div className="p-3 bg-[#FFF2DB]/40 border border-[#E8DFD1] rounded-sm space-y-2">
                <div className="flex items-center justify-between text-[10px] text-[#78716C] uppercase font-bold">
                  <span>Network Asset Distribution</span>
                  <span>Total Value: {walletBalances.totalUsdFormatted}</span>
                </div>
                <div className="w-full h-2.5 bg-[#E8DFD1] rounded-xs overflow-hidden flex">
                  {walletBalances.chainBreakdown.map((chain, idx) => (
                    <div
                      key={chain.chain}
                      className={
                        idx === 0
                          ? "bg-[#171717]"
                          : idx === 1
                            ? "bg-[#16A34A]"
                            : "bg-[#F62440]"
                      }
                      style={{ width: `${Math.max(chain.percentage, 5)}%` }}
                      title={`${chain.chain}: $${chain.valueUsd.toFixed(2)} (${chain.percentage.toFixed(1)}%)`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[10px]">
                  {walletBalances.chainBreakdown.map((chain, idx) => (
                    <div key={chain.chain} className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-xs ${
                          idx === 0
                            ? "bg-[#171717]"
                            : idx === 1
                              ? "bg-[#16A34A]"
                              : "bg-[#F62440]"
                        }`}
                      />
                      <span className="text-[#171717] font-bold">{chain.chain}:</span>
                      <span className="text-[#78716C]">
                        ${chain.valueUsd.toFixed(2)} ({chain.percentage.toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens Table */}
            <DataTable
              columns={[
                {
                  header: "ASSET",
                  cell: (row: WalletTokenBalance) => (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#171717] text-white flex items-center justify-center text-[9px] font-bold">
                        {row.symbol.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-bold text-[#171717]">{row.symbol}</span>
                        <span className="text-[10px] text-[#78716C] ml-1.5 hidden sm:inline">
                          {row.name}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "NETWORK",
                  cell: (row: WalletTokenBalance) => (
                    <span
                      className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase ${
                        row.chain === "Base"
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : row.chain === "Ethereum"
                            ? "bg-[#171717] text-[#FFFAF3]"
                            : "bg-cyan-100 text-cyan-800 border border-cyan-300"
                      }`}
                    >
                      {row.chain}
                    </span>
                  ),
                },
                {
                  header: "HOLDINGS",
                  cell: (row: WalletTokenBalance) => (
                    <span className="font-bold text-[#171717]">
                      {row.amountFormatted} {row.symbol}
                    </span>
                  ),
                },
                {
                  header: "PRICE",
                  cell: (row: WalletTokenBalance) => (
                    <span className="text-[#78716C]">
                      ${row.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  ),
                },
                {
                  header: "USD VALUE",
                  cell: (row: WalletTokenBalance) => (
                    <span className="font-bold text-[#16A34A]">
                      {row.valueUsdFormatted}
                    </span>
                  ),
                },
                {
                  header: "EXPLORER",
                  cell: (row: WalletTokenBalance) => (
                    <a
                      href={row.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#16A34A] hover:underline text-[10px] flex items-center gap-0.5"
                    >
                      <span>View</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ),
                },
              ]}
              data={walletBalances?.tokens || []}
            />
          </div>
        ) : (
          <div className="border border-dashed border-[#E8DFD1] bg-[#FFFAF3]/50 rounded-sm p-6 text-center space-y-2">
            <Wallet className="w-6 h-6 text-[#78716C] mx-auto opacity-60" />
            <div className="text-xs font-bold text-[#171717]">
              Wallet Not Connected
            </div>
            <p className="text-[11px] text-[#78716C]">
              Connect your MetaMask wallet in the topbar to view your multi-chain balances across Base and Ethereum.
            </p>
            <button
              onClick={() => void wallet.connect()}
              className="px-3 py-1.5 rounded-sm bg-[#171717] text-white text-xs font-bold hover:bg-black transition"
            >
              Connect MetaMask Wallet
            </button>
          </div>
        )}
      </div>

      {/* SECTION 2: DEFINITIVE FLASH TRADING & ORDER LEDGER */}
      <div className="space-y-3 pt-4 border-t border-[#E8DFD1]">
        <div className="flex items-center justify-between border-b border-[#E8DFD1] pb-2">
          <div className="text-xs uppercase text-[#171717] font-bold tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#16A34A]" />
            <span>2. Definitive Flash Order Ledger &amp; Live Proofs</span>
          </div>
          <Link
            href="/trade"
            className="text-xs font-bold text-[#16A34A] hover:underline flex items-center gap-1"
          >
            <span>NEW FLASH TRADE</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {orders.length > 0 ? (
          <DataTable
            columns={[
              {
                header: "TIME",
                cell: (row: Order) => (
                  <span className="text-[11px] text-[#78716C]">
                    {new Date(row.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ),
              },
              {
                header: "CHAIN",
                cell: (row: Order) => (
                  <span className="px-1.5 py-0.5 rounded-sm bg-[#171717] text-[#FFFAF3] text-[9px] font-bold uppercase">
                    {row.chainId}
                  </span>
                ),
              },
              {
                header: "STRATEGY",
                cell: (row: Order) => (
                  <span className="font-bold uppercase text-[#171717]">
                    {row.orderType}
                  </span>
                ),
              },
              {
                header: "SPENT (INPUT)",
                cell: (row: Order) => (
                  <span className="font-mono text-[#171717]">
                    {row.inputAmount}
                  </span>
                ),
              },
              {
                header: "EXPECTED / OUTPUT",
                cell: (row: Order) => (
                  <span className="text-[#16A34A] font-bold">
                    {row.outputAmount || "~ Pending"}
                  </span>
                ),
              },
              {
                header: "STATUS",
                cell: (row: Order) => (
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[9px] uppercase font-bold border ${
                      row.status === "FILLED"
                        ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                        : ["PENDING", "ACCEPTED"].includes(row.status)
                          ? "bg-[#EAB308]/10 text-[#A16207] border-[#EAB308]/30"
                          : "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30"
                    }`}
                  >
                    {row.status}
                  </span>
                ),
              },
              {
                header: "PROOF / TX HASH",
                cell: (row: Order) => {
                  const explorer =
                    VERIFIED_CHAINS[row.chainId]?.explorerBaseUrl ||
                    "https://basescan.org";
                  return row.transactionHash ? (
                    <a
                      href={`${explorer}/tx/${row.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#16A34A] hover:underline text-[10px] flex items-center gap-1 font-mono"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#16A34A]" />
                      <span>
                        {row.transactionHash.slice(0, 6)}...{row.transactionHash.slice(-4)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-[#78716C] text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Awaiting landing</span>
                    </span>
                  );
                },
              },
            ]}
            data={orders}
          />
        ) : (
          <div className="border border-dashed border-[#E8DFD1] bg-[#FFFAF3]/50 rounded-sm p-8 text-center space-y-3">
            <Zap className="w-8 h-8 text-[#16A34A] mx-auto opacity-80" />
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#171717] uppercase">
                No Definitive Flash Trades Executed Yet
              </div>
              <p className="text-[11px] text-[#78716C] max-w-md mx-auto">
                CallLedger executes non-custodial Limit and Market orders directly via Definitive Flash routing across 900+ liquidity sources.
              </p>
            </div>
            <Link
              href="/trade"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition shadow-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Launch Flash Trade Terminal →</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

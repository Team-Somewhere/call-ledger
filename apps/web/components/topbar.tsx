"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  LogOut,
  Shield,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useWalletSession } from "../lib/use-wallet-session";
import { api, type ArkivTransaction } from "../lib/api";

const navLinks = [
  { href: "/", label: "TERMINAL" },
  { href: "/discover", label: "DISCOVER" },
  { href: "/following", label: "FOLLOWING" },
  { href: "/strategies", label: "ALLOCATIONS" },
  { href: "/portfolio", label: "PORTFOLIO" },
];

// ─── Latest Arkiv TX widget ───────────────────────────────────────────────

function ArkivTxWidget() {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<ArkivTransaction | null | undefined>(undefined);
  const [recent, setRecent] = useState<ArkivTransaction[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [latestResult, recentResult] = await Promise.allSettled([
      api.arkivLatestTransaction(),
      api.arkivTransactions("?limit=5"),
    ]);

    const latestTx =
      latestResult.status === "fulfilled" ? latestResult.value.data : null;
    const recentTxs =
      recentResult.status === "fulfilled" ? recentResult.value.data : [];
    setLatest(latestTx ?? recentTxs[0] ?? null);
    setRecent(recentTxs);
    const loadFailure =
      latestResult.status === "rejected"
        ? latestResult.reason
        : recentResult.status === "rejected"
          ? recentResult.reason
          : null;
    setLoadError(
      !latestTx && recentTxs.length === 0 && loadFailure
        ? loadFailure instanceof Error
          ? loadFailure.message
          : "Could not load Arkiv transactions."
        : null,
    );
  }, []);

  // Load on mount and poll every 30s
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopied(hash);
    setTimeout(() => setCopied(null), 2000);
  }

  const hasLatest = latest !== null && latest !== undefined;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 border rounded-sm px-2 py-1 text-[10px] font-mono transition",
          hasLatest
            ? "border-[#16A34A]/40 bg-[#16A34A]/8 text-[#16A34A] hover:border-[#16A34A]"
            : "border-[#E8DFD1] bg-[#FFFAF3] text-[#78716C] hover:border-[#171717] hover:text-[#171717]",
        )}
        title="Latest Arkiv transaction"
      >
        {latest === undefined ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Shield className={cn("w-3 h-3", hasLatest ? "text-[#16A34A]" : "text-[#78716C]")} />
        )}
        <span className="uppercase tracking-wider hidden sm:inline">LATEST ARKIV TX</span>
        {hasLatest && (
          <span className="font-mono text-[9px] text-[#16A34A] hidden lg:inline">
            {latest.txHash.slice(0, 8)}…
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-96 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] shadow-xl z-50 font-mono text-xs overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E8DFD1] bg-[#FFF2DB]/40">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#16A34A]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#171717]">
                Arkiv Transaction History
              </span>
            </div>
            <span className="text-[9px] text-[#78716C]">RABDI TESTNET</span>
          </div>

          {/* Latest tx */}
          {loadError && !hasLatest ? (
            <div className="px-3 py-6 text-center">
              <AlertCircle className="w-5 h-5 text-[#F62440] mx-auto mb-2" />
              <div className="text-[11px] font-bold text-[#171717]">
                Could not load transactions
              </div>
              <p className="text-[10px] text-[#78716C] mt-1 font-sans">
                {loadError}
              </p>
            </div>
          ) : !hasLatest ? (
            <div className="px-3 py-6 text-center">
              <Zap className="w-5 h-5 text-[#E8DFD1] mx-auto mb-2" />
              <div className="text-[11px] font-bold text-[#171717]">No transactions yet</div>
              <p className="text-[10px] text-[#78716C] mt-1 font-sans">
                Add a trader and enable monitoring to start archiving to Arkiv.
              </p>
            </div>
          ) : (
            <>
              {/* Latest */}
              <div className="px-3 py-2.5 bg-[#16A34A]/5 border-b border-[#E8DFD1]">
                <div className="text-[9px] uppercase text-[#78716C] mb-1.5 tracking-wider">Latest confirmed</div>
                <TxRow
                  tx={latest}
                  copied={copied}
                  onCopy={copyHash}
                  highlight
                />
              </div>

              {/* Recent list */}
              {recent.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[9px] uppercase text-[#78716C] tracking-wider">
                    Recent transactions
                  </div>
                  <div className="divide-y divide-[#E8DFD1]/60">
                    {recent.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="px-3 py-2">
                        <TxRow tx={tx} copied={copied} onCopy={copyHash} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="border-t border-[#E8DFD1] px-3 py-2 flex items-center justify-between">
            <Link
              href="/archive"
              onClick={() => setOpen(false)}
              className="text-[10px] text-[#78716C] hover:text-[#171717] transition"
            >
              View archive feed →
            </Link>
            <Link
              href="/monitoring"
              onClick={() => setOpen(false)}
              className="text-[10px] text-[#78716C] hover:text-[#171717] transition"
            >
              Worker status →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function TxRow({
  tx,
  copied,
  onCopy,
  highlight = false,
}: {
  tx: ArkivTransaction;
  copied: string | null;
  onCopy: (hash: string) => void;
  highlight?: boolean;
}) {
  const confirmedAt = tx.confirmedAt ? new Date(tx.confirmedAt) : null;

  return (
    <div className={cn("space-y-1", highlight && "")}>
      {/* Hash row */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-[9px] font-bold uppercase px-1 py-px rounded-sm",
            tx.status === "CONFIRMED"
              ? "bg-[#16A34A]/10 text-[#16A34A]"
              : "bg-[#F62440]/10 text-[#F62440]",
          )}
        >
          {tx.status}
        </span>
        <code className="text-[10px] font-mono text-[#171717] flex-1 break-all">
          {tx.txHash}
        </code>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onCopy(tx.txHash)}
            title="Copy transaction hash"
            className="p-0.5 rounded hover:bg-[#E8DFD1]/60 text-[#78716C] hover:text-[#171717] transition"
          >
            {copied === tx.txHash ? (
              <Check className="w-3 h-3 text-[#16A34A]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>
          <a
            href={tx.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View on Rabdi explorer"
            className="p-0.5 rounded hover:bg-[#E8DFD1]/60 text-[#78716C] hover:text-[#171717] transition"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      {/* Meta row */}
      <div className="flex items-center gap-3 text-[9px] text-[#78716C]">
        {tx.traderUsername && (
          <span>@{tx.traderUsername}</span>
        )}
        <span className="font-mono truncate max-w-[120px]">
          post·{tx.sourcePostId.slice(-8)}
        </span>
        {confirmedAt && (
          <span className="ml-auto">
            {confirmedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Topbar ──────────────────────────────────────────────────────────

export function Topbar() {
  const pathname = usePathname();
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    address,
    isAuthenticated,
    isConnecting,
    error,
    connect,
    connectGuest,
    disconnect,
  } = useWalletSession();

  const handleCopy = () => {
    if (address) {
      void navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="w-full bg-[#FFFAF3] border-b border-[#E8DFD1] px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-40">
      {/* Left: Brand Logo + Nav Links */}
      <div className="flex items-center gap-6 md:gap-10">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center select-none group">
          <span className="bg-[#F62440] text-white px-1.5 py-0.5 rounded-sm font-bold text-xs tracking-wider">
            CALL
          </span>
          <span className="font-bold text-sm tracking-wider text-[#171717] ml-1 font-mono">
            LEDGER
          </span>
        </Link>

        {/* Horizontal Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-xs font-mono tracking-wider transition-colors py-1",
                  isActive
                    ? "text-[#171717] font-semibold border-b border-[#171717]"
                    : "text-[#78716C] hover:text-[#171717]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right: Arkiv TX + Wallet */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Latest Arkiv TX widget */}
        <ArkivTxWidget />

        {/* Wallet Section */}
        {isAuthenticated && address ? (
          <div className="relative">
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="flex items-center gap-2 border border-[#E8DFD1] hover:border-[#171717] rounded-sm px-2.5 py-1 text-xs font-mono bg-[#FFF2DB]/50 transition text-[#171717]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] inline-block animate-pulse" />
              <span className="text-[11px] font-medium font-mono">
                {`${address.slice(0, 6)}...${address.slice(-4)}`}
              </span>
              <ChevronDown className="w-3 h-3 text-[#78716C]" />
            </button>

            {showWalletMenu && (
              <div className="absolute right-0 mt-1.5 w-72 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] shadow-lg p-3.5 z-50 text-xs font-mono">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#E8DFD1] text-[10px] uppercase text-[#78716C]">
                  <span>Connected Wallet</span>
                  <span className="flex items-center gap-1 text-[#16A34A]">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                </div>

                <div className="mt-2.5 bg-[#FFF2DB]/60 p-2 rounded-sm border border-[#E8DFD1] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[#171717] truncate select-all">
                    {address}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-1 hover:bg-[#E8DFD1]/50 rounded text-[#78716C] hover:text-[#171717] transition shrink-0"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-[#78716C]">
                  <span>Network</span>
                  <span className="font-medium text-[#171717]">
                    Rabdi Testnet
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#E8DFD1] flex justify-between items-center text-[10px]">
                  <span className="text-[#16A34A]">EIP-191 Off-Chain Auth</span>
                  <button
                    onClick={() => {
                      disconnect();
                      setShowWalletMenu(false);
                    }}
                    className="flex items-center gap-1 text-[#F62440] hover:underline font-semibold"
                  >
                    <LogOut className="w-3 h-3" />
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="flex items-center gap-1.5 border border-[#171717] bg-[#171717] hover:bg-[#333] text-[#FFFAF3] rounded-sm px-3 py-1 text-xs font-mono transition shadow-xs disabled:opacity-60"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Connecting…</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3 h-3" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>

            <button
              onClick={() => void connectGuest()}
              disabled={isConnecting}
              title="One-click demo guest session without MetaMask"
              className="border border-[#E8DFD1] hover:border-[#78716C] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3] rounded-sm px-2 py-1 text-[10px] font-mono transition"
            >
              Guest Demo
            </button>
          </div>
        )}
      </div>

      {/* Global Connection Error Banner */}
      {error && !isAuthenticated && (
        <div className="w-full mt-1.5 flex items-center justify-between gap-2 p-1.5 rounded-sm bg-[#F62440]/10 border border-[#F62440]/30 text-[#F62440] text-[11px] font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={() => void connectGuest()}
            className="text-[10px] underline hover:no-underline font-bold shrink-0"
          >
            Use Guest Mode instead
          </button>
        </div>
      )}
    </header>
  );
}

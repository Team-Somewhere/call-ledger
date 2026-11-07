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
  { href: "/trade", label: "TRADE" },
  { href: "/strategies", label: "ALLOCATIONS" },
  { href: "/portfolio", label: "PORTFOLIO" },
];

// ─── Latest Arkiv TX widget ───────────────────────────────────────────────

function shortHash(value: string | null | undefined, size = 10): string {
  if (!value) return "—";
  if (value.length <= size + 1) return value;
  return `${value.slice(0, size)}…`;
}

function ArkivTxWidget() {
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<ArkivTransaction | null | undefined>(
    undefined,
  );
  const [recent, setRecent] = useState<ArkivTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [latestResult, recentResult] = await Promise.allSettled([
      api.arkivLatestTransaction(),
      api.arkivTransactions("?limit=20"),
    ]);

    const latestTx =
      latestResult.status === "fulfilled" ? latestResult.value.data : null;
    const recentPayload =
      recentResult.status === "fulfilled" ? recentResult.value : null;
    const recentTxs = recentPayload?.data ?? [];
    const meta = recentPayload?.meta as
      | { total?: number; onChainCount?: number }
      | undefined;

    setLatest(latestTx ?? recentTxs[0] ?? null);
    setRecent(recentTxs);
    setTotal(
      typeof meta?.total === "number"
        ? meta.total
        : recentTxs.length,
    );

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

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

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

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  }

  const hasLatest = latest !== null && latest !== undefined;
  const preview = latest?.txHash ?? latest?.entityKey ?? null;

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
        title="Latest Arkiv transaction hashes saved by CallLedger"
      >
        {latest === undefined ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Shield
            className={cn(
              "w-3 h-3",
              hasLatest ? "text-[#16A34A]" : "text-[#78716C]",
            )}
          />
        )}
        <span className="uppercase tracking-wider hidden sm:inline">
          LATEST ARKIV TX
        </span>
        {hasLatest && preview && (
          <span className="font-mono text-[9px] text-[#16A34A] hidden lg:inline">
            {shortHash(preview, 8)}
          </span>
        )}
        {total > 0 && (
          <span className="text-[9px] text-[#78716C] hidden md:inline">
            · {total}
          </span>
        )}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-[28rem] max-w-[calc(100vw-2rem)] rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] shadow-xl z-50 font-mono text-xs overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#E8DFD1] bg-[#FFF2DB]/40">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-[#16A34A]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#171717]">
                Platform → Arkiv writes
              </span>
            </div>
            <span className="text-[9px] text-[#78716C]">
              RABDI · {total} saved
            </span>
          </div>

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
              <div className="text-[11px] font-bold text-[#171717]">
                No Arkiv writes yet
              </div>
              <p className="text-[10px] text-[#78716C] mt-1 font-sans">
                Open a trader and click Fetch Latest Posts — each archive write
                appears here with its tx hash / entity key.
              </p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2.5 bg-[#16A34A]/5 border-b border-[#E8DFD1]">
                <div className="text-[9px] uppercase text-[#78716C] mb-1.5 tracking-wider">
                  Latest confirmed write
                </div>
                <TxRow tx={latest} copied={copied} onCopy={copyValue} />
              </div>

              <div className="max-h-80 overflow-y-auto">
                <div className="px-3 pt-2 pb-1 text-[9px] uppercase text-[#78716C] tracking-wider sticky top-0 bg-[#FFFAF3]">
                  Latest hashes ({recent.length})
                </div>
                <div className="divide-y divide-[#E8DFD1]/60">
                  {recent.map((tx) => (
                    <div key={tx.id} className="px-3 py-2">
                      <TxRow tx={tx} copied={copied} onCopy={copyValue} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-[#E8DFD1] px-3 py-2 flex items-center justify-between">
            <Link
              href="/archive"
              onClick={() => setOpen(false)}
              className="text-[10px] text-[#78716C] hover:text-[#171717] transition"
            >
              View archive feed →
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[10px] text-[#78716C] hover:text-[#171717] transition"
            >
              Refresh
            </button>
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
}: {
  tx: ArkivTransaction;
  copied: string | null;
  onCopy: (value: string) => void;
}) {
  const confirmedAt = tx.confirmedAt ? new Date(tx.confirmedAt) : null;
  const primary = tx.txHash ?? tx.entityKey;
  const proofLabel =
    tx.proofSource === "arkiv_chain"
      ? "ON-CHAIN"
      : tx.txHash
        ? "TX"
        : "ENTITY";

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-1.5">
        <span
          className={cn(
            "text-[9px] font-bold uppercase px-1 py-px rounded-sm shrink-0 mt-0.5",
            tx.status === "CONFIRMED"
              ? "bg-[#16A34A]/10 text-[#16A34A]"
              : "bg-[#F62440]/10 text-[#F62440]",
          )}
        >
          {proofLabel}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {tx.txHash && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#78716C] shrink-0">hash</span>
              <code className="text-[10px] font-mono text-[#171717] flex-1 break-all">
                {tx.txHash}
              </code>
              <button
                onClick={() => onCopy(tx.txHash!)}
                title="Copy transaction hash"
                className="p-0.5 rounded hover:bg-[#E8DFD1]/60 text-[#78716C] hover:text-[#171717] transition shrink-0"
              >
                {copied === tx.txHash ? (
                  <Check className="w-3 h-3 text-[#16A34A]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              {tx.explorerUrl && (
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on Rabdi explorer"
                  className="p-0.5 rounded hover:bg-[#E8DFD1]/60 text-[#78716C] hover:text-[#171717] transition shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[#78716C] shrink-0">entity</span>
            <code className="text-[10px] font-mono text-[#292524] flex-1 break-all">
              {tx.entityKey}
            </code>
            <button
              onClick={() => onCopy(tx.entityKey)}
              title="Copy Arkiv entity key"
              className="p-0.5 rounded hover:bg-[#E8DFD1]/60 text-[#78716C] hover:text-[#171717] transition shrink-0"
            >
              {copied === tx.entityKey ? (
                <Check className="w-3 h-3 text-[#16A34A]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-[#78716C] pl-8">
        {tx.traderUsername && <span>@{tx.traderUsername}</span>}
        {tx.sourcePostId && (
          <span className="font-mono truncate max-w-[140px]">
            post·{shortHash(tx.sourcePostId, 10)}
          </span>
        )}
        {confirmedAt && (
          <span className="ml-auto">
            {confirmedAt.toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        {!tx.txHash && primary && (
          <span className="text-[#78716C]">stored on Arkiv</span>
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

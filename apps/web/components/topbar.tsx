"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Copy, Loader2, LogOut, ShieldCheck, Wallet } from "lucide-react";
import { cn } from "../lib/utils";
import { useWalletSession } from "../lib/use-wallet-session";

const navLinks = [
  { href: "/", label: "TERMINAL" },
  { href: "/discover", label: "DISCOVER" },
  { href: "/following", label: "FOLLOWING" },
  { href: "/signals", label: "SIGNALS" },
  { href: "/strategies", label: "ALLOCATIONS" },
  { href: "/portfolio", label: "PORTFOLIO" },
  { href: "/activity", label: "ACTIVITY" },
  { href: "/archive", label: "ARCHIVE" },
  { href: "/monitoring", label: "MONITORING" },
];

export function Topbar() {
  const pathname = usePathname();
  const [network, setNetwork] = useState<"TESTNET" | "MAINNET">("TESTNET");
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

      {/* Right: Network Segmented Control + Wallet Action */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Network Toggle */}
        <div className="flex items-center border border-[#E8DFD1] rounded-sm p-0.5 bg-[#FFF2DB]/60 text-[10px] font-mono">
          <button
            onClick={() => setNetwork("TESTNET")}
            className={cn(
              "px-2 py-0.5 rounded-sm transition uppercase",
              network === "TESTNET"
                ? "bg-[#171717] text-[#FFFAF3] font-medium shadow-xs"
                : "text-[#78716C] hover:text-[#171717]",
            )}
          >
            TESTNET
          </button>
          <button
            onClick={() => setNetwork("MAINNET")}
            className={cn(
              "px-2 py-0.5 rounded-sm transition uppercase",
              network === "MAINNET"
                ? "bg-[#171717] text-[#FFFAF3] font-medium shadow-xs"
                : "text-[#78716C] hover:text-[#171717]",
            )}
          >
            MAINNET
          </button>
        </div>

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
                    Arbitrum One ({network})
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

      {/* Global Connection Error Banner (if any) */}
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

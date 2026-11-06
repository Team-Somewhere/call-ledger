"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

const navLinks = [
  { href: "/", label: "TERMINAL" },
  { href: "/discover", label: "DISCOVER" },
  { href: "/following", label: "FOLLOWING" },
  { href: "/signals", label: "SIGNALS" },
  { href: "/strategies", label: "ALLOCATIONS" },
  { href: "/portfolio", label: "PORTFOLIO" },
  { href: "/activity", label: "ACTIVITY" },
];

export function Topbar() {
  const pathname = usePathname();
  const [network, setNetwork] = useState<"TESTNET" | "MAINNET">("TESTNET");
  const [walletConnected, setWalletConnected] = useState(true);
  const [showWalletMenu, setShowWalletMenu] = useState(false);

  return (
    <header className="w-full bg-[#FFFAF3] border-b border-[#E8DFD1] px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-40">
      {/* Left: Brand Logo + Nav Links */}
      <div className="flex items-center gap-6 md:gap-10">
        {/* Brand Logo inspired by KOLLATERAL */}
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

      {/* Right: Network Segmented Control + Wallet Pill */}
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

        {/* Wallet Pill */}
        <div className="relative">
          <button
            onClick={() => setShowWalletMenu(!showWalletMenu)}
            className="flex items-center gap-2 border border-[#E8DFD1] hover:border-[#171717] rounded-sm px-2.5 py-1 text-xs font-mono bg-[#FFF2DB]/50 transition text-[#171717]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] inline-block" />
            <span className="text-[11px] font-medium">0.1000 ETH</span>
            <ChevronDown className="w-3 h-3 text-[#78716C]" />
          </button>

          {showWalletMenu && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] shadow-lg p-3 z-50 text-xs font-mono">
              <div className="text-[10px] uppercase text-[#78716C] pb-1 border-b border-[#E8DFD1]">
                Connected Wallet
              </div>
              <div className="mt-2 text-xs font-medium text-[#171717] truncate">
                0x71C836...49b2
              </div>
              <div className="mt-1 text-[11px] text-[#78716C]">
                Chain: Arbitrum One
              </div>
              <div className="mt-3 pt-2 border-t border-[#E8DFD1] flex justify-between items-center text-[10px]">
                <span className="text-[#16A34A]">Arkiv Key Linked</span>
                <button
                  onClick={() => {
                    setWalletConnected(!walletConnected);
                    setShowWalletMenu(false);
                  }}
                  className="text-[#F62440] hover:underline"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

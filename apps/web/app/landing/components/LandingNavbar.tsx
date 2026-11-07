"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Wallet } from "lucide-react";
import { useWalletSession } from "../../../lib/use-wallet-session";

export const LandingNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [isOverDarkFooter, setIsOverDarkFooter] = useState(false);
  const { isAuthenticated, connect, disconnect, isConnecting, address } = useWalletSession();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Seamlessly adapt navbar theme when scrolling over the dark footer section
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsOverDarkFooter(Boolean(entry?.isIntersecting));
      },
      { rootMargin: "-70px 0px 0px 0px", threshold: 0.05 }
    );

    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const isDark = isOverDarkFooter;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isDark
          ? "bg-[#171717]/95 backdrop-blur-md border-b border-white/10 shadow-md text-[#FFFAF3]"
          : scrolled
          ? "bg-[#FFFAF3]/95 backdrop-blur-md border-b border-[#E8DFD1] shadow-xs text-[#171717]"
          : "bg-transparent text-[#171717]"
      }`}
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 h-16 sm:h-18 flex items-center justify-between font-mono">
        {/* Brand Logo */}
        <Link
          href="/landing"
          className="flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-[#171717] rounded-sm group shrink-0"
          aria-label="CallLedger home"
        >
          <span className="bg-[#F62440] text-white px-2.5 py-1 rounded-xs font-black text-xs sm:text-sm tracking-wider shadow-xs">
            CALL
          </span>
          <span
            className={`font-extrabold text-sm sm:text-base tracking-wider transition-colors ${
              isDark ? "text-white group-hover:text-[#F62440]" : "text-[#171717] group-hover:text-[#F62440]"
            }`}
          >
            LEDGER
          </span>
        </Link>

        {/* Action Buttons: Definitive, Connect Wallet, Open App (Equally Spaced) */}
        <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
          {/* Button 1: Definitive App Redirect */}
          <a
            href="https://www.definitive.fi"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-sm text-xs font-bold tracking-wider transition-all border ${
              isDark
                ? "bg-white/5 border-white/20 text-[#FFFAF3] hover:bg-white/15 hover:border-white/40"
                : "bg-[#FFF2DB]/80 border-[#E8DFD1] text-[#171717] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-[#171717]"
            }`}
            title="Download Definitive app or trade online in browser"
            aria-label="Open Definitive app website"
          >
            <span>Definitive</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
          </a>

          {/* Button 2: Connect Wallet (MetaMask / EIP-1193) */}
          <button
            type="button"
            onClick={() => {
              if (isAuthenticated) {
                disconnect();
              } else {
                void connect();
              }
            }}
            disabled={isConnecting}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-sm text-xs font-bold tracking-wider transition-all border cursor-pointer ${
              isDark
                ? "bg-white/5 border-white/20 text-[#FFFAF3] hover:bg-white/15 hover:border-white/40"
                : "bg-[#FFF2DB]/80 border-[#E8DFD1] text-[#171717] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-[#171717]"
            }`}
            title={isAuthenticated ? `Connected: ${address} (Click to disconnect)` : "Connect your MetaMask wallet"}
            aria-label={isAuthenticated ? "Disconnect wallet" : "Connect wallet"}
          >
            <Wallet className="w-3.5 h-3.5 shrink-0" />
            {isConnecting ? (
              <span>Connecting...</span>
            ) : isAuthenticated && address ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span>
                  {address.slice(0, 4)}...{address.slice(-3)}
                </span>
              </span>
            ) : (
              <span>Connect Wallet</span>
            )}
          </button>

          {/* Button 3: Open App */}
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-sm text-xs font-bold tracking-wider transition-all border shadow-sm shrink-0 ${
              isDark
                ? "bg-[#FFF2DB] text-[#171717] border-[#FFF2DB] hover:bg-white hover:text-[#171717]"
                : "bg-[#171717] text-[#FFFAF3] border-[#171717] hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717]"
            }`}
            aria-label="Open the CallLedger application"
          >
            <span>Open App</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;


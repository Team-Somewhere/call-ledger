"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const LandingNavbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#FFFAF3]/95 backdrop-blur-md border-b border-[#E8DFD1] shadow-xs"
          : "bg-transparent"
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between font-mono">
        <Link
          href="/landing"
          className="flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#171717] rounded-sm"
          aria-label="CallLedger home"
        >
          <span className="bg-[#F62440] text-white px-1.5 py-0.5 rounded-xs font-bold text-[10px] tracking-wider">
            CALL
          </span>
          <span className="font-bold text-xs tracking-wider text-[#171717]">
            LEDGER
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#171717] text-[#FFFAF3] text-[11px] font-bold tracking-wider hover:bg-[#2a2a2a] transition-all shadow-xs"
            aria-label="Open the CallLedger application"
          >
            <span>Open App</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default LandingNavbar;

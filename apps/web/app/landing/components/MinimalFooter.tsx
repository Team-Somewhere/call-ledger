"use client";

import React from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { XLogo } from "./XLogo";

export const MinimalFooter: React.FC = () => {
  return (
    <footer className="bg-[#171717] text-[#FFFAF3] overflow-hidden" aria-labelledby="closing-heading">
      {/* Reduced top spacing to remove the empty gap above the headline */}
      <div className="relative pt-6 sm:pt-8 pb-16 sm:pb-20 px-6 md:px-12 text-center max-w-4xl mx-auto space-y-6">
        {/* Blue dotted background kept as requested */}
        <div
          className="absolute inset-0 ledger-dot-grid opacity-20 pointer-events-none [background-image:radial-gradient(#60a5fa_1.2px,transparent_1.2px)]"
          aria-hidden="true"
        />

        {/* Brand Badge */}
        <div className="inline-flex items-center gap-2.5 border border-white/20 bg-white/5 px-4 py-2 rounded-full backdrop-blur-xs">
          <XLogo className="w-3.5 h-3.5 text-white" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span className="text-xs font-mono font-bold tracking-widest text-[#FFFAF3] uppercase">
            CALL LEDGER · LIVE ON BASE
          </span>
        </div>

        {/* Headline: Clean 3-line layout without awkward line breaks */}
        <div className="space-y-4 font-sans">
          <h2 id="closing-heading" className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#FFFAF3] leading-[1.12]">
            Every public call on X.
            <br />
            <span className="text-[#FFF2DB]">Every real result.</span>
            <br />
            <span className="text-[#F62440]">Finally on record.</span>
          </h2>

          <p className="text-sm sm:text-base lg:text-lg text-white/70 max-w-xl mx-auto pt-2 leading-relaxed">
            Never wonder whether a crypto influencer deleted a bad trade or bragged about a pump after the fact. See real track records in plain English.
          </p>
        </div>

        {/* Primary CTA Button - Well-proportioned, visible height & padding */}
        <div className="pt-4">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <Link
              href="/"
              className="group relative inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 rounded-sm text-sm sm:text-base font-mono font-bold tracking-wider overflow-hidden transition-all duration-300 border bg-[#FFF2DB] text-[#171717] border-[#E8DFD1] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-white/40 shadow-xl"
            >
              <span className="relative z-10 flex items-center gap-2.5">
                <span>Open CallLedger</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <nav className="border-t border-white/10 px-6 md:px-12 py-8 font-mono" aria-label="Footer navigation">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-white/60">
          <div className="flex items-center gap-2.5">
            <span className="bg-[#F62440] text-white px-2 py-0.5 rounded-xs font-bold text-xs">
              CALL
            </span>
            <span className="font-bold text-white tracking-wider text-sm">LEDGER</span>
            <span className="text-white/40 ml-3">© {new Date().getFullYear()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-xs sm:text-sm">
            <Link href="/" className="hover:text-white transition">Terminal</Link>
            <Link href="/discover" className="hover:text-white transition">Discover Traders</Link>
            <Link href="/following" className="hover:text-white transition">Following</Link>
            <Link href="/trade" className="hover:text-white transition">Trade Ticket</Link>
            <Link href="/strategies" className="hover:text-white transition">Allocations</Link>
            <Link href="/portfolio" className="hover:text-white transition">Portfolio</Link>
          </div>
        </div>
      </nav>
    </footer>
  );
};

export default MinimalFooter;


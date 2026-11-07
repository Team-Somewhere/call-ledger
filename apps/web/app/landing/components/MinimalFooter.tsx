"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const ROTATING_PHRASES = [
  "Now so is the record.",
  "Every signal verified on-chain.",
  "From chaotic feed to clean execution.",
  "Auditable history. Zero guesswork.",
];

export const MinimalFooter: React.FC = () => {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 4200);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="bg-[#171717] text-[#FFFAF3] overflow-hidden" aria-labelledby="closing-heading">
      <div className="relative py-28 md:py-36 px-6 md:px-12 lg:px-16 text-center max-w-4xl mx-auto space-y-8">
        <div className="absolute inset-0 ledger-dot-grid opacity-10 pointer-events-none" aria-hidden="true" />

        {/* Blinking CallLedger Brand Badge */}
        <div className="inline-flex items-center gap-2 border border-white/20 bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-[#F62440] animate-ping" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-[#FFFAF3] uppercase">
            CALL LEDGER PROTOCOL
          </span>
        </div>

        {/* Dynamic Rotating Headline */}
        <div className="space-y-3 font-sans">
          <h2 id="closing-heading" className="text-4xl sm:text-6xl font-bold tracking-tight text-[#FFFAF3]">
            The call is public.
            <br />
            <span className="inline-block min-h-[1.3em] text-[#F62440]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.45 }}
                  className="inline-block"
                >
                  {ROTATING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </h2>

          <p className="text-sm sm:text-base text-white/60 max-w-xl mx-auto pt-2 leading-relaxed">
            Never wonder whether a crypto influencer deleted a losing trade or claimed
            a pump after the fact. Build your sovereign trading record today.
          </p>
        </div>

        {/* Primary CTA (starts cream, flips to dark on hover) */}
        <div className="pt-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <Link
              href="/"
              className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-sm text-xs font-mono font-bold tracking-wider overflow-hidden transition-all duration-300 border bg-[#FFF2DB] text-[#171717] border-[#E8DFD1] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-white/30 shadow-md"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Open CallLedger</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <nav className="border-t border-white/10 px-6 md:px-12 lg:px-16 py-8 font-mono" aria-label="Footer navigation">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <span className="bg-[#F62440] text-white px-1.5 py-0.5 rounded-xs font-bold text-[10px]">
              CALL
            </span>
            <span className="font-bold text-white tracking-wider">LEDGER</span>
            <span className="text-white/30 ml-2">© {new Date().getFullYear()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/" className="hover:text-white transition">Terminal</Link>
            <Link href="/discover" className="hover:text-white transition">Discover</Link>
            <Link href="/following" className="hover:text-white transition">Following</Link>
            <Link href="/trade" className="hover:text-white transition">Trade</Link>
            <Link href="/strategies" className="hover:text-white transition">Allocations</Link>
            <Link href="/portfolio" className="hover:text-white transition">Portfolio</Link>
          </div>
        </div>
      </nav>
    </footer>
  );
};

export default MinimalFooter;


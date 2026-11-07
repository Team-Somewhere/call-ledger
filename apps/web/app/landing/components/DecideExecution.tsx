"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { TextScramble } from "./TextScramble";
import { ArrowRight, ShieldCheck, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { XLogo } from "./XLogo";

export const DecideExecution: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative py-32 md:py-44 bg-[#FFFAF3] text-[#171717] overflow-hidden"
      aria-labelledby="decide-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
        {/* Left Column: Plain English Explanation & Actions */}
        <div className="lg:col-span-6 space-y-7">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] text-xs font-mono font-bold tracking-wider text-[#171717]">
            <XLogo className="w-3.5 h-3.5" />
            <span>STEP 4 · YOUR CALL, YOUR WALLET</span>
          </div>

          <div className="space-y-4">
            <h2 id="decide-heading" className="text-5xl sm:text-6xl font-bold tracking-tight text-[#171717] leading-tight font-sans">
              <TextScramble
                text="You decide what to do next."
                trigger={inView}
                duration={1000}
                delay={100}
              />
            </h2>
            <p className="text-base sm:text-lg text-[#78716C] leading-relaxed">
              Following an influencer on X doesn&apos;t mean blindly copying them. CallLedger keeps the public score so you know who actually wins.
            </p>
            <p className="text-base sm:text-lg text-[#78716C] leading-relaxed">
              If you do choose to take the trade, you stay in 100% control. You sign with MetaMask. No one else ever touches your coins.
            </p>
          </div>

          <div className="space-y-2.5 pt-2 text-sm text-[#171717] font-medium">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>Start small with test amounts like 0.05 USDC</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>Fast & cheap micro-trades on Base</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>Review entry, stop-loss, and target before signing</span>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-4 items-center">
            {/* Primary Action Button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/"
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-sm text-sm font-mono font-bold tracking-wider overflow-hidden transition-all duration-300 border bg-[#171717] text-[#FFFAF3] border-[#171717] hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717] shadow-md"
              >
                <span className="relative z-10 flex items-center gap-2.5">
                  <span>Open CallLedger</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/trade"
                className="group inline-flex items-center gap-2.5 px-6 py-4 rounded-sm text-sm font-mono font-bold tracking-wider border border-[#E8DFD1] bg-[#FFF2DB] text-[#171717] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-[#171717] transition-all duration-300 shadow-xs"
              >
                <span>Preview Trade Ticket</span>
                <ExternalLink className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Right Column: Realistic Trade Ticket Preview */}
        <div className="lg:col-span-6 flex justify-center">
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-full max-w-lg border-2 border-[#171717] bg-[#FFFAF3] rounded-sm shadow-2xl p-7 sm:p-8 space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="font-mono font-bold text-xs tracking-wider text-[#171717]">
                  DEFINITIVE FLASH · TRADE TICKET
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                SELF-CUSTODY
              </span>
            </div>

            {/* Signal Origin from X */}
            <div className="p-4 bg-[#FFF2DB] border border-[#E8DFD1] rounded-sm space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-mono text-[#78716C] font-semibold text-[11px]">
                  <XLogo className="w-3 h-3 text-[#171717]" />
                  Call from @CryptoTony__ on X
                </span>
                <span className="font-mono text-[10px] text-[#16A34A] font-bold">MATCHED SIGNAL</span>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="font-bold text-lg text-[#171717]">ETH / USDC</div>
                  <div className="text-xs text-[#78716C]">Breakout long above $3,140</div>
                </div>
                <span className="px-2.5 py-1 rounded-sm bg-[#16A34A] text-white font-mono text-xs font-bold">
                  BUY LONG
                </span>
              </div>
            </div>

            {/* Real micro-amounts matching CallLedger */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-white/60">
                <div className="text-[10px] text-[#78716C] uppercase font-bold">Network</div>
                <div className="font-bold text-[#171717] text-sm mt-0.5">Base</div>
              </div>
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-white/60">
                <div className="text-[10px] text-[#78716C] uppercase font-bold">Trade Size</div>
                <div className="font-bold text-[#171717] text-sm mt-0.5">0.05 USDC</div>
              </div>
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-white/60">
                <div className="text-[10px] text-[#78716C] uppercase font-bold">Stop Loss</div>
                <div className="font-bold text-[#F62440] text-sm mt-0.5">$3,080</div>
              </div>
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-white/60">
                <div className="text-[10px] text-[#78716C] uppercase font-bold">Take Profit</div>
                <div className="font-bold text-[#16A34A] text-sm mt-0.5">$3,420</div>
              </div>
            </div>

            {/* Sign with MetaMask */}
            <div className="pt-2">
              <div className="w-full py-3.5 bg-[#171717] text-[#FFFAF3] text-xs sm:text-sm font-mono font-bold rounded-sm tracking-wider text-center flex items-center justify-center gap-2.5 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>SIGN IN METAMASK TO CONFIRM</span>
              </div>
              <p className="text-[11px] text-[#78716C] text-center mt-2.5 font-sans">
                Funds never leave your wallet without your direct MetaMask approval.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DecideExecution;


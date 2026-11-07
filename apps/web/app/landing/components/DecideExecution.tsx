"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { TextScramble } from "./TextScramble";
import { ArrowRight, ShieldCheck, ExternalLink } from "lucide-react";
import Link from "next/link";

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
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative py-28 md:py-36 bg-[#FFFAF3] text-[#171717] overflow-hidden"
      aria-labelledby="decide-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center font-mono">
        {/* Left Column: Cipher text & Actions */}
        <div className="lg:col-span-6 space-y-6">
          <span className="text-xs text-[#78716C] tracking-widest uppercase block">
            // 04 · NON-CUSTODIAL EXECUTION
          </span>

          <div className="space-y-3 font-sans">
            <h2 id="decide-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
              <TextScramble
                text="You decide what to do next."
                trigger={inView}
                duration={1200}
                delay={100}
              />
            </h2>
            <p className="text-sm sm:text-base text-[#78716C] leading-relaxed">
              Tracking a signal does not force a trade. CallLedger provides verified
              historical accuracy. If you decide to act, an optional non-custodial
              execution path lets you review and sign orders via Definitive Flash.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-4 items-center">
            {/* Primary Action Button with smooth hover transition */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/"
                className="group relative inline-flex items-center gap-2.5 px-6 py-3.5 rounded-sm text-xs font-mono font-bold tracking-wider overflow-hidden transition-all duration-300 border bg-[#171717] text-[#FFFAF3] border-[#171717] hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717] shadow-sm"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <span>Open CallLedger</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/trade"
                className="group inline-flex items-center gap-2 px-5 py-3.5 rounded-sm text-xs font-mono font-bold tracking-wider border border-[#E8DFD1] bg-[#FFF2DB] text-[#171717] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-[#171717] transition-all duration-300"
              >
                <span>Inspect Trade Review Flow</span>
                <ExternalLink className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Right Column: 3D interactive floating card with subtle hover motion */}
        <div className="lg:col-span-6 flex justify-center">
          <motion.div
            whileHover={{ y: -8, rotateX: 3, rotateY: -3, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-full max-w-md border-2 border-[#171717] bg-[#FFFAF3] rounded-sm shadow-xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="font-bold text-xs text-[#171717]">// DEFINITIVE FLASH VAULT</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-[#FFF2DB] border border-[#E8DFD1] text-[#78716C]">
                NON-CUSTODIAL
              </span>
            </div>

            <div className="p-3 bg-[#FFF2DB]/80 border border-[#E8DFD1] rounded-sm space-y-1 text-xs">
              <span className="text-[9px] text-[#78716C] uppercase font-bold">Signal Source</span>
              <div className="font-bold text-[#171717]">SOL/USDC · 4H LONG</div>
              <div className="text-[10px] text-[#78716C]">@ThorneMacro · Verified on-chain</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-sm border border-[#E8DFD1]">
                <div className="text-[9px] text-[#78716C] uppercase">EXECUTION CHAIN</div>
                <div className="font-bold text-[#171717] mt-0.5">Base Mainnet</div>
              </div>
              <div className="p-2.5 rounded-sm border border-[#E8DFD1]">
                <div className="text-[9px] text-[#78716C] uppercase">ORDER STRATEGY</div>
                <div className="font-bold text-[#171717] mt-0.5">Flash Limit</div>
              </div>
            </div>

            <div className="pt-2">
              <div className="w-full py-3 bg-[#171717] text-[#FFFAF3] text-xs font-bold rounded-sm tracking-wider text-center flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>CRYPTOGRAPHICALLY SIGN IN METAMASK</span>
              </div>
              <p className="text-[10px] text-[#78716C] text-center mt-2 font-sans">
                No funds leave your wallet without your direct EIP-712 signature.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DecideExecution;


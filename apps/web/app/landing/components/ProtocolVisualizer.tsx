"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, AnimatePresence } from "motion/react";
import { XLogo } from "./XLogo";
import { Check, ShieldCheck, CheckCircle2, ArrowRight, Heart, Repeat2, Bookmark, Share } from "lucide-react";

export const ProtocolVisualizer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest < 0.25) {
        setActivePhase(1);
      } else if (latest < 0.5) {
        setActivePhase(2);
      } else if (latest < 0.75) {
        setActivePhase(3);
      } else {
        setActivePhase(4);
      }
    });
  }, [scrollYProgress]);

  const scrollToPhase = (phaseNumber: 1 | 2 | 3 | 4) => {
    setActivePhase(phaseNumber);
    if (!containerRef.current) return;
    const offsets = { 1: 0.05, 2: 0.35, 3: 0.65, 4: 0.95 };
    const targetOffset = offsets[phaseNumber];
    const containerTop = containerRef.current.offsetTop;
    const containerHeight = containerRef.current.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: containerTop + containerHeight * targetOffset,
      behavior: "smooth",
    });
  };

  const phases = [
    { num: 1, label: "01 CATCH TWEET", title: "Catch the Call on X" },
    { num: 2, label: "02 EXTRACT TRADE", title: "Pull Out Trade Details" },
    { num: 3, label: "03 LOCK ON-CHAIN", title: "Save Proof to Blockchain" },
    { num: 4, label: "04 TRACK & COPY", title: "Track Outcome & Copy Trade" },
  ];

  return (
    <section
      id="protocol"
      ref={containerRef}
      className="relative h-[240vh] bg-[#FFFAF3] text-[#171717]"
    >
      {/* Sticky Dual-Pane Terminal Viewport */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center items-center overflow-hidden px-4 sm:px-8 lg:px-16 py-8">
        {/* Section Header (Scaled Up) */}
        <div className="w-full max-w-7xl mx-auto mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="shrink min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 border-2 border-[#E8DFD1] bg-[#FFF2DB] px-3.5 py-1.5 rounded-sm text-xs font-mono uppercase tracking-widest text-[#171717] font-bold">
              <XLogo className="w-4 h-4 text-[#171717]" />
              <span>// HOW CALLLEDGER WORKS</span>
            </div>
            <h2 className="font-sans text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#171717] tracking-tight">
              From a Tweet on X to an Executable Trade
            </h2>
          </div>

          {/* Phase Tracker Pills */}
          <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto py-1 font-mono">
            {phases.map((p, index) => {
              const isCurrent = activePhase === p.num;
              return (
                <React.Fragment key={p.num}>
                  <button
                    onClick={() => scrollToPhase(p.num as 1 | 2 | 3 | 4)}
                    className={`px-4 py-2 rounded-sm text-xs sm:text-sm tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border-2 font-bold ${
                      isCurrent
                        ? "bg-[#171717] text-[#FFFAF3] border-[#171717] shadow-md"
                        : "border-[#E8DFD1] text-[#78716C] hover:text-[#171717] hover:border-[#171717] bg-[#FFFAF3]"
                    }`}
                  >
                    {p.label}
                  </button>
                  {index < phases.length - 1 && (
                    <span className="text-[#E8DFD1] text-sm hidden sm:inline shrink-0 select-none font-bold">
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Scaled-up Dual-Pane Container */}
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch font-mono">
          {/* Left Column: Simple English Explanation */}
          <div className="hidden lg:flex lg:col-span-5 rounded-2xl border-2 border-[#E8DFD1] bg-[#FFF2DB] p-8 flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-pulse" />
                  <span className="text-sm text-[#171717] uppercase tracking-wider font-extrabold">
                    STEP 0{activePhase} // 04
                  </span>
                </div>
                <span className="text-xs text-[#78716C] font-bold">Live System</span>
              </div>

              {/* Dynamic Phase Explanation in Plain English */}
              <div className="mt-6 space-y-4 font-sans">
                <AnimatePresence mode="wait">
                  {activePhase === 1 && (
                    <motion.div
                      key="desc-phase-1"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <h3 className="text-2xl text-[#171717] font-bold">
                        1. We catch the tweet the second it is posted
                      </h3>
                      <p className="text-sm text-[#78716C] leading-relaxed">
                        CallLedger monitors verified crypto traders on X 24/7. When an influencer like Doctor Profit or Crypto Tony tweets a trade setup, we save the post instantly before they have any chance to edit or delete it.
                      </p>
                      <div className="space-y-2 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Scans top trader feeds every 16 seconds</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Exact timestamp captured directly from Twitter</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activePhase === 2 && (
                    <motion.div
                      key="desc-phase-2"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <h3 className="text-2xl text-[#171717] font-bold">
                        2. We pull out the clean trade numbers
                      </h3>
                      <p className="text-sm text-[#78716C] leading-relaxed">
                        Traders write in conversational slang like &quot;buying more dips here&quot; or &quot;SL tight at 162&quot;. CallLedger reads the text and extracts the 5 key numbers you need: the coin, the entry price, the stop-loss, and the profit target.
                      </p>
                      <div className="space-y-2 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Filters out useless memes and general chit-chat</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Turns noisy tweets into clean trading signals</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activePhase === 3 && (
                    <motion.div
                      key="desc-phase-3"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <h3 className="text-2xl text-[#171717] font-bold">
                        3. The proof is permanently saved on-chain
                      </h3>
                      <p className="text-sm text-[#78716C] leading-relaxed">
                        We write the trade setup to decentralized blockchain storage (Arkiv). Once it is written, it is permanent. If the creator deletes their tweet on X when the trade goes wrong, our record remains visible to everyone.
                      </p>
                      <div className="space-y-2 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Immutable proof tied to an on-chain block number</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Creators cannot erase or hide their losing calls</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activePhase === 4 && (
                    <motion.div
                      key="desc-phase-4"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <h3 className="text-2xl text-[#171717] font-bold">
                        4. Track real results & copy with 1 click
                      </h3>
                      <p className="text-sm text-[#78716C] leading-relaxed">
                        We watch real-time market prices to see if the trade hits profit or stop-loss. If you like the setup, you can copy the trade right inside CallLedger with your MetaMask wallet, starting with just $1 on Base.
                      </p>
                      <div className="space-y-2 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Real win/loss statistics logged on creator profiles</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#16A34A] stroke-[3]" />
                          <span>Safe, non-custodial copy-trading via Definitive Flash</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Simple Stats Footer */}
            <div className="mt-8 pt-4 border-t border-[#E8DFD1] grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
                <span className="text-[#78716C] text-[11px] block">Network</span>
                <span className="font-bold text-[#171717] mt-0.5 block">Base Mainnet</span>
              </div>
              <div className="p-3 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
                <span className="text-[#78716C] text-[11px] block">Minimum Trade</span>
                <span className="font-bold text-[#16A34A] mt-0.5 block">0.05 USDC ($0.05)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Stage (Authentic Tweet Card & Trade Preview) */}
          <div className="lg:col-span-7 w-full mx-auto rounded-2xl border-2 border-[#171717] bg-[#171717] text-[#FFFAF3] p-6 sm:p-9 shadow-2xl flex flex-col justify-between">
            {/* Top Bar with Twitter Badge */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs text-white/60">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  <XLogo className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-white font-bold text-sm">Crypto Twitter Live Feed</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-[#16A34A] font-bold">16s Live Poll</span>
              </div>
            </div>

            {/* Central Stage: Realist Tweet Card & Clean Numbers */}
            <div className="py-6 min-h-[290px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {activePhase === 1 && (
                  <motion.div
                    key="visual-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Realistic Tweet Card */}
                    <div className="p-5 rounded-xl border border-white/15 bg-white/5 space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FFE5BF] text-[#171717] font-bold flex items-center justify-center text-sm font-mono border border-white/20">
                            DP
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-base">Doctor Profit</span>
                              <span className="text-blue-400 text-xs">☑</span>
                            </div>
                            <span className="text-white/40 text-xs font-mono">@DrProfitCrypto</span>
                          </div>
                        </div>
                        <span className="text-xs text-white/50 font-mono">2m ago</span>
                      </div>

                      <p className="text-base text-white/90 leading-relaxed font-normal">
                        &quot;$SOL breakout confirmed right now! Entered long at <span className="font-bold text-white underline decoration-[#16A34A]">$174.50</span>. Stop-loss tight at $162. Target is $215. Send it! 🚀&quot;
                      </p>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/40 font-mono">
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> 842</span>
                        <span className="flex items-center gap-1"><Repeat2 className="w-3.5 h-3.5" /> 148</span>
                        <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> 312</span>
                        <span className="text-[#16A34A] font-bold">✓ Captured by CallLedger</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 2 && (
                  <motion.div
                    key="visual-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="text-xs text-white/50 pb-1">
                      EXTRACTED TRADE PARAMETERS FROM @DrProfitCrypto:
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                        <span className="text-white/40 text-xs">COIN PAIR</span>
                        <div className="font-bold text-xl text-white mt-1">SOL / USDC</div>
                      </div>
                      <div className="p-4 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10">
                        <span className="text-[#16A34A] text-xs font-bold">DIRECTION</span>
                        <div className="font-bold text-xl text-[#16A34A] mt-1">▲ BUY / LONG</div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-xs grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-white/40 text-[11px]">ENTRY TARGET</span>
                        <div className="font-bold text-base text-white mt-0.5">$174.50</div>
                      </div>
                      <div>
                        <span className="text-white/40 text-[11px]">TAKE PROFIT</span>
                        <div className="font-bold text-base text-[#16A34A] mt-0.5">$215.00</div>
                      </div>
                      <div>
                        <span className="text-white/40 text-[11px]">STOP LOSS</span>
                        <div className="font-bold text-base text-[#F62440] mt-0.5">$162.00</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 3 && (
                  <motion.div
                    key="visual-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="p-5 rounded-xl border border-white/15 bg-white/5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">ON-CHAIN PROOF RECEIPT</span>
                        <span className="text-[#16A34A] font-bold">STATUS: LOCKED & PERMANENT</span>
                      </div>
                      <div className="p-3 rounded-lg bg-black/60 border border-white/10 text-xs space-y-1">
                        <div className="text-[#FFE5BF] font-mono break-all">
                          arkiv://record/drprofit-sol-call-block28941029
                        </div>
                        <div className="text-white/40 text-[11px]">
                          Hash: 0x892a91fbc012849102941029
                        </div>
                      </div>
                      <p className="text-xs text-white/70 font-sans">
                        Even if Doctor Profit deletes their tweet on X right now, this proof cannot be altered or removed.
                      </p>
                    </div>
                  </motion.div>
                )}

                {activePhase === 4 && (
                  <motion.div
                    key="visual-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="p-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#16A34A] font-bold flex items-center gap-1.5 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Trade Outcome: In Profit (+7.9%)
                        </span>
                        <span className="text-white/60 text-xs">Resolved</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                          <span className="text-white/50 block text-[11px]">Entry Executed</span>
                          <span className="text-white font-bold text-sm">$174.50</span>
                        </div>
                        <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                          <span className="text-white/50 block text-[11px]">Exit Reached</span>
                          <span className="text-[#16A34A] font-bold text-sm">$188.40</span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs border-t border-white/10 text-white/80">
                        <span>Copy trade directly with your wallet:</span>
                        <span className="text-[#16A34A] font-bold">Min Spend: 0.05 USDC</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Terminal Bottom Controls */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
              <div className="flex items-center gap-2">
                <span>Phase 0{activePhase} // 04</span>
                <span>•</span>
                <span className="text-white">CallLedger Verifier</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToPhase(Math.max(1, activePhase - 1) as 1 | 2 | 3 | 4)}
                  disabled={activePhase === 1}
                  className="px-3 py-1.5 rounded-sm border border-white/10 hover:text-white disabled:opacity-20 cursor-pointer transition font-bold"
                >
                  Prev
                </button>
                <button
                  onClick={() => scrollToPhase(Math.min(4, activePhase + 1) as 1 | 2 | 3 | 4)}
                  disabled={activePhase === 4}
                  className="px-3 py-1.5 rounded-sm border border-white/10 hover:text-white disabled:opacity-20 cursor-pointer transition font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProtocolVisualizer;

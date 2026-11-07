"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, AnimatePresence } from "motion/react";
import { Check, ShieldCheck, ExternalLink, Cpu, Hash, FileCode, CheckCircle2 } from "lucide-react";

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
    { num: 1, label: "01 INGESTION", title: "Stream Polling & Capture" },
    { num: 2, label: "02 EXTRACTION", title: "NLP Signal Structuring" },
    { num: 3, label: "03 ATTESTATION", title: "Arkiv Immutable Anchor" },
    { num: 4, label: "04 OUTCOME", title: "Live Price Oracle Resolution" },
  ];

  return (
    <section
      id="protocol"
      ref={containerRef}
      className="relative h-[250vh] bg-[#FFFAF3] text-[#171717]"
    >
      {/* Sticky Dual-Pane Terminal Viewport */}
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center items-center overflow-hidden px-4 sm:px-6 lg:px-12 py-6">
        {/* Section Header */}
        <div className="w-full max-w-7xl mx-auto mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4">
          <div className="shrink min-w-0">
            <span className="font-mono text-xs text-[#78716C] tracking-widest uppercase block mb-1.5 sm:mb-2">
              // 02 · VERIFIABLE RUNTIME
            </span>
            <h2 className="font-sans text-2xl sm:text-4xl lg:text-5xl font-bold text-[#171717] tracking-tight">
              From Social Post to Structured Signal
            </h2>
          </div>

          {/* Phase Tracker Pills */}
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap shrink-0 overflow-x-auto py-1">
            {phases.map((p, index) => {
              const isCurrent = activePhase === p.num;
              return (
                <React.Fragment key={p.num}>
                  <button
                    onClick={() => scrollToPhase(p.num as 1 | 2 | 3 | 4)}
                    className={`px-3 py-1.5 rounded-sm font-mono text-[10px] sm:text-[11px] tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 border ${
                      isCurrent
                        ? "bg-[#171717] text-[#FFFAF3] font-bold border-[#171717] shadow-sm"
                        : "border-[#E8DFD1] text-[#78716C] hover:text-[#171717] hover:border-[#171717] bg-[#FFFAF3]"
                    }`}
                  >
                    {p.label}
                  </button>
                  {index < phases.length - 1 && (
                    <span className="text-[#E8DFD1] text-xs hidden sm:inline shrink-0 select-none">
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Expansive Dual-Pane Container */}
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch font-mono">
          {/* Left Column: Contextual Protocol Rules & Telemetry */}
          <div className="hidden lg:flex lg:col-span-5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 p-6 sm:p-7 backdrop-blur-md flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                  <span className="text-xs text-[#171717] uppercase tracking-wider font-bold">
                    PHASE 0{activePhase} // 04
                  </span>
                </div>
                <span className="text-[11px] text-[#78716C]">Pipeline Active</span>
              </div>

              {/* Dynamic Phase Explanation */}
              <div className="mt-5 space-y-4">
                <AnimatePresence mode="wait">
                  {activePhase === 1 && (
                    <motion.div
                      key="desc-phase-1"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-3 font-sans"
                    >
                      <h3 className="text-xl text-[#171717] font-bold">
                        Creator Stream Polling & Raw Capture
                      </h3>
                      <p className="text-xs text-[#78716C] leading-relaxed">
                        CallLedger monitors qualified creators on X every 16 seconds.
                        Raw post contents, canonical URLs, and creator signatures are archived
                        at the exact millisecond of discovery.
                      </p>
                      <div className="space-y-1.5 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Direct X API + Firecrawl fallback integration</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Raw JSON payload preserved with snowflake timestamp</span>
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
                      className="space-y-3 font-sans"
                    >
                      <h3 className="text-xl text-[#171717] font-bold">
                        Deterministic Trade Parameter Extraction
                      </h3>
                      <p className="text-xs text-[#78716C] leading-relaxed">
                        Our signal classifier extracts token pair symbols, long/short direction,
                        exact price entry bounds, and invalidation stops from conversational English.
                      </p>
                      <div className="space-y-1.5 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Distinguishes market commentary from explicit signals</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Risk-reward ratio calculated automatically</span>
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
                      className="space-y-3 font-sans"
                    >
                      <h3 className="text-xl text-[#171717] font-bold">
                        On-Chain Arkiv Proof Attestation
                      </h3>
                      <p className="text-xs text-[#78716C] leading-relaxed">
                        The structured signal payload is hashed and written to the Arkiv
                        decentralized archive with an immutable block height stamp.
                        Even if the author deletes the tweet, the receipt lives forever.
                      </p>
                      <div className="space-y-1.5 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Cryptographic hash anchored on Arkiv block ledger</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Retrospective deletion cannot alter caller score</span>
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
                      className="space-y-3 font-sans"
                    >
                      <h3 className="text-xl text-[#171717] font-bold">
                        Price Resolution & Optional Execution
                      </h3>
                      <p className="text-xs text-[#78716C] leading-relaxed">
                        High-frequency market oracles monitor whether entry and take-profit targets
                        hit within the designated resolution window. Users can review the signal
                        and execute directly via Definitive Flash on Base.
                      </p>
                      <div className="space-y-1.5 pt-2 font-mono text-xs text-[#171717]">
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>Automated win/loss resolution without cherry-picking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                          <span>1-click non-custodial Definitive Flash order flow</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Protocol Telemetry */}
            <div className="mt-6 pt-4 border-t border-[#E8DFD1] grid grid-cols-2 gap-3 text-[10px]">
              <div className="p-2.5 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
                <span className="text-[#78716C] block">Arkiv Key</span>
                <span className="font-bold text-[#171717] mt-0.5 block truncate">
                  ark-sig-99201-sol
                </span>
              </div>
              <div className="p-2.5 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
                <span className="text-[#78716C] block">Execution Layer</span>
                <span className="font-bold text-[#16A34A] mt-0.5 block">
                  Definitive Flash
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Terminal */}
          <div className="lg:col-span-7 w-full mx-auto rounded-sm border border-[#171717] bg-[#171717] text-[#FFFAF3] p-5 sm:p-7 shadow-xl flex flex-col justify-between">
            {/* Terminal Top Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                <span className="text-white font-bold">Signal #99201 Execution Engine</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span>Base Sepolia</span>
                <span>•</span>
                <span className="text-white">Block #28,941,029</span>
              </div>
            </div>

            {/* Central Terminal Body Morphs */}
            <div className="py-6 min-h-[260px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {activePhase === 1 && (
                  <motion.div
                    key="terminal-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                      <span>Source: @ThorneMacro (Alex Thorne)</span>
                      <span className="text-[#F62440]">Snowflake #18540912</span>
                    </div>
                    <div className="p-3.5 rounded-sm border border-white/10 bg-black/40 text-xs space-y-1.5">
                      <div className="text-white/40">// Raw Tweet Captured</div>
                      <p className="font-sans text-white/90 italic">
                        &quot;$SOL breakout confirmed — entered at $174.50. 4H close above $178 confirms continuation into $215 TP. SL $162.&quot;
                      </p>
                    </div>
                    <div className="flex justify-between text-[11px] text-white/60">
                      <span>HTTP 200 · Canonical payload captured</span>
                      <span className="text-[#16A34A]">✓ Verified Raw Hash</span>
                    </div>
                  </motion.div>
                )}

                {activePhase === 2 && (
                  <motion.div
                    key="terminal-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-sm border border-white/10 bg-black/40">
                        <span className="text-white/40 text-[10px]">TARGET ASSET</span>
                        <div className="font-bold text-base text-white mt-0.5">SOL / USDC</div>
                      </div>
                      <div className="p-3 rounded-sm border border-white/10 bg-black/40">
                        <span className="text-white/40 text-[10px]">DIRECTION</span>
                        <div className="font-bold text-base text-[#16A34A] mt-0.5">▲ LONG / BUY</div>
                      </div>
                    </div>
                    <div className="p-3 rounded-sm border border-white/10 bg-black/40 text-xs grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-white/40 text-[10px]">ENTRY</span>
                        <div className="font-bold text-white">$174.50</div>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px]">TARGET (TP)</span>
                        <div className="font-bold text-[#16A34A]">$215.00</div>
                      </div>
                      <div>
                        <span className="text-white/40 text-[10px]">STOP LOSS</span>
                        <div className="font-bold text-[#F62440]">$162.00</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activePhase === 3 && (
                  <motion.div
                    key="terminal-3"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="p-3.5 rounded-sm border border-white/10 bg-black/40 text-xs space-y-2">
                      <div className="flex justify-between text-white/50 text-[10px]">
                        <span>ARKIV ANCHOR RECEIPT</span>
                        <span className="text-[#16A34A]">STATUS: CONFIRMED</span>
                      </div>
                      <code className="text-[#FFE5BF] text-[10px] break-all block bg-black/60 p-2.5 rounded-sm border border-white/5">
                        ark-0x892a91fbc012849102941029-sol-c1-thornemacro
                      </code>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>Hash permanently anchored</span>
                      <span className="text-white">Block #28,941,029</span>
                    </div>
                  </motion.div>
                )}

                {activePhase === 4 && (
                  <motion.div
                    key="terminal-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                      <span className="text-[#16A34A] font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Target Achieved: $188.40 (+7.9%)
                      </span>
                      <span className="text-white/50 text-[10px]">RESOLVED IN 14h</span>
                    </div>
                    <div className="p-3.5 rounded-sm border border-[#16A34A]/30 bg-[#16A34A]/10 text-xs space-y-1">
                      <div className="text-[#16A34A] font-bold">1-Click Definitive Flash Execution</div>
                      <p className="text-[11px] font-sans text-white/80">
                        Followers who deployed capital via Definitive Flash filled at effective price $174.58.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Terminal Bottom Controls */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
              <div className="flex items-center gap-2">
                <span>Phase 0{activePhase} // 04</span>
                <span>•</span>
                <span className="text-white">Arkiv Network</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollToPhase(Math.max(1, activePhase - 1) as 1 | 2 | 3 | 4)}
                  disabled={activePhase === 1}
                  className="px-2.5 py-1 rounded-sm border border-white/10 hover:text-white disabled:opacity-20 cursor-pointer transition"
                >
                  Prev
                </button>
                <button
                  onClick={() => scrollToPhase(Math.min(4, activePhase + 1) as 1 | 2 | 3 | 4)}
                  disabled={activePhase === 4}
                  className="px-2.5 py-1 rounded-sm border border-white/10 hover:text-white disabled:opacity-20 cursor-pointer transition"
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

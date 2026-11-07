"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { Check, CheckCircle2, ShieldCheck } from "lucide-react";
import { XLogo } from "./XLogo";

const TIMELINE_STAGES = [
  {
    step: 1,
    time: "NOV 05 · 20:15 UTC",
    title: "1. CALL POSTED ON X & SAVED",
    desc: "Doctor Profit tweets $SOL long trade setup. Captured and saved to blockchain immediately. Target entry: $174.50.",
    price: "$174.50 SPOT",
    badge: "POSTED",
    badgeColor: "bg-[#F62440] text-white",
  },
  {
    step: 2,
    time: "NOV 06 · 04:30 UTC",
    title: "2. ENTRY TARGET REACHED",
    desc: "Solana price drops into the exact entry zone. Followers get an instant alert with copy-trade option.",
    price: "$174.50 FILLED",
    badge: "ENTRY HIT",
    badgeColor: "bg-[#171717] text-[#FFFAF3]",
  },
  {
    step: 3,
    time: "NOV 06 · 14:00 UTC",
    title: "3. TRADE RUNS IN PROFIT",
    desc: "Price climbs to $179.20. Live price feed records +2.7% gain in real-time.",
    price: "$179.20 (+2.7%)",
    badge: "IN PROFIT",
    badgeColor: "bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40",
  },
  {
    step: 4,
    time: "NOV 07 · 09:00 UTC",
    title: "4. TARGET HIT & VERIFIED",
    desc: "Target price achieved at $188.40. The trade is marked as a win on the trader's permanent ledger score.",
    price: "$188.40 (+7.9%)",
    badge: "PROFIT HIT",
    badgeColor: "bg-[#16A34A] text-white",
  },
];

export const SignalLedgerTimeline: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const lineHeight = useTransform(scrollYProgress, [0.08, 0.88], ["0%", "100%"]);
  const smoothLineHeight = useSpring(lineHeight, { stiffness: 140, damping: 25 });

  const [activeCount, setActiveCount] = useState(1);

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest < 0.25) setActiveCount(1);
      else if (latest < 0.5) setActiveCount(2);
      else if (latest < 0.75) setActiveCount(3);
      else setActiveCount(4);
    });
  }, [scrollYProgress]);

  return (
    <section ref={containerRef} className="relative h-[250vh] bg-[#FFF2DB]/50 text-[#171717]">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-6 sm:px-10 lg:px-16 py-6 sm:py-8">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center font-mono">
          {/* Left Narrative - Slightly Increased */}
          <div className="lg:col-span-5 space-y-5">
            <div className="inline-flex items-center gap-2.5 border-2 border-[#E8DFD1] bg-[#FFFAF3] px-3.5 py-1.5 rounded-sm text-xs uppercase tracking-widest text-[#171717] font-bold">
              <XLogo className="w-4 h-4 text-[#171717]" />
              <span>// REAL OUTCOME TRACKING</span>
            </div>
            <h2 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#171717] leading-[1.08]">
              Follow the call.
              <br />
              <span className="text-[#16A34A]">See what really happened.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#78716C] font-sans leading-relaxed">
              Did the influencer&apos;s call make money, or did it get stopped out? CallLedger tracks every stage of the trade in real-time, giving you an honest record of who actually wins.
            </p>
            <div className="p-3.5 border-2 border-[#E8DFD1] bg-[#FFFAF3] rounded-sm text-xs sm:text-sm text-[#171717] flex items-center justify-between font-bold">
              <span>UNLOCKED: {activeCount} / 4 STEPS</span>
              <span className="text-[#16A34A]">
                {activeCount === 4 ? "ALL 4 STEPS VERIFIED" : "SCROLL TO ADVANCE"}
              </span>
            </div>
          </div>

          {/* Right Centered Interactive Timeline - Moderately Increased Size */}
          <div className="lg:col-span-7">
            <div className="relative pl-10 sm:pl-12">
              {/* Background static track */}
              <div className="absolute left-[13px] sm:left-[17px] top-3 bottom-5 w-1.5 bg-[#E8DFD1] rounded-full" />

              {/* Dynamic growing line */}
              <motion.div
                style={{ height: smoothLineHeight }}
                className="absolute left-[13px] sm:left-[17px] top-3 w-1.5 bg-[#16A34A] rounded-full origin-top shadow-[0_0_12px_rgba(22,163,74,0.5)]"
              />

              <div className="space-y-4 sm:space-y-4.5">
                {TIMELINE_STAGES.map((event, idx) => {
                  const isReached = idx < activeCount;

                  return (
                    <div key={event.step} className="relative flex items-center gap-3.5 sm:gap-5">
                      {/* Node Bullet */}
                      <motion.div
                        animate={{
                          scale: isReached ? [1, 1.25, 1] : 0.85,
                          backgroundColor: isReached ? "#16A34A" : "#E8DFD1",
                          borderColor: isReached ? "#FFFAF3" : "#E8DFD1",
                        }}
                        transition={{ duration: 0.25 }}
                        className="absolute -left-[30px] sm:-left-[34px] w-7 h-7 rounded-full border-2 border-[#FFFAF3] flex items-center justify-center text-[10px] font-bold text-white shadow-xs z-10"
                      >
                        {isReached && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </motion.div>

                      {/* Event Card - Nicely proportioned, readable, and filled */}
                      <motion.div
                        animate={{
                          opacity: isReached ? 1 : 0.28,
                          x: isReached ? 0 : 12,
                          backgroundColor: isReached ? "#FFFAF3" : "#FFF8ED",
                        }}
                        transition={{ duration: 0.35 }}
                        className={`w-full p-4 sm:p-4.5 rounded-lg border-2 transition-all ${
                          isReached ? "border-[#171717] shadow-md" : "border-[#E8DFD1]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <h4 className="text-xs sm:text-sm md:text-base font-bold text-[#171717] truncate">
                              {event.title}
                            </h4>
                            <span className="text-[10px] sm:text-xs text-[#78716C] font-semibold shrink-0">
                              · {event.time}
                            </span>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-xs font-bold text-[10px] shrink-0 ${event.badgeColor}`}>
                            {event.badge}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm font-sans text-[#78716C] leading-snug mt-1.5">
                          {event.desc}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-[#E8DFD1]/70 flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-[#78716C] font-bold text-[11px] uppercase">PRICE AT STEP:</span>
                          <span className="font-extrabold text-[#171717] text-xs sm:text-sm font-mono">{event.price}</span>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SignalLedgerTimeline;

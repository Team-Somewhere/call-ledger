"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "motion/react";
import { Check, CheckCircle2, ShieldCheck } from "lucide-react";

const TIMELINE_STAGES = [
  {
    step: 1,
    time: "NOV 05 · 20:15 UTC",
    title: "SIGNAL CAPTURED & ATTESTED",
    desc: "Post captured on X and anchored on Arkiv block #28,941,029. Target entry $174.50.",
    price: "$174.50 SPOT",
    badge: "OPEN",
    badgeColor: "bg-[#F62440] text-white",
  },
  {
    step: 2,
    time: "NOV 06 · 04:30 UTC",
    title: "ENTRY TARGET TOUCHED",
    desc: "Asset entered designated execution zone. Real-time webhook notification dispatched to followers.",
    price: "$174.50 FILLED",
    badge: "ACTIVE",
    badgeColor: "bg-[#171717] text-[#FFFAF3]",
  },
  {
    step: 3,
    time: "NOV 06 · 14:00 UTC",
    title: "CONTINUATION CONFIRMED",
    desc: "4H candle closed at $179.20. Market price confirms the creator's structural momentum.",
    price: "$179.20 (+2.7%)",
    badge: "IN PROFIT",
    badgeColor: "bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40",
  },
  {
    step: 4,
    time: "NOV 07 · 09:00 UTC",
    title: "TARGET EXECUTED & RESOLVED",
    desc: "Trade completed at $188.40. Outcome ledger finalized with cryptographically proven history.",
    price: "$188.40 (+7.9%)",
    badge: "RESOLVED",
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
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-12 py-6">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center font-mono">
          {/* Left Narrative */}
          <div className="lg:col-span-5 space-y-5">
            <span className="text-xs text-[#78716C] tracking-widest uppercase block">
              // 03 · OUTCOME LEDGER
            </span>
            <h2 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
              The timeline locks.
              <br />
              <span className="text-[#16A34A]">You scroll through history.</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#78716C] font-sans leading-relaxed">
              The screen stays centered here until all 4 timeline checkpoints are
              unlocked. Watch how CallLedger tracks price movements and verifies
              whether the call delivered or hit invalidation.
            </p>
            <div className="p-3.5 border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm text-xs text-[#171717] flex items-center justify-between">
              <span>UNLOCKED: {activeCount} / 4 NODES</span>
              <span className="text-[#16A34A] font-bold">
                {activeCount === 4 ? "ALL NODES VERIFIED" : "SCROLL TO ADVANCE"}
              </span>
            </div>
          </div>

          {/* Right Centered Interactive Timeline */}
          <div className="lg:col-span-7">
            <div className="relative pl-8 sm:pl-10">
              {/* Background static track */}
              <div className="absolute left-[13px] sm:left-[17px] top-2 bottom-6 w-1 bg-[#E8DFD1] rounded-full" />

              {/* Dynamic growing line */}
              <motion.div
                style={{ height: smoothLineHeight }}
                className="absolute left-[13px] sm:left-[17px] top-2 w-1 bg-[#16A34A] rounded-full origin-top shadow-[0_0_10px_rgba(22,163,74,0.4)]"
              />

              <div className="space-y-6 sm:space-y-7">
                {TIMELINE_STAGES.map((event, idx) => {
                  const isReached = idx < activeCount;

                  return (
                    <div key={event.step} className="relative flex items-start gap-4 sm:gap-6">
                      {/* Node Bullet */}
                      <motion.div
                        animate={{
                          scale: isReached ? [1, 1.3, 1] : 0.8,
                          backgroundColor: isReached ? "#16A34A" : "#E8DFD1",
                          borderColor: isReached ? "#FFFAF3" : "#E8DFD1",
                        }}
                        transition={{ duration: 0.3 }}
                        className="absolute -left-[27px] sm:-left-[31px] top-1.5 w-6 h-6 rounded-full border-4 border-[#FFFAF3] flex items-center justify-center text-[9px] font-bold text-white shadow-xs z-10"
                      >
                        {isReached && <Check className="w-3 h-3 stroke-[3]" />}
                      </motion.div>

                      {/* Event Box */}
                      <motion.div
                        animate={{
                          opacity: isReached ? 1 : 0.25,
                          x: isReached ? 0 : 16,
                          backgroundColor: isReached ? "#FFFAF3" : "#FFF8ED",
                        }}
                        transition={{ duration: 0.4 }}
                        className={`flex-1 p-3.5 sm:p-4 rounded-sm border transition-all ${
                          isReached ? "border-[#171717] shadow-sm" : "border-[#E8DFD1]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] pb-1">
                          <span className="text-[#78716C] font-bold">{event.time}</span>
                          <span className={`px-2 py-0.5 rounded-xs font-bold text-[9px] ${event.badgeColor}`}>
                            {event.badge}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-[#171717] mt-0.5">
                          {event.title}
                        </h4>

                        <p className="text-[11px] font-sans text-[#78716C] leading-snug mt-1">
                          {event.desc}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-[#E8DFD1]/70 flex items-center justify-between text-[10px]">
                          <span className="text-[#78716C]">PRICE AT LOG:</span>
                          <span className="font-bold text-[#171717]">{event.price}</span>
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

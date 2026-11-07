"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { FileX, Clock, MessageSquareOff, ShieldAlert } from "lucide-react";

export const CardStackProblem: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Card 1: starts visible, dims and scales down as Card 2 arrives
  const card1Scale = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.94]);
  const card1Opacity = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.35]);

  // Card 2: slides up from 70px to 0px, dims as Card 3 arrives
  const card2Y = useTransform(scrollYProgress, [0.14, 0.44], [70, 0]);
  const card2Opacity = useTransform(
    scrollYProgress,
    [0.14, 0.38, 0.52, 0.8],
    [0, 1, 1, 0.35]
  );
  const card2Scale = useTransform(scrollYProgress, [0.52, 0.82], [1, 0.94]);

  // Card 3: slides up from 70px to 0px and locks on top
  const card3Y = useTransform(scrollYProgress, [0.52, 0.82], [70, 0]);
  const card3Opacity = useTransform(scrollYProgress, [0.52, 0.78], [0, 1]);

  // Left editorial column entrance
  const leftColY = useTransform(scrollYProgress, [0, 0.12], [20, 0]);
  const leftColOpacity = useTransform(scrollYProgress, [0, 0.12], [0.85, 1]);

  return (
    <section
      id="problem"
      ref={containerRef}
      className="relative h-[220vh] bg-[#FFFAF3] text-[#171717]"
    >
      {/* Sticky Viewport Container - pins in center of screen */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-12 py-6">
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-14 items-center">
          {/* Left Column: Editorial Headline */}
          <motion.div
            style={{ y: leftColY, opacity: leftColOpacity }}
            className="lg:col-span-5 space-y-4 font-sans"
          >
            <div className="inline-flex items-center gap-2 border border-[#E8DFD1] bg-[#FFF2DB] px-2.5 py-1 rounded-sm text-[10px] font-mono uppercase tracking-widest text-[#78716C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F62440] animate-pulse" />
              <span>// 01 · THE PROBLEM</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
              A public call lands.
              <br />
              <span className="text-[#F62440]">Then it disappears.</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#78716C] leading-relaxed">
              Crypto social media moves at blinding speed. High-conviction calls get
              deleted after a stop-out, cherry-picked in hindsight, or lost in
              an unmanageable torrent of noise.
            </p>
          </motion.div>

          {/* Right Column: 3 Stacking Cards with CallLedger Palette */}
          <div className="lg:col-span-7 relative h-[360px] sm:h-[420px] lg:h-[440px] w-full mx-auto font-mono">
            {/* CARD 1: THE VANISHING POST */}
            <motion.div
              style={{ scale: card1Scale, opacity: card1Opacity }}
              className="z-[10] absolute inset-0 rounded-xl border border-[#E8DFD1] bg-[#FFF2DB] p-6 sm:p-8 flex flex-col justify-between shadow-lg origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
                  <span className="text-xs text-[#78716C] tracking-wider uppercase">
                    01 // THE VANISHING CALL
                  </span>
                  <span className="text-xs text-[#F62440] font-bold flex items-center gap-1.5">
                    <FileX className="w-3.5 h-3.5" /> Deleted Posts
                  </span>
                </div>
                <div className="mt-5 font-sans text-3xl sm:text-4xl lg:text-5xl font-bold text-[#171717] tracking-tight">
                  Zero Accountability
                </div>
                <p className="mt-3 text-xs sm:text-sm text-[#78716C] font-sans leading-relaxed">
                  Traders parade winning calls while silently deleting setups that hit invalidation.
                  Followers are left holding losses with zero verifiable proof of the creator&apos;s
                  actual historical hit rate.
                </p>
              </div>

              <div className="pt-3 border-t border-[#E8DFD1] flex items-center justify-between text-xs">
                <span className="text-[#171717]">CallLedger archives posts to Arkiv storage permanently.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Permanent</span>
              </div>
            </motion.div>

            {/* CARD 2: POST-FACTO CLAIMS */}
            <motion.div
              style={{ y: card2Y, scale: card2Scale, opacity: card2Opacity }}
              className="z-[20] absolute inset-0 rounded-xl border border-[#E8DFD1] bg-[#FFE5BF] p-6 sm:p-8 flex flex-col justify-between shadow-xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD1]">
                  <span className="text-xs text-[#78716C] tracking-wider uppercase">
                    02 // ZERO TIMESTAMPS
                  </span>
                  <span className="text-xs text-[#F62440] font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Faked Entries
                  </span>
                </div>
                <div className="mt-5 font-sans text-3xl sm:text-4xl lg:text-5xl font-bold text-[#171717] tracking-tight">
                  Hindsight Alpha
                </div>
                <p className="mt-3 text-xs sm:text-sm text-[#78716C] font-sans leading-relaxed">
                  Influencers claim &quot;called this bottom in my private channel&quot; with
                  edited charts and retroactive entry timestamps after the candle has already printed.
                </p>
              </div>

              <div className="pt-3 border-t border-[#E8DFD1] flex items-center justify-between text-xs">
                <span className="text-[#171717]">Every signal is cryptographically time-stamped on-chain.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Block # Verified</span>
              </div>
            </motion.div>

            {/* CARD 3: FRAGMENTATION & NOISE */}
            <motion.div
              style={{ y: card3Y, opacity: card3Opacity }}
              className="z-[30] absolute inset-0 rounded-xl border border-[#171717] bg-[#171717] text-[#FFFAF3] p-6 sm:p-8 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs text-white/50 tracking-wider uppercase">
                    03 // SCATTERED CHANNELS
                  </span>
                  <span className="text-xs text-[#F62440] font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> 90% Noise
                  </span>
                </div>
                <div className="mt-5 font-sans text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
                  Lost In The Feed
                </div>
                <p className="mt-3 text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Real trade calls drown in memes, sponsored promotions, and chatter.
                  Key parameters like entry targets, stop boundaries, and timeframes are missed.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/80">CallLedger parses assets, directions, and stops into structured feeds.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Structured Signal</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardStackProblem;

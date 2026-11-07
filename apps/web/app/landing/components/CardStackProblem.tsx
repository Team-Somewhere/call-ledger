"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { AlertCircle, Clock, FileX } from "lucide-react";

export const CardStackProblem: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Card 1 transforms: starts fully visible; dims and subtly scales down as Card 2 arrives
  const card1Scale = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.94]);
  const card1Opacity = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.35]);

  // Card 2 transforms:
  // Starts hidden (opacity: 0, y: 70px)
  // From 0.14 to 0.44: smoothly fades in to 1 and slides up to 0px, fully covering Card 1
  // From 0.52 to 0.82: dims to 0.35 and subtly scales down to 0.94 as Card 3 arrives
  const card2Y = useTransform(scrollYProgress, [0.14, 0.44], [70, 0]);
  const card2Opacity = useTransform(
    scrollYProgress,
    [0.14, 0.38, 0.52, 0.8],
    [0, 1, 1, 0.35]
  );
  const card2Scale = useTransform(scrollYProgress, [0.52, 0.82], [1, 0.94]);

  // Card 3 transforms:
  // Starts hidden (opacity: 0, y: 70px)
  // From 0.52 to 0.82: smoothly fades in to 1 and slides up to 0px, fully covering Card 2
  const card3Y = useTransform(scrollYProgress, [0.52, 0.82], [70, 0]);
  const card3Opacity = useTransform(scrollYProgress, [0.52, 0.78], [0, 1]);

  // Subtle entrance for the left editorial column
  const leftColY = useTransform(scrollYProgress, [0, 0.12], [20, 0]);
  const leftColOpacity = useTransform(scrollYProgress, [0, 0.12], [0.85, 1]);

  return (
    <section
      id="problem"
      ref={containerRef}
      className="relative h-[220vh] bg-[#171717] text-[#FFFAF3]"
    >
      <div className="absolute inset-0 halftone-banner opacity-20 pointer-events-none" aria-hidden="true" />

      {/* Sticky Viewport Container */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 sm:px-6 lg:px-12 py-6">
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-14 items-center">
          {/* Left Column: Editorial Headline */}
          <motion.div
            style={{ y: leftColY, opacity: leftColOpacity }}
            className="lg:col-span-5 space-y-4"
          >
            <span className="font-mono text-[11px] sm:text-xs text-[#F62440] tracking-widest uppercase block">
              // 01 · THE PROBLEM
            </span>
            <h2 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              The call lands.
              <br />
              <span className="text-[#F62440]">Then it disappears.</span>
            </h2>
            <p className="text-xs sm:text-sm text-white/60 font-sans leading-relaxed">
              Crypto social feeds move at breakneck speed. Trades get buried in commentary,
              edited retroactively, or deleted entirely when the market moves against the poster.
            </p>
          </motion.div>

          {/* Right Column: 3 Stacking Cards */}
          <div className="lg:col-span-7 relative h-[360px] sm:h-[420px] lg:h-[440px] w-full mx-auto font-mono">
            {/* CARD 1: THE VANISHING POST */}
            <motion.div
              style={{ scale: card1Scale, opacity: card1Opacity }}
              className="z-[10] absolute inset-0 rounded-xl border border-white/15 bg-[#1F2430] p-6 sm:p-8 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs text-white/50 tracking-wider uppercase">
                    01 // THE VANISHING CALL
                  </span>
                  <span className="text-xs text-[#F62440] font-medium flex items-center gap-1">
                    <FileX className="w-3.5 h-3.5" /> Deleted Tweets
                  </span>
                </div>
                <div className="mt-5 font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight">
                  No Accountability
                </div>
                <p className="mt-3 text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Traders boast about winners and quietly delete losing calls when stopped out.
                  Followers have no immutable record of true historical win rates.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/80">CallLedger archives posts to Arkiv storage permanently.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Permanent</span>
              </div>
            </motion.div>

            {/* CARD 2: POST-FACTO CLAIMS */}
            <motion.div
              style={{ y: card2Y, scale: card2Scale, opacity: card2Opacity }}
              className="z-[20] absolute inset-0 rounded-xl border border-white/15 bg-[#252C3D] p-6 sm:p-8 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs text-white/50 tracking-wider uppercase">
                    02 // ZERO TIMESTAMPS
                  </span>
                  <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Faked Entries
                  </span>
                </div>
                <div className="mt-5 font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight">
                  Hindsight Alpha
                </div>
                <p className="mt-3 text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Influencers claim &quot;I called this at the bottom&quot; with edited screenshots
                  and cherry-picked chart overlays after the green candle has already printed.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/80">Every signal is cryptographically time-stamped on Base & Arkiv.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Block # Verified</span>
              </div>
            </motion.div>

            {/* CARD 3: FRAGMENTATION & NOISE */}
            <motion.div
              style={{ y: card3Y, opacity: card3Opacity }}
              className="z-[30] absolute inset-0 rounded-xl border border-white/20 bg-[#2D364D] p-6 sm:p-8 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs text-white/50 tracking-wider uppercase">
                    03 // SCATTERED CHANNELS
                  </span>
                  <span className="text-xs text-[#F62440] font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> 90% Noise
                  </span>
                </div>
                <div className="mt-5 font-sans text-4xl sm:text-5xl font-bold text-white tracking-tight">
                  Lost In The Feed
                </div>
                <p className="mt-3 text-xs sm:text-sm text-white/70 font-sans leading-relaxed">
                  Actionable trade setups drown in memes, sponsored promotions, and chatter.
                  Key invalidation levels and timeframes are missed.
                </p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/80">CallLedger parses assets, directions, and entries into structured feeds.</span>
                <span className="text-[#16A34A] font-bold shrink-0 ml-2">Structured</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardStackProblem;

"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { XLogo } from "./XLogo";
import { FileX, Clock, MessageSquareOff, ShieldAlert, ArrowRight } from "lucide-react";

export const CardStackProblem: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Card 1: starts fully visible, dims and scales down as Card 2 arrives
  const card1Scale = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.94]);
  const card1Opacity = useTransform(scrollYProgress, [0.12, 0.44], [1, 0.35]);

  // Card 2: slides up from 80px to 0px, dims as Card 3 arrives
  const card2Y = useTransform(scrollYProgress, [0.14, 0.44], [80, 0]);
  const card2Opacity = useTransform(
    scrollYProgress,
    [0.14, 0.38, 0.52, 0.8],
    [0, 1, 1, 0.35]
  );
  const card2Scale = useTransform(scrollYProgress, [0.52, 0.82], [1, 0.94]);

  // Card 3: slides up from 80px to 0px and locks on top
  const card3Y = useTransform(scrollYProgress, [0.52, 0.82], [80, 0]);
  const card3Opacity = useTransform(scrollYProgress, [0.52, 0.78], [0, 1]);

  // Left editorial column entrance
  const leftColY = useTransform(scrollYProgress, [0, 0.12], [20, 0]);
  const leftColOpacity = useTransform(scrollYProgress, [0, 0.12], [0.85, 1]);

  return (
    <section
      id="problem"
      ref={containerRef}
      className="relative h-[230vh] bg-[#FFFAF3] text-[#171717]"
    >
      {/* Sticky Viewport Container - pins in center of screen */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-4 sm:px-8 lg:px-16 py-8">
        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Left Column: Editorial Headline (Scaled Up) */}
          <motion.div
            style={{ y: leftColY, opacity: leftColOpacity }}
            className="lg:col-span-5 space-y-5 font-sans"
          >
            <div className="inline-flex items-center gap-2.5 border-2 border-[#E8DFD1] bg-[#FFF2DB] px-3.5 py-1.5 rounded-sm text-xs font-mono uppercase tracking-widest text-[#171717] font-bold">
              <XLogo className="w-4 h-4 text-[#171717]" />
              <span>THE TWITTER / X PROBLEM</span>
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#171717] leading-[1.08]">
              Traders post on X.
              <br />
              <span className="text-[#F62440]">Then delete the losses.</span>
            </h2>
            <p className="text-base sm:text-lg text-[#78716C] leading-relaxed">
              Crypto Twitter moves fast. Influencers boast when a call hits a 5x pump, but quietly delete losing calls when their stop-loss hits. Without real timestamps, followers have no way to know who is actually profitable.
            </p>
          </motion.div>

          {/* Right Column: 3 Scaled-up Stacking Cards */}
          <div className="lg:col-span-7 relative h-[420px] sm:h-[480px] lg:h-[500px] w-full mx-auto font-mono">
            {/* CARD 1: THE DELETED TWEET */}
            <motion.div
              style={{ scale: card1Scale, opacity: card1Opacity }}
              className="z-[10] absolute inset-0 rounded-2xl border-2 border-[#E8DFD1] bg-[#FFF2DB] p-7 sm:p-10 flex flex-col justify-between shadow-xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
                  <span className="text-xs sm:text-sm text-[#78716C] tracking-wider uppercase font-bold flex items-center gap-2">
                    <XLogo className="w-3.5 h-3.5 text-[#171717]" />
                    01 // THE VANISHING TWEET
                  </span>
                  <span className="text-xs sm:text-sm text-[#F62440] font-bold flex items-center gap-1.5 bg-[#F62440]/10 px-2.5 py-1 rounded-sm border border-[#F62440]/30">
                    <FileX className="w-4 h-4" /> Deleted After Stop-Loss
                  </span>
                </div>
                <div className="mt-6 font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#171717] tracking-tight">
                  Zero Accountability
                </div>
                <p className="mt-4 text-sm sm:text-base text-[#78716C] font-sans leading-relaxed">
                  An influencer calls a high-leverage trade on Solana. When the coin drops 15%, the tweet is deleted within minutes. Followers who followed the trade are stuck with losses, while the influencer pretends the trade never happened.
                </p>
              </div>

              <div className="pt-4 border-t border-[#E8DFD1] flex items-center justify-between text-xs sm:text-sm">
                <span className="text-[#171717] font-bold">CallLedger saves the tweet to on-chain storage the second it is posted.</span>
                <span className="text-[#16A34A] font-extrabold shrink-0 ml-3">Permanent Proof</span>
              </div>
            </motion.div>

            {/* CARD 2: FAKED SCREENSHOTS */}
            <motion.div
              style={{ y: card2Y, scale: card2Scale, opacity: card2Opacity }}
              className="z-[20] absolute inset-0 rounded-2xl border-2 border-[#E8DFD1] bg-[#FFE5BF] p-7 sm:p-10 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD1]">
                  <span className="text-xs sm:text-sm text-[#78716C] tracking-wider uppercase font-bold flex items-center gap-2">
                    <XLogo className="w-3.5 h-3.5 text-[#171717]" />
                    02 // FAKED TIMESTAMPS
                  </span>
                  <span className="text-xs sm:text-sm text-[#F62440] font-bold flex items-center gap-1.5 bg-[#F62440]/10 px-2.5 py-1 rounded-sm border border-[#F62440]/30">
                    <Clock className="w-4 h-4" /> Hindsight Alpha
                  </span>
                </div>
                <div className="mt-6 font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#171717] tracking-tight">
                  Anyone Can Fake It
                </div>
                <p className="mt-4 text-sm sm:text-base text-[#78716C] font-sans leading-relaxed">
                  After Bitcoin pumps $5,000, traders post cropped profit cards saying &quot;Called this bottom in my private VIP group!&quot; Without an on-chain blockchain timestamp, there is no way to verify if they actually bought before the pump.
                </p>
              </div>

              <div className="pt-4 border-t border-[#E8DFD1] flex items-center justify-between text-xs sm:text-sm">
                <span className="text-[#171717] font-bold">Every signal gets an immutable blockchain timestamp on Base.</span>
                <span className="text-[#16A34A] font-extrabold shrink-0 ml-3">Can&apos;t Be Faked</span>
              </div>
            </motion.div>

            {/* CARD 3: FEED NOISE */}
            <motion.div
              style={{ y: card3Y, opacity: card3Opacity }}
              className="z-[30] absolute inset-0 rounded-2xl border-2 border-[#171717] bg-[#171717] text-[#FFFAF3] p-7 sm:p-10 flex flex-col justify-between shadow-2xl origin-top"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <span className="text-xs sm:text-sm text-white/60 tracking-wider uppercase font-bold flex items-center gap-2">
                    <XLogo className="w-3.5 h-3.5 text-white" />
                    03 // TOO MUCH NOISE
                  </span>
                  <span className="text-xs sm:text-sm text-[#F62440] font-bold flex items-center gap-1.5 bg-[#F62440]/20 px-2.5 py-1 rounded-sm border border-[#F62440]/40">
                    <ShieldAlert className="w-4 h-4" /> 95% Feed Chatter
                  </span>
                </div>
                <div className="mt-6 font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight">
                  Missed Trade Entries
                </div>
                <p className="mt-4 text-sm sm:text-base text-white/80 font-sans leading-relaxed">
                  You follow dozens of great traders on X. But their real trade setups get buried beneath memes, replies, and paid promotions. By the time you notice the post in your timeline, the entry price has already left you behind.
                </p>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-white/90 font-bold">CallLedger automatically pulls out the clean trade: Coin, Entry, Target, Stop.</span>
                <span className="text-[#16A34A] font-extrabold shrink-0 ml-3">Clean Signal</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardStackProblem;

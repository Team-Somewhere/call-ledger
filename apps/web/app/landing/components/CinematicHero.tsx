"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { TextScramble } from "./TextScramble";
import { RotatingWords } from "./RotatingWords";
import { XLogo } from "./XLogo";
import { ArrowRight, ShieldCheck, Check } from "lucide-react";
import Link from "next/link";

export const CinematicHero: React.FC = () => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax and depth transforms on scroll down
  const contentY = useTransform(scrollYProgress, [0, 0.8], [0, 95]);
  const contentScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.94]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.15]);

  // Floating ambient badges drift outward in 3D parallax space as user scrolls
  const badge1X = useTransform(scrollYProgress, [0, 0.7], [0, -140]);
  const badge1Y = useTransform(scrollYProgress, [0, 0.7], [0, -70]);
  const badge1Opacity = useTransform(scrollYProgress, [0, 0.55], [0.95, 0]);

  const badge2X = useTransform(scrollYProgress, [0, 0.7], [0, 140]);
  const badge2Y = useTransform(scrollYProgress, [0, 0.7], [0, -70]);
  const badge2Opacity = useTransform(scrollYProgress, [0, 0.55], [0.95, 0]);

  const badge3X = useTransform(scrollYProgress, [0, 0.7], [0, -100]);
  const badge3Y = useTransform(scrollYProgress, [0, 0.7], [0, 90]);
  const badge3Opacity = useTransform(scrollYProgress, [0, 0.55], [0.95, 0]);

  const badge4X = useTransform(scrollYProgress, [0, 0.7], [0, 100]);
  const badge4Y = useTransform(scrollYProgress, [0, 0.7], [0, 90]);
  const badge4Opacity = useTransform(scrollYProgress, [0, 0.55], [0.95, 0]);

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative min-h-[96vh] sm:min-h-screen flex flex-col justify-between items-center px-4 sm:px-6 lg:px-8 pt-28 pb-10 overflow-hidden bg-transparent"
    >
      <div className="w-full h-1" />

      {/* Center Kinetic Headline & Narrative Container */}
      <motion.div
        style={{ y: contentY, scale: contentScale, opacity: contentOpacity }}
        className="w-full max-w-5xl mx-auto text-center flex flex-col items-center relative z-10"
      >
        {/* Floating Badges showing Twitter touchpoints */}
        <motion.div
          style={{ x: badge1X, y: badge1Y, opacity: badge1Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.95, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="hidden lg:flex absolute -top-6 left-2 xl:left-4 items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E8DFD1] bg-[#FFF2DB] backdrop-blur-md text-xs font-mono text-[#171717] shadow-xs pointer-events-none"
        >
          <XLogo className="w-3.5 h-3.5 text-[#171717]" />
          <span>Tracking @DoctorProfit & @CryptoTony</span>
        </motion.div>

        <motion.div
          style={{ x: badge2X, y: badge2Y, opacity: badge2Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.95, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="hidden lg:flex absolute -top-6 right-2 xl:right-4 items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E8DFD1] bg-[#FFF2DB] backdrop-blur-md text-xs font-mono text-[#171717] shadow-xs pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
          <span>Saved on Blockchain</span>
        </motion.div>

        <motion.div
          style={{ x: badge3X, y: badge3Y, opacity: badge3Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.95, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="hidden lg:flex absolute -bottom-4 left-4 xl:left-8 items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E8DFD1] bg-[#FFF2DB] backdrop-blur-md text-xs font-mono text-[#171717] shadow-xs pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#F62440]" />
          <span>No Deleted Tweets</span>
        </motion.div>

        <motion.div
          style={{ x: badge4X, y: badge4Y, opacity: badge4Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.95, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="hidden lg:flex absolute -bottom-4 right-4 xl:right-8 items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E8DFD1] bg-[#FFF2DB] backdrop-blur-md text-xs font-mono text-[#171717] shadow-xs pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
          <span>Copy Trades with 0.05 USDC</span>
        </motion.div>

        {/* Top Pill with Twitter/X focus */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-[#E8DFD1] bg-[#FFF2DB] text-[#171717] font-mono text-xs tracking-wider uppercase shadow-xs"
        >
          <XLogo className="w-3.5 h-3.5 text-[#171717]" />
          <span className="font-bold">REAL TRADING CALLS FROM TWITTER / X</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping ml-1" />
        </motion.div>

        {/* Scaled-down Balanced Headline with Rotating Words */}
        <div className="w-full origin-center">
          <h1 className="font-sans text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-[#171717] leading-[1.08]">
            Every trade call on X, <br />
            <RotatingWords
              words={[
                "tracked with real proof.",
                "saved before it's deleted.",
                "verified on the blockchain.",
                "copied directly in 1 click.",
                "checked against real prices.",
              ]}
              intervalMs={3000}
              className="text-[#F62440] drop-shadow-[0_0_30px_rgba(246,36,64,0.15)]"
            />
          </h1>
        </div>

        {/* Simple English Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 text-sm sm:text-base lg:text-lg text-[#78716C] max-w-3xl mx-auto font-sans leading-relaxed"
        >
          Crypto influencers post trading calls on X every day. When they win, they brag. When they lose, tweets get quietly deleted. CallLedger automatically catches their calls, verifies the real outcome, and lets you follow the ones who actually make profit.
        </motion.p>

        {/* Interactive Scaled CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 flex items-center justify-center gap-4 flex-wrap"
        >
          <Link
            href="/"
            className="group px-7 py-3.5 rounded-sm font-mono text-xs sm:text-sm tracking-wider uppercase bg-[#171717] text-[#FFFAF3] font-bold hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717] border-2 border-[#171717] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2.5 shadow-md"
          >
            <span>Open CallLedger</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#problem"
            className="px-6 py-3.5 rounded-sm font-mono text-xs sm:text-sm tracking-wider uppercase text-[#171717] hover:text-[#171717] border-2 border-[#E8DFD1] hover:border-[#171717] bg-[#FFFAF3] transition-all inline-flex items-center gap-2 font-bold"
          >
            <span>See How It Works</span>
            <span>↓</span>
          </a>
        </motion.div>
      </motion.div>

      {/* Clean Bottom Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        className="flex flex-col items-center gap-2 cursor-pointer opacity-80 hover:opacity-100 transition-opacity z-10 pt-4"
        onClick={() => {
          document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <span className="font-mono text-[11px] tracking-widest text-[#78716C] uppercase flex items-center gap-1.5 hover:text-[#171717] transition font-bold">
          <span>Scroll to see the story</span>
          <span>↓</span>
        </span>
        <div className="w-[1.5px] h-8 bg-gradient-to-b from-[#171717]/60 via-[#171717]/20 to-transparent relative overflow-hidden">
          <motion.div
            animate={{ y: [-15, 32] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="w-full h-3 bg-[#171717]"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default CinematicHero;

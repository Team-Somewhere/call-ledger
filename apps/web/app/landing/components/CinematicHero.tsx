"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { TextScramble } from "./TextScramble";
import { RotatingWords } from "./RotatingWords";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

interface CinematicHeroProps {
  onEnterApp?: () => void;
}

export const CinematicHero: React.FC<CinematicHeroProps> = () => {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Parallax and depth transforms on scroll down
  const contentY = useTransform(scrollYProgress, [0, 0.8], [0, 85]);
  const contentScale = useTransform(scrollYProgress, [0, 0.8], [1, 0.94]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.15]);

  // Floating ambient badges drift outward in 3D parallax space as user scrolls towards Problem
  const badge1X = useTransform(scrollYProgress, [0, 0.7], [0, -120]);
  const badge1Y = useTransform(scrollYProgress, [0, 0.7], [0, -60]);
  const badge1Opacity = useTransform(scrollYProgress, [0, 0.55], [0.9, 0]);

  const badge2X = useTransform(scrollYProgress, [0, 0.7], [0, 120]);
  const badge2Y = useTransform(scrollYProgress, [0, 0.7], [0, -60]);
  const badge2Opacity = useTransform(scrollYProgress, [0, 0.55], [0.9, 0]);

  const badge3X = useTransform(scrollYProgress, [0, 0.7], [0, -90]);
  const badge3Y = useTransform(scrollYProgress, [0, 0.7], [0, 80]);
  const badge3Opacity = useTransform(scrollYProgress, [0, 0.55], [0.9, 0]);

  const badge4X = useTransform(scrollYProgress, [0, 0.7], [0, 90]);
  const badge4Y = useTransform(scrollYProgress, [0, 0.7], [0, 80]);
  const badge4Opacity = useTransform(scrollYProgress, [0, 0.55], [0.9, 0]);

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative min-h-screen flex flex-col justify-between items-center px-4 sm:px-6 lg:px-8 pt-28 pb-12 overflow-hidden bg-transparent"
    >
      <div className="w-full h-4" />

      {/* Center Kinetic Headline & Narrative Container with Scroll-Linked Parallax */}
      <motion.div
        style={{ y: contentY, scale: contentScale, opacity: contentOpacity }}
        className="w-full max-w-5xl mx-auto text-center flex flex-col items-center relative z-10"
      >
        {/* Ambient Web3 Badges with scroll-driven outward parallax drift */}
        <motion.div
          style={{ x: badge1X, y: badge1Y, opacity: badge1Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="hidden md:flex absolute -top-8 left-4 lg:left-10 items-center gap-2 px-3 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 backdrop-blur-md text-[11px] font-mono text-[#78716C] shadow-sm pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
          <span>Arkiv Attested Signals</span>
        </motion.div>

        <motion.div
          style={{ x: badge2X, y: badge2Y, opacity: badge2Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="hidden md:flex absolute -top-6 right-4 lg:right-10 items-center gap-2 px-3 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 backdrop-blur-md text-[11px] font-mono text-[#78716C] shadow-sm pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#171717]" />
          <span>Non-Custodial Flash Orders</span>
        </motion.div>

        <motion.div
          style={{ x: badge3X, y: badge3Y, opacity: badge3Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="hidden md:flex absolute -bottom-6 left-8 lg:left-16 items-center gap-2 px-3 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 backdrop-blur-md text-[11px] font-mono text-[#78716C] shadow-sm pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#F62440]" />
          <span>Zero Retrospective Edits</span>
        </motion.div>

        <motion.div
          style={{ x: badge4X, y: badge4Y, opacity: badge4Opacity }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="hidden md:flex absolute -bottom-8 right-8 lg:right-16 items-center gap-2 px-3 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 backdrop-blur-md text-[11px] font-mono text-[#78716C] shadow-sm pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span>Live On Base & Ethereum</span>
        </motion.div>

        {/* Top Pill with Cryptographic Scramble Effect on Load */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/90 backdrop-blur-md text-[#171717] font-mono text-[11px] tracking-wider uppercase shadow-xs"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" />
          <TextScramble
            text="VERIFIABLE SOCIAL TRADING PROTOCOL"
            duration={1100}
            delay={100}
          />
        </motion.div>

        {/* Headline with Rotating Words */}
        <div className="w-full origin-center">
          <h1 className="font-sans text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-[#171717] leading-[1.06]">
            Every trade call, <br />
            <RotatingWords
              words={[
                "structured on-chain.",
                "anchored to Arkiv.",
                "tracked with real proof.",
                "executed via Flash.",
                "auditable forever.",
              ]}
              intervalMs={2800}
              className="text-[#F62440] drop-shadow-[0_0_35px_rgba(246,36,64,0.2)]"
            />
          </h1>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 text-base sm:text-lg text-[#78716C] max-w-3xl mx-auto font-sans leading-relaxed min-h-[56px]"
        >
          <TextScramble
            text="Public trade calls move fast and vanish into noisy feeds. CallLedger captures creator posts, extracts structured entry signals, and verifies real outcomes on-chain."
            duration={1300}
            delay={350}
          />
        </motion.p>

        {/* Interactive CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-4 flex-wrap"
        >
          <Link
            href="/"
            className="group px-7 py-3.5 rounded-sm font-mono text-xs tracking-wider uppercase bg-[#171717] text-[#FFFAF3] font-bold hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717] border border-[#171717] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2 shadow-sm"
          >
            <TextScramble text="Open CallLedger" duration={900} delay={500} />
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#problem"
            className="px-7 py-3.5 rounded-sm font-mono text-xs tracking-wider uppercase text-[#78716C] hover:text-[#171717] border border-[#E8DFD1] hover:border-[#171717] bg-[#FFFAF3] transition-all inline-flex items-center gap-1.5"
          >
            <TextScramble text="Explore The Flow" duration={900} delay={650} />
            <span>↓</span>
          </a>
        </motion.div>
      </motion.div>

      {/* Single Clean Bottom Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        className="flex flex-col items-center gap-2.5 cursor-pointer opacity-75 hover:opacity-100 transition-opacity z-10 pt-4"
        onClick={() => {
          document.getElementById("problem")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <span className="font-mono text-[10px] tracking-widest text-[#78716C] uppercase flex items-center gap-1 hover:text-[#171717] transition">
          <span>Scroll to explore</span>
          <span>↓</span>
        </span>
        <div className="w-[1px] h-9 bg-gradient-to-b from-[#171717]/50 via-[#171717]/20 to-transparent relative overflow-hidden">
          <motion.div
            animate={{ y: [-15, 36] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="w-full h-4 bg-[#171717]"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default CinematicHero;

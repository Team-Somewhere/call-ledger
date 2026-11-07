"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, ExternalLink, Activity, Sparkles, Check } from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  AnimatePresence,
} from "motion/react";

// ─── Scramble / Cipher Text Effect ──────────────────────────────────────────

function ScrambleText({
  text,
  trigger = true,
  className = "",
}: {
  text: string;
  trigger?: boolean;
  className?: string;
}) {
  const [displayText, setDisplayText] = useState(text);
  const chars = "!<>-_/[]{}—=+*^?#@$%0123456789";

  useEffect(() => {
    if (!trigger) return;
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " " || char === "\n") return char;
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)] ?? char;
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
      }
      iteration += 1 / 2;
    }, 28);

    return () => clearInterval(interval);
  }, [text, trigger]);

  return <span className={className}>{displayText}</span>;
}

// ─── Interactive Primary CTA Button ─────────────────────────────────────────

function CtaButton({
  variant = "dark",
  label = "Open CallLedger",
}: {
  variant?: "dark" | "cream";
  label?: string;
}) {
  const isDark = variant === "dark";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="inline-block"
    >
      <Link
        href="/"
        className={`group relative inline-flex items-center gap-2.5 px-6 py-3.5 rounded-sm text-xs font-mono font-bold tracking-wider overflow-hidden transition-all duration-300 border ${
          isDark
            ? "bg-[#171717] text-[#FFFAF3] border-[#171717] hover:bg-[#FFF2DB] hover:text-[#171717] hover:border-[#171717] shadow-sm"
            : "bg-[#FFF2DB] text-[#171717] border-[#E8DFD1] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-white/30 shadow-md"
        }`}
        aria-label="Open CallLedger application"
      >
        <span className="relative z-10 flex items-center gap-2">
          {label}
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </Link>
    </motion.div>
  );
}

// ─── Section Header Stamp ───────────────────────────────────────────────────

function SectionStamp({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 select-none" aria-hidden="true">
      <span className="w-2 h-2 rounded-full bg-[#F62440] animate-pulse shrink-0" />
      <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#78716C]">
        [{code}] {label}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. HERO — "The call"
// ═══════════════════════════════════════════════════════════════════════════════

const HERO_STREAM_POSTS = [
  {
    handle: "@ThorneMacro",
    avatar: "AT",
    text: "$SOL breakout confirmed — entered at $174. 4H close above $178 needed.",
    time: "just now",
    tag: "HIGH CONVICTION",
    tagColor: "text-[#16A34A] border-[#16A34A]/30 bg-[#16A34A]/10",
  },
  {
    handle: "@NovaCapDesk",
    avatar: "NC",
    text: "Risk-off rotation across L1s. Keeping $BTC exposure tight below $90k.",
    time: "2m",
    tag: "MARKET COMMENTARY",
    tagColor: "text-[#78716C] border-[#E8DFD1] bg-[#FFF2DB]",
  },
  {
    handle: "@ElenaDeFi",
    avatar: "EV",
    text: "ETH funding rates normalized. Quietly building spot accumulation here.",
    time: "4m",
    tag: "ALPHA CALL",
    tagColor: "text-[#F62440] border-[#F62440]/30 bg-[#F62440]/10",
  },
  {
    handle: "@SatoshiPulseX",
    avatar: "SP",
    text: "BTC dominance peak incoming. Altcoin rotation setup clean on the 1D chart.",
    time: "7m",
    tag: "TRADE SETUP",
    tagColor: "text-[#16A34A] border-[#16A34A]/30 bg-[#16A34A]/10",
  },
];

function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);
  const heroY = useTransform(scrollYProgress, [0, 0.7], [0, -40]);
  const feedY = useTransform(scrollYProgress, [0, 0.7], [0, 30]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden pt-20 pb-16"
      aria-labelledby="hero-heading"
    >
      <div className="absolute inset-0 ledger-dot-grid opacity-35" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFAF3] via-transparent to-[#FFFAF3]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        {/* Left Column: Headline & Value Prop */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="lg:col-span-7 space-y-7"
        >
          <div className="inline-flex items-center gap-2 border border-[#E8DFD1] bg-[#FFF2DB]/80 px-2.5 py-1 rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#171717]">
              PUBLIC TRADE CALLS · VERIFIABLE SIGNALS
            </span>
          </div>

          <div className="space-y-3">
            <h1
              id="hero-heading"
              className="text-5xl sm:text-6xl xl:text-7xl font-bold tracking-tight text-[#171717] leading-[1.04]"
            >
              Every call.
              <br />
              <span className="text-[#F62440] underline decoration-[#F62440]/30 underline-offset-8">
                On record.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#78716C] font-sans leading-relaxed max-w-xl pt-2">
              Traders post high-conviction calls in fast-moving streams. CallLedger
              captures the post, parses the signal, tracks the outcome on-chain,
              and connects directly to non-custodial execution through Definitive Flash.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <CtaButton variant="dark" label="Open CallLedger" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] text-[10px] font-mono text-[#78716C]">
              <Activity className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>ARKIV ATTESTED · BASE & ETH READY</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Live Feed Artifact that reveals smoothly as user scrolls */}
        <motion.div
          style={{ y: feedY }}
          className="lg:col-span-5"
          aria-label="Sample live feed stream"
        >
          <div className="border border-[#171717] rounded-sm bg-[#FFFAF3] shadow-lg overflow-hidden">
            <div className="bg-[#171717] px-4 py-2.5 flex items-center justify-between text-[10px] font-mono text-white/80">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                // LIVE STREAM FEED
              </span>
              <span className="text-[#FFE5BF] text-[9px] uppercase tracking-wider">
                POLLING 16s
              </span>
            </div>

            <div className="p-3.5 space-y-2.5 divide-y divide-[#E8DFD1]/70">
              {HERO_STREAM_POSTS.map((post, index) => (
                <motion.article
                  key={post.handle}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.15 + index * 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`pt-2.5 first:pt-0 font-mono text-xs transition-colors p-2 rounded-xs ${
                    index === 0
                      ? "bg-[#FFF2DB]/90 border border-[#F62440]/30 shadow-xs"
                      : "hover:bg-[#FFF2DB]/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#171717] text-[#FFFAF3] flex items-center justify-center text-[8px] font-bold">
                        {post.avatar}
                      </div>
                      <span className="font-bold text-[#171717] text-[11px]">
                        {post.handle}
                      </span>
                      <span className={`text-[8px] px-1 py-px rounded-xs border font-mono ${post.tagColor}`}>
                        {post.tag}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#78716C]">{post.time}</span>
                  </div>
                  <p className="text-[11px] font-sans text-[#292524] leading-snug">
                    {post.text}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none" aria-hidden="true">
        <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-[#78716C]">
          SCROLL TO UNPACK
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-6 bg-gradient-to-b from-[#171717] to-transparent"
        />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. THE PROBLEM — "A call disappears into the feed" (Dynamic Floating Motion)
// ═══════════════════════════════════════════════════════════════════════════════

const CHAOTIC_FRAGMENTS = [
  { id: 1, text: "just bought more $SOL don't fade", xInit: -140, yInit: -60, xDrift: -40, yDrift: -80, rot: -8 },
  { id: 2, text: "$BTC 100k programmed soon?", xInit: 160, yInit: -90, xDrift: 70, yDrift: -120, rot: 12 },
  { id: 3, text: "macro looks weak until FOMC", xInit: -120, yInit: 70, xDrift: -80, yDrift: 110, rot: -6 },
  { id: 4, text: "L2 fees dropping 95% today", xInit: 130, yInit: 60, xDrift: 90, yDrift: 100, rot: 7 },
  { id: 5, text: "gm to everyone holding spot", xInit: -180, yInit: 10, xDrift: -110, yDrift: 20, rot: 4 },
  { id: 6, text: "funding rates through the roof", xInit: 190, yInit: -10, xDrift: 130, yDrift: -20, rot: -9 },
];

function ProblemSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Dramatic scroll-driven dispersion & blur as user scrolls through the problem!
  const fragmentsSpread = useTransform(scrollYProgress, [0.15, 0.7], [0, 1]);
  const callHighlightScale = useTransform(scrollYProgress, [0.3, 0.6], [0.94, 1.05]);
  const darkBgIntensity = useTransform(scrollYProgress, [0.2, 0.6], ["#171717", "#0d0d0d"]);

  return (
    <motion.section
      ref={containerRef}
      style={{ backgroundColor: darkBgIntensity }}
      className="relative min-h-[120vh] py-32 flex flex-col justify-center overflow-hidden text-[#FFFAF3]"
      aria-labelledby="problem-heading"
    >
      <div className="absolute inset-0 halftone-banner opacity-20 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full">
        <div className="max-w-2xl mx-auto text-center space-y-4 mb-16">
          <SectionStamp code="01 // NOISE" label="THE PROBLEM" />
          <h2
            id="problem-heading"
            className="text-4xl sm:text-5xl font-bold tracking-tight text-[#FFFAF3] leading-tight"
          >
            The call lands.
            <br />
            <span className="text-[#F62440]">Then it disappears in the feed.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/60 font-sans leading-relaxed">
            Real trades get posted alongside memes, commentary, and replies. Within
            minutes, key targets like entry, invalidation, and timeframe are washed away.
          </p>
        </div>

        {/* Dynamic Interactive Stage: Chaotic Feed Fragments drifting apart */}
        <div className="relative h-[380px] sm:h-[420px] max-w-3xl mx-auto flex items-center justify-center">
          {/* Drifting noisy post chips */}
          {CHAOTIC_FRAGMENTS.map((item) => {
            return (
              <motion.div
                key={item.id}
                style={{
                  x: useTransform(fragmentsSpread, [0, 1], [item.xInit * 0.6, item.xInit + item.xDrift]),
                  y: useTransform(fragmentsSpread, [0, 1], [item.yInit * 0.6, item.yInit + item.yDrift]),
                  rotate: item.rot,
                  opacity: useTransform(fragmentsSpread, [0, 0.4, 0.85], [0.35, 0.65, 0.15]),
                  scale: useTransform(fragmentsSpread, [0, 1], [1, 0.88]),
                }}
                className="absolute z-10 px-3 py-2 rounded-sm border border-white/15 bg-white/5 backdrop-blur-xs font-mono text-[11px] text-white/60 max-w-[200px] pointer-events-none select-none"
              >
                {item.text}
              </motion.div>
            );
          })}

          {/* The true signal card that cuts through the noise */}
          <motion.div
            style={{ scale: callHighlightScale }}
            className="relative z-20 w-full max-w-md bg-[#1f1f1f] border-2 border-[#F62440] rounded-sm p-5 shadow-[0_0_50px_rgba(246,36,64,0.25)] font-mono"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F62440] animate-ping" />
                <span className="font-bold text-[#FFFAF3]">@ThorneMacro</span>
                <span className="text-[10px] text-white/40">on X · 4h ago</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded-xs bg-[#F62440]/20 text-[#F62440] border border-[#F62440]/40 font-bold">
                SIGNAL LOCATED
              </span>
            </div>

            <p className="text-sm font-sans text-white/90 leading-relaxed mt-3.5">
              &quot;$SOL expansion underway. Entered at <strong className="font-mono text-white underline decoration-[#F62440]">$174.50</strong>. 4H close above $178 confirms continuation. SL set tight at $162.&quot;
            </p>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
              <span>HOW DO YOU PROVE THIS WAS POSTED BEFORE THE PUMP?</span>
              <span className="text-[#FFE5BF] font-bold">→ WITH CALL LEDGER</span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. STRUCTURE — "From post to signal" (STICKY SCROLL-JACKED PROGRESSION)
// ═══════════════════════════════════════════════════════════════════════════════

const STRUCTURE_STAGES = [
  {
    step: 1,
    label: "SOURCE IDENTITY",
    detail: "Creator handle, profile verification, and origin URL verified.",
    value: "@ThorneMacro (Alex Thorne) · Source: X",
    tag: "VERIFIED ORIGIN",
  },
  {
    step: 2,
    label: "ASSET & DIRECTION",
    detail: "Extracted contract symbol and directional sentiment.",
    value: "SOL / USDC · ▲ BUY / LONG",
    tag: "HIGH CONVICTION",
  },
  {
    step: 3,
    label: "TRADE PARAMETERS",
    detail: "Explicit entry targets, invalidation stop, and timeframe parsed.",
    value: "Entry: $174.50 · Target: $215.00 · SL: $162.00 (4H)",
    tag: "R:R 1:3.2",
  },
  {
    step: 4,
    label: "TIMESTAMP ANCHOR",
    detail: "Canonical creation block time cryptographically logged.",
    value: "2026-11-05T20:15:00Z · Block #28,941,029",
    tag: "IMMUTABLE TIME",
  },
  {
    step: 5,
    label: "ARKIV ATTESTATION",
    detail: "On-chain proof receipt published to Arkiv storage.",
    value: "Receipt: ark-sig-99201-sol (0x892a...c1)",
    tag: "ANCHORED PROOF",
  },
];

function StructureSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Map the scroll progress into active step index (0 to 4)
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      // 5 steps across 0.1 to 0.9 range
      if (latest < 0.2) setActiveStep(0);
      else if (latest < 0.38) setActiveStep(1);
      else if (latest < 0.56) setActiveStep(2);
      else if (latest < 0.74) setActiveStep(3);
      else setActiveStep(4);
    });
  }, [scrollYProgress]);

  return (
    // Tall container (280vh) so user scrolls through while inner content stays pinned!
    <div ref={containerRef} className="relative h-[280vh] bg-[#FFFAF3]">
      {/* Sticky viewport frame pinned in center */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Narrative & Progress Gauge */}
          <div className="lg:col-span-5 space-y-6">
            <SectionStamp code="02 // STRUCTURING" label="FROM POST TO SIGNAL" />

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
                Scroll to structure
                <br />
                the signal.
              </h2>
              <p className="text-sm text-[#78716C] font-sans leading-relaxed">
                As you scroll, CallLedger pulls raw prose through the structuring
                pipeline. Every layer is extracted, verified, and anchored before
                becoming an actionable signal.
              </p>
            </div>

            {/* Scroll Progress Meter */}
            <div className="p-4 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/80 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#171717]">
                <span>STAGE {activeStep + 1} OF 5</span>
                <span>{Math.round(((activeStep + 1) / 5) * 100)}% COMPLETE</span>
              </div>
              <div className="w-full h-1.5 bg-[#E8DFD1] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#F62440]"
                  animate={{ width: `${((activeStep + 1) / 5) * 100}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <p className="text-[10px] text-[#78716C] italic pt-1">
                Keep scrolling down to reveal all parameters...
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Step-by-Step Card Builder */}
          <div className="lg:col-span-7">
            <div className="border-2 border-[#171717] rounded-sm bg-[#FFFAF3] shadow-xl overflow-hidden font-mono">
              <div className="bg-[#171717] px-5 py-3 flex items-center justify-between text-xs text-[#FFFAF3]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F62440]" />
                  <span className="font-bold tracking-wider">// STRUCTURED SIGNAL SPEC</span>
                </div>
                <span className="text-[10px] text-[#FFE5BF] border border-[#FFE5BF]/30 px-2 py-0.5 rounded-xs">
                  STAGE {activeStep + 1} ACTIVE
                </span>
              </div>

              <div className="divide-y divide-[#E8DFD1] p-2 sm:p-4 space-y-2">
                {STRUCTURE_STAGES.map((stage, idx) => {
                  const isRevealed = idx <= activeStep;
                  const isCurrent = idx === activeStep;

                  return (
                    <motion.div
                      key={stage.step}
                      initial={false}
                      animate={{
                        opacity: isRevealed ? 1 : 0.2,
                        x: isRevealed ? 0 : 15,
                        backgroundColor: isCurrent ? "#FFF2DB" : "#FFFAF3",
                      }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={`p-3.5 rounded-sm transition-all border ${
                        isCurrent
                          ? "border-[#171717] shadow-sm"
                          : isRevealed
                            ? "border-transparent"
                            : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] pb-1">
                        <span className="text-[#78716C] uppercase font-bold tracking-wider">
                          0{stage.step} — {stage.label}
                        </span>
                        {isRevealed && (
                          <span className="text-[9px] px-1.5 py-px rounded-xs bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30 font-bold flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> {stage.tag}
                          </span>
                        )}
                      </div>

                      <div className="text-xs sm:text-sm font-bold text-[#171717] pt-0.5">
                        {isRevealed ? (
                          stage.value
                        ) : (
                          <span className="text-[#78716C]/40">Awaiting scroll advance...</span>
                        )}
                      </div>

                      {isRevealed && (
                        <p className="text-[11px] font-sans text-[#78716C] pt-1">
                          {stage.detail}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. FOLLOW — "See what happened next" (STICKY TIMELINE LOCK)
// ═══════════════════════════════════════════════════════════════════════════════

const TIMELINE_STAGES = [
  {
    step: 1,
    time: "NOV 05 · 20:15 UTC",
    title: "SIGNAL CAPTURED & ANCHORED",
    desc: "Post captured on X and anchored on Arkiv at block #28,941,029. Target entry $174.50.",
    price: "$174.50 SPOT",
    badge: "OPEN",
    badgeColor: "bg-[#F62440] text-white",
  },
  {
    step: 2,
    time: "NOV 06 · 04:30 UTC",
    title: "ENTRY TARGET FILLED",
    desc: "Asset touched designated entry zone. Real-time webhook notification dispatched to followers.",
    price: "$174.50 REACHED",
    badge: "ACTIVE",
    badgeColor: "bg-[#171717] text-[#FFFAF3]",
  },
  {
    step: 3,
    time: "NOV 06 · 14:00 UTC",
    title: "CONTINUATION CONFIRMED",
    desc: "4H candle closed at $179.20. Market confirms the creator's structural thesis.",
    price: "$179.20 (+2.7%)",
    badge: "IN PROFIT",
    badgeColor: "bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/40",
  },
  {
    step: 4,
    time: "NOV 07 · 09:00 UTC",
    title: "TAKE PROFIT TARGET EXECUTED",
    desc: "Trade completed at $188.40. Outcome ledger finalized with cryptographically proven history.",
    price: "$188.40 (+7.9%)",
    badge: "RESOLVED",
    badgeColor: "bg-[#16A34A] text-white",
  },
];

function FollowSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Calculate line height percentage smoothly
  const lineHeight = useTransform(scrollYProgress, [0.08, 0.88], ["0%", "100%"]);
  const smoothLineHeight = useSpring(lineHeight, { stiffness: 120, damping: 25 });

  const [activeCount, setActiveCount] = useState(1);

  useEffect(() => {
    return scrollYProgress.on("change", (latest) => {
      if (latest < 0.22) setActiveCount(1);
      else if (latest < 0.45) setActiveCount(2);
      else if (latest < 0.68) setActiveCount(3);
      else setActiveCount(4);
    });
  }, [scrollYProgress]);

  return (
    // Tall container (280vh) so the page pauses scroll and stays centered!
    <div ref={containerRef} className="relative h-[280vh] bg-[#FFF2DB]/50">
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden px-6 md:px-12 lg:px-16">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Narrative */}
          <div className="lg:col-span-5 space-y-6">
            <SectionStamp code="03 // OUTCOME LEDGER" label="TIMELINE TRACKING" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
              The timeline locks.
              <br />
              <span className="text-[#16A34A]">You scroll through history.</span>
            </h2>
            <p className="text-sm text-[#78716C] font-sans leading-relaxed">
              The page stays centered here until all 4 timeline checkpoints are
              unlocked. Watch how CallLedger tracks price movements and verifies
              whether the call actually delivered or failed.
            </p>
            <div className="p-3.5 border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm font-mono text-xs text-[#171717] flex items-center justify-between">
              <span>UNLOCKED NODES: {activeCount} / 4</span>
              <span className="text-[#16A34A] font-bold">
                {activeCount === 4 ? "ALL NODES VERIFIED" : "SCROLL DOWN TO PROGRESS"}
              </span>
            </div>
          </div>

          {/* Right Centered Interactive Timeline */}
          <div className="lg:col-span-7">
            <div className="relative pl-8 sm:pl-10 font-mono">
              {/* Background static track */}
              <div className="absolute left-[13px] sm:left-[17px] top-2 bottom-6 w-1 bg-[#E8DFD1] rounded-full" />

              {/* Dynamic growing line */}
              <motion.div
                style={{ height: smoothLineHeight }}
                className="absolute left-[13px] sm:left-[17px] top-2 w-1 bg-[#16A34A] rounded-full origin-top shadow-[0_0_10px_rgba(22,163,74,0.4)]"
              />

              <div className="space-y-6 sm:space-y-8">
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// E. DECIDE — "Your call, your execution" (Scramble Text & Interactive Tilt)
// ═══════════════════════════════════════════════════════════════════════════════

function DecideSection() {
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
      className="relative py-28 md:py-36 bg-[#FFFAF3] overflow-hidden"
      aria-labelledby="decide-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Cipher text & Actions */}
        <div className="lg:col-span-6 space-y-6">
          <SectionStamp code="04 // USER SOVEREIGNTY" label="YOUR CALL" />

          <div className="space-y-3">
            <h2 id="decide-heading" className="text-4xl sm:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
              <ScrambleText
                text="You decide what to do next."
                trigger={inView}
              />
            </h2>
            <p className="text-sm sm:text-base text-[#78716C] font-sans leading-relaxed">
              Tracking a signal does not force a trade. CallLedger gives you
              complete source transparency. If you choose to act, an optional
              non-custodial route lets you review and sign orders via Definitive Flash.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap gap-4 items-center">
            {/* Open CallLedger with interactive color inversion */}
            <CtaButton variant="dark" label="Open CallLedger" />

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/trade"
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-sm text-xs font-mono font-bold tracking-wider border border-[#E8DFD1] bg-[#FFF2DB] text-[#171717] hover:bg-[#171717] hover:text-[#FFFAF3] hover:border-[#171717] transition-all duration-300"
              >
                <span>Inspect Trade Review Flow</span>
                <ExternalLink className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Right Column: 3D interactive floating card */}
        <div className="lg:col-span-6 flex justify-center">
          <motion.div
            whileHover={{ y: -8, rotateX: 3, rotateY: -3, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-full max-w-md border-2 border-[#171717] bg-[#FFFAF3] rounded-sm shadow-xl p-6 font-mono space-y-5"
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
}

// ═══════════════════════════════════════════════════════════════════════════════
// F. CLOSING & FOOTER — Phrase Rotator & Blinking CallLedger
// ═══════════════════════════════════════════════════════════════════════════════

const ROTATING_PHRASES = [
  "Now so is the record.",
  "Every signal verified on-chain.",
  "From chaotic feed to clean execution.",
  "Auditable history. Zero guesswork.",
];

function ClosingSection() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="bg-[#171717] text-[#FFFAF3] overflow-hidden" aria-labelledby="closing-heading">
      <div className="relative py-28 md:py-36 px-6 md:px-12 lg:px-16 text-center max-w-4xl mx-auto space-y-8">
        <div className="absolute inset-0 ledger-dot-grid opacity-10 pointer-events-none" aria-hidden="true" />

        {/* Blinking CallLedger Brand Badge */}
        <div className="inline-flex items-center gap-2 border border-white/20 bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-xs">
          <span className="w-2 h-2 rounded-full bg-[#F62440] animate-ping" />
          <span className="text-[11px] font-mono font-bold tracking-widest text-[#FFFAF3] uppercase">
            CALL LEDGER PROTOCOL
          </span>
        </div>

        {/* Dynamic Rotating Headline */}
        <div className="space-y-3">
          <h2 id="closing-heading" className="text-4xl sm:text-6xl font-bold tracking-tight text-[#FFFAF3]">
            The call is public.
            <br />
            <span className="inline-block min-h-[1.3em] text-[#F62440]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.45 }}
                  className="inline-block"
                >
                  {ROTATING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </h2>

          <p className="text-sm sm:text-base text-white/60 font-sans max-w-xl mx-auto pt-2">
            Never wonder whether a crypto influencer deleted a losing trade or claimed
            a pump after the fact. Build your sovereign trading record today.
          </p>
        </div>

        {/* Primary CTA (starts cream, flips to dark on hover) */}
        <div className="pt-4">
          <CtaButton variant="cream" label="Open CallLedger" />
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <nav className="border-t border-white/10 px-6 md:px-12 lg:px-16 py-8" aria-label="Footer navigation">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-white/50">
          <div className="flex items-center gap-2">
            <span className="bg-[#F62440] text-white px-1.5 py-0.5 rounded-xs font-bold text-[10px]">
              CALL
            </span>
            <span className="font-bold text-white tracking-wider">LEDGER</span>
            <span className="text-white/30 ml-2">© {new Date().getFullYear()}</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/" className="hover:text-white transition">Terminal</Link>
            <Link href="/discover" className="hover:text-white transition">Discover</Link>
            <Link href="/following" className="hover:text-white transition">Following</Link>
            <Link href="/trade" className="hover:text-white transition">Trade</Link>
            <Link href="/strategies" className="hover:text-white transition">Allocations</Link>
            <Link href="/portfolio" className="hover:text-white transition">Portfolio</Link>
          </div>
        </div>
      </nav>
    </footer>
  );
}

// ─── Sticky Minimal Topbar ──────────────────────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#FFFAF3]/95 backdrop-blur-md border-b border-[#E8DFD1] shadow-xs" : "bg-transparent"
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 h-14 flex items-center justify-between">
        <Link
          href="/landing"
          className="flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-[#171717] rounded-sm"
          aria-label="CallLedger home"
        >
          <span className="bg-[#F62440] text-white px-1.5 py-0.5 rounded-xs font-bold text-[10px] tracking-wider">
            CALL
          </span>
          <span className="font-bold text-xs tracking-wider text-[#171717]">
            LEDGER
          </span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-[#171717] text-[#FFFAF3] text-[11px] font-mono font-bold tracking-wider hover:bg-[#2a2a2a] transition-all shadow-xs"
          aria-label="Open the CallLedger application"
        >
          Open App
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </header>
  );
}

// ─── Root Page Component ────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <HeroSection />
        <ProblemSection />
        <StructureSection />
        <FollowSection />
        <DecideSection />
      </main>
      <ClosingSection />
    </>
  );
}

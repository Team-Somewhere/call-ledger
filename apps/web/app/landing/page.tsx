"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, ExternalLink } from "lucide-react";

// ─── Reduced-motion check ───────────────────────────────────────────────────

function isReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ─── Utility: scroll-triggered reveal (fires once when element enters) ───────

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isReducedMotion()) { setVisible(true); return; }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─── Utility: scroll progress within an element (0 → 1) ─────────────────────
// Used to drive timeline line growth and sticky section step changes.

function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || isReducedMotion()) { setProgress(1); return; }

    const update = () => {
      const rect = el.getBoundingClientRect();
      const viewH = window.innerHeight;
      // progress goes 0→1 as the element scrolls from bottom to top of viewport
      const p = Math.max(0, Math.min(1, (viewH - rect.top) / (viewH + rect.height)));
      setProgress(p);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  return progress;
}

// ─── Shared CTA button ───────────────────────────────────────────────────────

function CtaButton({
  variant = "dark",
  label = "Open CallLedger",
}: {
  variant?: "dark" | "light";
  label?: string;
}) {
  const base =
    "inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-mono font-bold tracking-wider transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]";
  const styles =
    variant === "dark"
      ? `${base} bg-[#171717] text-[#FFFAF3] hover:bg-[#2a2a2a] focus-visible:outline-[#FFFAF3]`
      : `${base} bg-[#FFFAF3] text-[#171717] border border-[#FFFAF3]/30 hover:bg-white focus-visible:outline-white`;

  return (
    <Link href="/" className={styles} aria-label="Open CallLedger application">
      {label}
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

// ─── Ledger mark / timestamp ornament ───────────────────────────────────────

function LedgerMark({ time }: { time: string }) {
  return (
    <div className="flex items-center gap-3 select-none" aria-hidden="true">
      <div className="w-1.5 h-1.5 rounded-full bg-[#F62440] shrink-0" />
      <span className="text-[10px] font-mono text-[#78716C] tracking-widest uppercase">
        {time}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. HERO — "The call"
// ═══════════════════════════════════════════════════════════════════════════════

const STREAM_POSTS = [
  { handle: "@ThorneMacro",   text: "$SOL breakout confirmed — entered at $174. 4H close above $178 needed.", time: "just now", hot: true  },
  { handle: "@NovaCapDesk",   text: "Risk-off vibes across board. Keeping $BTC exposure tight below 90k.",    time: "2m",       hot: false },
  { handle: "@ElenaDeFi",     text: "ETH funding rates normalising. Building a spot position quietly.",        time: "4m",       hot: false },
  { handle: "@SatoshiPulseX", text: "BTC dominance peak incoming. Alts rotation setup looks clean on the 1D.", time: "7m",      hot: false },
  { handle: "@CrossTrades",   text: "AVAX / BTC pair weak. Short bias holds while price below $34.5.",        time: "9m",       hot: false },
];

function HeroSection() {
  // Which posts are "mounted" into the DOM (before animation)
  const [mounted, setMounted] = useState<number[]>([0]);
  // Which posts have finished their enter animation
  const [entered, setEntered] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    if (isReducedMotion()) {
      setMounted(STREAM_POSTS.map((_, i) => i));
      setEntered(new Set(STREAM_POSTS.map((_, i) => i)));
      return;
    }

    // After 1s, begin sliding posts in one-by-one
    const timers: ReturnType<typeof setTimeout>[] = [];
    STREAM_POSTS.forEach((_, i) => {
      if (i === 0) return; // first post is already in
      timers.push(
        setTimeout(() => {
          setMounted((prev) => [...prev, i]);
          // Let it render at "pre-enter" state, then trigger enter
          setTimeout(() => setEntered((prev) => new Set([...prev, i])), 60);
        }, 900 + i * 1600)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Background dot grid */}
      <div className="absolute inset-0 ledger-dot-grid opacity-40" aria-hidden="true" />
      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFAF3] via-transparent to-[#FFFAF3]" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full pt-24 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* ── Left: Headline + CTA ── */}
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F62440] animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#78716C]">
              Public trade calls · Structured · Traceable
            </span>
          </div>

          <div className="flex items-baseline gap-1" aria-hidden="true">
            <span className="text-[11px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/30 px-1.5 py-0.5 rounded-sm">CALL</span>
            <span className="text-[11px] font-mono font-bold text-[#171717] tracking-widest uppercase border border-[#E8DFD1] px-1.5 py-0.5 rounded-sm">LEDGER</span>
          </div>

          <h1 id="hero-heading" className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#171717] leading-[1.05]">
            Every call.<br />
            <span className="text-[#F62440]">On record.</span>
          </h1>

          <p className="text-base md:text-lg text-[#78716C] font-sans leading-relaxed max-w-md">
            Public crypto trade calls move fast and vanish. CallLedger captures
            them from creator posts, structures each signal, and keeps an
            auditable record — so you can follow the call and see what happened.
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <CtaButton variant="dark" label="Open CallLedger" />
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" aria-hidden="true" />
              <span className="text-[10px] font-mono text-[#78716C] uppercase tracking-widest">Live now</span>
            </div>
          </div>
        </div>

        {/* ── Right: One-by-one animated feed ── */}
        <div
          className="relative lg:h-[460px] flex flex-col gap-0 overflow-hidden"
          aria-label="Sample live feed of creator posts (illustrative)"
          role="img"
        >
          <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest pb-2 mb-3 border-b border-[#E8DFD1] flex items-center gap-2 shrink-0">
            <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" aria-hidden="true" />
            // LIVE FEED · POLLS EVERY 16S
          </div>

          {/* Posts list — newer items slide in from the top */}
          <div className="relative flex flex-col gap-2 overflow-hidden flex-1">
            {mounted.map((i) => {
              const post = STREAM_POSTS[i]!;
              const isIn = entered.has(i);
              const isNewest = i === mounted[0];

              return (
                <article
                  key={i}
                  className={`border rounded-sm p-3 text-xs font-mono shrink-0 transition-all duration-700 ease-out ${
                    isNewest
                      ? "border-[#F62440]/40 bg-[#FFF2DB]"
                      : "border-[#E8DFD1] bg-[#FFFAF3]"
                  }`}
                  style={{
                    opacity:    isIn ? (1 - mounted.indexOf(i) * 0.14) : 0,
                    transform:  isIn ? `translateY(0px)` : `translateY(-24px)`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[#E8DFD1] flex items-center justify-center text-[8px] font-bold text-[#78716C] shrink-0">
                        {post.handle.slice(1, 3).toUpperCase()}
                      </div>
                      <span className="font-bold text-[#171717] text-[11px]">{post.handle}</span>
                      {isNewest && (
                        <span className="text-[9px] text-[#F62440] font-mono border border-[#F62440]/30 px-1 py-px rounded-sm animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-[#78716C]">{post.time}</span>
                  </div>
                  <p className="text-[#292524] leading-snug">{post.text}</p>
                </article>
              );
            })}
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#FFFAF3] to-transparent pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" aria-hidden="true">
        <div className="w-px h-10 bg-gradient-to-b from-[#171717]/20 to-transparent animate-pulse" />
        <span className="text-[9px] font-mono text-[#78716C] tracking-widest uppercase">scroll</span>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// B. THE PROBLEM — scattered feed, boxes animate in one by one
// ═══════════════════════════════════════════════════════════════════════════════

const SCATTER_POSTS = [
  { top: "4%",  left: "2%",  text: "$BTC setup forming…",             dim: true,  rotate: "-1deg",   delay: 0   },
  { top: "16%", left: "32%", text: "SOL breaking out of range",        dim: false, rotate: "0.5deg",  delay: 80  },
  { top: "10%", left: "57%", text: "ETH funding rates spike",          dim: true,  rotate: "1.2deg",  delay: 160 },
  { top: "36%", left: "4%",  text: "great thread on L2 fees",          dim: true,  rotate: "-0.8deg", delay: 240 },
  { top: "33%", left: "36%", text: "$AVAX bearish divergence — SHORT", dim: false, rotate: "-1.5deg", delay: 320, signal: true },
  { top: "50%", left: "14%", text: "good morning CT 🌅",               dim: true,  rotate: "0.3deg",  delay: 400 },
  { top: "56%", left: "52%", text: "rotate into DeFi bluechips now",   dim: false, rotate: "1deg",    delay: 480 },
  { top: "68%", left: "4%",  text: "risk-off until macro clears",      dim: true,  rotate: "-0.5deg", delay: 560 },
  { top: "70%", left: "36%", text: "BTC dominance peaking…",           dim: true,  rotate: "0.8deg",  delay: 640 },
];

function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { ref: innerRef, visible } = useReveal(0.08);

  // Merge refs
  const setRef = useCallback(
    (el: HTMLElement | null) => {
      (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el;
      (innerRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    [innerRef]
  );

  return (
    <section
      ref={setRef}
      className="relative py-28 md:py-36 overflow-hidden bg-[#171717]"
      aria-labelledby="problem-heading"
    >
      <div className="absolute inset-0 halftone-banner opacity-25" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: scattered post fragments, staggered in ── */}
          <div
            className="relative h-80 md:h-[420px]"
            aria-label="Illustrative scattered feed — calls get buried"
            role="img"
          >
            {SCATTER_POSTS.map((p, i) => (
              <div
                key={i}
                className={`absolute px-2 py-1.5 rounded-sm text-[10px] font-mono border max-w-[170px] leading-snug transition-all duration-700 ease-out ${
                  "signal" in p && p.signal
                    ? "border-[#F62440]/60 bg-[#F62440]/15 text-[#FFFAF3]"
                    : p.dim
                    ? "border-[#E8DFD1]/10 bg-white/4 text-white/25"
                    : "border-[#E8DFD1]/20 bg-white/8 text-white/60"
                }`}
                style={{
                  top:       p.top,
                  left:      p.left,
                  transform: visible
                    ? `rotate(${p.rotate})`
                    : `rotate(${p.rotate}) translateY(16px)`,
                  opacity:          visible ? 1 : 0,
                  transitionDelay:  visible ? `${p.delay}ms` : "0ms",
                }}
              >
                {p.text}
              </div>
            ))}

            {/* Annotation */}
            <div
              className="absolute text-[9px] font-mono text-[#F62440] uppercase tracking-widest transition-all duration-700"
              style={{
                top:     "24%",
                left:    "35%",
                whiteSpace: "nowrap",
                opacity:        visible ? 1 : 0,
                transitionDelay: "720ms",
              }}
              aria-hidden="true"
            >
              ↓ a signal — but which one?
            </div>
          </div>

          {/* ── Right: copy ── */}
          <div
            className="space-y-6 transition-all duration-1000"
            style={{
              opacity:   visible ? 1 : 0,
              transform: visible ? "translateX(0)" : "translateX(32px)",
              transitionDelay: "200ms",
            }}
          >
            <LedgerMark time="THE PROBLEM" />
            <h2 id="problem-heading" className="text-4xl md:text-5xl font-bold tracking-tight text-[#FFFAF3] leading-tight">
              The call lands.<br />
              Then it&apos;s gone.
            </h2>
            <div className="space-y-4 text-[#78716C] font-sans leading-relaxed">
              <p>
                Creators post trade calls across X and other sources in real
                time. The important details — asset, direction, entry — are
                buried in prose, mixed with market commentary, replies, and noise.
              </p>
              <p>
                By the time you find the call, the context has shifted. And
                there&apos;s no record of what was said, when, or what happened after.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// C. STRUCTURE — sticky scroll-driven signal build-up
// ═══════════════════════════════════════════════════════════════════════════════

const SIGNAL_STEPS = [
  {
    id: "step-source",
    label: "SOURCE",
    content: (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-6 h-6 rounded-full bg-[#E8DFD1] flex items-center justify-center text-[9px] font-bold text-[#78716C]">AT</div>
        <span className="font-bold text-[#171717]">Alex Thorne</span>
        <span className="text-[#78716C] text-[10px]">@ThorneMacro</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#FFF2DB] border border-[#E8DFD1] text-[#78716C] rounded-sm">X</span>
      </div>
    ),
  },
  {
    id: "step-asset",
    label: "ASSET",
    content: (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold font-mono text-[#171717] text-base">SOL / USDC</span>
        <span className="text-[9px] font-mono px-2 py-0.5 bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-sm font-bold">▲ LONG</span>
      </div>
    ),
  },
  {
    id: "step-entry",
    label: "ENTRY",
    content: (
      <div className="font-mono text-sm text-[#171717] flex flex-wrap items-center gap-2">
        <span className="text-[#78716C] text-[10px] uppercase tracking-wider">Entry target</span>
        <span className="font-bold">$174.50</span>
        <span className="text-[#78716C]">·</span>
        <span className="text-[#78716C] text-[10px] uppercase tracking-wider">Timeframe</span>
        <span className="font-bold">4H</span>
      </div>
    ),
  },
  {
    id: "step-ts",
    label: "TIMESTAMP",
    content: (
      <div className="font-mono text-sm text-[#171717] flex flex-wrap items-center gap-2">
        <span className="text-[#78716C] text-[10px]">Captured</span>
        <span>2026-11-05 · 20:15 UTC</span>
        <a
          href="#"
          className="text-[9px] text-[#78716C] hover:text-[#171717] inline-flex items-center gap-0.5 transition"
          aria-label="View original post (illustrative)"
          onClick={(e) => e.preventDefault()}
        >
          ORIGINAL POST <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    ),
  },
  {
    id: "step-verify",
    label: "ARKIV",
    content: (
      <div className="flex items-center gap-2 font-mono">
        <ShieldCheck className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
        <span className="text-[#16A34A] font-bold text-[11px]">ARKIV-VERIFIED</span>
        <span className="text-[#78716C] text-[10px]">ark-sig-99201-sol</span>
      </div>
    ),
  },
];

function StructureSection() {
  // Scroll-driven: the sticky container drives "how many rows are revealed"
  const stickyContainerRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(stickyContainerRef as React.RefObject<HTMLElement>);
  // Also trigger the raw-post reveal on enter
  const { ref: sectionRef, visible } = useReveal(0.05);

  // Map scroll progress → number of revealed rows
  // We want rows to appear across 20–90% of section scroll
  const normalised = Math.max(0, Math.min(1, (progress - 0.15) / 0.7));
  const revealedCount = isReducedMotion()
    ? SIGNAL_STEPS.length
    : Math.min(SIGNAL_STEPS.length, Math.ceil(normalised * (SIGNAL_STEPS.length + 0.5)));

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className="relative py-28 md:py-36"
      aria-labelledby="structure-heading"
    >
      <div
        ref={stickyContainerRef}
        className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start"
      >
        {/* ── Left: sticky copy ── */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <LedgerMark time="FROM POST TO SIGNAL" />
          <h2 id="structure-heading" className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
            Structure<br />from the noise.
          </h2>
          <div className="space-y-4 text-[#78716C] font-sans leading-relaxed max-w-md">
            <p>
              When a creator posts a trade call, CallLedger parses the
              text — identifying asset, direction, entry levels, and
              timeframe where stated — and stores it as a structured signal
              with its source and timestamp.
            </p>
            <p>
              The signal is linked back to the original post. Nothing is
              invented. The source is always visible.
            </p>
          </div>
          <p className="text-[10px] font-mono text-[#78716C] border border-[#E8DFD1] rounded-sm px-3 py-2 bg-[#FFF2DB]/40 leading-relaxed">
            ⓘ&nbsp; The signal card below shows illustrative sample data,
            not live platform results.
          </p>
        </div>

        {/* ── Right: progressive signal card ── */}
        <div className="space-y-4">
          {/* Raw post */}
          <div
            className="border border-[#E8DFD1] bg-[#FFF2DB]/50 rounded-sm p-4 font-mono text-xs transition-all duration-700"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
          >
            <div className="text-[10px] text-[#78716C] mb-2 uppercase tracking-widest">// RAW POST</div>
            <p className="text-[#171717] leading-relaxed italic">
              &quot;$SOL breakout confirmed — entered at $174. 4H close above $178
              needed to hold the structure. Watching for continuation into
              $215 range. SL below $162. High conviction.&quot;
            </p>
            <div className="mt-2 text-[9px] text-[#78716C]">@ThorneMacro · X · 2026-11-05</div>
          </div>

          {/* Arrow */}
          <div
            className="text-center text-[#E8DFD1] text-xl transition-all duration-500"
            style={{ opacity: visible ? 1 : 0, transitionDelay: "300ms" }}
            aria-hidden="true"
          >
            ↓
          </div>

          {/* Structured signal card, rows revealed by scroll */}
          <div className="border border-[#171717] rounded-sm overflow-hidden">
            <div className="bg-[#171717] px-4 py-2 text-[9px] font-mono text-[#FFFAF3]/60 uppercase tracking-widest flex items-center justify-between">
              <span>// STRUCTURED SIGNAL</span>
              <span className="text-[#F62440]">SAMPLE DATA</span>
            </div>
            <div className="divide-y divide-[#E8DFD1]">
              {SIGNAL_STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 transition-all duration-500 ease-out"
                  style={{
                    opacity:   i < revealedCount ? 1 : 0,
                    transform: i < revealedCount ? "translateX(0)" : "translateX(12px)",
                    transitionDelay: `${i * 60}ms`,
                  }}
                >
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#78716C] w-20 shrink-0">
                    {step.label}
                  </span>
                  <div className="min-w-0">{step.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// D. FOLLOW — scroll-driven timeline: line grows, dots appear one by one
// ═══════════════════════════════════════════════════════════════════════════════

type TimelineStatus = "ACTIVE" | "WATCHING" | "CLOSED";

interface TimelineEvent {
  ts: string;
  label: string;
  note: string;
  status: TimelineStatus;
  price: string;
}

const TIMELINE: TimelineEvent[] = [
  { ts: "Nov 05 · 20:15", label: "Signal captured",          note: "Entry target $174.50 · 4H",   status: "ACTIVE",   price: "$174.50" },
  { ts: "Nov 06 · 04:30", label: "Price crossed entry",      note: "Spot reached $176.80",         status: "WATCHING", price: "$176.80" },
  { ts: "Nov 06 · 14:00", label: "4H candle close above $178", note: "Structure confirmed",        status: "WATCHING", price: "$179.20" },
  { ts: "Nov 07 · 09:00", label: "Signal closed",            note: "Price at $188.40 · +7.9%",    status: "CLOSED",   price: "$188.40" },
];

const DOT_COLOR: Record<TimelineStatus, string> = {
  ACTIVE:   "bg-[#F62440]",
  WATCHING: "bg-[#FFE5BF] border-2 border-[#E8DFD1]",
  CLOSED:   "bg-[#16A34A]",
};

function FollowSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const progress   = useScrollProgress(sectionRef);
  const { ref: revealRef, visible } = useReveal(0.1);

  const setRef = useCallback(
    (el: HTMLElement | null) => {
      (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el;
      (revealRef as React.MutableRefObject<HTMLElement | null>).current = el;
    },
    [revealRef]
  );

  // Normalise progress so the timeline plays from 20%–80% of section scroll
  const norm = Math.max(0, Math.min(1, (progress - 0.18) / 0.6));
  const lineHeight = isReducedMotion() ? 100 : Math.round(norm * 100); // %
  const visibleDots = isReducedMotion()
    ? TIMELINE.length
    : Math.floor(norm * (TIMELINE.length + 0.5));

  return (
    <section
      ref={setRef}
      className="relative py-28 md:py-36 bg-[#FFF2DB]/40"
      aria-labelledby="follow-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* ── Left: scroll-driven timeline ── */}
        <div
          className="transition-opacity duration-700"
          style={{ opacity: visible ? 1 : 0 }}
          aria-label="Illustrative signal timeline showing state changes (sample data)"
          role="img"
        >
          <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest pb-3 mb-1 border-b border-[#E8DFD1] flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" aria-hidden="true" />
            // SIGNAL LEDGER · SOL/USDC ·{" "}
            <span className="text-[#F62440]">SAMPLE DATA</span>
          </div>

          {/* Timeline wrapper — fixed geometry so dot+line stay perfectly aligned */}
          <div className="relative ml-3 mt-4">
            {/* Growing vertical line — starts at top-0 and extends downward */}
            <div
              className="absolute left-[5px] top-0 w-0.5 bg-[#E8DFD1] transition-none origin-top"
              style={{
                height: `${lineHeight}%`,
                transition: "height 0.6s cubic-bezier(0.4,0,0.2,1)",
              }}
              aria-hidden="true"
            />

            {TIMELINE.map((event, i) => {
              const dotVisible = i < visibleDots;
              const isLast = i === TIMELINE.length - 1;

              return (
                <div
                  key={i}
                  className="relative flex gap-5 pb-8"
                  style={{ minHeight: isLast ? undefined : "80px" }}
                >
                  {/* Dot — perfectly aligned on the line */}
                  <div className="relative shrink-0 w-3 flex justify-center">
                    <div
                      className={`w-3 h-3 rounded-full mt-0.5 transition-all duration-500 ${DOT_COLOR[event.status]}`}
                      style={{
                        opacity:         dotVisible ? 1 : 0,
                        transform:       dotVisible ? "scale(1)" : "scale(0.4)",
                        transitionDelay: `${i * 120}ms`,
                      }}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 transition-all duration-600 ease-out"
                    style={{
                      opacity:         dotVisible ? 1 : 0,
                      transform:       dotVisible ? "translateX(0)" : "translateX(10px)",
                      transitionDelay: `${i * 120 + 60}ms`,
                    }}
                  >
                    <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-wider mb-1">{event.ts}</div>
                    <div className="text-sm font-bold text-[#171717] mb-0.5">{event.label}</div>
                    <div className="text-xs text-[#78716C] font-sans mb-2">{event.note}</div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border inline-block ${
                        event.status === "CLOSED"
                          ? "bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A] font-bold"
                          : "bg-[#FFFAF3] border-[#E8DFD1] text-[#78716C]"
                      }`}
                    >
                      {event.price}{event.status === "CLOSED" && " ✓"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] font-mono text-[#78716C]/50 mt-2 ml-8">
            All values above are illustrative and do not represent actual trades.
          </p>
        </div>

        {/* ── Right: copy ── */}
        <div
          className="space-y-6 transition-all duration-1000"
          style={{
            opacity:   visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(32px)",
            transitionDelay: "200ms",
          }}
        >
          <LedgerMark time="WHAT HAPPENED NEXT" />
          <h2 id="follow-heading" className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
            Follow the call.<br />
            Review the record.
          </h2>
          <div className="space-y-4 text-[#78716C] font-sans leading-relaxed max-w-md">
            <p>
              When you follow a creator, CallLedger monitors their posts and
              surfaces new signals as they appear. Each signal has its own
              timeline — showing when it was captured, how the market moved,
              and when the signal was resolved.
            </p>
            <p>
              Past calls stay in the ledger. You can review a creator&apos;s
              signal history to understand their style before deciding to
              act on future calls.
            </p>
            <p className="font-mono text-xs text-[#171717] border-l-2 border-[#F62440] pl-3">
              Tracking makes past calls reviewable. It does not predict future outcomes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// E. DECIDE — card params stagger in, button pulses
// ═══════════════════════════════════════════════════════════════════════════════

const TRADE_PARAMS = [
  { label: "Chain",      value: "Base" },
  { label: "Order type", value: "LIMIT (Flash)" },
  { label: "Spend",      value: "0.05 USDC" },
  { label: "Limit",      value: "$2,400" },
];

function DecideSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="relative py-28 md:py-36 overflow-hidden"
      aria-labelledby="decide-heading"
    >
      {/* Subtle warm strip on right */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[#FFF2DB]/30 hidden lg:block" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

        {/* ── Left: copy + stagger ── */}
        <div
          className="space-y-6 transition-all duration-1000"
          style={{
            opacity:   visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(-32px)",
          }}
        >
          <LedgerMark time="YOUR CALL" />
          <h2 id="decide-heading" className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight">
            You decide<br />what to do next.
          </h2>
          <div className="space-y-4 text-[#78716C] font-sans leading-relaxed max-w-md">
            <p>
              Seeing a signal is not a trade. CallLedger shows you the call,
              the source, and the context. What you do with it is your decision.
            </p>
            <p>
              If you want to act, there is an optional path to review and
              execute an order through{" "}
              <strong className="font-mono text-[#171717]">Definitive Flash</strong>
              {" "}— a connected non-custodial execution layer. You review every
              parameter before anything is submitted. Your wallet, your
              signature, your choice.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CtaButton variant="dark" label="Open CallLedger" />
            <Link
              href="/trade"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-mono tracking-wider border border-[#E8DFD1] text-[#78716C] hover:border-[#171717] hover:text-[#171717] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
            >
              See trade review flow
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* ── Right: trade review card with staggered params ── */}
        <div
          aria-label="Sample trade review interface (illustrative)"
          role="img"
          className="transition-all duration-1000"
          style={{
            opacity:         visible ? 1 : 0,
            transform:       visible ? "translateX(0)" : "translateX(32px)",
            transitionDelay: "200ms",
          }}
        >
          <div className="border border-[#E8DFD1] rounded-sm overflow-hidden max-w-md shadow-sm">
            {/* Card header */}
            <div className="bg-[#171717] px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">// TRADE REVIEW</span>
              <span className="text-[9px] font-mono text-[#F62440] border border-[#F62440]/30 px-1.5 py-0.5 rounded-sm">SAMPLE</span>
            </div>

            <div className="p-5 space-y-5 bg-[#FFFAF3]">
              {/* Signal source ref */}
              <div
                className="p-3 bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm space-y-1 transition-all duration-600"
                style={{
                  opacity:         visible ? 1 : 0,
                  transform:       visible ? "translateY(0)" : "translateY(8px)",
                  transitionDelay: "300ms",
                }}
              >
                <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest">Signal Source</div>
                <div className="text-sm font-bold text-[#171717] font-mono">SOL/USDC · ▲ LONG</div>
                <div className="text-[10px] text-[#78716C]">@ThorneMacro · X · captured Nov 05</div>
              </div>

              {/* Params — each staggered */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {TRADE_PARAMS.map(({ label, value }, i) => (
                  <div
                    key={label}
                    className="border border-[#E8DFD1] rounded-sm p-2.5 bg-white transition-all duration-500 ease-out"
                    style={{
                      opacity:         visible ? 1 : 0,
                      transform:       visible ? "translateY(0)" : "translateY(10px)",
                      transitionDelay: `${400 + i * 80}ms`,
                    }}
                  >
                    <div className="text-[9px] text-[#78716C] uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="font-bold text-[#171717]">{value}</div>
                  </div>
                ))}
              </div>

              {/* CTA button — fades in last, has a subtle pulse ring */}
              <div
                className="border-t border-[#E8DFD1] pt-4 space-y-2 transition-all duration-600"
                style={{
                  opacity:         visible ? 1 : 0,
                  transitionDelay: "740ms",
                }}
              >
                <div className="relative">
                  {/* Pulse ring */}
                  <div
                    className="absolute inset-0 rounded-sm bg-[#171717]/10 animate-ping"
                    style={{ animationDuration: "2.4s", animationDelay: "1s" }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="relative w-full py-2.5 bg-[#171717] text-[#FFFAF3] text-xs font-mono font-bold rounded-sm tracking-wider cursor-default select-none"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    ✓ CONFIRM &amp; SIGN WITH WALLET
                  </button>
                </div>
                <p className="text-[9px] font-mono text-[#78716C] text-center leading-relaxed">
                  Non-custodial. You sign every order. Your keys, your trade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// F. CLOSING + FOOTER  — CTA fixed to white/cream on dark bg
// ═══════════════════════════════════════════════════════════════════════════════

function ClosingSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <footer className="bg-[#171717]" aria-labelledby="closing-heading">
      {/* Closing hero */}
      <div ref={ref as React.RefObject<HTMLDivElement>} className="relative py-32 md:py-40 overflow-hidden">
        <div className="absolute inset-0 ledger-dot-grid opacity-10" aria-hidden="true" />
        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
          <div className="w-[600px] h-[600px] rounded-full bg-[#F62440]/5 blur-3xl" />
        </div>

        <div
          className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 text-center space-y-10 transition-all duration-1000"
          style={{
            opacity:   visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(32px)",
          }}
        >
          <div className="flex items-baseline gap-1 justify-center" aria-hidden="true">
            <span className="text-[11px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1.5 py-0.5 rounded-sm">CALL</span>
            <span className="text-[11px] font-mono font-bold text-white tracking-widest uppercase border border-white/20 px-1.5 py-0.5 rounded-sm">LEDGER</span>
          </div>

          <h2
            id="closing-heading"
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#FFFAF3] leading-tight"
          >
            The call is public.<br />
            <span className="text-[#F62440]">Now so is the record.</span>
          </h2>

          {/*
            CTA on dark background: use "light" variant so it renders
            as cream/white — not the invisible dark-on-dark "outline" of before.
          */}
          <CtaButton variant="light" label="Open CallLedger" />
        </div>
      </div>

      {/* Footer nav */}
      <nav className="border-t border-white/10 px-6 md:px-12 lg:px-16 py-10" aria-label="Footer navigation">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1 py-px rounded-sm">CALL</span>
              <span className="text-[10px] font-mono font-bold text-white tracking-widest uppercase border border-white/20 px-1 py-px rounded-sm">LEDGER</span>
            </div>
            <p className="text-[10px] font-mono text-white/30 max-w-xs leading-relaxed">
              Trade call monitoring, signal structuring, and outcome tracking. Not investment advice.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[11px] font-mono text-white/40 uppercase tracking-widest">
            {[
              { href: "/",           label: "Terminal"    },
              { href: "/discover",   label: "Discover"    },
              { href: "/following",  label: "Following"   },
              { href: "/trade",      label: "Trade"       },
              { href: "/strategies", label: "Allocations" },
              { href: "/portfolio",  label: "Portfolio"   },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-white transition-colors duration-150 focus-visible:outline-1 focus-visible:outline-white rounded-sm"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 text-[9px] font-mono text-white/20">
          © {new Date().getFullYear()} CallLedger · Signal monitoring for public crypto trade calls · Not financial advice
        </div>
      </nav>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sticky top nav
// ═══════════════════════════════════════════════════════════════════════════════

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
        scrolled ? "bg-[#FFFAF3]/95 backdrop-blur-sm border-b border-[#E8DFD1] shadow-sm" : "bg-transparent"
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 h-14 flex items-center justify-between">
        <Link
          href="/landing"
          className="flex items-baseline gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] rounded-sm"
          aria-label="CallLedger home"
        >
          <span className="text-[10px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1 py-px rounded-sm">CALL</span>
          <span className="text-[10px] font-mono font-bold text-[#171717] tracking-widest uppercase border border-[#E8DFD1] px-1 py-px rounded-sm">LEDGER</span>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#171717] text-[#FFFAF3] text-[11px] font-mono font-bold tracking-wider hover:bg-[#2a2a2a] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          aria-label="Open the CallLedger application"
        >
          Open App
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE ROOT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[#171717] focus:text-[#FFFAF3] focus:px-4 focus:py-2 focus:rounded-sm focus:text-sm focus:font-mono"
      >
        Skip to main content
      </a>

      <LandingNav />

      <main id="main-content">
        <HeroSection />

        <ProblemSection />

        <StructureSection />

        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="border-t border-[#E8DFD1]" aria-hidden="true" />
        </div>

        <FollowSection />

        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="border-t border-[#E8DFD1]" aria-hidden="true" />
        </div>

        <DecideSection />
      </main>

      <ClosingSection />
    </>
  );
}

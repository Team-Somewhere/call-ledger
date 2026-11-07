"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, ExternalLink } from "lucide-react";

// ─── Utility: scroll-triggered reveal ───────────────────────────────────────

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion — show immediately
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setVisible(true); return; }

    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

// ─── Shared CTA button ───────────────────────────────────────────────────────

function CtaButton({
  variant = "dark",
  label = "Open CallLedger",
}: {
  variant?: "dark" | "outline";
  label?: string;
}) {
  const base =
    "inline-flex items-center gap-2 px-6 py-3 rounded-sm text-sm font-mono font-bold tracking-wider transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]";
  const styles =
    variant === "dark"
      ? `${base} bg-[#171717] text-[#FFFAF3] hover:bg-[#2a2a2a] active:scale-[0.98]`
      : `${base} border border-[#171717] text-[#171717] hover:bg-[#FFF2DB] active:scale-[0.98]`;

  return (
    <Link href="/" className={styles} aria-label="Open CallLedger application">
      {label}
      <ArrowRight className="w-4 h-4" aria-hidden="true" />
    </Link>
  );
}

// ─── Thin signal line motif (runs the full page height) ─────────────────────

function SignalLine() {
  return (
    <div
      className="absolute left-6 md:left-10 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#E8DFD1] to-transparent pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ─── Ledger mark / timestamp ornament ───────────────────────────────────────

function LedgerMark({ time, label }: { time: string; label?: string }) {
  return (
    <div className="flex items-center gap-3 select-none" aria-hidden="true">
      <div className="w-1.5 h-1.5 rounded-full bg-[#F62440] shrink-0" />
      <span className="text-[10px] font-mono text-[#78716C] tracking-widest uppercase">
        {time}
        {label ? ` · ${label}` : ""}
      </span>
    </div>
  );
}

// ─── A. HERO — "The call" ────────────────────────────────────────────────────

function HeroSection() {
  const [tick, setTick] = useState(0);

  // Animate the stream of incoming posts
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(id);
  }, []);

  const streamPosts = [
    { handle: "@ThorneMacro", text: "$SOL breakout confirmed — entered at $174. 4H close above $178 needed.", time: "just now", hot: true },
    { handle: "@NovaCapDesk", text: "Risk-off vibes across board. Keeping $BTC exposure tight below 90k.", time: "2m" },
    { handle: "@ElenaDeFi", text: "ETH funding rates normalising. Building a spot position quietly.", time: "4m", hot: false },
    { handle: "@SatoshiPulseX", text: "BTC dominance peak incoming. Alts rotation setup looks clean on the 1D.", time: "7m" },
    { handle: "@CrossTrades", text: "AVAX / BTC pair weak. Short bias holds while price below $34.5.", time: "9m" },
  ];

  const visibleCount = Math.min(3 + (tick % 2), streamPosts.length);

  return (
    <section
      className="relative min-h-[100svh] flex flex-col justify-center overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Background dot grid */}
      <div className="absolute inset-0 ledger-dot-grid opacity-40" aria-hidden="true" />

      {/* Gradient vignette */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#FFFAF3] via-transparent to-[#FFFAF3]"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 w-full pt-20 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: Headline + CTA */}
        <div className="space-y-8">
          {/* eyebrow */}
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F62440] animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#78716C]">
              Public trade calls · Structured · Traceable
            </span>
          </div>

          {/* Wordmark */}
          <div className="flex items-baseline gap-1" aria-hidden="true">
            <span className="text-[11px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/30 px-1.5 py-0.5 rounded-sm">
              CALL
            </span>
            <span className="text-[11px] font-mono font-bold text-[#171717] tracking-widest uppercase border border-[#E8DFD1] px-1.5 py-0.5 rounded-sm">
              LEDGER
            </span>
          </div>

          <h1
            id="hero-heading"
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#171717] leading-[1.05]"
          >
            Every call.
            <br />
            <span className="text-[#F62440]">On record.</span>
          </h1>

          <p className="text-base md:text-lg text-[#78716C] font-sans leading-relaxed max-w-md">
            Public crypto trade calls move fast and vanish. CallLedger captures
            them from creator posts, structures each signal, and keeps an
            auditable record — so you can follow the call and see what happened.
          </p>

          <div className="flex flex-wrap gap-3 items-center">
            <CtaButton variant="dark" label="Open CallLedger" />
            <LedgerMark time={new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} label="LIVE" />
          </div>
        </div>

        {/* Right: animated stream of raw posts */}
        <div
          className="relative lg:h-[480px] flex flex-col gap-2 overflow-hidden"
          aria-label="Sample live feed of creator posts (illustrative)"
          role="img"
        >
          <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest pb-1 border-b border-[#E8DFD1] flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" aria-hidden="true" />
            // LIVE FEED · POLLS EVERY 16S
          </div>

          <div className="space-y-2 relative">
            {streamPosts.slice(0, visibleCount).map((post, i) => (
              <article
                key={i}
                className={`border rounded-sm p-3 text-xs font-mono transition-all duration-500 ${
                  i === 0 && post.hot
                    ? "border-[#F62440]/40 bg-[#FFF2DB] shadow-sm"
                    : "border-[#E8DFD1] bg-[#FFFAF3]"
                }`}
                style={{
                  opacity: 1 - i * 0.15,
                  transform: `translateY(${i * 2}px)`,
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#E8DFD1] flex items-center justify-center text-[8px] font-bold text-[#78716C]">
                      {post.handle.slice(1, 3).toUpperCase()}
                    </div>
                    <span className="font-bold text-[#171717] text-[11px]">{post.handle}</span>
                    {i === 0 && post.hot && (
                      <span className="text-[9px] text-[#F62440] font-mono border border-[#F62440]/30 px-1 py-px rounded-sm">
                        NEW
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-[#78716C]">{post.time}</span>
                </div>
                <p className="text-[#292524] leading-snug">{post.text}</p>
              </article>
            ))}
          </div>

          {/* Fade out at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#FFFAF3] to-transparent pointer-events-none" aria-hidden="true" />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" aria-hidden="true">
        <div className="w-px h-10 bg-gradient-to-b from-[#E8DFD1] to-transparent animate-pulse" />
        <span className="text-[9px] font-mono text-[#78716C] tracking-widest uppercase">scroll</span>
      </div>
    </section>
  );
}

// ─── B. THE PROBLEM — "A call disappears into the feed" ─────────────────────

function ProblemSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-36 overflow-hidden bg-[#171717]"
      aria-labelledby="problem-heading"
    >
      {/* Halftone texture */}
      <div className="absolute inset-0 halftone-banner opacity-30" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Visual: scattered feed */}
          <div
            className={`relative h-72 md:h-96 transition-all duration-1000 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
            aria-label="Illustrative scattered feed — calls get buried"
            role="img"
          >
            {/* Scattered post fragments */}
            {[
              { top: "5%", left: "2%", text: "$BTC setup forming…", dim: true, rotate: "-1deg" },
              { top: "18%", left: "30%", text: "SOL breaking out of range", dim: false, rotate: "0.5deg", hot: true },
              { top: "12%", left: "55%", text: "ETH funding rates spike", dim: true, rotate: "1.2deg" },
              { top: "38%", left: "5%", text: "great thread on L2 fees", dim: true, rotate: "-0.8deg" },
              { top: "35%", left: "38%", text: "$AVAX bearish divergence — SHORT", dim: false, rotate: "-1.5deg", signal: true },
              { top: "52%", left: "15%", text: "good morning CT 🌅", dim: true, rotate: "0.3deg" },
              { top: "58%", left: "50%", text: "rotate into DeFi bluechips now", dim: false, rotate: "1deg" },
              { top: "70%", left: "5%", text: "risk-off until macro clears", dim: true, rotate: "-0.5deg" },
              { top: "72%", left: "38%", text: "BTC dominance peaking…", dim: true, rotate: "0.8deg" },
            ].map((p, i) => (
              <div
                key={i}
                className={`absolute px-2 py-1 rounded-sm text-[10px] font-mono border max-w-[160px] leading-snug ${
                  p.signal
                    ? "border-[#F62440]/50 bg-[#F62440]/10 text-[#FFFAF3]"
                    : p.hot
                    ? "border-[#FFE5BF]/40 bg-[#FFF2DB]/10 text-[#FFFAF3]"
                    : "border-[#E8DFD1]/10 bg-white/5 text-white/30"
                }`}
                style={{
                  top: p.top,
                  left: p.left,
                  transform: `rotate(${p.rotate})`,
                  transition: `all ${0.4 + i * 0.08}s ease`,
                }}
              >
                {p.text}
              </div>
            ))}

            {/* Annotation arrow at the signal post */}
            <div
              className="absolute text-[9px] font-mono text-[#F62440] uppercase tracking-widest"
              style={{ top: "28%", left: "38%", whiteSpace: "nowrap" }}
              aria-hidden="true"
            >
              ↓ a signal — but which one?
            </div>
          </div>

          {/* Copy */}
          <div
            className={`space-y-6 transition-all duration-1000 delay-200 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
          >
            <LedgerMark time="THE PROBLEM" />
            <h2
              id="problem-heading"
              className="text-4xl md:text-5xl font-bold tracking-tight text-[#FFFAF3] leading-tight"
            >
              The call lands.
              <br />
              Then it&apos;s gone.
            </h2>
            <div className="space-y-4 text-[#78716C] font-sans leading-relaxed">
              <p>
                Creators post trade calls across X and other sources in real
                time. The important details — asset, direction, entry — are
                buried in prose, mixed with market commentary, replies, and
                noise.
              </p>
              <p>
                By the time you find the call, the context has shifted. And
                there&apos;s no record of what was said, when, or what happened
                after.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── C. STRUCTURE — "From post to signal" ───────────────────────────────────

const SIGNAL_STEPS = [
  {
    id: "step-source",
    label: "SOURCE",
    content: (
      <div className="flex items-center gap-2">
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
      <div className="font-mono text-sm text-[#171717]">
        <span className="text-[#78716C] mr-2 text-[10px] uppercase tracking-wider">Entry target</span>
        <span className="font-bold">$174.50</span>
        <span className="text-[#78716C] mx-3">·</span>
        <span className="text-[#78716C] mr-2 text-[10px] uppercase tracking-wider">Timeframe</span>
        <span className="font-bold">4H</span>
      </div>
    ),
  },
  {
    id: "step-ts",
    label: "TIMESTAMP",
    content: (
      <div className="font-mono text-sm text-[#171717]">
        <span className="text-[#78716C] mr-2 text-[10px]">Captured</span>
        <span>2026-11-05 · 20:15 UTC</span>
        <a
          href="#"
          className="ml-3 text-[9px] text-[#78716C] hover:text-[#171717] inline-flex items-center gap-0.5 transition"
          aria-label="View original post (illustrative link)"
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
      <div className="flex items-center gap-2 text-sm font-mono">
        <ShieldCheck className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
        <span className="text-[#16A34A] font-bold text-[11px]">ARKIV-VERIFIED</span>
        <span className="text-[#78716C] text-[10px]">ark-sig-99201-sol</span>
      </div>
    ),
  },
];

function StructureSection() {
  const { ref, visible } = useReveal(0.1);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setRevealed(SIGNAL_STEPS.length); return; }

    let i = 0;
    const id = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= SIGNAL_STEPS.length) clearInterval(id);
    }, 420);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-36"
      aria-labelledby="structure-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
        {/* Copy */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <LedgerMark time="FROM POST TO SIGNAL" />
          <h2
            id="structure-heading"
            className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight"
          >
            Structure
            <br />
            from the noise.
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

        {/* Animated signal card build-up */}
        <div className="space-y-1">
          {/* Raw post at top */}
          <div
            className={`border border-[#E8DFD1] bg-[#FFF2DB]/50 rounded-sm p-4 mb-6 font-mono text-xs transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
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
          <div className={`text-center text-[#E8DFD1] text-xl mb-4 transition-all duration-500 delay-300 ${visible ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            ↓
          </div>

          {/* Structured signal card, built step by step */}
          <div className="border border-[#171717] rounded-sm overflow-hidden">
            <div className="bg-[#171717] px-4 py-2 text-[9px] font-mono text-[#FFFAF3]/60 uppercase tracking-widest flex items-center justify-between">
              <span>// STRUCTURED SIGNAL</span>
              <span className="text-[#F62440]">SAMPLE DATA</span>
            </div>
            <div className="divide-y divide-[#E8DFD1]">
              {SIGNAL_STEPS.map((step, i) => (
                <div
                  key={step.id}
                  className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 transition-all duration-500 ${
                    i < revealed ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                  }`}
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

// ─── D. FOLLOW — "See what happened next" ───────────────────────────────────

type TimelineStatus = "ACTIVE" | "WATCHING" | "CLOSED";

interface TimelineEvent {
  ts: string;
  label: string;
  note: string;
  status: TimelineStatus;
  price: string;
}

const TIMELINE: TimelineEvent[] = [
  { ts: "Nov 05 · 20:15", label: "Signal captured", note: "Entry target $174.50 · 4H", status: "ACTIVE", price: "$174.50" },
  { ts: "Nov 06 · 04:30", label: "Price crossed entry", note: "Spot reached $176.80", status: "WATCHING", price: "$176.80" },
  { ts: "Nov 06 · 14:00", label: "4H candle close above $178", note: "Structure confirmed", status: "WATCHING", price: "$179.20" },
  { ts: "Nov 07 · 09:00", label: "Signal closed", note: "Price at $188.40 · +7.9% from entry", status: "CLOSED", price: "$188.40" },
];

const STATUS_COLORS: Record<TimelineStatus, string> = {
  ACTIVE: "bg-[#F62440]",
  WATCHING: "bg-[#FFE5BF] border border-[#E8DFD1]",
  CLOSED: "bg-[#16A34A]",
};

function FollowSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-36 bg-[#FFF2DB]/40"
      aria-labelledby="follow-heading"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Timeline visual */}
        <div
          className={`space-y-0 transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          aria-label="Illustrative signal timeline showing state changes (sample data)"
          role="img"
        >
          <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest pb-3 border-b border-[#E8DFD1] flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#16A34A] animate-pulse" aria-hidden="true" />
            // SIGNAL LEDGER · SOL/USDC · <span className="text-[#F62440]">SAMPLE DATA</span>
          </div>

          <div className="relative pl-5">
            {/* Vertical line */}
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-[#E8DFD1]" aria-hidden="true" />

            {TIMELINE.map((event, i) => (
              <div
                key={i}
                className={`relative py-4 pl-6 transition-all duration-700 ${
                  visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {/* Node */}
                <div
                  className={`absolute left-0 top-5 w-3 h-3 rounded-full -translate-x-[5px] ${STATUS_COLORS[event.status]}`}
                  aria-hidden="true"
                />

                <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-wider mb-1">{event.ts}</div>
                <div className="text-sm font-bold text-[#171717] mb-0.5">{event.label}</div>
                <div className="text-xs text-[#78716C] font-sans">{event.note}</div>

                {/* Price badge */}
                <div className="mt-2 inline-block">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border ${
                      event.status === "CLOSED"
                        ? "bg-[#16A34A]/10 border-[#16A34A]/30 text-[#16A34A] font-bold"
                        : "bg-[#FFFAF3] border-[#E8DFD1] text-[#78716C]"
                    }`}
                  >
                    {event.price}
                    {event.status === "CLOSED" && " ✓"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-[#78716C]/60 pt-2">
            All values above are illustrative and do not represent actual trades.
          </p>
        </div>

        {/* Copy */}
        <div
          className={`space-y-6 transition-all duration-1000 delay-200 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
        >
          <LedgerMark time="WHAT HAPPENED NEXT" />
          <h2
            id="follow-heading"
            className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight"
          >
            Follow the call.
            <br />
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
              Tracking makes past calls reviewable. It does not predict
              future outcomes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── E. DECIDE — "Your call, your execution" ────────────────────────────────

function DecideSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <section
      ref={ref}
      className="relative py-28 md:py-36 overflow-hidden"
      aria-labelledby="decide-heading"
    >
      {/* Subtle dark strip */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[#171717]/3 hidden lg:block" aria-hidden="true" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12 lg:px-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Copy */}
        <div
          className={`space-y-6 transition-all duration-1000 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
        >
          <LedgerMark time="YOUR CALL" />
          <h2
            id="decide-heading"
            className="text-4xl md:text-5xl font-bold tracking-tight text-[#171717] leading-tight"
          >
            You decide
            <br />
            what to do next.
          </h2>
          <div className="space-y-4 text-[#78716C] font-sans leading-relaxed max-w-md">
            <p>
              Seeing a signal is not a trade. CallLedger shows you the call,
              the source, and the context. What you do with it is your
              decision.
            </p>
            <p>
              If you want to act, there is an optional path to review and
              execute an order through{" "}
              <strong className="font-mono text-[#171717]">Definitive Flash</strong>{" "}
              — a connected non-custodial execution layer. You review every
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

        {/* Visual: mini trade review card */}
        <div
          className={`transition-all duration-1000 delay-200 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
          aria-label="Sample trade review interface (illustrative)"
          role="img"
        >
          <div className="border border-[#E8DFD1] rounded-sm overflow-hidden max-w-md">
            <div className="bg-[#171717] px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/60 uppercase tracking-widest">// TRADE REVIEW</span>
              </div>
              <span className="text-[9px] font-mono text-[#F62440] border border-[#F62440]/30 px-1.5 py-0.5 rounded-sm">SAMPLE</span>
            </div>

            <div className="p-5 space-y-5">
              {/* Signal ref */}
              <div className="p-3 bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm space-y-1">
                <div className="text-[9px] font-mono text-[#78716C] uppercase tracking-widest">Signal Source</div>
                <div className="text-sm font-bold text-[#171717] font-mono">SOL/USDC · ▲ LONG</div>
                <div className="text-[10px] text-[#78716C]">@ThorneMacro · X · captured Nov 05</div>
              </div>

              {/* Params */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {[
                  { label: "Chain", value: "Base" },
                  { label: "Order type", value: "LIMIT (Flash)" },
                  { label: "Spend", value: "0.05 USDC" },
                  { label: "Limit", value: "$2,400" },
                ].map(({ label, value }) => (
                  <div key={label} className="border border-[#E8DFD1] rounded-sm p-2.5">
                    <div className="text-[9px] text-[#78716C] uppercase tracking-wider mb-0.5">{label}</div>
                    <div className="font-bold text-[#171717]">{value}</div>
                  </div>
                ))}
              </div>

              {/* CTA row */}
              <div className="border-t border-[#E8DFD1] pt-4 space-y-2">
                <button
                  type="button"
                  className="w-full py-2.5 bg-[#171717] text-[#FFFAF3] text-xs font-mono font-bold rounded-sm tracking-wider hover:bg-[#2a2a2a] transition cursor-default"
                  aria-label="Confirm and sign with wallet (illustrative — not functional on this page)"
                  tabIndex={-1}
                >
                  ✓ CONFIRM & SIGN WITH WALLET
                </button>
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

// ─── F. CLOSING + FOOTER ────────────────────────────────────────────────────

function ClosingSection() {
  const { ref, visible } = useReveal(0.1);

  return (
    <footer className="bg-[#171717]" aria-labelledby="closing-heading">
      {/* Closing hero */}
      <div
        ref={ref}
        className="relative py-32 md:py-40 overflow-hidden"
      >
        <div className="absolute inset-0 ledger-dot-grid opacity-10" aria-hidden="true" />

        <div
          className={`relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 text-center space-y-10 transition-all duration-1000 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Wordmark */}
          <div className="flex items-baseline gap-1 justify-center" aria-hidden="true">
            <span className="text-[11px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1.5 py-0.5 rounded-sm">
              CALL
            </span>
            <span className="text-[11px] font-mono font-bold text-white tracking-widest uppercase border border-white/20 px-1.5 py-0.5 rounded-sm">
              LEDGER
            </span>
          </div>

          <h2
            id="closing-heading"
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#FFFAF3] leading-tight"
          >
            The call is public.
            <br />
            <span className="text-[#F62440]">Now so is the record.</span>
          </h2>

          <CtaButton variant="outline" label="Open CallLedger" />
        </div>
      </div>

      {/* Footer nav */}
      <nav
        className="border-t border-white/10 px-6 md:px-12 lg:px-16 py-10"
        aria-label="Footer navigation"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1 py-px rounded-sm">
                CALL
              </span>
              <span className="text-[10px] font-mono font-bold text-white tracking-widest uppercase border border-white/20 px-1 py-px rounded-sm">
                LEDGER
              </span>
            </div>
            <p className="text-[10px] font-mono text-white/30 max-w-xs leading-relaxed">
              Trade call monitoring, signal structuring, and outcome
              tracking. Not investment advice.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[11px] font-mono text-white/40 uppercase tracking-widest">
            {[
              { href: "/", label: "Terminal" },
              { href: "/discover", label: "Discover" },
              { href: "/following", label: "Following" },
              { href: "/trade", label: "Trade" },
              { href: "/strategies", label: "Allocations" },
              { href: "/portfolio", label: "Portfolio" },
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

// ─── Sticky minimal nav for the landing page ────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#FFFAF3]/95 backdrop-blur-sm border-b border-[#E8DFD1] shadow-sm" : "bg-transparent"
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/landing"
          className="flex items-baseline gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717] rounded-sm"
          aria-label="CallLedger home"
        >
          <span className="text-[10px] font-mono font-bold text-[#F62440] tracking-widest uppercase border border-[#F62440]/40 px-1 py-px rounded-sm">
            CALL
          </span>
          <span className="text-[10px] font-mono font-bold text-[#171717] tracking-widest uppercase border border-[#E8DFD1] px-1 py-px rounded-sm">
            LEDGER
          </span>
        </Link>

        {/* Single CTA */}
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

// ─── PAGE ROOT ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-[#171717] focus:text-[#FFFAF3] focus:px-4 focus:py-2 focus:rounded-sm focus:text-sm focus:font-mono"
      >
        Skip to main content
      </a>

      <LandingNav />

      <main id="main-content">
        {/* A. The call */}
        <HeroSection />

        {/* Visual continuity: thin line */}
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8DFD1] to-transparent" aria-hidden="true" />
        </div>

        {/* B. The problem */}
        <ProblemSection />

        {/* C. Structure */}
        <StructureSection />

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="border-t border-[#E8DFD1]" aria-hidden="true" />
        </div>

        {/* D. Follow */}
        <FollowSection />

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
          <div className="border-t border-[#E8DFD1]" aria-hidden="true" />
        </div>

        {/* E. Decide */}
        <DecideSection />
      </main>

      {/* F. Closing + Footer */}
      <ClosingSection />
    </>
  );
}

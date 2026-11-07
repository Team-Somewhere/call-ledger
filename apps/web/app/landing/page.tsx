"use client";

import React from "react";
import { LandingNavbar } from "./components/LandingNavbar";
import { CinematicHero } from "./components/CinematicHero";
import { CardStackProblem } from "./components/CardStackProblem";
import { ProtocolVisualizer } from "./components/ProtocolVisualizer";
import { SignalLedgerTimeline } from "./components/SignalLedgerTimeline";
import { DecideExecution } from "./components/DecideExecution";
import { MinimalFooter } from "./components/MinimalFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFFAF3] text-[#171717] relative selection:bg-[#FFE5BF] selection:text-[#171717]">
      {/* Blueprint Dot Grid */}
      <div className="fixed inset-0 ledger-dot-grid pointer-events-none z-0 opacity-35" aria-hidden="true" />

      {/* Structured Content Track */}
      <div className="relative z-10">
        {/* Minimal Sticky Header */}
        <LandingNavbar />

        {/* Scene 0: Kinetic Parallax Hero */}
        <CinematicHero />

        {/* Scene 1: 3-Layer Sticky Stacking Cards Problem */}
        <CardStackProblem />

        {/* Scene 2: Pinned 4-Phase Protocol Visualizer */}
        <ProtocolVisualizer />

        {/* Scene 3: Pinned Timeline Lock Outcome Ledger */}
        <SignalLedgerTimeline />

        {/* Scene 4: Interactive Sovereign Execution & Card Tilt */}
        <DecideExecution />

        {/* Scene 5: Launchpad Footer with Rotating Words */}
        <MinimalFooter />
      </div>
    </div>
  );
}

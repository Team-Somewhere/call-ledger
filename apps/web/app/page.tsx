"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CreateStrategyModal } from "../components/create-strategy-modal";
import { SignalCard } from "../components/signal-card";
import { MOCK_CREATORS, MOCK_SIGNALS, MockSignal } from "../lib/mock-data";

export default function TerminalPage() {
  const [filter, setFilter] = useState<
    "ALL" | "SIGNALS_ONLY" | "HIGH_CONVICTION"
  >("SIGNALS_ONLY");
  const [feedSearch, setFeedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<MockSignal | null>(null);

  const handleCopy = (signal: MockSignal) => {
    setSelectedSignal(signal);
    setIsModalOpen(true);
  };

  const trendingTickers = [
    { rank: 1, symbol: "$BTC", sentiment: "MIXED", count: "22 CALLS" },
    { rank: 2, symbol: "$ETH", sentiment: "LONG", count: "9 CALLS" },
    { rank: 3, symbol: "$SOL", sentiment: "LONG", count: "7 CALLS" },
    { rank: 4, symbol: "$MSTR", sentiment: "LONG", count: "2 CALLS" },
    { rank: 5, symbol: "$AVAX", sentiment: "SHORT", count: "2 CALLS" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Search the Terminal Bar */}
      <div className="flex flex-col items-center max-w-xl mx-auto space-y-1.5 pb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#78716C]">
          // SEARCH THE TERMINAL
        </span>
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search creators — @handle or name"
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
            className="w-full bg-[#FFFAF3] border border-[#E8DFD1] hover:border-[#171717] focus:border-[#171717] rounded-full pl-10 pr-4 py-2 text-xs font-mono text-[#171717] placeholder-[#78716C] shadow-xs focus:outline-none transition"
          />
        </div>
      </div>

      {/* 3-Column Terminal Layout inspired by KOLLATERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column 1: Left Filter & Terminal Stats (3 cols) */}
        <div className="lg:col-span-3 space-y-5 font-mono">
          <div>
            <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
              // LIVE FEED
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#171717] mt-0.5">
              Terminal
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-[#78716C] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>LIVE • POLLS EVERY 16S</span>
            </div>
          </div>

          {/* Search feed input */}
          <div>
            <div className="text-[10px] uppercase text-[#78716C] mb-1">
              SEARCH FEED
            </div>
            <input
              type="text"
              placeholder="handle, ticker, text"
              className="w-full bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm px-2.5 py-1.5 text-xs text-[#171717] placeholder-[#78716C] focus:outline-none focus:border-[#171717]"
            />
          </div>

          {/* Filter Pills */}
          <div className="space-y-1">
            <div className="text-[10px] uppercase text-[#78716C] mb-1">
              FILTER
            </div>
            <button
              onClick={() => setFilter("ALL")}
              className={`w-full text-left px-3 py-1.5 rounded-sm text-xs font-mono transition ${
                filter === "ALL"
                  ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                  : "text-[#78716C] hover:text-[#171717] hover:bg-[#FFF2DB]/60"
              }`}
            >
              All calls
            </button>
            <button
              onClick={() => setFilter("SIGNALS_ONLY")}
              className={`w-full text-left px-3 py-1.5 rounded-sm text-xs font-mono transition ${
                filter === "SIGNALS_ONLY"
                  ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                  : "text-[#78716C] hover:text-[#171717] hover:bg-[#FFF2DB]/60"
              }`}
            >
              Signals only
            </button>
            <button
              onClick={() => setFilter("HIGH_CONVICTION")}
              className={`w-full text-left px-3 py-1.5 rounded-sm text-xs font-mono transition ${
                filter === "HIGH_CONVICTION"
                  ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                  : "text-[#78716C] hover:text-[#171717] hover:bg-[#FFF2DB]/60"
              }`}
            >
              High conviction
            </button>
          </div>

          {/* Dither Graphic Banner Box */}
          <div className="bg-[#171717] text-[#FFFAF3] p-3 rounded-sm text-[10px] font-mono leading-tight">
            <div className="text-[#FFE5BF] font-bold">
              /// ARKIV ATTESTATION PROOF
            </div>
            <div className="text-slate-400 text-[9px] mt-1">
              Crypto calls indexed with cryptographic verification.
              Retrospective tweet deletions do not alter score.
            </div>
          </div>

          {/* Signal Integrity Stats */}
          <div className="border border-[#E8DFD1] bg-[#FFF2DB]/40 rounded-sm p-3 text-xs space-y-1.5">
            <div className="text-[10px] uppercase text-[#78716C] pb-1 border-b border-[#E8DFD1]">
              SIGNAL INTEGRITY
            </div>
            <div className="flex justify-between">
              <span className="text-[#78716C]">INDEXED</span>
              <span className="font-bold text-[#171717]">245</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#78716C]">ARKIV-VERIFIED</span>
              <span className="font-bold text-[#16A34A]">245</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#78716C]">REAL SIGNALS</span>
              <span className="font-bold text-[#171717]">49</span>
            </div>
          </div>
        </div>

        {/* Column 2: Center Live Calls Feed (6 cols) */}
        <div className="lg:col-span-6 space-y-4 font-mono">
          {/* Feed Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1] text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-[#171717] text-[#FFFAF3] px-2 py-0.5 rounded-sm font-bold text-[10px]">
                0-YAP
              </span>
              <span className="text-[11px] text-[#78716C]">
                POWERED BY ARKIV • STRIP THE NOISE
              </span>
            </div>
            <span className="text-[11px] text-[#78716C]">
              {MOCK_SIGNALS.length} signals
            </span>
          </div>

          {/* Feed Cards */}
          <div className="space-y-4">
            {MOCK_SIGNALS.map((signal) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                onDeployStrategy={handleCopy}
              />
            ))}
          </div>
        </div>

        {/* Column 3: Right Side Widgets (3 cols) */}
        <div className="lg:col-span-3 space-y-5 font-mono">
          {/* WHO TO FADE OR FOLLOW */}
          <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-3">
            <div className="text-[10px] uppercase text-[#78716C] pb-2 border-b border-[#E8DFD1] tracking-wider">
              WHO TO FADE OR FOLLOW
            </div>
            <div className="divide-y divide-[#E8DFD1]/60">
              {MOCK_CREATORS.map((creator) => {
                const isNegative =
                  creator.averageReturn < 0 || creator.winRate < 70;
                return (
                  <Link
                    key={creator.id}
                    href={`/creators/${creator.id}`}
                    className="py-2.5 flex items-center justify-between hover:bg-[#FFF2DB]/40 px-1 rounded transition group"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        className="w-7 h-7 rounded-full object-cover border border-[#E8DFD1] grayscale group-hover:grayscale-0 transition"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#171717] group-hover:underline">
                          {creator.displayName.split(" ")[0]}
                        </div>
                        <div className="text-[10px] text-[#78716C]">
                          @{creator.xUsername}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-bold ${
                        isNegative ? "text-[#F62440]" : "text-[#16A34A]"
                      }`}
                    >
                      {isNegative
                        ? `-${creator.losingSignals * 2.1}%`
                        : `+${creator.averageReturn}%`}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* TRENDING TICKERS */}
          <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-3">
            <div className="text-[10px] uppercase text-[#78716C] pb-2 border-b border-[#E8DFD1] tracking-wider">
              TRENDING TICKERS
            </div>
            <div className="divide-y divide-[#E8DFD1]/60 text-xs">
              {trendingTickers.map((t) => (
                <div
                  key={t.rank}
                  className="py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#78716C] text-[10px]">{t.rank}</span>
                    <span className="font-bold text-[#171717]">{t.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-bold ${
                        t.sentiment === "LONG"
                          ? "text-[#16A34A]"
                          : t.sentiment === "SHORT"
                            ? "text-[#F62440]"
                            : "text-[#78716C]"
                      }`}
                    >
                      {t.sentiment}
                    </span>
                    <span className="text-[10px] text-[#78716C]">
                      {t.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick CTA */}
          <div className="border border-[#E8DFD1] bg-[#FFF2DB]/60 rounded-sm p-3 text-center space-y-2">
            <div className="text-xs font-bold text-[#171717]">
              NEW COPY STRATEGY
            </div>
            <p className="text-[11px] text-[#78716C] font-sans">
              Deploy automated non-custodial copy rules on top ranked traders.
            </p>
            <button
              onClick={() => {
                setSelectedSignal(null);
                setIsModalOpen(true);
              }}
              className="w-full py-1.5 rounded-sm bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold transition"
            >
              + CONFIGURE STRATEGY
            </button>
          </div>
        </div>
      </div>

      <CreateStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCreatorId={selectedSignal?.creatorId}
      />
    </div>
  );
}

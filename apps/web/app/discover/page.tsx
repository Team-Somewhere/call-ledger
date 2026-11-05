"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MOCK_CREATORS } from "../../lib/mock-data";

export default function LeaderboardPage() {
  const [filterMode, setFilterMode] = useState<
    "MOST_RELIABLE" | "MOST_DAMNING" | "MOST_TWO_FACED"
  >("MOST_RELIABLE");
  const [search, setSearch] = useState("");

  const sortedCreators = useMemo(() => {
    return MOCK_CREATORS.filter((c) => {
      return (
        c.displayName.toLowerCase().includes(search.toLowerCase()) ||
        c.xUsername.toLowerCase().includes(search.toLowerCase())
      );
    }).sort((a, b) => {
      if (filterMode === "MOST_DAMNING") {
        return a.winRate - b.winRate; // Lowest first
      }
      return b.winRate - a.winRate; // Highest first
    });
  }, [filterMode, search]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header section matching Screenshot 2 */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // LEADERBOARD
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          The record, ranked.
        </h1>
        <p className="text-xs text-[#78716C] font-sans max-w-xl">
          Every indexed creator, scored on what their calls actually returned a
          follower. No spin, just the ledger.
        </p>
      </div>

      {/* Dithered / Halftone Banner Strip */}
      <div className="w-full bg-[#171717] text-[#FFFAF3] p-4 rounded-sm flex items-center justify-between text-xs">
        <div className="space-y-0.5">
          <div className="text-[10px] text-[#FFE5BF] uppercase tracking-wider font-bold">
            /// HEADLINE P&L AUDIT
          </div>
          <div className="text-xs text-slate-300 font-sans">
            Simulated performance benchmarked at $1,000-per-call return vs
            holding ETH / SOL baseline.
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] text-[#78716C]">
            VERIFIED VIA ARKIV PROTOCOL
          </span>
        </div>
      </div>

      {/* Filter Capsule Pills */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilterMode("MOST_DAMNING")}
            className={`px-3 py-1 rounded-full text-xs font-mono transition ${
              filterMode === "MOST_DAMNING"
                ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                : "border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3]"
            }`}
          >
            MOST DAMNING
          </button>
          <button
            onClick={() => setFilterMode("MOST_RELIABLE")}
            className={`px-3 py-1 rounded-full text-xs font-mono transition ${
              filterMode === "MOST_RELIABLE"
                ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                : "border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3]"
            }`}
          >
            MOST RELIABLE
          </button>
          <button
            onClick={() => setFilterMode("MOST_TWO_FACED")}
            className={`px-3 py-1 rounded-full text-xs font-mono transition ${
              filterMode === "MOST_TWO_FACED"
                ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                : "border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3]"
            }`}
          >
            MOST TWO-FACED
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ranked creators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm pl-8 pr-3 py-1 text-xs text-[#171717] placeholder-[#78716C] focus:outline-none focus:border-[#171717]"
          />
        </div>
      </div>

      {/* Ranked List matching Screenshot 2 */}
      <div className="divide-y divide-[#E8DFD1] border-y border-[#E8DFD1]">
        {sortedCreators.map((creator, idx) => {
          const rankNum = (idx + 1).toString().padStart(2, "0");
          const isDamning = filterMode === "MOST_DAMNING";
          const returnVal = isDamning
            ? `-${creator.losingSignals * 3.4}%`
            : `+${creator.averageReturn}%`;
          const isNegative = returnVal.startsWith("-");

          return (
            <div
              key={creator.id}
              className="py-4 flex items-center justify-between hover:bg-[#FFF2DB]/40 px-2 transition group"
            >
              {/* Left: Rank + Avatar + Name + Sub details */}
              <div className="flex items-center gap-4">
                <span className="text-base font-bold text-[#16A34A] w-6 text-center">
                  {rankNum}
                </span>

                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#E8DFD1] grayscale group-hover:grayscale-0 transition"
                />

                <div>
                  <Link
                    href={`/creators/${creator.id}`}
                    className="font-bold text-sm text-[#171717] hover:underline"
                  >
                    @{creator.xUsername}
                  </Link>
                  <div className="text-[10px] text-[#78716C] tracking-wide mt-0.5">
                    @{creator.xUsername.toUpperCase()} •{" "}
                    {creator.verifiedSignals} SCORED CALLS • WALLET CONTRADICTS
                    0%
                  </div>
                </div>
              </div>

              {/* Right: P&L % + Label */}
              <div className="text-right">
                <div
                  className={`text-xl font-bold font-mono ${
                    isNegative ? "text-[#F62440]" : "text-[#16A34A]"
                  }`}
                >
                  {returnVal}
                </div>
                <div className="text-[9px] text-[#78716C] uppercase tracking-wider">
                  HEADLINE P&amp;L
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

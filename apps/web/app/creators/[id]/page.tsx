"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { CreateStrategyModal } from "../../../components/create-strategy-modal";
import { PerformanceChart } from "../../../components/performance-chart";
import { MOCK_CREATORS, MOCK_SIGNALS } from "../../../lib/mock-data";

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

export default function CreatorProfilePage({ params }: CreatorPageProps) {
  const resolvedParams = use(params);
  const creatorId = resolvedParams.id;

  const creator =
    MOCK_CREATORS.find((c) => c.id === creatorId) || MOCK_CREATORS[0]!;

  const [isModalOpen, setIsModalOpen] = useState(false);

  const isNegative = creator.averageReturn < 0 || creator.winRate < 70;
  const returnString = isNegative
    ? `-${creator.losingSignals * 2.1}%`
    : `+${creator.averageReturn}%`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Back button */}
      <div>
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#171717] transition"
        >
          &lt; BACK TO LEADERBOARD
        </Link>
      </div>

      {/* Header matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3.5">
          <img
            src={creator.avatarUrl}
            alt={creator.displayName}
            className="w-12 h-12 rounded-full object-cover border border-[#E8DFD1] grayscale"
          />
          <div>
            <div className="text-[10px] text-[#78716C] uppercase tracking-widest">
              // DOSSIER
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#171717]">
                @{creator.xUsername}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                  isNegative
                    ? "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30"
                    : "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                }`}
              >
                {returnString} track record
              </span>
            </div>
            <div className="text-[10px] text-[#78716C] space-x-3 mt-1">
              <span>
                {creator.verifiedSignals}/{creator.totalSignals} SCORED
              </span>
              <span>•</span>
              <span>{creator.winRate}% WIN</span>
              <span>•</span>
              <span>0% WALLET CONTRADICTS</span>
              <span>•</span>
              <span>{(creator.totalSignals / 4).toFixed(1)}/WK</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://x.com/${creator.xUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#78716C] hover:text-[#171717] flex items-center gap-1 border border-[#E8DFD1] px-2.5 py-1 rounded-sm bg-[#FFFAF3]"
          >
            VIEW ON X &gt;
          </a>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold bg-[#171717] hover:bg-black text-[#FFFAF3] px-3.5 py-1 rounded-sm transition"
          >
            + COPY CALLS
          </button>
        </div>
      </div>

      {/* Dither Halftone Banner */}
      <div className="w-full bg-[#171717] text-[#FFFAF3] p-3 rounded-sm flex items-center justify-between text-xs">
        <span className="text-[10px] tracking-widest uppercase font-bold text-[#FFE5BF]">
          SEPARATING SIGNAL FROM THE NOISE
        </span>
        <span className="text-[10px] text-slate-400">
          ARKIV IMMUTABLE RECORD #{creator.arkivAttestationKey}
        </span>
      </div>

      {/* Two-Column Verdict and Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-[#E8DFD1] p-5 rounded-sm bg-[#FFFAF3]">
        {/* Left: The Verdict */}
        <div className="space-y-3">
          <div className="text-[10px] text-[#78716C] uppercase tracking-wider">
            // THE VERDICT
          </div>
          <div
            className={`text-5xl font-bold font-mono tracking-tight ${
              isNegative ? "text-[#F62440]" : "text-[#16A34A]"
            }`}
          >
            {returnString}
          </div>
          <div className="text-xs text-[#78716C] font-sans leading-relaxed pt-1">
            $1,000 into every call &rarr;{" "}
            {isNegative
              ? "$-24. Holding ETH instead &rarr; $-12."
              : "+$248. Holding ETH instead &rarr; +$65."}
            <br />
            {creator.verifiedSignals} SETTLED CALLS • {creator.winRate}% WIN
            RATE
          </div>
        </div>

        {/* Right: Metrics & Spread */}
        <div className="space-y-4 text-xs">
          <div>
            <div className="text-[10px] text-[#78716C] uppercase tracking-wider mb-1.5">
              // CUMULATIVE P&amp;L PER CALL
            </div>
            <div className="h-16 border border-[#E8DFD1] bg-[#FFF2DB]/30 rounded-sm p-1">
              <PerformanceChart
                height={55}
                strokeColor={isNegative ? "#F62440" : "#16A34A"}
                fillColor={isNegative ? "#F62440" : "#16A34A"}
                labels={[]}
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#78716C] uppercase tracking-wider mb-1">
              // SIGNAL MIX
            </div>
            <div className="w-full h-2 rounded-xs bg-[#E8DFD1] flex overflow-hidden">
              <div className="bg-[#16A34A] h-full" style={{ width: "65%" }} />
              <div className="bg-[#FFE5BF] h-full" style={{ width: "20%" }} />
              <div className="bg-[#F62440] h-full" style={{ width: "15%" }} />
            </div>
            <div className="flex justify-between text-[9px] text-[#78716C] mt-1">
              <span>■ DIRECTIONAL 65%</span>
              <span>■ TARGET 20%</span>
              <span>■ AMBIGUOUS 15%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row Grid matching Screenshot 4 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 border border-[#E8DFD1] rounded-sm divide-y sm:divide-y-0 sm:divide-x divide-[#E8DFD1] bg-[#FFF2DB]/30 text-center">
        <div className="p-3">
          <div className="text-[9px] text-[#78716C] uppercase">WIN RATE</div>
          <div className="text-base font-bold text-[#171717] mt-1">
            {creator.winRate}%
          </div>
        </div>
        <div className="p-3">
          <div className="text-[9px] text-[#78716C] uppercase">SETTLED</div>
          <div className="text-base font-bold text-[#171717] mt-1">
            {creator.verifiedSignals}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[9px] text-[#78716C] uppercase">
            SCORED / TOTAL
          </div>
          <div className="text-base font-bold text-[#171717] mt-1">
            {creator.verifiedSignals}/{creator.totalSignals}
          </div>
        </div>
        <div className="p-3">
          <div className="text-[9px] text-[#78716C] uppercase">
            WALLET CONTRADICTS
          </div>
          <div className="text-base font-bold text-[#171717] mt-1">0%</div>
        </div>
        <div className="p-3">
          <div className="text-[9px] text-[#78716C] uppercase">CADENCE</div>
          <div className="text-base font-bold text-[#171717] mt-1">
            {(creator.totalSignals / 3).toFixed(1)}/wk
          </div>
        </div>
      </div>

      {/* Equity Curve Chart Section matching Screenshot 4 */}
      <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-[#E8DFD1]">
          <span className="text-[10px] text-[#78716C] uppercase">
            // EQUITY CURVE • $1,000 PER CALL VS HOLDING ETH
          </span>
          <span className="text-[10px] text-[#78716C]">
            PRICING VIA ARKIV ORACLES
          </span>
        </div>
        <PerformanceChart
          height={200}
          strokeColor={isNegative ? "#F62440" : "#16A34A"}
          fillColor={isNegative ? "#F62440" : "#16A34A"}
        />
      </div>

      <CreateStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCreatorId={creator.id}
      />
    </div>
  );
}

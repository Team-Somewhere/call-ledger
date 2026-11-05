"use client";

import React, { useState } from "react";
import { ArrowUpRight, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { type MockSignal } from "../lib/mock-data";

export interface SignalCardProps {
  signal: MockSignal;
  onDeployStrategy?: (signal: MockSignal) => void;
}

export function SignalCard({ signal, onDeployStrategy }: SignalCardProps) {
  const [faded, setFaded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isBuy = signal.direction === "BUY";

  return (
    <div className="bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm p-4 text-xs font-mono transition hover:border-[#171717] flex flex-col justify-between">
      <div>
        {/* Creator Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#E8DFD1]">
          <div className="flex items-center gap-2">
            <img
              src={signal.creatorAvatar}
              alt={signal.creatorName}
              className="w-6 h-6 rounded-full object-cover border border-[#E8DFD1] grayscale"
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[#171717]">
                {signal.creatorName}
              </span>
              <span className="text-[#78716C] text-[11px]">
                @{signal.creatorHandle}
              </span>
              <span className="text-[#78716C] text-[10px]">• 4h</span>
            </div>
          </div>
          <span className="text-[10px] text-[#78716C] hover:text-[#171717] cursor-pointer">
            ORIGINAL CALL &gt;
          </span>
        </div>

        {/* Signal Body / Content */}
        <div className="mt-3 text-xs text-[#171717] font-sans leading-relaxed">
          High conviction liquidity expansion on{" "}
          <strong className="font-mono">{signal.assetPair}</strong>. Entry
          target: ${signal.entryPrice}, TP: ${signal.takeProfit}, SL: $
          {signal.stopLoss}.
        </div>

        {/* Tag Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/60 text-[#78716C]">
            PRICE TARGET ${signal.takeProfit}
          </span>
          <span
            className={`px-2 py-0.5 rounded-sm border font-bold ${
              isBuy
                ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                : "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30"
            }`}
          >
            {signal.assetSymbol} {isBuy ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span className="px-2 py-0.5 rounded-sm border border-[#E8DFD1] bg-[#FFF2DB]/60 text-[#78716C]">
            {signal.confidence}% CONFIDENCE
          </span>
        </div>

        {/* Resolution Bar */}
        <div className="mt-3 pt-2 border-t border-[#E8DFD1] flex items-center justify-between text-[10px] text-[#78716C]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            RESOLUTION: 14d window
          </span>
          <span className="font-mono text-[#171717]">R:R 1:2.4</span>
        </div>

        {/* Arkiv Verification Proof Tag */}
        <div className="mt-2 p-1.5 rounded-sm border border-[#16A34A]/30 bg-[#16A34A]/5 flex items-center justify-between text-[10px] text-[#16A34A]">
          <span className="flex items-center gap-1 font-mono">
            <ShieldCheck className="w-3 h-3" />
            ARKIV-VERIFIED • {signal.arkivRecordKey || "ark-sig-990-sol"}
          </span>
          <span className="underline hover:no-underline cursor-pointer">
            proof &gt;
          </span>
        </div>
      </div>

      {/* Action Buttons: Follow / Copy vs Fade */}
      <div className="mt-4 pt-2.5 border-t border-[#E8DFD1] grid grid-cols-2 gap-2 text-xs font-mono">
        <button
          onClick={() => {
            setCopied(!copied);
            onDeployStrategy?.(signal);
          }}
          className={`py-1.5 px-3 rounded-sm border font-medium flex items-center justify-center gap-1 transition ${
            copied
              ? "bg-[#171717] text-[#FFFAF3] border-[#171717]"
              : "bg-[#FFFAF3] text-[#171717] border-[#E8DFD1] hover:border-[#171717]"
          }`}
        >
          {copied ? <Check className="w-3 h-3 text-[#16A34A]" /> : null}
          <span>▲ COPY CALL</span>
        </button>

        <button
          onClick={() => setFaded(!faded)}
          className={`py-1.5 px-3 rounded-sm border font-medium flex items-center justify-center gap-1 transition ${
            faded
              ? "bg-[#F62440] text-white border-[#F62440]"
              : "bg-[#FFFAF3] text-[#78716C] border-[#E8DFD1] hover:border-[#F62440] hover:text-[#F62440]"
          }`}
        >
          <span>▼ FADE</span>
        </button>
      </div>
    </div>
  );
}

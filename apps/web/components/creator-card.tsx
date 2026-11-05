"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck, UserPlus } from "lucide-react";
import { type MockCreator } from "../lib/mock-data";
import { StatusBadge } from "./status-badge";

export interface CreatorCardProps {
  creator: MockCreator;
}

export function CreatorCard({ creator }: CreatorCardProps) {
  const [isFollowed, setIsFollowed] = useState(creator.isFollowed ?? false);

  const toggleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFollowed(!isFollowed);
  };

  return (
    <div className="bg-[#FFF2DB]/40 border border-[#E8DFD1] hover:border-[#171717] rounded-sm p-4 flex flex-col justify-between transition group">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={creator.avatarUrl}
              alt={creator.displayName}
              className="w-10 h-10 rounded-full object-cover border border-[#E8DFD1] shrink-0 grayscale group-hover:grayscale-0 transition"
            />
            <div>
              <Link
                href={`/creators/${creator.id}`}
                className="font-bold text-sm text-[#171717] hover:underline transition flex items-center gap-1.5"
              >
                {creator.displayName}
              </Link>
              <div className="text-xs text-[#78716C] font-mono">
                @{creator.xUsername}
              </div>
            </div>
          </div>
          <StatusBadge status={creator.status} />
        </div>

        {/* Bio */}
        <p className="mt-2.5 text-xs text-[#78716C] line-clamp-2 leading-relaxed font-sans">
          {creator.bio}
        </p>

        {/* Metrics Grid */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 py-2 px-2.5 rounded-sm bg-[#FFFAF3] border border-[#E8DFD1] text-center font-mono">
          <div>
            <div className="text-[9px] text-[#78716C] uppercase tracking-wider">
              Win Rate
            </div>
            <div className="text-sm font-bold text-[#16A34A] mt-0.5">
              {creator.winRate}%
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#78716C] uppercase tracking-wider">
              Calls
            </div>
            <div className="text-sm font-bold text-[#171717] mt-0.5">
              {creator.verifiedSignals}/{creator.totalSignals}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#78716C] uppercase tracking-wider">
              Avg Return
            </div>
            <div className="text-sm font-bold text-[#16A34A] mt-0.5">
              +{creator.averageReturn}%
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-3.5 pt-2.5 border-t border-[#E8DFD1] flex items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1 text-[10px] text-[#78716C]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
          <span className="truncate max-w-[110px]">
            {creator.arkivAttestationKey}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleFollow}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-mono font-medium border transition ${
              isFollowed
                ? "bg-[#171717] text-[#FFFAF3] border-[#171717]"
                : "bg-[#FFFAF3] text-[#171717] border-[#E8DFD1] hover:border-[#171717]"
            }`}
          >
            {isFollowed ? "FOLLOWING" : "+ FOLLOW"}
          </button>
          <Link
            href={`/creators/${creator.id}`}
            className="px-2 py-1 rounded-sm text-[11px] font-mono text-[#78716C] hover:text-[#171717] border border-[#E8DFD1] hover:border-[#171717] bg-[#FFFAF3] transition"
          >
            DOSSIER &gt;
          </Link>
        </div>
      </div>
    </div>
  );
}

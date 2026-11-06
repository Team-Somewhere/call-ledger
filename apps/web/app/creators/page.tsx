"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { api, type CreatorListItem } from "../../lib/api";
import { EmptyState } from "../../components/empty-state";
import { MonitoringStatusBadge, SourceBadge } from "../../components/source-badge";

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.listCreators("?limit=100");
      setCreators(data);
    } catch {
      setError("Could not load creators.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      <div className="space-y-1">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // GLOBAL CREATOR DIRECTORY
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Creators
        </h1>
        <p className="text-xs text-[#78716C] font-sans max-w-xl">
          Every creator is a single global record on CallLedger. Multiple users
          can follow the same creator without duplicating it.
        </p>
      </div>

      {error && (
        <div className="text-xs p-2.5 rounded-sm border bg-[#F62440]/10 border-[#F62440]/30 text-[#F62440]">
          {error}
        </div>
      )}

      {creators === null && !error && (
        <div className="py-10 flex items-center justify-center text-xs text-[#78716C] gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading creators…
        </div>
      )}

      {creators && creators.length === 0 && (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No creators yet"
          description="Add creators from the Discover page to build your directory."
          action={
            <Link
              href="/discover"
              className="px-4 py-2 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-sm transition"
            >
              Discover creators
            </Link>
          }
        />
      )}

      <div className="border-y border-[#E8DFD1] divide-y divide-[#E8DFD1]">
        {creators?.map((creator) => (
          <div
            key={creator.id}
            className="py-3 px-1 flex items-center justify-between hover:bg-[#FFF2DB]/40 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#E8DFD1]"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-xs text-[#78716C] font-bold">
                  {creator.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link
                  href={`/creators/${creator.id}`}
                  className="font-bold text-sm text-[#171717] hover:underline truncate block"
                >
                  {creator.displayName}
                </Link>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {creator.sources.map((source) => (
                    <span key={source.id} className="flex items-center gap-1.5">
                      <SourceBadge sourceType={source.sourceType} />
                      <MonitoringStatusBadge
                        status={source.status}
                        className="!text-[9px]"
                      />
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link
              href={`/creators/${creator.id}`}
              className="text-xs border border-[#E8DFD1] hover:border-[#171717] px-3 py-1 rounded-sm bg-[#FFFAF3] text-[#171717] transition shrink-0 ml-3"
            >
              VIEW PROFILE &gt;
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

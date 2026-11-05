"use client";

import React, { useState } from "react";
import { MOCK_ACTIVITIES } from "../../lib/mock-data";

export default function ActivityPage() {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredActivities =
    filter === "ALL"
      ? MOCK_ACTIVITIES
      : MOCK_ACTIVITIES.filter((a) => a.type === filter);

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono">
      {/* Header */}
      <div className="space-y-1.5 pb-2 border-b border-[#E8DFD1]">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // AUDIT TRAIL
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Activity Ledger
        </h1>
        <p className="text-xs text-[#78716C] font-sans">
          Immutable event stream of signal ingests, strategy evaluations, and
          on-chain Arkiv confirmations.
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {["ALL", "SIGNAL", "STRATEGY", "ORDER", "VERIFICATION", "FOLLOW"].map(
          (item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition ${
                filter === item
                  ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                  : "border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3]"
              }`}
            >
              {item}
            </button>
          ),
        )}
      </div>

      {/* Events List */}
      <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm divide-y divide-[#E8DFD1]">
        {filteredActivities.map((act) => (
          <div
            key={act.id}
            className="p-4 flex items-start justify-between gap-4 hover:bg-[#FFF2DB]/40 transition"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#171717]" />
                <span className="font-bold text-xs text-[#171717]">
                  {act.title}
                </span>
                {act.badge && (
                  <span className="px-1.5 py-0.2 rounded-sm bg-[#FFE5BF] text-[9px] text-[#171717]">
                    {act.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#78716C] font-sans pl-3.5 leading-relaxed">
                {act.description}
              </p>
            </div>
            <span className="text-[10px] text-[#78716C] whitespace-nowrap">
              {act.timestamp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

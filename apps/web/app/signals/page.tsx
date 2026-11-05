"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CreateStrategyModal } from "../../components/create-strategy-modal";
import { SignalCard } from "../../components/signal-card";
import { MOCK_SIGNALS, MockSignal } from "../../lib/mock-data";

export default function SignalsPage() {
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<
    "ALL" | "BUY" | "SELL"
  >("ALL");
  const [selectedSignal, setSelectedSignal] = useState<MockSignal | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDeploy = (signal: MockSignal) => {
    setSelectedSignal(signal);
    setIsModalOpen(true);
  };

  const filteredSignals = useMemo(() => {
    return MOCK_SIGNALS.filter((s) => {
      const matchesSearch =
        s.assetPair.toLowerCase().includes(search.toLowerCase()) ||
        s.creatorName.toLowerCase().includes(search.toLowerCase()) ||
        s.creatorHandle.toLowerCase().includes(search.toLowerCase());

      const matchesDirection =
        directionFilter === "ALL" || s.direction === directionFilter;
      return matchesSearch && matchesDirection;
    });
  }, [search, directionFilter]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="space-y-1.5 pb-2 border-b border-[#E8DFD1]">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // LIVE FEED
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Verified Signals
        </h1>
        <p className="text-xs text-[#78716C] font-sans">
          Trade calls parsed in real-time from verified traders on X and
          anchored on Arkiv.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Direction Tabs */}
        <div className="flex items-center gap-1.5">
          {(["ALL", "BUY", "SELL"] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition ${
                directionFilter === dir
                  ? "bg-[#171717] text-[#FFFAF3] font-semibold"
                  : "border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFFAF3]"
              }`}
            >
              {dir === "ALL"
                ? "ALL SIDES"
                : dir === "BUY"
                  ? "▲ LONG ONLY"
                  : "▼ SHORT ONLY"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search token pair ($SOL, $ETH)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm pl-8 pr-3 py-1 text-xs text-[#171717] placeholder-[#78716C] focus:outline-none focus:border-[#171717]"
          />
        </div>
      </div>

      {/* Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSignals.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            onDeployStrategy={handleDeploy}
          />
        ))}
      </div>

      <CreateStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCreatorId={selectedSignal?.creatorId}
      />
    </div>
  );
}

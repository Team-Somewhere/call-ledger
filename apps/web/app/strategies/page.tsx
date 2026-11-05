"use client";

import React, { useState } from "react";
import { Pause, Play, Plus } from "lucide-react";
import { CreateStrategyModal } from "../../components/create-strategy-modal";
import { MOCK_STRATEGIES, MockStrategy } from "../../lib/mock-data";
import { formatCurrency } from "../../lib/utils";

export default function AllocationsPage() {
  const [strategies, setStrategies] = useState<MockStrategy[]>(MOCK_STRATEGIES);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleStatus = (id: string) => {
    setStrategies((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }
          : s,
      ),
    );
  };

  const handleStrategyCreated = (newStrat: any) => {
    setStrategies([newStrat, ...strategies]);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1]">
        <div>
          <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
            // AUTOMATION
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Allocations
          </h1>
          <p className="text-xs text-[#78716C] font-sans mt-0.5">
            Active rules for replicating verified signals into Definitive Flash
            trade orders.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 rounded-sm bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold transition flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>NEW ALLOCATION</span>
        </button>
      </div>

      {/* Strategy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strat) => (
          <div
            key={strat.id}
            className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-3 hover:border-[#171717] transition"
          >
            {/* Top row */}
            <div className="flex items-start justify-between pb-2 border-b border-[#E8DFD1]">
              <div>
                <h3 className="font-bold text-sm text-[#171717]">
                  {strat.name}
                </h3>
                <div className="text-[11px] text-[#78716C] mt-0.5">
                  TARGET: @{strat.creatorHandle}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase border ${
                  strat.status === "ACTIVE"
                    ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
                    : "bg-[#FFE5BF] text-[#78716C] border-[#E8DFD1]"
                }`}
              >
                {strat.status}
              </span>
            </div>

            {/* Rules Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-[#FFF2DB]/40 p-2.5 rounded-sm border border-[#E8DFD1]">
              <div>
                <div className="text-[9px] text-[#78716C] uppercase">
                  Max Trade
                </div>
                <div className="font-bold text-[#171717] mt-0.5">
                  {formatCurrency(strat.maxTradeAmount)}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-[#78716C] uppercase">
                  Execution
                </div>
                <div className="font-bold text-[#171717] mt-0.5">
                  {strat.executionMode}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-[#78716C] uppercase">
                  Stop / Profit
                </div>
                <div className="font-bold text-[#171717] mt-0.5">
                  SL {strat.stopLossPercentage}% / TP{" "}
                  {strat.takeProfitPercentage}%
                </div>
              </div>
              <div>
                <div className="text-[9px] text-[#78716C] uppercase">
                  Min Win Rate
                </div>
                <div className="font-bold text-[#171717] mt-0.5">
                  &ge; {strat.minCreatorWinRate}%
                </div>
              </div>
            </div>

            {/* Return stats */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[#78716C] text-[11px]">
                Simulated Net P&amp;L:
              </span>
              <span className="font-bold text-[#16A34A]">
                +{formatCurrency(strat.totalPnl)} (+{strat.pnlPercentage}%)
              </span>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-[#E8DFD1] flex items-center justify-between text-xs">
              <button
                onClick={() => toggleStatus(strat.id)}
                className="px-2.5 py-1 rounded-sm border border-[#E8DFD1] hover:border-[#171717] text-[11px] text-[#78716C] hover:text-[#171717] flex items-center gap-1 transition"
              >
                {strat.status === "ACTIVE" ? (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 text-[#16A34A]" />
                    <span>RESUME</span>
                  </>
                )}
              </button>
              <span className="text-[10px] text-[#78716C]">
                {strat.totalTradesExecuted} EXECUTION FILLS
              </span>
            </div>
          </div>
        ))}
      </div>

      <CreateStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleStrategyCreated}
      />
    </div>
  );
}

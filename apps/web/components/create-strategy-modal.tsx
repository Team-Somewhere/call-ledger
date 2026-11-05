"use client";

import React, { useState } from "react";
import { CheckCircle2, Shield, X, Zap } from "lucide-react";
import { MOCK_CREATORS } from "../lib/mock-data";

export interface CreateStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCreatorId?: string;
  onCreated?: (strategyData: Record<string, unknown>) => void;
}

export function CreateStrategyModal({
  isOpen,
  onClose,
  defaultCreatorId,
  onCreated,
}: CreateStrategyModalProps) {
  const [creatorId, setCreatorId] = useState(
    defaultCreatorId || MOCK_CREATORS[0]?.id || "",
  );
  const [name, setName] = useState("");
  const [executionMode, setExecutionMode] = useState<"MANUAL" | "AUTOMATED">(
    "MANUAL",
  );
  const [maxTradeAmount, setMaxTradeAmount] = useState("1500");
  const [maxDailyTrades, setMaxDailyTrades] = useState("3");
  const [minWinRate, setMinWinRate] = useState("70");
  const [stopLoss, setStopLoss] = useState("5.0");
  const [takeProfit, setTakeProfit] = useState("15.0");
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCreator = MOCK_CREATORS.find((c) => c.id === creatorId);

    const newStrategy = {
      id: `strat-${Date.now()}`,
      creatorId,
      creatorName: selectedCreator?.displayName || "Unknown Creator",
      creatorHandle: selectedCreator?.xUsername || "unknown",
      name:
        name || `${selectedCreator?.displayName || "Creator"} Copy Strategy`,
      executionMode,
      maxTradeAmount: parseFloat(maxTradeAmount) || 1000,
      maxDailyTrades: parseInt(maxDailyTrades, 10) || 3,
      minCreatorWinRate: parseFloat(minWinRate) || 70,
      stopLossPercentage: parseFloat(stopLoss) || 5,
      takeProfitPercentage: parseFloat(takeProfit) || 15,
      status: "ACTIVE",
      totalTradesExecuted: 0,
      totalPnl: 0,
      pnlPercentage: 0,
      createdAt: new Date().toISOString(),
    };

    setIsSuccess(true);
    setTimeout(() => {
      onCreated?.(newStrategy);
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-mono">
      <div className="relative w-full max-w-lg bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm shadow-xl p-6 text-[#171717]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-sm text-[#78716C] hover:text-[#171717] hover:bg-[#FFF2DB] transition"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-[#16A34A]" />
            <h3 className="text-base font-bold text-[#171717]">
              ALLOCATION STRATEGY CREATED
            </h3>
            <p className="text-xs text-[#78716C] max-w-xs font-sans">
              Rules locked in. Non-custodial Definitive Flash order triggers are
              active.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <div className="text-[10px] text-[#78716C] uppercase tracking-wider">
                // NEW ALLOCATION
              </div>
              <h2 className="text-base font-bold text-[#171717] mt-0.5">
                Configure Copy-Trading Rules
              </h2>
            </div>

            {/* Creator Selection */}
            <div>
              <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                Target Creator
              </label>
              <select
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
              >
                {MOCK_CREATORS.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.displayName} (@{creator.xUsername}) —{" "}
                    {creator.winRate}% Win Rate
                  </option>
                ))}
              </select>
            </div>

            {/* Strategy Name */}
            <div>
              <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                Strategy Name
              </label>
              <input
                type="text"
                placeholder="e.g. SOL Trend Replicator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
              />
            </div>

            {/* Execution Mode */}
            <div>
              <label className="block text-[11px] text-[#78716C] uppercase mb-1.5">
                Execution Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExecutionMode("MANUAL")}
                  className={`p-2.5 rounded-sm border text-left transition ${
                    executionMode === "MANUAL"
                      ? "bg-[#171717] text-[#FFFAF3] border-[#171717]"
                      : "bg-[#FFF2DB]/50 border-[#E8DFD1] text-[#78716C] hover:border-[#171717]"
                  }`}
                >
                  <div className="font-bold text-xs">Manual Sign</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Prompt on every call
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionMode("AUTOMATED")}
                  className={`p-2.5 rounded-sm border text-left transition ${
                    executionMode === "AUTOMATED"
                      ? "bg-[#171717] text-[#FFFAF3] border-[#171717]"
                      : "bg-[#FFF2DB]/50 border-[#E8DFD1] text-[#78716C] hover:border-[#171717]"
                  }`}
                >
                  <div className="font-bold text-xs">Automated Flash</div>
                  <div className="text-[10px] opacity-80 mt-0.5">
                    Instant Definitive swap
                  </div>
                </button>
              </div>
            </div>

            {/* Risk & Sizing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                  Max Trade Allocation (USD)
                </label>
                <input
                  type="number"
                  value={maxTradeAmount}
                  onChange={(e) => setMaxTradeAmount(e.target.value)}
                  className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                  Daily Trade Cap
                </label>
                <input
                  type="number"
                  value={maxDailyTrades}
                  onChange={(e) => setMaxDailyTrades(e.target.value)}
                  className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#78716C] uppercase mb-1">
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="w-full bg-[#FFF2DB]/60 border border-[#E8DFD1] rounded-sm px-3 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#171717]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8DFD1] flex items-center justify-between">
              <span className="text-[10px] text-[#78716C] flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#16A34A]" />
                Arkiv cryptographic audit required
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-sm border border-[#E8DFD1] text-[#78716C] hover:text-[#171717] text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-sm bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold transition"
                >
                  DEPLOY STRATEGY
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

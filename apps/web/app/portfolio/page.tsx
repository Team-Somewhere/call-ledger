"use client";

import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import { DataTable } from "../../components/data-table";
import { PerformanceChart } from "../../components/performance-chart";
import { MOCK_ORDERS, MOCK_POSITIONS } from "../../lib/mock-data";

export default function PortfolioPage() {
  const [positions, setPositions] = useState(MOCK_POSITIONS);

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header matching Screenshot 3 */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1]">
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Portfolio
        </h1>
        <button
          onClick={() => {}}
          className="flex items-center gap-1.5 px-3 py-1 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] hover:border-[#171717] text-xs font-mono text-[#78716C] hover:text-[#171717] transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>REFRESH</span>
        </button>
      </div>

      {/* Metric Boxes Grid matching Screenshot 3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-0 border border-[#E8DFD1] rounded-sm divide-y md:divide-y-0 md:divide-x divide-[#E8DFD1] bg-[#FFF2DB]/30">
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            NET P&amp;L
          </div>
          <div className="text-2xl font-bold text-[#16A34A]">+$18,320.15</div>
          <div className="text-[10px] text-[#78716C]">+17.2% SIMULATED</div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            WIN RATE
          </div>
          <div className="text-2xl font-bold text-[#171717]">78.4%</div>
          <div className="text-[10px] text-[#78716C]">31 WINS • 7 LOSSES</div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            USDC DEPLOYED
          </div>
          <div className="text-2xl font-bold text-[#171717]">12,840.00</div>
          <div className="text-[10px] text-[#78716C]">
            REAL ON-CHAIN • EXECUTED ONLY
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-0 border border-[#E8DFD1] rounded-sm divide-y md:divide-y-0 md:divide-x divide-[#E8DFD1] bg-[#FFF2DB]/30 -mt-6">
        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            TRADES EXECUTED
          </div>
          <div className="text-2xl font-bold text-[#171717]">43</div>
          <div className="text-[10px] text-[#78716C]">OF 45 • 2 FAILED</div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            COPY / FADE
          </div>
          <div className="text-2xl font-bold text-[#16A34A]">
            38 <span className="text-[#78716C]">/</span>{" "}
            <span className="text-[#F62440]">5</span>
          </div>
          <div className="w-full h-1.5 bg-[#E8DFD1] rounded-xs overflow-hidden flex">
            <div className="bg-[#16A34A] h-full" style={{ width: "88%" }} />
            <div className="bg-[#F62440] h-full" style={{ width: "12%" }} />
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
            BEST / WORST
          </div>
          <div className="text-lg font-bold text-[#171717]">
            <span className="text-[#16A34A]">+28.5%</span> /{" "}
            <span className="text-[#F62440]">-6.5%</span>
          </div>
          <div className="text-[10px] text-[#78716C]">
            SOL SWING / AVAX HEDGE
          </div>
        </div>
      </div>

      {/* Capital Deployed Over Time Chart matching Screenshot 3 */}
      <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-2">
        <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
          // CAPITAL DEPLOYED OVER TIME
        </div>
        <PerformanceChart
          height={180}
          strokeColor="#171717"
          fillColor="#FFE5BF"
          data={[10, 20, 20, 45, 45, 80, 80, 110, 140, 140, 195]}
          labels={["start", "20 Jul", "22 Jul", "24 Jul", "26 Jul", "today"]}
        />
        <div className="text-center text-[10px] text-[#78716C] uppercase pt-1">
          EARLY HISTORY • TREND FILLS IN WITH MORE FILLS
        </div>
      </div>

      {/* Open Positions Table */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
          // OPEN POSITIONS ({positions.length})
        </div>
        <DataTable
          columns={[
            {
              header: "ASSET PAIR",
              cell: (row) => (
                <span className="font-bold text-[#171717]">
                  {row.assetPair}{" "}
                  <span className="text-[10px] font-normal text-[#78716C]">
                    ({row.chain})
                  </span>
                </span>
              ),
            },
            {
              header: "HOLDING",
              cell: (row) => `${row.quantity} ${row.assetSymbol}`,
            },
            {
              header: "ENTRY",
              cell: (row) => `$${row.averageEntryPrice}`,
            },
            {
              header: "CURRENT",
              cell: (row) => `$${row.currentPrice}`,
            },
            {
              header: "UNREALIZED P&L",
              cell: (row) => (
                <span className="text-[#16A34A] font-bold">
                  +${row.unrealizedPnl} (+{row.unrealizedPnlPercent}%)
                </span>
              ),
            },
            {
              header: "STATUS",
              cell: (row) => (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30 text-[10px]">
                  {row.status}
                </span>
              ),
            },
          ]}
          data={positions}
        />
      </div>

      {/* Definitive Execution Log */}
      <div className="space-y-2 pt-2">
        <div className="text-[10px] uppercase text-[#78716C] tracking-wider">
          // DEFINITIVE ORDER LEDGER
        </div>
        <DataTable
          columns={[
            { header: "TIME", cell: (row) => row.timestamp },
            {
              header: "MARKET",
              cell: (row) => <span className="font-bold">{row.assetPair}</span>,
            },
            {
              header: "SIDE",
              cell: (row) => (
                <span
                  className={`font-bold ${row.direction === "BUY" ? "text-[#16A34A]" : "text-[#F62440]"}`}
                >
                  {row.direction}
                </span>
              ),
            },
            { header: "ROUTING", cell: (row) => row.provider },
            { header: "INPUT", cell: (row) => row.inputAmount },
            {
              header: "OUTPUT",
              cell: (row) => (
                <span className="text-[#16A34A]">{row.outputAmount}</span>
              ),
            },
            {
              header: "STATE",
              cell: (row) => (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#171717] text-[#FFFAF3] text-[9px] uppercase">
                  {row.status}
                </span>
              ),
            },
          ]}
          data={MOCK_ORDERS}
        />
      </div>
    </div>
  );
}

import React from "react";
import { AlertCircle } from "lucide-react";

export function MockBanner() {
  return (
    <div className="bg-[#FFF2DB]/70 border-b border-[#E8DFD1] px-4 md:px-8 py-1.5 text-[11px] text-[#78716C] flex items-center justify-between gap-4 font-mono">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F62440] inline-block shrink-0" />
        <span className="truncate">
          <strong className="text-[#171717] font-semibold">
            // PHASE 1 SIMULATION:
          </strong>{" "}
          Displaying indexed mock signals, creator scores, and Arkiv
          attestations. Non-custodial trading engine.
        </span>
      </div>
      <span className="hidden md:inline-block shrink-0 text-[10px] text-[#171717]">
        INDEX PROTOCOL v0.1.0
      </span>
    </div>
  );
}

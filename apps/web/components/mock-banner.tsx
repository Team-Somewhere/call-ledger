import React from "react";
import { AlertCircle } from "lucide-react";

export function MockBanner() {
  return (
    <div className="bg-[#FFF2DB]/80 border-b border-[#E8DFD1] px-4 md:px-8 py-1.5 text-xs text-[#78716C] flex items-center justify-between font-mono">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F62440] inline-block animate-pulse" />
        <span>
          <strong className="text-[#171717] font-semibold">
            // PHASE 1 SIMULATION:
          </strong>{" "}
          Displaying indexed mock signals, creator scores, and Arkiv
          attestations. Non-custodial trading engine.
        </span>
      </div>
      <span className="hidden md:inline-block px-1.5 py-0.2 rounded-sm bg-[#FFE5BF] text-[10px] text-[#171717]">
        INDEX PROTOCOL v0.1.0
      </span>
    </div>
  );
}

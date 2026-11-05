import React from "react";
import { cn } from "../lib/utils";

export interface StatusBadgeProps {
  status: string;
  variant?: "status" | "direction" | "verification" | "mode";
  className?: string;
}

export function StatusBadge({
  status,
  variant = "status",
  className,
}: StatusBadgeProps) {
  let badgeStyle = "bg-[#FFF2DB] text-[#171717] border-[#E8DFD1]";

  if (variant === "direction") {
    if (status === "BUY" || status === "LONG") {
      badgeStyle =
        "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30 font-bold";
    } else {
      badgeStyle =
        "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30 font-bold";
    }
  } else if (variant === "verification") {
    if (status === "VERIFIED") {
      badgeStyle =
        "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30 font-medium";
    } else if (status === "PENDING") {
      badgeStyle = "bg-[#FFE5BF] text-[#78716C] border-[#E8DFD1]";
    } else {
      badgeStyle = "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30";
    }
  } else if (variant === "mode") {
    if (status === "AUTOMATED") {
      badgeStyle = "bg-[#171717] text-[#FFFAF3] border-[#171717] font-medium";
    } else {
      badgeStyle = "bg-[#FFF2DB] text-[#78716C] border-[#E8DFD1]";
    }
  } else {
    // General status
    switch (status) {
      case "QUALIFIED":
      case "ACTIVE":
      case "FILLED":
      case "OPEN":
        badgeStyle = "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30";
        break;
      case "MONITORING":
      case "PENDING":
      case "PAUSED":
        badgeStyle = "bg-[#FFE5BF] text-[#78716C] border-[#E8DFD1]";
        break;
      case "CANCELLED":
      case "FAILED":
      case "CLOSED":
      case "REJECTED":
        badgeStyle = "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30";
        break;
      default:
        badgeStyle = "bg-[#FFF2DB] text-[#78716C] border-[#E8DFD1]";
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono border uppercase tracking-wider",
        badgeStyle,
        className,
      )}
    >
      {status}
    </span>
  );
}

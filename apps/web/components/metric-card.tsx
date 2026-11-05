import React, { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../lib/utils";

export interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  change,
  icon,
  trend,
  className,
}: MetricCardProps) {
  const isPositive = change !== undefined ? change >= 0 : trend === "up";

  return (
    <div
      className={cn(
        "bg-[#FFF2DB]/40 border border-[#E8DFD1] rounded-sm p-4 flex flex-col justify-between transition hover:border-[#171717]",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[#78716C] text-[11px] font-mono uppercase tracking-wider">
        <span>// {label}</span>
        {icon && <div className="text-[#171717]">{icon}</div>}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-[#171717] font-mono">
          {value}
        </div>
        {(subValue || change !== undefined) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs font-mono">
            {change !== undefined && (
              <span
                className={cn(
                  "flex items-center font-bold",
                  isPositive ? "text-[#16A34A]" : "text-[#F62440]",
                )}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5 inline" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5 inline" />
                )}
                {change > 0 ? `+${change}%` : `${change}%`}
              </span>
            )}
            {subValue && (
              <span className="text-[#78716C] text-[11px]">{subValue}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

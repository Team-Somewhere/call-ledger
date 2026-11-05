import React, { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded-sm border border-dashed border-[#E8DFD1] bg-[#FFF2DB]/30 font-mono",
        className,
      )}
    >
      {icon && <div className="p-3 mb-2 text-[#78716C]">{icon}</div>}
      <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[#78716C] font-sans max-w-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

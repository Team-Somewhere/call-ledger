import React from "react";
import { Globe, Hash, MessagesSquare, Radio } from "lucide-react";
import { cn } from "../lib/utils";
import type { SourceSummary } from "../lib/api";

const CONFIG: Record<
  SourceSummary["sourceType"],
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  X: { label: "X", Icon: Hash },
  BLUESKY: { label: "BLUESKY", Icon: MessagesSquare },
  RSS: { label: "RSS", Icon: Radio },
  WEBSITE: { label: "WEBSITE", Icon: Globe },
};

export function SourceBadge({
  sourceType,
  className,
}: {
  sourceType: SourceSummary["sourceType"];
  className?: string;
}) {
  const { label, Icon } = CONFIG[sourceType];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[#E8DFD1] bg-[#FFF2DB] text-[#78716C]",
        className,
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

const STATUS_STYLES: Record<SourceSummary["status"], string> = {
  ACTIVE: "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30",
  WAITING_FOR_AUTHORIZED_ACCESS:
    "bg-[#FFE5BF] text-[#78716C] border-[#E8DFD1]",
  DISABLED: "bg-[#FFF2DB] text-[#78716C] border-[#E8DFD1]",
  ERROR: "bg-[#F62440]/10 text-[#F62440] border-[#F62440]/30",
};

export function MonitoringStatusBadge({
  status,
  className,
}: {
  status: SourceSummary["status"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono border uppercase tracking-wider",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status === "WAITING_FOR_AUTHORIZED_ACCESS"
        ? "AWAITING ACCESS"
        : status}
    </span>
  );
}

export function VerificationBadge({
  status,
  className,
}: {
  status: SourceSummary["verificationStatus"];
  className?: string;
}) {
  const styles =
    status === "ADMIN_VERIFIED" || status === "SELF_VERIFIED"
      ? "bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/30"
      : "bg-[#FFF2DB] text-[#78716C] border-[#E8DFD1]";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono border uppercase tracking-wider",
        styles,
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function sourceDisplayHandle(source: SourceSummary): string {
  if (source.handle) {
    return source.sourceType === "X"
      ? `@${source.handle}`
      : source.handle;
  }
  try {
    return new URL(source.canonicalUrl).hostname;
  } catch {
    return source.canonicalUrl;
  }
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Radio,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import {
  api,
  ApiRequestError,
  type FollowingItem,
} from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";
import { EmptyState } from "../../components/empty-state";
import {
  MonitoringStatusBadge,
  SourceBadge,
  sourceDisplayHandle,
} from "../../components/source-badge";
import { ToastProvider, useToast } from "../../components/toast";

function FollowingContent() {
  const { isAuthenticated, connect, isConnecting, address } = useWalletSession();
  const { notify } = useToast();

  const [items, setItems] = useState<FollowingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems(null);
      return;
    }
    try {
      const { data } = await api.listFollowing("?sourceType=X");
      setItems(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not load your following list.",
      );
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const unfollow = async (creatorId: string, name: string) => {
    setBusyId(creatorId);
    try {
      await api.unfollowCreator(creatorId);
      notify("success", `Unfollowed ${name}`);
      await load();
    } catch (err) {
      notify(
        "error",
        err instanceof ApiRequestError ? err.message : "Could not unfollow.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto py-12 font-mono">
        <EmptyState
          icon={<ShieldCheck className="w-6 h-6" />}
          title="Wallet sign-in required"
          description="Your following list is tied to your verified wallet. Sign in with your wallet to view the creators you follow."
          action={
            <button
              onClick={() => void connect()}
              disabled={isConnecting}
              className="px-4 py-2 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isConnecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isConnecting ? "Signing…" : "Sign in with Wallet"}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      <div className="space-y-1">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // OFF-CHAIN FOLLOWING (NO BLOCKCHAIN TRANSACTIONS)
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Following
        </h1>
        <p className="text-xs text-[#78716C] font-sans max-w-xl">
          Creators you follow on CallLedger. Actionable posts appear in Activity,
          where Copy Trade opens a review you must confirm. CallLedger never
          follows accounts on X and never trades without your signature.
        </p>
      </div>

      {error && (
        <div className="text-xs p-2.5 rounded-sm border bg-[#F62440]/10 border-[#F62440]/30 text-[#F62440]">
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="py-10 flex items-center justify-center text-xs text-[#78716C] gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading following…
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState
          icon={<Radio className="w-6 h-6" />}
          title="Not following anyone yet"
          description="Add creators from the Discover page to follow them on CallLedger."
          action={
            <Link
              href="/discover"
              className="px-4 py-2 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-sm transition"
            >
              Discover creators
            </Link>
          }
        />
      )}

      {items?.map((item) => (
        <div
          key={item.followId}
          className="border border-[#E8DFD1] rounded-sm bg-[#FFFAF3] p-4 flex flex-col gap-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {item.creator.avatarUrl ? (
                <img
                  src={item.creator.avatarUrl}
                  alt={item.creator.displayName}
                  className="w-10 h-10 rounded-full object-cover border border-[#E8DFD1]"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-xs text-[#78716C] font-bold">
                  {item.creator.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link
                  href={`/creators/${item.creator.id}`}
                  className="font-bold text-sm text-[#171717] hover:underline truncate block"
                >
                  {item.creator.displayName}
                </Link>
                <div className="text-[10px] text-[#78716C] mt-0.5">
                  Followed {new Date(item.followedAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <button
              onClick={() => void unfollow(item.creator.id, item.creator.displayName)}
              disabled={busyId === item.creator.id}
              className="flex items-center gap-1.5 px-3 py-1 border border-[#E8DFD1] hover:border-[#F62440] hover:text-[#F62440] text-[#78716C] rounded-sm text-xs transition disabled:opacity-50 shrink-0"
            >
              {busyId === item.creator.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserMinus className="w-3.5 h-3.5" />
              )}
              Unfollow
            </button>
          </div>

          <div className="space-y-2">
            {item.creator.sources
              .filter((source) => source.sourceType === "X")
              .map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between gap-2 border-t border-[#E8DFD1] pt-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <SourceBadge sourceType={source.sourceType} />
                    <a
                      href={source.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#78716C] hover:text-[#171717] truncate flex items-center gap-1"
                    >
                      {sourceDisplayHandle(source)}
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  </div>
                  <MonitoringStatusBadge status={source.status} />
                </div>
              ))}

            {item.creator.sources.some(
              (s) => s.status === "WAITING_FOR_AUTHORIZED_ACCESS",
            ) && (
              <div className="flex items-start gap-1.5 text-[11px] text-[#78716C] font-sans bg-[#FFE5BF]/40 border border-[#E8DFD1] rounded-sm px-2.5 py-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>
                  X monitoring is not currently available. This creator has been
                  saved to your CallLedger following list and can be monitored
                  when an authorized source is configured.
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="text-[10px] text-[#78716C] text-center pt-2">
        Authenticated as {address?.slice(0, 6)}…{address?.slice(-4)}
      </div>
    </div>
  );
}

export default function FollowingPage() {
  return (
    <ToastProvider>
      <FollowingContent />
    </ToastProvider>
  );
}

"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { api, ApiRequestError, type CreatorListItem } from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";
import { EmptyState } from "../../components/empty-state";
import { MonitoringStatusBadge } from "../../components/source-badge";
import { ToastProvider, useToast } from "../../components/toast";
import { cn } from "../../lib/utils";

type SourceKind = "X";

const SOURCE_META: Record<
  SourceKind,
  { label: string; hint: string; glyph: string }
> = {
  X: {
    label: "X (Twitter)",
    hint: "Enter an X username to add a trader",
    glyph: "#",
  },
};

function creatorHandle(creator: CreatorListItem): string | null {
  const source = creator.sources.find((s) => s.handle);
  return source?.handle ? `@${source.handle}` : null;
}

function DiscoverContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, connect, isConnecting, address } = useWalletSession();
  const { notify } = useToast();

  const [creators, setCreators] = useState<CreatorListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    displayName: string | null;
    canonicalUrl: string;
    handle: string | null;
    status: string;
    notices: string[];
    alreadyExists: boolean;
  } | null>(null);
  const [addedCreatorId, setAddedCreatorId] = useState<string | null>(null);

  const loadCreators = useCallback(async () => {
    try {
      const { data } = await api.listCreators("?limit=50");
      setCreators(data);
      setListError(null);
    } catch {
      setListError("Could not load the creator directory.");
    }
  }, []);

  useEffect(() => {
    void loadCreators();
  }, [loadCreators]);

  useEffect(() => {
    if (searchParams.get("x_connected") === "true") {
      notify("success", "X account connected");
    }
  }, [searchParams, notify]);

  const previewUrl = useMemo(() => {
    const handle = input.replace(/^@/, "").replace(/[/?#].*$/, "");
    if (!handle) return null;
    return `https://x.com/${handle}`;
  }, [input]);

  const buildPayload = (): Record<string, unknown> | null => {
    const value = input.trim();
    if (!value) return null;
    return { sourceType: "X", username: value };
  };

  const resolve = async () => {
    const payload = buildPayload();
    if (!payload) {
      setFormError("Enter an X username.");
      return;
    }
    setFormError(null);
    setPreview(null);
    setAddedCreatorId(null);

    setIsResolving(true);
    try {
      const { data } = await api.resolveSource(payload);
      setPreview({
        displayName: data.displayName,
        canonicalUrl: data.canonicalUrl,
        handle: data.handle,
        status: data.status,
        notices: data.notices,
        alreadyExists: data.alreadyExists,
      });
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? error.message : "Could not validate source.",
      );
    } finally {
      setIsResolving(false);
    }
  };

  const addCreator = async () => {
    if (!isAuthenticated) {
      const connected = await connect();
      if (!connected) {
        notify("error", "Sign in before adding creators.");
        return;
      }
    }
    const payload = buildPayload();
    if (!payload || !preview) return;

    setIsAdding(true);
    try {
      const { data } = await api.createCreator(payload);
      setAddedCreatorId(data.creator.id);
      notify(
        "success",
        data.alreadyExisted
          ? "Creator already on CallLedger — reused the existing record."
          : "Creator added to CallLedger.",
      );
      setInput("");
      setPreview(null);
      void loadCreators();
    } catch (error) {
      notify(
        "error",
        error instanceof ApiRequestError ? error.message : "Failed to add creator.",
      );
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-5 font-mono min-w-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 min-w-0">
        <div className="space-y-1.5 min-w-0 w-full sm:w-auto">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-[#171717]">
            Discover Traders
          </h1>
          <p className="text-[11px] leading-relaxed text-[#78716C] font-sans max-w-[520px] break-words">
            Add traders by their X (Twitter) username. Public posts and trading signals are indexed automatically via Firecrawl.
          </p>
        </div>

        {isAuthenticated ? (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#16A34A]/10 border border-[#16A34A]/30 text-[#16A34A] rounded-sm text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>
              Wallet {address?.slice(0, 6)}…{address?.slice(-4)}
            </span>
          </div>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={isConnecting}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#171717] hover:bg-black text-[#FFFAF3] rounded-sm text-xs transition disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{isConnecting ? "Signing…" : "Sign in with Wallet"}</span>
          </button>
        )}
      </div>

      {/* Add creator form */}
      <div className="border border-[#E8DFD1] rounded-[3px] bg-[#FFFCF7]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8DFD1]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#171717]">
            // ADD A Trader
          </div>
          <Plus className="w-4 h-4 text-[#78716C]" />
        </div>

        <div className="p-4 space-y-4">
          <p className="text-[11px] text-[#78716C] font-sans">
            {SOURCE_META.X.hint}
          </p>

          {/* Input */}
          <div>
            <label className="text-[10px] text-[#78716C] uppercase">
              X USERNAME (WITHOUT @)
            </label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C]">
                  @
                </span>
                <input
                  type="text"
                  required
                  placeholder="DrProfitCrypto"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void resolve()}
                  className={cn(
                    "w-full h-[27px] bg-[#FFFAF3] border border-[#171717]/70 rounded-[3px] py-1 px-3 pl-7 text-[11px] text-[#171717] focus:outline-none focus:border-[#171717]",
                  )}
                />
              </div>
              <button
                onClick={() => void resolve()}
                disabled={isResolving}
                className="h-[27px] px-4 bg-[#171717] hover:bg-black text-[#FFFAF3] text-[11px] font-bold rounded-[3px] transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isResolving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Resolve"
                )}
              </button>
            </div>
            {previewUrl && (
              <div className="mt-1.5 text-[11px] text-[#78716C] font-mono">
                {previewUrl}
              </div>
            )}
          </div>

          {formError && (
            <div className="text-xs p-2.5 rounded-sm border bg-[#F62440]/10 border-[#F62440]/30 text-[#F62440]">
              {formError}
            </div>
          )}

          {preview && (
            <div className="border border-[#E8DFD1] rounded-[3px] bg-[#FFF5E6] p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-[#171717] truncate">
                    {preview.handle ? `@${preview.handle}` : preview.displayName ?? "Creator"}
                  </div>
                  <div className="text-[10px] text-[#78716C] break-all">
                    {preview.canonicalUrl}
                  </div>
                </div>
                <MonitoringStatusBadge
                  status={preview.status as never}
                />
              </div>

              {preview.status === "ACTIVE" && (
                <div className="text-[10px] text-[#16A34A] font-sans leading-relaxed bg-[#16A34A]/10 border border-[#16A34A]/30 rounded-[3px] px-2.5 py-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                  <span>
                    Live source verified — recent posts and trading signals will be
                    indexed immediately upon adding.
                  </span>
                </div>
              )}

              {preview.status === "WAITING_FOR_AUTHORIZED_ACCESS" && (
                <div className="text-[10px] text-[#9B7547] font-sans leading-relaxed bg-[#FFF0D8] border border-[#E8DFD1] rounded-[3px] px-2.5 py-2">
                  WAITING_FOR_AUTHORIZED_ACCESS — the creator is saved in
                  CallLedger, but live X monitoring is not enabled until an
                  authorized X data source or Firecrawl is configured.
                </div>
              )}

              {preview.alreadyExists && (
                <div className="text-[11px] text-[#78716C] font-sans">
                  This identity is already on CallLedger. Adding it will reuse
                  the existing global creator record (no duplicates).
                </div>
              )}

              {addedCreatorId && (
                <div className="text-[11px] text-[#16A34A] font-sans">
                  <Link href={`/creators/${addedCreatorId}`} className="underline">
                    View creator profile &rarr;
                  </Link>
                </div>
              )}

              <button
                onClick={() => void addCreator()}
                disabled={isAdding}
                className="w-full h-[34px] px-4 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-[3px] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                {!isAuthenticated
                  ? "Sign in & Add to CallLedger"
                  : preview.alreadyExists
                    ? "Already on CallLedger — view / use record"
                    : "Add to CallLedger"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Directory */}
      <div className="pt-2 border-t border-[#E8DFD1]">
        <div className="py-3 text-[10px] uppercase text-[#78716C] tracking-widest">
          // TRADER DIRECTORY
        </div>
        <div className="border-t border-[#E8DFD1]" />
        {listError && (
          <div className="py-6 text-xs text-[#F62440] px-1">{listError}</div>
        )}
        {creators === null && !listError && (
          <div className="py-8 flex items-center justify-center text-xs text-[#78716C] gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading directory…
          </div>
        )}
        {creators && creators.length === 0 && (
          <div className="py-6">
            <EmptyState
              icon={<Globe className="w-5 h-5" />}
              title="No traders yet"
              description="Add your first trader by entering their X username in the form above."
            />
          </div>
        )}
        {creators?.map((creator) => (
          <div
            key={creator.id}
            className="py-3 flex items-center justify-between border-b border-[#E8DFD1] last:border-b-0 hover:bg-[#FFF2DB]/40 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#E8DFD1]"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-[#78716C] shrink-0">
                  <span aria-hidden className="text-[11px]">◇</span>
                </div>
              )}
              <div className="min-w-0">
                <Link
                  href={`/creators/${creator.id}`}
                  className="font-bold text-[12px] text-[#171717] hover:underline truncate block"
                >
                  {creatorHandle(creator) ?? creator.displayName}
                </Link>
              </div>
            </div>
            <Link
              href={`/creators/${creator.id}`}
              className="text-[10px] border border-[#171717]/80 hover:bg-[#171717] hover:text-[#FFFAF3] px-3 py-1.5 rounded-[3px] bg-[#FFFAF3] text-[#171717] transition shrink-0 ml-3"
            >
              VIEW PROFILE &gt;
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <ToastProvider>
      <Suspense
        fallback={
          <div className="font-mono text-xs text-[#78716C] p-4">
            Loading creator directory…
          </div>
        }
      >
        <DiscoverContent />
      </Suspense>
    </ToastProvider>
  );
}
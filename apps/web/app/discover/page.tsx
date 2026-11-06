"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Globe,
  Hash,
  Loader2,
  MessagesSquare,
  Plus,
  Radio,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { api, ApiRequestError, type CreatorListItem } from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";
import { EmptyState } from "../../components/empty-state";
import { MonitoringStatusBadge, SourceBadge } from "../../components/source-badge";
import { ToastProvider, useToast } from "../../components/toast";
import { cn } from "../../lib/utils";

type SourceKind = "X" | "BLUESKY" | "RSS" | "WEBSITE";

const SOURCE_META: Record<
  SourceKind,
  { label: string; hint: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  X: {
    label: "X (Twitter)",
    hint: "Username only — no X API key required to add. Live monitoring awaits authorized access.",
    Icon: Hash,
  },
  BLUESKY: {
    label: "Bluesky",
    hint: "Public profile handle. We resolve the DID and store it as the stable identity — no API key or password needed.",
    Icon: MessagesSquare,
  },
  RSS: {
    label: "RSS / Atom feed",
    hint: "A feed URL. We validate it, extract the title, and mark it ready for monitoring.",
    Icon: Radio,
  },
  WEBSITE: {
    label: "Authorized website",
    hint: "Only when you are authorized to crawl the site. Requires a configured Firecrawl provider.",
    Icon: Globe,
  },
};

function DiscoverContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, connect, isConnecting, address } = useWalletSession();
  const { notify } = useToast();

  const [creators, setCreators] = useState<CreatorListItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [sourceKind, setSourceKind] = useState<SourceKind>("X");
  const [input, setInput] = useState("");
  const [websiteAuthorized, setWebsiteAuthorized] = useState(false);
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
    switch (sourceKind) {
      case "X": {
        const handle = input.replace(/^@/, "").replace(/[/?#].*$/, "");
        if (!handle) return null;
        return `https://x.com/${handle}`;
      }
      case "BLUESKY": {
        const handle = input.replace(/^@/, "");
        if (!handle) return null;
        return `https://bsky.app/profile/${handle}`;
      }
      case "RSS": {
        const url = input.trim();
        if (!url) return null;
        try {
          const parsed = new URL(url);
          return `Feed: ${parsed.hostname}`;
        } catch {
          return "Invalid URL";
        }
      }
      case "WEBSITE": {
        const url = input.trim();
        if (!url) return null;
        try {
          const parsed = new URL(url);
          return `Site: ${parsed.hostname}`;
        } catch {
          return "Invalid URL";
        }
      }
    }
  }, [sourceKind, input]);

  const buildPayload = (): Record<string, unknown> | null => {
    const value = input.trim();
    if (!value) return null;
    switch (sourceKind) {
      case "X":
        return { sourceType: "X", username: value };
      case "BLUESKY":
        return { sourceType: "BLUESKY", handle: value };
      case "RSS":
        return { sourceType: "RSS", feedUrl: value };
      case "WEBSITE":
        return {
          sourceType: "WEBSITE",
          websiteUrl: value,
          authorized: websiteAuthorized,
        };
    }
  };

  const resolve = async () => {
    const payload = buildPayload();
    if (!payload) {
      setFormError("Enter a value first.");
      return;
    }
    setFormError(null);
    setPreview(null);
    setAddedCreatorId(null);

    const needsAuthConfirmation =
      sourceKind === "WEBSITE" && !websiteAuthorized;
    if (needsAuthConfirmation) {
      setFormError(
        "Confirm that you are authorized to crawl this website before continuing.",
      );
      return;
    }

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
      notify("error", "Sign in with your wallet before adding creators.");
      return;
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
      setWebsiteAuthorized(false);
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
    <div className="space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
            // CREATOR DISCOVERY & DIRECTORY
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
            Discover Creators
          </h1>
          <p className="text-xs text-[#78716C] font-sans max-w-xl">
            Add traders by X username, Bluesky handle, RSS feed, or an authorized
            website. One creator can own multiple source identities — profiles are
            never auto-merged.
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

      {/* Banner */}
      <div className="w-full bg-[#171717] text-[#FFFAF3] p-4 rounded-sm text-xs">
        <div className="text-[10px] text-[#FFE5BF] uppercase tracking-wider font-bold">
          /// MULTI-SOURCE CREATOR ARCHITECTURE
        </div>
        <div className="text-xs text-slate-300 font-sans mt-1">
          Following a creator is an <strong>off-chain</strong> database
          operation — no blockchain transaction, and no X follow is ever
          performed on your behalf.
        </div>
      </div>

      {/* Add creator form */}
      <div className="border border-[#E8DFD1] rounded-sm bg-[#FFFAF3]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8DFD1]">
          <div className="text-xs font-bold uppercase tracking-wider text-[#171717]">
            // Add a creator
          </div>
          <Plus className="w-4 h-4 text-[#78716C]" />
        </div>

        <div className="p-4 space-y-4">
          {/* Source selector */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SOURCE_META) as SourceKind[]).map((kind) => {
              const meta = SOURCE_META[kind];
              const Icon = meta.Icon;
              return (
                <button
                  key={kind}
                  onClick={() => {
                    setSourceKind(kind);
                    setPreview(null);
                    setFormError(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs border transition",
                    sourceKind === kind
                      ? "bg-[#171717] text-[#FFFAF3] border-[#171717] font-semibold"
                      : "border-[#E8DFD1] text-[#78716C] hover:text-[#171717] bg-[#FFF2DB]/40",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-[#78716C] font-sans">
            {SOURCE_META[sourceKind].hint}
          </p>

          {/* Input */}
          <div>
            <label className="text-[10px] text-[#78716C] uppercase">
              {sourceKind === "X" && "X username (without @)"}
              {sourceKind === "BLUESKY" && "Bluesky handle"}
              {sourceKind === "RSS" && "Feed URL"}
              {sourceKind === "WEBSITE" && "Website URL"}
            </label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                {(sourceKind === "X" || sourceKind === "BLUESKY") && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#78716C]">
                    @
                  </span>
                )}
                <input
                  type="text"
                  required
                  placeholder={
                    sourceKind === "X"
                      ? "tradername"
                      : sourceKind === "BLUESKY"
                        ? "trader.bsky.social"
                        : sourceKind === "RSS"
                          ? "https://example.com/feed.xml"
                          : "https://example.com"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void resolve()}
                  className={cn(
                    "w-full bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm py-1.5 pr-3 text-xs text-[#171717] focus:outline-none focus:border-[#171717]",
                    (sourceKind === "X" || sourceKind === "BLUESKY") &&
                      "pl-7",
                  )}
                />
              </div>
              <button
                onClick={() => void resolve()}
                disabled={isResolving}
                className="px-4 py-1.5 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-sm transition disabled:opacity-50 flex items-center gap-1.5"
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

          {sourceKind === "WEBSITE" && (
            <label className="flex items-start gap-2 text-xs font-sans text-[#78716C] cursor-pointer">
              <input
                type="checkbox"
                checked={websiteAuthorized}
                onChange={(e) => setWebsiteAuthorized(e.target.checked)}
                className="mt-0.5 accent-[#171717]"
              />
              <span>
                I confirm that I am authorized to crawl this website and that it
                is not an X/Twitter endpoint.
              </span>
            </label>
          )}

          {formError && (
            <div className="text-xs p-2.5 rounded-sm border bg-[#F62440]/10 border-[#F62440]/30 text-[#F62440]">
              {formError}
            </div>
          )}

          {preview && (
            <div className="border border-[#E8DFD1] rounded-sm bg-[#FFF2DB]/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#171717]">
                    {preview.displayName ?? preview.handle ?? "Creator"}
                  </div>
                  <div className="text-[11px] text-[#78716C] break-all">
                    {preview.canonicalUrl}
                  </div>
                </div>
                <MonitoringStatusBadge
                  status={preview.status as never}
                />
              </div>

              {preview.status === "WAITING_FOR_AUTHORIZED_ACCESS" && (
                <div className="text-[11px] text-[#78716C] font-sans leading-relaxed bg-[#FFE5BF]/50 border border-[#E8DFD1] rounded-sm px-2.5 py-2">
                  WAITING_FOR_AUTHORIZED_ACCESS — the creator is saved in
                  CallLedger, but live X monitoring is not enabled until an
                  authorized X data source is configured.
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
                className="w-full px-4 py-2 bg-[#171717] hover:bg-black text-[#FFFAF3] text-xs font-bold rounded-sm transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isAdding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                {preview.alreadyExists
                  ? "Already on CallLedger — use existing record"
                  : "Add to CallLedger"}
              </button>
              {!isAuthenticated && (
                <div className="text-[10px] text-[#78716C] font-sans text-center">
                  Sign in with your wallet to add creators.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Directory */}
      <div className="border-y border-[#E8DFD1] divide-y divide-[#E8DFD1]">
        <div className="py-3 px-1 text-[10px] uppercase text-[#78716C] tracking-widest">
          // CREATOR DIRECTORY
        </div>
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
              title="No creators yet"
              description="Add your first creator with the form above — X, Bluesky, RSS or an authorized website."
            />
          </div>
        )}
        {creators?.map((creator) => (
          <div
            key={creator.id}
            className="py-3 px-1 flex items-center justify-between hover:bg-[#FFF2DB]/40 transition group"
          >
            <div className="flex items-center gap-3 min-w-0">
              {creator.avatarUrl ? (
                <img
                  src={creator.avatarUrl}
                  alt={creator.displayName}
                  className="w-9 h-9 rounded-full object-cover border border-[#E8DFD1]"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-xs text-[#78716C] font-bold">
                  {creator.displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link
                  href={`/creators/${creator.id}`}
                  className="font-bold text-sm text-[#171717] hover:underline truncate"
                >
                  {creator.displayName}
                </Link>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {creator.sources.map((source) => (
                    <span key={source.id} className="flex items-center gap-1.5">
                      <SourceBadge sourceType={source.sourceType} />
                      <MonitoringStatusBadge status={source.status} className="!text-[9px]" />
                    </span>
                  ))}
                  {creator.sources.length === 0 && (
                    <span className="text-[10px] text-[#78716C]">NO SOURCES</span>
                  )}
                </div>
              </div>
            </div>
            <Link
              href={`/creators/${creator.id}`}
              className="text-xs border border-[#E8DFD1] hover:border-[#171717] px-3 py-1 rounded-sm bg-[#FFFAF3] text-[#171717] transition shrink-0 ml-3"
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
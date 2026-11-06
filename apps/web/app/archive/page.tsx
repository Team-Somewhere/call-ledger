"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Archive,
  ExternalLink,
  Loader2,
  Shield,
  TrendingUp,
} from "lucide-react";
import { api, type ArchivedPost } from "../../lib/api";

/**
 * Arkiv Archive Feed — posts retrieved directly from Arkiv Rabdi.
 *
 * This page demonstrates actual Arkiv reads. Every post shown here
 * was written to the Arkiv Rabdi testnet by the CallLedger monitoring worker.
 * The original X URL may become unavailable without removing content from Arkiv,
 * as long as the entity has not expired.
 */

export default function ArchivePage() {
  const [posts, setPosts] = useState<ArchivedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [source, setSource] = useState<string>("unknown");
  const [filterTrading, setFilterTrading] = useState(false);
  const [usernameFilter, setUsernameFilter] = useState("");
  const [appliedUsername, setAppliedUsername] = useState("");

  const load = useCallback(
    async (reset = false) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const cursor = reset ? "" : (nextCursor ?? "");
      const params = new URLSearchParams({ limit: "20" });
      if (filterTrading) params.set("tradingRelated", "true");
      if (appliedUsername) params.set("username", appliedUsername);
      if (cursor) params.set("cursor", cursor);

      try {
        const resp = await api.archivePosts(`?${params.toString()}`);
        const meta = resp.meta as {
          hasMore?: boolean;
          nextCursor?: string | null;
          source?: string;
        } | undefined;

        if (reset) {
          setPosts(resp.data);
        } else {
          setPosts((prev) => [...prev, ...resp.data]);
        }
        setHasMore(Boolean(meta?.hasMore));
        setNextCursor(meta?.nextCursor ?? null);
        setSource(meta?.source ?? "unknown");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to load archive.";
        setError(msg);
        if (reset) setPosts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filterTrading, appliedUsername, nextCursor],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTrading, appliedUsername]);

  function applyUsernameFilter() {
    const cleaned = usernameFilter.replace(/^@/, "").trim().toLowerCase();
    setAppliedUsername(cleaned);
  }

  function clearFilters() {
    setUsernameFilter("");
    setAppliedUsername("");
    setFilterTrading(false);
  }

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="border-b border-[#E8DFD1] pb-4">
        <div className="text-[10px] uppercase tracking-widest text-[#78716C]">
          // ARKIV RABDI TESTNET
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717] mt-0.5">
          Archive Feed
        </h1>
        <p className="font-sans text-xs text-[#78716C] mt-1 max-w-lg">
          X posts permanently archived on Arkiv Rabdi. Reads are served directly
          from the chain — content remains accessible even if the original post is deleted,
          as long as the Arkiv entity has not expired.
        </p>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-2 text-[10px]">
        <Shield className="w-3 h-3 text-[#16A34A]" />
        <span className="text-[#78716C]">
          DATA SOURCE:{" "}
          <span
            className={`font-bold ${source === "arkiv" ? "text-[#16A34A]" : "text-[#F62440]"}`}
          >
            {source === "arkiv" ? "ARKIV RABDI TESTNET" : source.toUpperCase()}
          </span>
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by @handle"
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyUsernameFilter()}
            className="bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm px-2.5 py-1 text-xs text-[#171717] placeholder-[#78716C] focus:outline-none focus:border-[#171717] w-40"
          />
          <button
            onClick={applyUsernameFilter}
            className="px-3 py-1 bg-[#171717] text-[#FFFAF3] text-xs rounded-sm hover:bg-black transition"
          >
            Filter
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-[#78716C] cursor-pointer">
          <input
            type="checkbox"
            checked={filterTrading}
            onChange={(e) => setFilterTrading(e.target.checked)}
            className="accent-[#171717]"
          />
          Trading signals only
        </label>
        {(appliedUsername || filterTrading) && (
          <button
            onClick={clearFilters}
            className="text-[10px] text-[#78716C] hover:text-[#F62440] transition"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 border border-[#F62440]/30 bg-[#F62440]/5 p-3 rounded-sm text-xs text-[#F62440]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div>
            <div className="font-bold">Archive unavailable</div>
            <div className="font-sans text-[11px] mt-0.5">{error}</div>
            {error.includes("not configured") && (
              <div className="font-sans text-[11px] mt-1 text-[#78716C]">
                Set{" "}
                <code className="bg-[#E8DFD1] px-1 rounded-sm">
                  ARKIV_ACCESS_KEY
                </code>{" "}
                in the API environment to enable archive reads.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-xs text-[#78716C]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading from Arkiv Rabdi…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && posts.length === 0 && (
        <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-10 text-center">
          <Archive className="w-8 h-8 text-[#78716C] mx-auto mb-3" />
          <div className="text-sm font-bold text-[#171717]">
            No archived posts yet
          </div>
          <p className="font-sans text-xs text-[#78716C] mt-1 max-w-xs mx-auto">
            Add a trader on the{" "}
            <Link href="/discover" className="underline text-[#171717]">
              Discover
            </Link>{" "}
            page. The monitoring worker will archive their X posts to Arkiv
            automatically.
          </p>
        </div>
      )}

      {/* Post list */}
      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <ArchivedPostCard key={post.entityKey} post={post} />
          ))}

          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={() => void load(false)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 border border-[#E8DFD1] bg-[#FFFAF3] px-4 py-2 text-xs text-[#171717] rounded-sm hover:border-[#171717] disabled:opacity-50 transition"
              >
                {loadingMore && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArchivedPostCard({ post }: { post: ArchivedPost }) {
  const capturedAt = post.capturedAt ? new Date(post.capturedAt) : null;
  const originalAt = post.originalCreatedAt
    ? new Date(post.originalCreatedAt)
    : null;
  const expiresAt = post.expiresAt ? new Date(post.expiresAt) : null;

  const daysUntilExpiry = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const expiringSoon = daysUntilExpiry !== null && daysUntilExpiry < 30;

  return (
    <article className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-4 space-y-3 hover:border-[#171717] transition">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-[10px] font-bold text-[#78716C] shrink-0">
            {post.authorDisplayName?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#171717] truncate">
              {post.creatorDisplayName || post.authorDisplayName || `@${post.authorUsername}`}
            </div>
            <div className="text-[10px] text-[#78716C]">
              @{post.authorUsername}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {post.tradingRelated && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#16A34A] bg-[#16A34A]/10 border border-[#16A34A]/30 px-2 py-0.5 rounded-sm">
              <TrendingUp className="w-2.5 h-2.5" />
              SIGNAL
            </span>
          )}
          <span
            className={`text-[10px] ${post.contentFidelity === "VERBATIM" ? "text-[#16A34A]" : "text-[#78716C]"}`}
          >
            {post.contentFidelity}
          </span>
        </div>
      </div>

      {/* Post text */}
      {post.postText && (
        <p className="font-sans text-sm leading-relaxed text-[#292524] whitespace-pre-wrap break-words">
          {post.postText}
        </p>
      )}

      {/* Topics + Assets */}
      {(post.topics.length > 0 || post.assets.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {post.assets.map((asset) => (
            <span
              key={asset}
              className="text-[10px] px-2 py-0.5 bg-[#FFF2DB] border border-[#E8DFD1] rounded-sm font-mono text-[#78716C]"
            >
              ${asset}
            </span>
          ))}
          {post.topics.map((topic) => (
            <span
              key={topic}
              className="text-[10px] px-2 py-0.5 bg-[#E8DFD1]/40 border border-[#E8DFD1] rounded-sm text-[#78716C]"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="pt-2 border-t border-[#E8DFD1] space-y-1.5 text-[10px] text-[#78716C]">
        {/* Arkiv entity key */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Shield className="w-3 h-3 text-[#16A34A] shrink-0" />
          <span className="font-bold text-[#16A34A]">ARKIV ENTITY</span>
          <code className="font-mono text-[9px] bg-[#E8DFD1]/60 px-1.5 py-0.5 rounded-sm break-all">
            {post.entityKey}
          </code>
        </div>

        {/* TX hash if available */}
        {(post.txHash || post.localTxHash) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[#78716C]">TX</span>
            <code className="font-mono text-[9px] bg-[#E8DFD1]/60 px-1.5 py-0.5 rounded-sm break-all">
              {post.txHash || post.localTxHash}
            </code>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex flex-wrap gap-4">
          {originalAt && (
            <span>
              ORIGINAL:{" "}
              <span className="text-[#171717]">
                {originalAt.toLocaleString()}
              </span>
            </span>
          )}
          {capturedAt && (
            <span>
              ARCHIVED:{" "}
              <span className="text-[#171717]">
                {capturedAt.toLocaleString()}
              </span>
            </span>
          )}
          {expiresAt && (
            <span
              className={expiringSoon ? "text-[#F62440] font-bold" : ""}
            >
              EXPIRES:{" "}
              <span>
                {expiresAt.toLocaleDateString()}
                {daysUntilExpiry !== null && ` (${daysUntilExpiry}d)`}
              </span>
            </span>
          )}
        </div>

        {/* Source link */}
        {post.postUrl && (
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#171717] transition"
          >
            Original source <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </article>
  );
}

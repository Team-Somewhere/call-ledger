"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ExternalLink, Loader2, Radio } from "lucide-react";
import { extractActionableSignal } from "@call-ledger/shared";
import { SourceBadge } from "../../components/source-badge";
import {
  api,
  ApiRequestError,
  type ActivityPost,
  type FollowingItem,
} from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";

const sourceOptions = ["ALL", "RSS", "BLUESKY", "WEBSITE", "X"] as const;

export default function ActivityPage() {
  const { isAuthenticated, connect, isConnecting } = useWalletSession();
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [following, setFollowing] = useState<FollowingItem[]>([]);
  const [sourceType, setSourceType] = useState("ALL");
  const [creatorId, setCreatorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [includeReplies, setIncludeReplies] = useState(false);
  const [includeReposts, setIncludeReposts] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "25" });
    if (sourceType !== "ALL") params.set("sourceType", sourceType);
    if (creatorId) params.set("creatorId", creatorId);
    if (startDate)
      params.set("startDate", new Date(`${startDate}T00:00:00`).toISOString());
    if (endDate)
      params.set("endDate", new Date(`${endDate}T23:59:59.999`).toISOString());
    if (includeReplies) params.set("includeReplies", "true");
    if (includeReposts) params.set("includeReposts", "true");
    return `?${params.toString()}`;
  }, [
    sourceType,
    creatorId,
    startDate,
    endDate,
    includeReplies,
    includeReposts,
  ]);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setFollowing([]);
      setPosts([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    void Promise.all([
      api.activity(query),
      api.listFollowing("?page=1&limit=100"),
    ])
      .then(([activity, follows]) => {
        if (!active) return;
        const meta = activity.meta as
          { nextCursor?: string | null; hasMore?: boolean } | undefined;
        setPosts(activity.data);
        setFollowing(follows.data);
        setNextCursor(meta?.nextCursor ?? null);
        setHasMore(Boolean(meta?.hasMore));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Could not load your activity feed.",
        );
        setPosts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, query]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams(query.slice(1));
      params.set("cursor", nextCursor);
      const response = await api.activity(`?${params.toString()}`);
      const meta = response.meta as
        { nextCursor?: string | null; hasMore?: boolean } | undefined;
      setPosts((current) => [...current, ...response.data]);
      setNextCursor(meta?.nextCursor ?? null);
      setHasMore(Boolean(meta?.hasMore));
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not load more activity.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, query]);

  const followedSourcesWaiting = following.some((item) =>
    item.creator.sources.some(
      (source) => source.status === "WAITING_FOR_AUTHORIZED_ACCESS",
    ),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 font-mono">
      <header className="space-y-1 border-b border-[#E8DFD1] pb-4">
        <div className="text-[10px] uppercase tracking-widest text-[#78716C]">
          // CREATOR ACTIVITY
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Activity Feed
        </h1>
        <p className="font-sans text-xs text-[#78716C]">
          Recent posts from creators you follow. Each source is monitored once
          for everyone following it.
        </p>
      </header>

      {!isAuthenticated ? (
        <section className="rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-6 text-center">
          <p className="mb-4 text-sm text-[#78716C]">
            Sign in with your wallet to view your followed creators&apos; posts.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={isConnecting}
            className="rounded-sm bg-[#171717] px-4 py-2 text-xs text-[#FFFAF3] disabled:opacity-50"
          >
            {isConnecting ? "Signing…" : "Sign in"}
          </button>
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-4">
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setSourceType(option)}
                  className={`rounded-full px-3 py-1 text-[10px] ${
                    sourceType === option
                      ? "bg-[#171717] text-[#FFFAF3]"
                      : "border border-[#E8DFD1] text-[#78716C]"
                  }`}
                >
                  {option === "ALL" ? "All sources" : option}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-[10px] text-[#78716C]">
                Creator
                <select
                  value={creatorId}
                  onChange={(event) => setCreatorId(event.target.value)}
                  className="block w-full rounded-sm border border-[#E8DFD1] bg-white px-2 py-2 text-xs text-[#171717]"
                >
                  <option value="">All followed creators</option>
                  {following.map((item) => (
                    <option key={item.creator.id} value={item.creator.id}>
                      {item.creator.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-[10px] text-[#78716C]">
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="block w-full rounded-sm border border-[#E8DFD1] bg-white px-2 py-2 text-xs text-[#171717]"
                />
              </label>
              <label className="space-y-1 text-[10px] text-[#78716C]">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="block w-full rounded-sm border border-[#E8DFD1] bg-white px-2 py-2 text-xs text-[#171717]"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-[10px] text-[#78716C]">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeReplies}
                  onChange={(event) => setIncludeReplies(event.target.checked)}
                />
                Include replies
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeReposts}
                  onChange={(event) => setIncludeReposts(event.target.checked)}
                />
                Include reposts
              </label>
            </div>
          </section>

          {error && (
            <div className="flex items-center gap-2 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3" aria-label="Loading activity">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]"
                />
              ))}
            </div>
          ) : following.length === 0 ? (
            <div className="rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-8 text-center">
              <Radio className="mx-auto mb-2 h-5 w-5 text-[#78716C]" />
              <p className="text-sm font-bold text-[#171717]">
                No followed creators yet
              </p>
              <p className="mt-1 font-sans text-xs text-[#78716C]">
                Follow a creator to see new posts here.
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-8 text-center">
              <p className="text-sm font-bold text-[#171717]">No posts yet</p>
              <p className="mt-1 font-sans text-xs text-[#78716C]">
                {followedSourcesWaiting
                  ? "Some followed sources are waiting for authorized access. Posts will appear when monitoring is available."
                  : "Your followed creators have no collected posts matching these filters yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => {
                const date = post.publishedAt ?? post.fetchedAt;
                return (
                  <article
                    key={post.id}
                    className="rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {post.creatorAvatarUrl ? (
                          <img
                            src={post.creatorAvatarUrl}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF2DB] text-xs font-bold text-[#78716C]">
                            {post.creatorName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate text-xs font-bold text-[#171717]">
                            {post.creatorName}
                          </div>
                          <div className="truncate text-[10px] text-[#78716C]">
                            {post.authorHandle
                              ? `@${post.authorHandle.replace(/^@/, "")}`
                              : post.sourceHandle}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SourceBadge sourceType={post.sourceType} />
                        {post.isReply && (
                          <span className="text-[9px] text-[#78716C]">
                            REPLY
                          </span>
                        )}
                        {post.isRepost && (
                          <span className="text-[9px] text-[#78716C]">
                            REPOST
                          </span>
                        )}
                        <time
                          dateTime={date}
                          title={post.publishedAt ? "Published" : "Collected"}
                          className="text-[10px] text-[#78716C]"
                        >
                          {new Date(date).toLocaleString()}
                        </time>
                      </div>
                    </div>
                    {post.title && (
                      <h2 className="mb-1 text-sm font-bold text-[#171717]">
                        {post.title}
                      </h2>
                    )}
                    {post.content && (
                      <p className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[#292524]">
                        {post.content}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {post.content && extractActionableSignal(post.content) && (
                        <Link
                          href={`/trade?draft=${encodeURIComponent(
                            JSON.stringify({
                              sourcePost: {
                                id: post.externalPostId,
                                url: post.canonicalUrl,
                                author: post.authorHandle,
                                text: post.content,
                              },
                              chain: "base",
                              targetSymbol: extractActionableSignal(post.content)?.asset || "ETH",
                              direction: extractActionableSignal(post.content)?.side || "buy",
                              orderType: "limit",
                              limitPrice: extractActionableSignal(post.content)?.entry,
                              stopLoss: extractActionableSignal(post.content)?.stopLoss,
                              takeProfit: extractActionableSignal(post.content)?.takeProfit,
                              classification: "TRADE_SIGNAL",
                            }),
                          )}`}
                          className="border border-[#171717] bg-[#171717] px-2 py-1 text-[10px] font-bold text-[#FFFAF3]"
                        >
                          COPY TRADE
                        </Link>
                      )}
                      {post.canonicalUrl && (
                        <a
                          href={post.canonicalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[#78716C] hover:text-[#171717]"
                        >
                          Original source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 border border-[#E8DFD1] bg-[#FFFAF3] px-4 py-2 text-xs text-[#171717] disabled:opacity-50"
              >
                {loadingMore && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

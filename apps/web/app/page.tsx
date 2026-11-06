"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  LineChart,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { CreateStrategyModal } from "../components/create-strategy-modal";
import { SignalCard } from "../components/signal-card";
import { TrendingChartDrawer, type TrendingTickerInfo } from "../components/trending-chart-drawer";
import { api, type ActivityPost, type CreatorListItem } from "../lib/api";
import { MOCK_SIGNALS, MockSignal } from "../lib/mock-data";
import { useWalletSession } from "../lib/use-wallet-session";

export default function TerminalPage() {
  const { isAuthenticated, connect } = useWalletSession();
  const [feedSearch, setFeedSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<MockSignal | null>(null);

  // Real platform creators + their posts
  const [platformCreators, setPlatformCreators] = useState<CreatorListItem[] | null>(null);
  const [platformPosts, setPlatformPosts] = useState<ActivityPost[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  const [featuredCreators, setFeaturedCreators] = useState<CreatorListItem[]>([]);
  const [followedCreatorIds, setFollowedCreatorIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [featuredCreatorsLoading, setFeaturedCreatorsLoading] = useState(true);
  const [featuredCreatorsError, setFeaturedCreatorsError] = useState<
    string | null
  >(null);
  const [followActionError, setFollowActionError] = useState<string | null>(
    null,
  );
  const [busyCreatorId, setBusyCreatorId] = useState<string | null>(null);

  // Live market price oracle state & selected ticker for TradingView drawer
  const [livePrices, setLivePrices] = useState<
    Record<string, { priceUsd: number; change24h: number }>
  >({});
  const [selectedTrendingTicker, setSelectedTrendingTicker] =
    useState<TrendingTickerInfo | null>(null);

  useEffect(() => {
    let active = true;

    const fetchLivePrices = async () => {
      try {
        const res = await fetch("/api/market/trending");
        const json = (await res.json()) as {
          success?: boolean;
          data?: Record<string, { priceUsd: number; change24h: number }>;
        };
        if (active && json.success && json.data) {
          setLivePrices(json.data);
        }
      } catch (err) {
        console.warn("Could not fetch live market prices:", err);
      }
    };

    void fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 20_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const loadPlatformFeed = useCallback(async () => {
    setPostsLoading(true);
    try {
      const { data: creators } = await api.listCreators("?limit=50");
      setPlatformCreators(creators);

      if (creators.length > 0) {
        // Fetch posts from all platform creators in parallel (up to 10 most recent)
        const postResults = await Promise.allSettled(
          creators.map((c) => api.creatorPosts(c.id, "?limit=10"))
        );
        const allPosts: ActivityPost[] = [];
        for (const result of postResults) {
          if (result.status === "fulfilled") {
            allPosts.push(...result.value.data);
          }
        }
        // Sort newest first
        allPosts.sort((a, b) => {
          const ta = new Date(a.publishedAt ?? a.fetchedAt).getTime();
          const tb = new Date(b.publishedAt ?? b.fetchedAt).getTime();
          return tb - ta;
        });
        setPlatformPosts(allPosts);
      } else {
        setPlatformPosts([]);
      }
    } catch {
      // API unavailable — fall back to mock
      setPlatformCreators(null);
      setPlatformPosts(null);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatformFeed();
  }, [loadPlatformFeed]);

  useEffect(() => {
    let active = true;

    async function loadFeaturedCreators() {
      setFeaturedCreatorsLoading(true);
      setFeaturedCreatorsError(null);
      try {
        const { data } = await api.listCreators("?limit=10&sourceType=X");
        if (!active) return;
        const xCreators = data.filter((creator) =>
          creator.sources.some((source) => source.sourceType === "X"),
        );
        setFeaturedCreators(xCreators);

        if (isAuthenticated) {
          try {
            const { data: following } = await api.listFollowing(
              "?page=1&limit=100",
            );
            if (active) {
              setFollowedCreatorIds(
                new Set(following.map((item) => item.creator.id)),
              );
            }
          } catch {
            if (active) setFollowedCreatorIds(new Set());
          }
        } else {
          setFollowedCreatorIds(new Set());
        }
      } catch {
        if (active) setFeaturedCreatorsError("Could not load X creators.");
      } finally {
        if (active) setFeaturedCreatorsLoading(false);
      }
    }

    void loadFeaturedCreators();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const toggleFeaturedFollow = async (creator: CreatorListItem) => {
    setFollowActionError(null);
    setBusyCreatorId(creator.id);
    try {
      if (!isAuthenticated) {
        const connected = await connect();
        if (!connected) return;
      }

      if (followedCreatorIds.has(creator.id)) {
        await api.unfollowCreator(creator.id);
        setFollowedCreatorIds((current) => {
          const next = new Set(current);
          next.delete(creator.id);
          return next;
        });
      } else {
        await api.followCreator(creator.id);
        setFollowedCreatorIds((current) => new Set(current).add(creator.id));
      }
    } catch (error) {
      setFollowActionError(
        error instanceof Error ? error.message : "Could not update follow.",
      );
    } finally {
      setBusyCreatorId(null);
    }
  };

  const handleCopy = (signal: MockSignal) => {
    setSelectedSignal(signal);
    setIsModalOpen(true);
  };

  // Determine what to show in the feed:
  // - If API returned posts (even empty), show real posts from real creators
  // - If API failed (null), fall back to mock signals
  const useRealFeed = platformPosts !== null;
  const hasPlatformCreators = platformCreators && platformCreators.length > 0;

  // For real feed: filter by feedSearch
  const filteredPosts = (platformPosts ?? []).filter((post) => {
    if (!feedSearch) return true;
    const q = feedSearch.toLowerCase();
    return (
      post.creatorName.toLowerCase().includes(q) ||
      (post.authorHandle ?? "").toLowerCase().includes(q) ||
      (post.content ?? "").toLowerCase().includes(q) ||
      (post.title ?? "").toLowerCase().includes(q)
    );
  });

  const trendingTickers: TrendingTickerInfo[] = [
    {
      rank: 1,
      symbol: "$BTC",
      name: "Bitcoin",
      sentiment: "MIXED",
      count: "22 CALLS",
      priceUsd: livePrices.BTC?.priceUsd,
      change24h: livePrices.BTC?.change24h,
    },
    {
      rank: 2,
      symbol: "$ETH",
      name: "Ethereum",
      sentiment: "LONG",
      count: "9 CALLS",
      priceUsd: livePrices.ETH?.priceUsd,
      change24h: livePrices.ETH?.change24h,
    },
    {
      rank: 3,
      symbol: "$HYPE",
      name: "Hyperliquid",
      sentiment: "LONG",
      count: "8 CALLS",
      priceUsd: livePrices.HYPE?.priceUsd,
      change24h: livePrices.HYPE?.change24h,
    },
    {
      rank: 4,
      symbol: "$SOL",
      name: "Solana",
      sentiment: "LONG",
      count: "7 CALLS",
      priceUsd: livePrices.SOL?.priceUsd,
      change24h: livePrices.SOL?.change24h,
    },
    {
      rank: 5,
      symbol: "$AVAX",
      name: "Avalanche",
      sentiment: "SHORT",
      count: "2 CALLS",
      priceUsd: livePrices.AVAX?.priceUsd,
      change24h: livePrices.AVAX?.change24h,
    },
  ];

  // Format relative time
  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }

  return (
    <div className="space-y-6 px-2 lg:flex lg:h-[calc(100dvh-8rem)] lg:flex-col lg:overflow-hidden">
      {/* Top bar: search + testnet badge */}
      <div className="flex items-center gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#78716C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search creators — @handle or name"
            value={feedSearch}
            onChange={(e) => setFeedSearch(e.target.value)}
            className="w-full bg-[#FFFAF3] border border-[#E8DFD1] hover:border-[#171717] focus:border-[#171717] rounded-full pl-10 pr-4 py-2 text-xs font-mono text-[#171717] placeholder-[#78716C] shadow-xs focus:outline-none transition"
          />
        </div>

      </div>

      {/* 3-Column Terminal Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(190px,0.8fr)_minmax(0,2fr)] lg:grid-cols-[minmax(190px,0.8fr)_minmax(0,2fr)_minmax(200px,0.9fr)] xl:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,280px)] gap-4 lg:gap-5 items-start lg:flex-1 lg:min-h-0 lg:items-stretch lg:overflow-hidden">
        {/* Column 1: Left Filter & Terminal Stats (2 cols) */}
        <div className="min-w-0 space-y-5 font-mono lg:overflow-hidden">
          <div>
            <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
              // LIVE FEED
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#171717] mt-0.5">
              Terminal
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-[#78716C] mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>LIVE • POLLS EVERY 16S</span>
            </div>
          </div>

        </div>

        {/* Column 2: Center Live Calls Feed (7 cols) */}
        <div className="min-w-0 space-y-4 font-mono lg:min-h-0 lg:overflow-y-auto">
          {/* Feed Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1] text-xs">
            <div className="flex items-center gap-2">
            </div>
            <span className="text-[11px] text-[#78716C]">
              {useRealFeed
                ? `${filteredPosts.length} post${filteredPosts.length !== 1 ? "s" : ""}`
                : `${MOCK_SIGNALS.length} signals`}
            </span>
          </div>

          {/* Feed Cards */}
          <div className="space-y-4">
            {postsLoading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-xs text-[#78716C]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading platform feed…
              </div>
            ) : useRealFeed && hasPlatformCreators ? (
              filteredPosts.length === 0 ? (
                <div className="border border-[#E8DFD1] rounded-sm bg-[#FFFAF3] p-8 text-center font-mono">
                  <div className="text-sm font-bold text-[#171717]">No posts yet</div>
                  <p className="mt-1 font-sans text-xs text-[#78716C]">
                    Platform creators have no collected posts yet. Check back soon.
                  </p>
                </div>
              ) : (
                filteredPosts.map((post) => {
                  const timeAgo = relativeTime(post.publishedAt ?? post.fetchedAt);
                  return (
                    <article
                      key={post.id}
                      className="bg-[#FFFAF3] border border-[#E8DFD1] rounded-sm p-4 text-xs font-mono transition hover:border-[#171717]"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-[#E8DFD1]">
                        <div className="flex items-center gap-2">
                          {post.creatorAvatarUrl ? (
                            <img
                              src={post.creatorAvatarUrl}
                              alt={post.creatorName}
                              className="w-7 h-7 rounded-full object-cover border border-[#E8DFD1] grayscale"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-[#78716C] shrink-0 text-[10px] font-bold">
                              {post.creatorName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-[#171717]">
                              {post.creatorName}
                            </span>
                            <span className="text-[#78716C] text-[10px]">• {timeAgo}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {post.canonicalUrl && (
                            <a
                              href={post.canonicalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#78716C] hover:text-[#171717] flex items-center gap-0.5"
                            >
                              VIEW <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Post Body */}
                      {post.title && (
                        <h2 className="mt-3 text-sm font-bold text-[#171717] font-sans">
                          {post.title}
                        </h2>
                      )}
                      {post.content && (
                        <p className="mt-2 font-sans text-sm leading-relaxed text-[#292524] whitespace-pre-wrap break-words">
                          {post.content}
                        </p>
                      )}

                      {/* Post Meta */}
                      {(post.isReply || post.isRepost) && (
                        <div className="mt-2 flex gap-2 text-[10px] text-[#78716C]">
                          {post.isReply && <span>REPLY</span>}
                          {post.isRepost && <span>REPOST</span>}
                        </div>
                      )}
                    </article>
                  );
                })
              )
            ) : useRealFeed && !hasPlatformCreators ? (
              <div className="border border-[#E8DFD1] rounded-sm bg-[#FFFAF3] p-8 text-center font-mono">
                <div className="text-sm font-bold text-[#171717]">No creators on platform</div>
                <p className="mt-1 font-sans text-xs text-[#78716C]">
                  Add creators on the{" "}
                  <Link href="/discover" className="underline text-[#171717]">Discover</Link>{" "}
                  page to see their posts here.
                </p>
              </div>
            ) : (
              /* Fallback: mock signals */
              MOCK_SIGNALS.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onDeployStrategy={handleCopy}
                />
              ))
            )}
          </div>
        </div>

        {/* Column 3: Right Side Widgets (3 cols) */}
        <div className="min-w-0 md:col-span-2 lg:col-span-1 space-y-5 font-mono lg:overflow-hidden">
          {/* WHO TO FADE OR FOLLOW */}
          <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-3">
            <div className="text-[10px] uppercase text-[#78716C] pb-2 border-b border-[#E8DFD1] tracking-wider">
              WHO TO FADE OR FOLLOW
            </div>
            <div className="divide-y divide-[#E8DFD1]/60">
              {featuredCreatorsLoading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-[10px] text-[#78716C]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading X creators…
                </div>
              ) : featuredCreatorsError ? (
                <p className="py-3 text-[10px] text-[#F62440]">
                  {featuredCreatorsError}
                </p>
              ) : featuredCreators.length === 0 ? (
                <p className="py-3 text-[10px] text-[#78716C]">
                  No X creators yet. Add one from Discover.
                </p>
              ) : (
                featuredCreators.slice(0, 3).map((creator) => {
                  const xSource = creator.sources.find(
                    (source) => source.sourceType === "X",
                  );
                  const isFollowing = followedCreatorIds.has(creator.id);
                  return (
                    <div
                      key={creator.id}
                      className="py-2.5 flex items-center justify-between gap-2 px-1 hover:bg-[#FFF2DB]/40 rounded transition group"
                    >
                      <Link
                        href={`/creators/${creator.id}`}
                        className="flex min-w-0 items-center gap-2"
                      >
                        {creator.avatarUrl ? (
                          <img
                            src={creator.avatarUrl}
                            alt={creator.displayName}
                            className="w-7 h-7 rounded-full object-cover border border-[#E8DFD1] grayscale group-hover:grayscale-0 transition"
                          />
                        ) : (
                          <span className="w-7 h-7 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-[9px] font-bold text-[#78716C] shrink-0">
                            {creator.displayName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-[#171717] group-hover:underline">
                            {creator.displayName}
                          </span>
                          {xSource?.handle && (
                            <span className="block truncate text-[10px] text-[#78716C]">
                              @{xSource.handle.replace(/^@/, "")}
                            </span>
                          )}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => void toggleFeaturedFollow(creator)}
                        disabled={busyCreatorId === creator.id}
                        aria-label={
                          isFollowing
                            ? `Unfollow ${creator.displayName}`
                            : `Follow ${creator.displayName}`
                        }
                        className={`shrink-0 flex items-center gap-1 rounded-sm border px-2 py-1 text-[9px] font-bold transition disabled:opacity-50 ${
                          isFollowing
                            ? "border-[#171717] bg-[#171717] text-[#FFFAF3]"
                            : "border-[#E8DFD1] text-[#78716C] hover:border-[#171717] hover:text-[#171717]"
                        }`}
                      >
                        {busyCreatorId === creator.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isFollowing ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        {isFollowing ? "FOLLOWING" : "FOLLOW"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {followActionError && (
              <p className="mt-2 text-[10px] text-[#F62440]">
                {followActionError}
              </p>
            )}
          </div>

          {/* TRENDING TICKERS */}
          <div className="border border-[#E8DFD1] bg-[#FFFAF3] rounded-sm p-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E8DFD1]">
              <div className="text-[10px] uppercase text-[#78716C] tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                <span>TRENDING TICKERS</span>
              </div>
              <span className="text-[9px] text-[#78716C]">CLICK FOR CHART</span>
            </div>
            <div className="divide-y divide-[#E8DFD1]/60 text-xs">
              {trendingTickers.map((t) => {
                const isPositive = (t.change24h ?? 0) >= 0;
                return (
                  <button
                    key={t.rank}
                    type="button"
                    onClick={() => setSelectedTrendingTicker(t)}
                    className="w-full py-2 flex items-center justify-between text-left hover:bg-[#FFF2DB]/80 -mx-1 px-1 rounded-xs transition group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#78716C] text-[10px] w-3 font-mono">{t.rank}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#171717] group-hover:text-black">{t.symbol}</span>
                          <LineChart className="w-3 h-3 text-[#78716C] opacity-0 group-hover:opacity-100 transition" />
                        </div>
                        <span className="text-[9px] text-[#78716C] block leading-tight">{t.count}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {t.priceUsd !== undefined ? (
                        <div className="font-bold text-[#171717] text-[11px]">
                          ${t.priceUsd >= 1000
                            ? t.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })
                            : t.priceUsd.toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-[10px] text-[#78716C]">Loading...</div>
                      )}
                      {t.change24h !== undefined ? (
                        <div
                          className={`text-[9px] font-bold flex items-center justify-end gap-0.5 ${
                            isPositive ? "text-[#16A34A]" : "text-[#F62440]"
                          }`}
                        >
                          {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                          <span>
                            {isPositive ? "+" : ""}
                            {t.change24h.toFixed(2)}%
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-[9px] font-bold ${
                            t.sentiment === "LONG"
                              ? "text-[#16A34A]"
                              : t.sentiment === "SHORT"
                                ? "text-[#F62440]"
                                : "text-[#78716C]"
                          }`}
                        >
                          {t.sentiment}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <CreateStrategyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCreatorId={selectedSignal?.creatorId}
      />

      {selectedTrendingTicker && (
        <TrendingChartDrawer
          ticker={selectedTrendingTicker}
          onClose={() => setSelectedTrendingTicker(null)}
        />
      )}
    </div>
  );
}

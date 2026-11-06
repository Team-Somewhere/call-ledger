"use client";

import React, { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  api,
  ApiRequestError,
  type ActivityPost,
  type CreatorDetailResponse,
} from "../../../lib/api";
import { useWalletSession } from "../../../lib/use-wallet-session";
import { EmptyState } from "../../../components/empty-state";
import {
  MonitoringStatusBadge,
  SourceBadge,
  VerificationBadge,
  sourceDisplayHandle,
} from "../../../components/source-badge";
import { ToastProvider, useToast } from "../../../components/toast";

interface CreatorPageProps {
  params: Promise<{ id: string }>;
}

function CreatorProfileContent({ id }: { id: string }) {
  const { isAuthenticated, connect, isConnecting } = useWalletSession();
  const { notify } = useToast();

  const [creator, setCreator] = useState<CreatorDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<ActivityPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.getCreator(id);
      setCreator(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Could not load creator.",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    void api
      .creatorPosts(id, "?limit=5&includeReplies=true&includeReposts=true")
      .then(({ data }) => {
        if (active) setPosts(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setPostsError(
            err instanceof ApiRequestError
              ? err.message
              : "Could not load recent posts.",
          );
        }
      })
      .finally(() => {
        if (active) setPostsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const toggleFollow = async () => {
    if (!creator) return;
    if (!isAuthenticated) {
      notify("error", "Sign in with your wallet to follow creators.");
      return;
    }
    setBusy(true);
    try {
      if (creator.isFollowing) {
        await api.unfollowCreator(creator.id);
        notify("success", `Unfollowed ${creator.displayName}`);
      } else {
        await api.followCreator(creator.id);
        notify("success", `Following ${creator.displayName}`);
      }
      await load();
    } catch (err) {
      notify(
        "error",
        err instanceof ApiRequestError ? err.message : "Action failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-12 font-mono space-y-4">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#171717]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Discover
        </Link>
        <div className="text-xs p-3 rounded-sm border bg-[#F62440]/10 border-[#F62440]/30 text-[#F62440]">
          {error}
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex items-center justify-center text-xs text-[#78716C] gap-2 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading creator…
      </div>
    );
  }

  const waiting = creator.sources.some(
    (s) => s.status === "WAITING_FOR_AUTHORIZED_ACCESS",
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-mono">
      <Link
        href="/discover"
        className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#171717]"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Discover
      </Link>

      {/* Header card */}
      <div className="border border-[#E8DFD1] rounded-sm bg-[#FFFAF3] p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {creator.avatarUrl ? (
              <img
                src={creator.avatarUrl}
                alt={creator.displayName}
                className="w-14 h-14 rounded-full object-cover border border-[#E8DFD1]"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#FFF2DB] border border-[#E8DFD1] flex items-center justify-center text-sm text-[#78716C] font-bold">
                {creator.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#171717] truncate">
                {creator.displayName}
              </h1>
              <div className="text-[11px] text-[#78716C] mt-0.5">
                {creator.followersCount} follower
                {creator.followersCount === 1 ? "" : "s"} on CallLedger · added{" "}
                {new Date(creator.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isAuthenticated ? (
              <button
                onClick={() => void connect()}
                disabled={isConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-black text-[#FFFAF3] rounded-sm text-xs transition disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isConnecting ? "Signing…" : "Sign in to follow"}
              </button>
            ) : (
              <button
                onClick={() => void toggleFollow()}
                disabled={busy}
                className={
                  creator.isFollowing
                    ? "flex items-center gap-1.5 px-3 py-1.5 border border-[#E8DFD1] hover:border-[#F62440] hover:text-[#F62440] text-[#78716C] rounded-sm text-xs transition disabled:opacity-50"
                    : "flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-black text-[#FFFAF3] rounded-sm text-xs font-bold transition disabled:opacity-50"
                }
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : creator.isFollowing ? (
                  <UserMinus className="w-3.5 h-3.5" />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" />
                )}
                {creator.isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}
          </div>
        </div>

        {creator.description && (
          <p className="mt-3 text-xs text-[#78716C] font-sans leading-relaxed">
            {creator.description}
          </p>
        )}
      </div>

      {waiting && (
        <div className="flex items-start gap-2 text-[11px] text-[#78716C] font-sans bg-[#FFE5BF]/50 border border-[#E8DFD1] rounded-sm px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <strong className="text-[#171717]">
              WAITING_FOR_AUTHORIZED_ACCESS
            </strong>{" "}
            — One or more sources need authorized provider access before posts
            can be collected.
          </span>
        </div>
      )}

      {/* Sources */}
      <div className="border border-[#E8DFD1] rounded-sm">
        <div className="px-4 py-3 border-b border-[#E8DFD1] text-xs font-bold uppercase tracking-wider text-[#171717]">
          // Connected source profiles
        </div>
        <div className="divide-y divide-[#E8DFD1]">
          {creator.sources.map((source) => (
            <div key={source.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <SourceBadge sourceType={source.sourceType} />
                  <a
                    href={source.canonicalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#171717] hover:underline truncate flex items-center gap-1"
                  >
                    {sourceDisplayHandle(source)}
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <VerificationBadge status={source.verificationStatus} />
                  <MonitoringStatusBadge status={source.status} />
                </div>
              </div>
              <div className="text-[10px] text-[#78716C] flex flex-wrap gap-x-3 gap-y-1">
                <span>IDENTITY: {source.externalId ?? "unresolved"}</span>
                <span>
                  LINK: {source.linkRelationshipType ?? "unknown"}
                  {source.linkVerificationMethod
                    ? ` / ${source.linkVerificationMethod}`
                    : ""}
                </span>
                <span>
                  LAST FETCH:{" "}
                  {source.lastFetchedAt
                    ? new Date(source.lastFetchedAt).toLocaleString()
                    : "never"}
                </span>
                {source.lastError && (
                  <span className="text-[#F62440]">
                    ERROR: {source.lastError}
                  </span>
                )}
              </div>
            </div>
          ))}
          {creator.sources.length === 0 && (
            <div className="px-4 py-6 text-xs text-[#78716C]">
              No source profiles linked.
            </div>
          )}
        </div>
      </div>

      {/* Monitoring status summary */}
      <div className="border border-[#E8DFD1] rounded-sm bg-[#FFF2DB]/30 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-[#171717] mb-2">
          // Monitoring status
        </div>
        <div className="space-y-1.5 text-[11px] text-[#78716C] font-sans">
          {creator.sources.length === 0 && <p>No monitoring configured.</p>}
          {creator.sources.map((source) => (
            <p key={source.id} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span className="font-mono">{source.sourceType}</span> —{" "}
              {source.status === "ACTIVE"
                ? source.lastFetchedAt
                  ? `active; last fetched ${new Date(source.lastFetchedAt).toLocaleString()}.`
                  : "active; waiting for its first scheduled fetch."
                : source.status === "WAITING_FOR_AUTHORIZED_ACCESS"
                  ? "awaiting authorized provider access. No posts are being fetched."
                  : source.status.toLowerCase() + "."}
            </p>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <div className="text-[10px] uppercase text-[#78716C] tracking-widest">
          // RECENT SOURCE POSTS
        </div>
        {postsError && (
          <div className="rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {postsError}
          </div>
        )}
        {postsLoading ? (
          <div className="h-24 animate-pulse rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]" />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<ExternalLink className="w-5 h-5" />}
            title="No posts collected yet"
            description={
              waiting
                ? "Posts will appear when an authorized source becomes available."
                : "This creator's connected sources have not produced any posts yet."
            }
          />
        ) : (
          <div className="divide-y divide-[#E8DFD1] rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
            {posts.map((post) => (
              <article key={post.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SourceBadge sourceType={post.sourceType} />
                    {post.isReply && (
                      <span className="text-[9px] text-[#78716C]">REPLY</span>
                    )}
                    {post.isRepost && (
                      <span className="text-[9px] text-[#78716C]">REPOST</span>
                    )}
                  </div>
                  <time className="text-[10px] text-[#78716C]">
                    {new Date(
                      post.publishedAt ?? post.fetchedAt,
                    ).toLocaleString()}
                  </time>
                </div>
                {post.title && (
                  <h2 className="text-xs font-bold text-[#171717]">
                    {post.title}
                  </h2>
                )}
                {post.content && (
                  <p className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-[#292524]">
                    {post.content}
                  </p>
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function CreatorPage({ params }: CreatorPageProps) {
  const { id } = use(params);
  return (
    <ToastProvider>
      <CreatorProfileContent id={id} />
    </ToastProvider>
  );
}

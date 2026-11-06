import {
  SourceAdapterError,
  type CreatorSourceAdapter,
  type FetchPostsInput,
  type FetchPostsResult,
  type NormalizedPost,
  type ResolvedCreator,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import { hashNormalizedContent } from "./normalize";

/**
 * Bluesky adapter — public, unauthenticated read access.
 *
 * Endpoints (official AT Protocol AppView):
 * - GET /xrpc/app.bsky.actor.getProfile?actor=<handle|did>
 * - GET /xrpc/app.bsky.feed.getAuthorFeed?actor=<did>&limit=...
 *
 * Docs:
 * - https://docs.bsky.app/docs/api/app-bsky-actor-get-profile
 * - https://docs.bsky.app/docs/api/app-bsky-feed-get-author-feed
 *
 * No API key, app password or user password is ever requested.
 */

export const BLUESKY_PUBLIC_API = "https://public.api.bsky.app";

interface BlueskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
}

interface BlueskyAuthorFeed {
  feed?: Array<{
    reason?: { $type?: string };
    reply?: unknown;
    post?: {
      uri?: string;
      cid?: string;
      author?: { did?: string; handle?: string };
      record?: { text?: string; createdAt?: string };
      indexedAt?: string;
      embed?: {
        images?: Array<{ fullsize?: string; thumb?: string }>;
      };
    };
  }>;
  cursor?: string;
}

export interface BlueskyAdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class BlueskyAdapter implements CreatorSourceAdapter {
  readonly sourceType = "BLUESKY" as const;

  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: BlueskyAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? BLUESKY_PUBLIC_API).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
  }

  async validate(input: unknown): Promise<ValidatedCreatorSource> {
    const handle = normalizeHandle(
      typeof input === "string" ? input : String(input ?? ""),
    );

    if (!isValidBlueskyHandle(handle)) {
      throw new SourceAdapterError(
        "INVALID_HANDLE",
        "Invalid Bluesky handle format (expected e.g. trader.bsky.social)",
        400,
      );
    }

    const profile = await this.getProfile(handle);

    const canonicalUrl = `https://bsky.app/profile/${profile.handle}`;

    return {
      sourceType: "BLUESKY",
      // DID is the stable external identity — handles can change.
      externalId: profile.did,
      handle: profile.handle,
      canonicalUrl,
      displayName: profile.displayName?.trim() || profile.handle,
      description: profile.description?.trim() || null,
      avatarUrl: profile.avatar ?? null,
      status: "ACTIVE",
      notices: [],
      providerMeta: { did: profile.did },
    };
  }

  async resolveCreator(
    input: ValidatedCreatorSource,
  ): Promise<ResolvedCreator> {
    return {
      displayName: input.displayName?.trim() || input.handle || "Bluesky User",
      description: input.description,
      avatarUrl: input.avatarUrl,
      source: input,
    };
  }

  async fetchLatestPosts(input: FetchPostsInput): Promise<FetchPostsResult> {
    const actor = input.source.externalId ?? input.source.handle;
    if (!actor) {
      throw new SourceAdapterError(
        "MISSING_ACTOR",
        "Bluesky source has no DID or handle",
        400,
      );
    }

    const limit = Math.min(input.limit ?? 25, 50);
    const url = new URL(`${this.baseUrl}/xrpc/app.bsky.feed.getAuthorFeed`);
    url.searchParams.set("actor", actor);
    url.searchParams.set("limit", String(limit));
    if (input.cursor) url.searchParams.set("cursor", input.cursor);

    const payload = await this.request<BlueskyAuthorFeed>(url);

    const posts: NormalizedPost[] = [];
    for (const item of payload.feed ?? []) {
      const post = item.post;
      if (!post?.uri) continue;
      const rkey = post.uri.split("/").pop();
      const text = post.record?.text ?? null;
      posts.push({
        sourcePostId: post.uri,
        sourceAuthorId: post.author?.did ?? input.source.externalId,
        // Null (not now) when the provider gives no date: never fabricate.
        publishedAt: parseDate(post.record?.createdAt ?? post.indexedAt),
        contentHash: hashNormalizedContent(null, text),
        text,
        title: null,
        authorHandle: post.author?.handle ?? input.source.handle ?? null,
        url: rkey
          ? `https://bsky.app/profile/${post.author?.handle ?? input.source.handle ?? actor}/post/${rkey}`
          : null,
        // A repost in the author feed is someone else's post; mark it so the
        // worker can store it as a repost rather than as the author's own.
        isRepost: item.reason?.$type === "app.bsky.feed.defs#reasonRepost",
        isReply: Boolean(item.reply),
        mediaUrls: [],
        publicMetrics: null,
        status: post.record ? "ACTIVE" : "UNAVAILABLE",
      });
      const normalizedPost = posts.at(-1);
      if (normalizedPost) {
        normalizedPost.mediaUrls = (post.embed?.images ?? [])
          .map((image) => image.fullsize ?? image.thumb)
          .filter((image): image is string => Boolean(image));
      }
    }

    return {
      available: true,
      posts,
      nextCursor: payload.cursor ?? null,
    };
  }

  private async getProfile(handle: string): Promise<BlueskyProfile> {
    const url = new URL(`${this.baseUrl}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set("actor", handle);

    try {
      return await this.request<BlueskyProfile>(url);
    } catch (error) {
      if (error instanceof SourceAdapterError && error.code === "NOT_FOUND") {
        throw new SourceAdapterError(
          "PROFILE_NOT_FOUND",
          `No Bluesky profile found for '${handle}'`,
          404,
        );
      }
      throw error;
    }
  }

  private async request<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        throw new SourceAdapterError(
          "RATE_LIMITED",
          `Bluesky rate limit reached${retryAfter ? ` (retry after ${retryAfter}s)` : ""}`,
          429,
          true,
          parseRetryAfter(retryAfter),
        );
      }

      if (response.status === 400 || response.status === 404) {
        throw new SourceAdapterError(
          "NOT_FOUND",
          "Bluesky returned no profile for that handle",
          404,
        );
      }

      if (!response.ok) {
        throw new SourceAdapterError(
          "UPSTREAM_HTTP_ERROR",
          `Bluesky API responded with HTTP ${response.status}`,
          502,
          response.status >= 500,
        );
      }

      return (await readJsonWithLimit(response, this.maxResponseBytes)) as T;
    } catch (error) {
      if (error instanceof SourceAdapterError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SourceAdapterError(
          "UPSTREAM_TIMEOUT",
          "Bluesky did not respond in time",
          504,
          true,
        );
      }
      throw new SourceAdapterError(
        "UPSTREAM_UNREACHABLE",
        "Could not reach the public Bluesky API",
        502,
        true,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readJsonWithLimit(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new SourceAdapterError(
      "RESPONSE_TOO_LARGE",
      "Bluesky returned a response that is too large",
      502,
    );
  }
  if (!response.body) {
    throw new SourceAdapterError(
      "INVALID_RESPONSE",
      "Bluesky returned an empty response",
      502,
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourceAdapterError(
        "RESPONSE_TOO_LARGE",
        "Bluesky returned a response that is too large",
        502,
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SourceAdapterError(
      "INVALID_RESPONSE",
      "Bluesky returned malformed JSON",
      502,
    );
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export function normalizeHandle(raw: string): string {
  let value = raw.trim().replace(/^@+/, "").toLowerCase();
  // Accept full profile URLs too.
  const urlMatch = value.match(/^https?:\/\/bsky\.app\/profile\/([^/?#]+)/);
  if (urlMatch?.[1]) value = urlMatch[1].toLowerCase();
  return value;
}

export function isValidBlueskyHandle(handle: string): boolean {
  if (handle.length < 3 || handle.length > 253) return false;
  if (handle.startsWith("did:")) return false;
  return /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(handle);
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const blueskyAdapter = new BlueskyAdapter();

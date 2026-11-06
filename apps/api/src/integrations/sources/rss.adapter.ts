import Parser from "rss-parser";
import { createHash } from "node:crypto";
import {
  SourceAdapterError,
  type CreatorSourceAdapter,
  type FetchPostsInput,
  type FetchPostsResult,
  type ResolvedCreator,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import { safeFetch, type SafeFetchOptions } from "./safe-fetch";
import { assertSafeUrl } from "./ssrf";
import { hashNormalizedContent } from "./normalize";

/**
 * RSS / Atom adapter.
 *
 * Phase 2A implements validation + creator resolution (feed title, description,
 * canonical URL, sample items). Recurring polling is Phase 2B — but the adapter
 * exposes `fetchLatestPosts` so the worker can reuse it unchanged.
 */

const ACCEPTED_CONTENT_TYPES = [
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
  "application/rdf+xml",
  "text/html", // some feeds are served with the wrong content type
];

export interface RssAdapterOptions {
  fetchOptions?: SafeFetchOptions;
}

interface ParsedFeedShape {
  title?: string;
  description?: string;
  link?: string;
  feedUrl?: string;
  items?: Array<{
    guid?: string;
    id?: string;
    link?: string;
    title?: string;
    content?: string;
    contentSnippet?: string;
    isoDate?: string;
    pubDate?: string;
    creator?: string;
    author?: string;
  }>;
}

export class RssAdapter implements CreatorSourceAdapter {
  readonly sourceType = "RSS" as const;

  constructor(private readonly options: RssAdapterOptions = {}) {}

  async validate(input: unknown): Promise<ValidatedCreatorSource> {
    if (typeof input !== "string" || input.trim() === "") {
      throw new SourceAdapterError(
        "INVALID_FEED_URL",
        "A feed URL is required",
        400,
      );
    }

    // Structural + DNS-level SSRF check happens inside safeFetch too, but we
    // fail fast on obviously bad URLs before any network call.
    const url = await assertSafeUrl(input.trim());

    const response = await safeFetch(url.toString(), {
      acceptContentTypes: ACCEPTED_CONTENT_TYPES,
      timeoutMs: 10_000,
      maxBytes: 2 * 1024 * 1024,
      ...this.options.fetchOptions,
    });

    const feed = await this.parseFeed(response.body, response.url);
    const items = feed.items ?? [];

    const canonicalUrl = this.resolveCanonicalUrl(feed, response.url);
    const title = feed.title?.trim() || url.hostname;
    const description = feed.description?.trim() || null;

    if (items.length === 0 && !feed.title) {
      throw new SourceAdapterError(
        "INVALID_FEED",
        "The URL did not return a recognizable RSS or Atom feed",
        422,
      );
    }

    return {
      sourceType: "RSS",
      // Stable feed identity: canonical feed URL, normalized.
      externalId: canonicalUrl,
      handle: new URL(canonicalUrl).hostname,
      canonicalUrl,
      displayName: title,
      description,
      avatarUrl: null,
      status: "ACTIVE",
      notices: [],
      providerMeta: {
        // The URL we actually poll. canonicalUrl is the site link, which is
        // NOT the feed and must never be fetched for posts.
        feedUrl: response.url,
        feedTitle: title,
        feedFormat: this.detectFormat(response.body),
        itemSampleSize: items.length,
        lastEtag: response.etag,
        lastModified: response.lastModified,
      },
    };
  }

  async resolveCreator(
    input: ValidatedCreatorSource,
  ): Promise<ResolvedCreator> {
    return {
      displayName: input.displayName?.trim() || input.handle || "RSS Feed",
      description: input.description,
      avatarUrl: null,
      source: input,
    };
  }

  async fetchLatestPosts(input: FetchPostsInput): Promise<FetchPostsResult> {
    const feedUrl = resolveFeedUrl(input.source);
    if (!feedUrl) {
      return {
        available: false,
        unavailableReason: "FEED_URL_MISSING",
        posts: [],
        nextCursor: null,
      };
    }

    const headers: Record<string, string> = {};
    if (input.conditional?.etag)
      headers["if-none-match"] = input.conditional.etag;
    if (input.conditional?.lastModified) {
      headers["if-modified-since"] = input.conditional.lastModified;
    }

    const response = await safeFetch(feedUrl, {
      acceptContentTypes: ACCEPTED_CONTENT_TYPES,
      timeoutMs: 10_000,
      maxBytes: 2 * 1024 * 1024,
      ...this.options.fetchOptions,
      headers,
    });

    if (response.notModified) {
      return {
        available: true,
        posts: [],
        nextCursor: null,
        notModified: true,
        etag: response.etag ?? input.conditional?.etag ?? null,
        lastModified:
          response.lastModified ?? input.conditional?.lastModified ?? null,
      };
    }

    const feed = await this.parseFeed(response.body, response.url);
    const limit = input.limit ?? 20;
    const items = (feed.items ?? []).slice(0, limit);

    const posts = items.map((item, index) => {
      const externalId = stableRssItemId(item, index);
      const publishedAt = parseDate(item.isoDate ?? item.pubDate);
      const title = item.title?.trim() || null;
      const content = item.contentSnippet ?? item.content ?? item.title ?? null;
      return {
        sourcePostId: externalId,
        sourceAuthorId: input.source.externalId,
        // Never fabricate a date. Null tells the worker to use fetchedAt.
        publishedAt,
        contentHash: hashNormalizedContent(title, content),
        text: content,
        title,
        url: item.link ?? null,
        authorHandle: item.creator?.trim() || item.author?.trim() || null,
        isReply: false,
        isRepost: false,
        mediaUrls: [],
        publicMetrics: null,
      };
    });

    return {
      available: true,
      posts,
      nextCursor: null,
      notModified: false,
      etag: response.etag,
      lastModified: response.lastModified,
    };
  }

  private async parseFeed(
    body: string,
    feedUrl: string,
  ): Promise<ParsedFeedShape> {
    const parser = new Parser({
      timeout: 10_000,
      headers: { "user-agent": "CallLedgerBot/2.0" },
    });

    if (!body || body.trim() === "") {
      throw new SourceAdapterError(
        "EMPTY_FEED",
        "The feed response was empty",
        422,
      );
    }

    try {
      const parsed = (await parser.parseString(body)) as ParsedFeedShape;
      return { ...parsed, feedUrl };
    } catch {
      throw new SourceAdapterError(
        "MALFORMED_FEED",
        "The response could not be parsed as RSS or Atom XML",
        422,
      );
    }
  }

  private resolveCanonicalUrl(feed: ParsedFeedShape, fetchedUrl: string) {
    // Prefer the feed's own advertised link when it is a valid, safe URL.
    const candidate = feed.link?.trim();
    if (candidate) {
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return parsed.toString();
        }
      } catch {
        // fall through
      }
    }
    return fetchedUrl;
  }

  private detectFormat(body: string): "RSS" | "ATOM" | "RDF" | "UNKNOWN" {
    const head = body.slice(0, 1000).toLowerCase();
    if (head.includes("<feed")) return "ATOM";
    if (head.includes("<rdf") || head.includes("rss 1.0")) return "RDF";
    if (head.includes("<rss")) return "RSS";
    return "UNKNOWN";
  }
}

/** Feed URL recorded at validation time. Never the site homepage. */
function resolveFeedUrl(source: {
  canonicalUrl: string;
  providerMeta?: unknown;
}): string | null {
  const meta = source.providerMeta as { feedUrl?: unknown } | null | undefined;
  if (typeof meta?.feedUrl === "string" && meta.feedUrl) return meta.feedUrl;
  return null;
}

/**
 * Stable item identity across polls. Prefer the feed's guid/id, then the item
 * link. Only when neither exists do we fall back to a hash of the item's own
 * content (never the array index, which changes when the feed re-orders).
 */
function stableRssItemId(
  item: {
    guid?: string;
    id?: string;
    link?: string;
    title?: string;
    isoDate?: string;
    pubDate?: string;
  },
  _index: number,
): string {
  const explicit = (item.guid ?? item.id ?? "").trim();
  if (explicit) return explicit;
  const link = (item.link ?? "").trim();
  if (link) return link;
  const publishedAt = item.isoDate ?? item.pubDate ?? "";
  const identity = link
    ? `${canonicalizeUrl(link)}|${publishedAt}`
    : `${item.title?.trim() ?? ""}|${publishedAt}`;
  return `rss:${createHash("sha256").update(identity).digest("hex")}`;
}

function canonicalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const rssAdapter = new RssAdapter();

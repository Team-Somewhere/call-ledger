import { createHash } from "node:crypto";
import {
  X_UNAVAILABLE_MESSAGE,
  type CreatorSourceAdapter,
  type CreatorSourceType,
  type FetchPostsInput,
  type FetchPostsResult,
  type NormalizedPost,
  type ResolvedCreator,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import { SourceAdapterError } from "@call-ledger/shared";
import type {
  FirecrawlClient,
  FirecrawlScrapeResult,
} from "../firecrawl/firecrawl.client";

/** Twitter/X snowflake epoch (ms). */
const X_SNOWFLAKE_EPOCH_MS = 1288834974657n;

export interface XAdapterOptions {
  /** True when an authorized X data provider or Firecrawl search is configured. */
  ingestionEnabled?: boolean;
  firecrawl?: FirecrawlClient;
}

export class XAdapter implements CreatorSourceAdapter {
  readonly sourceType: CreatorSourceType = "X";
  readonly unavailableMessage = X_UNAVAILABLE_MESSAGE;

  private readonly ingestionEnabled: boolean;
  private readonly firecrawl?: FirecrawlClient;

  constructor(options: XAdapterOptions = {}) {
    this.firecrawl = options.firecrawl;
    this.ingestionEnabled =
      options.ingestionEnabled ?? Boolean(this.firecrawl?.enabled);
  }

  async validate(input: unknown): Promise<ValidatedCreatorSource> {
    const username = normalizeXUsername(
      typeof input === "string" ? input : String(input ?? ""),
    );

    if (!isValidXUsername(username)) {
      throw new SourceAdapterError(
        "INVALID_HANDLE",
        "Invalid X username format",
        400,
      );
    }

    const isAvailable =
      this.ingestionEnabled || Boolean(this.firecrawl?.enabled);

    let displayName: string = `@${username}`;
    let description: string | null = null;
    let avatarUrl: string | null = null;

    if (this.firecrawl?.enabled) {
      try {
        const scrape = await this.firecrawl.scrape(
          `https://x.com/${username}`,
          { allowSocial: true },
        );

        if (scrape.title) {
          const cleanedTitle = scrape.title
            .replace(/\s+\(@[A-Za-z0-9_]+\).*$/i, "")
            .replace(/\s+on X:.*$/i, "")
            .replace(/\s+\/\s*X$/i, "")
            .trim();
          if (cleanedTitle) displayName = cleanedTitle;
        }

        if (scrape.description) {
          description = scrape.description.trim() || null;
        }

        avatarUrl = extractXProfileAvatar(scrape);

        if (scrape.markdown) {
          const nameMatch = scrape.markdown.match(
            /^#\s+(.+?)(?:\s+\(@[A-Za-z0-9_]+\))?$/m,
          );
          if (nameMatch?.[1] && displayName === `@${username}`) {
            displayName = nameMatch[1].trim();
          }

          if (!description) {
            const bioMatch = scrape.markdown.match(
              /^#\s+.+?\n\n([^\n]+(?:\n[^\n]+)?)/m,
            );
            if (bioMatch?.[1] && !bioMatch[1].startsWith("- ")) {
              description = bioMatch[1].trim();
            }
          }
        }
      } catch {
        // Fallback to username if scraping times out or is offline
      }
    }

    return {
      sourceType: "X",
      externalId: null,
      handle: username,
      canonicalUrl: `https://x.com/${username}`,
      displayName,
      description,
      avatarUrl,
      status: isAvailable ? "ACTIVE" : "WAITING_FOR_AUTHORIZED_ACCESS",
      notices: isAvailable
        ? []
        : [
            "X ingestion is disabled (X_INGESTION_ENABLED=false).",
            X_UNAVAILABLE_MESSAGE,
          ],
      providerMeta: {
        ingestionEnabled: isAvailable,
        provider: this.firecrawl?.enabled ? "FIRECRAWL" : "OFFLINE",
      },
    };
  }

  async resolveCreator(
    input: ValidatedCreatorSource,
  ): Promise<ResolvedCreator> {
    return {
      displayName: input.displayName?.trim() || `@${input.handle}`,
      description: input.description ?? null,
      avatarUrl: input.avatarUrl ?? null,
      source: input,
    };
  }

  async fetchLatestPosts(input: FetchPostsInput): Promise<FetchPostsResult> {
    const handle = input.source.handle;
    if (!handle) {
      return {
        available: false,
        unavailableReason: "MISSING_HANDLE",
        posts: [],
        nextCursor: null,
      };
    }

    if (this.firecrawl?.enabled) {
      try {
        const limit = Math.min(input.limit ?? 20, 20);
        const candidates = new Map<string, RawXPostCandidate>();

        // Prefer the live profile page — it surfaces the newest posts.
        try {
          const scrape = await this.firecrawl.scrape(
            `https://x.com/${handle}`,
            {
              allowSocial: true,
            },
          );
          for (const candidate of extractPostsFromProfileMarkdown(
            scrape.markdown,
            handle,
          )) {
            candidates.set(candidate.statusId, candidate);
          }
        } catch {
          // Fall through to search if profile scrape fails.
        }

        // Supplement with time-bounded web search, then keep newest by snowflake.
        const since = recentSearchSinceDate(14);
        const searchQueries = [
          `from:${handle} since:${since}`,
          `site:x.com/${handle}/status after:${since}`,
        ];

        for (const query of searchQueries) {
          if (candidates.size >= limit * 2) break;
          try {
            const searchResults = await this.firecrawl.search(query, limit);
            for (const item of searchResults) {
              const match = item.url.match(
                /(?:x|twitter)\.com\/([^/?#]+)\/status\/([0-9]+)/i,
              );
              if (!match?.[2]) continue;
              const author = match[1]?.toLowerCase();
              if (author && author !== handle.toLowerCase()) continue;

              const statusId = match[2];
              if (candidates.has(statusId)) continue;

              let cleanTitle = (item.title || "")
                .replace(/\s+on X:.*$/i, "")
                .replace(/\s+\/\s*X$/i, "")
                .replace(/^"|"$/g, "")
                .trim();

              let text = (item.description || item.title || "").trim();
              if (!text && cleanTitle) text = cleanTitle;

              candidates.set(statusId, {
                statusId,
                url: item.url,
                title: cleanTitle || null,
                text: text || cleanTitle || "Trading update from creator",
              });
            }
          } catch {
            // Try next query strategy.
          }
        }

        const ranked = [...candidates.values()]
          .map((candidate) => toNormalizedPost(candidate, handle))
          .sort(
            (a, b) =>
              (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
          );

        // Prefer posts from the last 60 days so random old search hits drop out.
        const maxAgeMs = 60 * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - maxAgeMs;
        const recent = ranked.filter(
          (p) => p.publishedAt && p.publishedAt.getTime() >= cutoff,
        );
        const posts = (recent.length > 0 ? recent : ranked).slice(0, limit);

        return {
          available: true,
          posts,
          nextCursor: posts[0]?.sourcePostId ?? null,
        };
      } catch (err) {
        return {
          available: false,
          unavailableReason:
            err instanceof Error ? err.message : "FIRECRAWL_SEARCH_FAILED",
          posts: [],
          nextCursor: null,
        };
      }
    }

    return {
      available: false,
      unavailableReason: this.ingestionEnabled
        ? "X_ADAPTER_NOT_IMPLEMENTED"
        : "WAITING_FOR_AUTHORIZED_ACCESS",
      posts: [],
      nextCursor: null,
    };
  }
}

interface RawXPostCandidate {
  statusId: string;
  url: string;
  title: string | null;
  text: string;
}

function toNormalizedPost(
  candidate: RawXPostCandidate,
  handle: string,
): NormalizedPost {
  const content =
    candidate.text || candidate.title || "Trading update from creator";
  const contentHash = createHash("sha256").update(content).digest("hex");
  const publishedAt =
    snowflakeToDate(candidate.statusId) ??
    // Non-numeric fallback IDs should not pretend to be "now".
    null;

  return {
    sourcePostId: candidate.statusId,
    sourceAuthorId: null,
    authorHandle: handle,
    title: candidate.title ? candidate.title.slice(0, 250) : null,
    text: content,
    url: candidate.url,
    publishedAt,
    contentHash,
    mediaUrls: [],
    isReply: false,
    isRepost: false,
    status: "ACTIVE",
  };
}

/**
 * Decode an X status snowflake ID into the tweet's created-at time.
 * https://github.com/client9/snowflake2time
 */
export function snowflakeToDate(statusId: string): Date | null {
  if (!/^\d+$/.test(statusId)) return null;
  try {
    const id = BigInt(statusId);
    const ms = Number((id >> 22n) + X_SNOWFLAKE_EPOCH_MS);
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function recentSearchSinceDate(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Pull status IDs + nearby text from a scraped X profile markdown dump.
 */
export function extractPostsFromProfileMarkdown(
  markdown: string | null | undefined,
  handle: string,
): RawXPostCandidate[] {
  if (!markdown) return [];

  const results: RawXPostCandidate[] = [];
  const seen = new Set<string>();
  const statusRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\/(\d+)/gi;

  let match: RegExpExecArray | null;
  while ((match = statusRegex.exec(markdown)) !== null) {
    const author = match[1];
    const statusId = match[2];
    if (!author || !statusId) continue;
    if (author.toLowerCase() !== handle.toLowerCase()) continue;
    if (seen.has(statusId)) continue;
    seen.add(statusId);

    const start = Math.max(0, match.index - 280);
    const end = Math.min(markdown.length, match.index + match[0].length + 280);
    const window = markdown.slice(start, end);

    const cleaned = window
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[#*_>`]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const text =
      cleaned
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .find((s) => s.length > 20 && !/^@?\w+$/.test(s)) ||
      cleaned.slice(0, 280) ||
      "Trading update from creator";

    results.push({
      statusId,
      url: `https://x.com/${handle}/status/${statusId}`,
      title: text.slice(0, 120),
      text,
    });
  }

  return results;
}

export function extractXProfileAvatar(
  scrape: Pick<FirecrawlScrapeResult, "imageUrl" | "markdown">,
): string | null {
  const markdownImages = [
    ...(scrape.markdown?.matchAll(
      /!\[[^\]]*\]\((https:\/\/pbs\.twimg\.com\/profile_images\/[^)\s]+)(?:\s+["'][^)]*["'])?\)/g,
    ) ?? []),
  ].map((match) => match[1]);

  for (const candidate of [scrape.imageUrl, ...markdownImages]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (
        url.protocol === "https:" &&
        url.hostname === "pbs.twimg.com" &&
        url.pathname.startsWith("/profile_images/")
      ) {
        return url.toString();
      }
    } catch {
      // Ignore malformed image metadata and try the next candidate.
    }
  }
  return null;
}

export function normalizeXUsername(raw: string): string {
  let value = raw.trim().replace(/^@+/, "");
  const urlMatch = value.match(
    /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i,
  );
  if (urlMatch?.[1]) value = urlMatch[1];
  return value.replace(/\/+$/, "");
}

export function isValidXUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(username);
}

export const xAdapter = new XAdapter();

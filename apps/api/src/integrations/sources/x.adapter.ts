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
import type { FirecrawlClient } from "../firecrawl/firecrawl.client";

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

    const isAvailable = this.ingestionEnabled || Boolean(this.firecrawl?.enabled);

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

        if (scrape.markdown) {
          const imgMatch = scrape.markdown.match(
            /!\[([^\]]*)\]\((https:\/\/pbs\.twimg\.com\/profile_images\/[^)]+)\)/,
          );
          if (imgMatch?.[2]) {
            avatarUrl = imgMatch[2];
          }

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
        const query = `site:x.com/${handle}/status`;
        const limit = Math.min(input.limit ?? 20, 20);
        const searchResults = await this.firecrawl.search(query, limit);

        if (!searchResults || searchResults.length === 0) {
          return {
            available: true,
            posts: [],
            nextCursor: null,
          };
        }

        const posts: NormalizedPost[] = [];
        const seenIds = new Set<string>();

        for (const item of searchResults) {
          const match = item.url.match(/\/status\/([0-9]+)/i);
          const statusId =
            match?.[1] ||
            createHash("sha256").update(item.url).digest("hex").slice(0, 20);

          if (seenIds.has(statusId)) continue;
          seenIds.add(statusId);

          let cleanTitle = (item.title || "")
            .replace(/\s+on X:.*$/i, "")
            .replace(/\s+\/\s*X$/i, "")
            .replace(/^"|"$/g, "")
            .trim();

          let text = (item.description || item.title || "").trim();
          if (!text && cleanTitle) text = cleanTitle;

          const content = text || cleanTitle || "Trading update from creator";

          const contentHash = createHash("sha256")
            .update(content)
            .digest("hex");

          posts.push({
            sourcePostId: statusId,
            sourceAuthorId: null,
            authorHandle: handle,
            title: cleanTitle ? cleanTitle.slice(0, 250) : null,
            text: content,
            url: item.url,
            publishedAt: new Date(),
            contentHash,
            mediaUrls: [],
            isReply: false,
            isRepost: false,
            status: "ACTIVE",
          });
        }

        return {
          available: true,
          posts,
          nextCursor: null,
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

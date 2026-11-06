import {
  SourceAdapterError,
  type CreatorSourceAdapter,
  type FetchPostsInput,
  type FetchPostsResult,
  type ResolvedCreator,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import type { FirecrawlClient } from "../firecrawl/firecrawl.client";
import { assertSafeUrl } from "./ssrf";
import { hashNormalizedContent } from "./normalize";

/**
 * Authorized-website adapter (Firecrawl-backed).
 *
 * A website source may only be registered when the user explicitly confirms
 * they are authorized to crawl it. Validation requires:
 *   1. a valid, SSRF-safe http(s) URL
 *   2. explicit `authorized === true` confirmation
 *   3. a configured + enabled Firecrawl client
 */

export interface WebsiteAdapterOptions {
  firecrawl: FirecrawlClient;
}

export class WebsiteAdapter implements CreatorSourceAdapter {
  readonly sourceType = "WEBSITE" as const;
  private readonly firecrawl: FirecrawlClient;

  constructor(options: WebsiteAdapterOptions) {
    this.firecrawl = options.firecrawl;
  }

  async validate(input: unknown): Promise<ValidatedCreatorSource> {
    const payload = input as {
      url?: string;
      authorized?: boolean;
      maxPages?: number;
    };

    if (typeof payload?.url !== "string" || payload.url.trim() === "") {
      throw new SourceAdapterError(
        "INVALID_URL",
        "A website URL is required",
        400,
      );
    }

    // Authorization confirmation is mandatory — enforced here, not only in UI.
    if (payload.authorized !== true) {
      throw new SourceAdapterError(
        "AUTHORIZATION_REQUIRED",
        "You must confirm that you are authorized to crawl this website",
        400,
      );
    }

    const url = await assertSafeUrl(payload.url.trim());

    // Validate availability + extract metadata through Firecrawl.
    // If Firecrawl is not configured we surface a clear, non-fatal error.
    this.firecrawl.assertAvailable();
    const page = await this.firecrawl.scrape(url.toString());

    return {
      sourceType: "WEBSITE",
      externalId: url.hostname,
      handle: url.hostname,
      canonicalUrl: url.toString(),
      displayName: page.title || url.hostname,
      description: page.description,
      avatarUrl: null,
      status: "ACTIVE",
      notices: [],
      providerMeta: {
        authorized: true,
        maxPages: payload.maxPages ?? 1,
        lastStatusCode: page.statusCode,
      },
    };
  }

  async resolveCreator(
    input: ValidatedCreatorSource,
  ): Promise<ResolvedCreator> {
    return {
      displayName: input.displayName?.trim() || input.handle || "Website",
      description: input.description,
      avatarUrl: null,
      source: input,
    };
  }

  async fetchLatestPosts(input: FetchPostsInput): Promise<FetchPostsResult> {
    if (!input.source.crawlAuthorized) {
      throw new SourceAdapterError(
        "AUTHORIZATION_REQUIRED",
        "This website source is not authorized for monitoring",
        403,
      );
    }

    this.firecrawl.assertAvailable();
    const page = await this.firecrawl.scrape(input.source.canonicalUrl);
    const content = page.markdown?.trim() || page.description?.trim() || "";
    const title = page.title?.trim() || null;

    return {
      available: true,
      posts: content
        ? [
            {
              sourcePostId: page.url || input.source.canonicalUrl,
              sourceAuthorId: input.source.externalId,
              publishedAt: parseDate(page.publishedAt),
              contentHash: hashNormalizedContent(title, content),
              text: content,
              title,
              url: page.url || input.source.canonicalUrl,
              authorHandle: input.source.handle,
              isReply: false,
              isRepost: false,
              mediaUrls: [],
            },
          ]
        : [],
      nextCursor: null,
    };
  }
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

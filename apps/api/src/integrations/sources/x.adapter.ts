import {
  X_UNAVAILABLE_MESSAGE,
  type CreatorSourceAdapter,
  type CreatorSourceType,
  type FetchPostsInput,
  type FetchPostsResult,
  type ResolvedCreator,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import { SourceAdapterError } from "@call-ledger/shared";

/**
 * X (Twitter) adapter — intentionally a placeholder in Phase 2A.
 *
 * We only perform OFFLINE handle validation. We do NOT:
 * - call any X endpoint
 * - use undocumented GraphQL operations
 * - automate a browser
 * - read or collect session cookies (auth_token / ct0)
 * - scrape third-party mirrors
 *
 * Until an authorized X data provider is configured, every X source resolves
 * with status WAITING_FOR_AUTHORIZED_ACCESS and `fetchLatestPosts` returns an
 * unavailable result. No posts are ever fabricated.
 */

export interface XAdapterOptions {
  /** True only when an authorized X data provider has been configured. */
  ingestionEnabled?: boolean;
}

export class XAdapter implements CreatorSourceAdapter {
  readonly sourceType: CreatorSourceType = "X";
  readonly unavailableMessage = X_UNAVAILABLE_MESSAGE;

  private readonly ingestionEnabled: boolean;

  constructor(options: XAdapterOptions = {}) {
    this.ingestionEnabled = options.ingestionEnabled ?? false;
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

    return {
      sourceType: "X",
      // We cannot resolve a stable numeric X user id without an authorized API.
      externalId: null,
      handle: username,
      canonicalUrl: `https://x.com/${username}`,
      displayName: `@${username}`,
      description: null,
      avatarUrl: null,
      status: this.ingestionEnabled
        ? "ACTIVE"
        : "WAITING_FOR_AUTHORIZED_ACCESS",
      notices: this.ingestionEnabled
        ? []
        : [
            "X ingestion is disabled (X_INGESTION_ENABLED=false).",
            X_UNAVAILABLE_MESSAGE,
          ],
      providerMeta: { ingestionEnabled: this.ingestionEnabled },
    };
  }

  async resolveCreator(
    input: ValidatedCreatorSource,
  ): Promise<ResolvedCreator> {
    return {
      displayName: input.displayName?.trim() || `@${input.handle}`,
      description: null,
      avatarUrl: null,
      source: input,
    };
  }

  async fetchLatestPosts(_input: FetchPostsInput): Promise<FetchPostsResult> {
    // No network request is made. Ever.
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
  const urlMatch = value.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i);
  if (urlMatch?.[1]) value = urlMatch[1];
  return value.replace(/\/+$/, "");
}

export function isValidXUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(username);
}

export const xAdapter = new XAdapter();

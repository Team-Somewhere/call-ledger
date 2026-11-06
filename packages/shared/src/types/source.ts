import type { CreatorStatus } from "../constants/statuses";

/**
 * Provider-independent creator source model.
 *
 * The database, API and frontend must never depend on provider-specific
 * response structures. Every external profile / feed is represented as a
 * `CreatorSource` row and accessed through an adapter that implements
 * `CreatorSourceAdapter`.
 */

export const CREATOR_SOURCE_TYPES = ["X", "BLUESKY", "RSS", "WEBSITE"] as const;
export type CreatorSourceType = (typeof CREATOR_SOURCE_TYPES)[number];

export const CREATOR_SOURCE_STATUSES = [
  "ACTIVE",
  "WAITING_FOR_AUTHORIZED_ACCESS",
  "DISABLED",
  "ERROR",
] as const;
export type CreatorSourceStatus = (typeof CREATOR_SOURCE_STATUSES)[number];

export const CREATOR_SOURCE_VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "SELF_VERIFIED",
  "ADMIN_VERIFIED",
] as const;
export type CreatorSourceVerificationStatus =
  (typeof CREATOR_SOURCE_VERIFICATION_STATUSES)[number];

/**
 * How a source identity came to be associated with a creator.
 * - CREATED_WITH: the source was provided when the creator record was created
 * - EXPLICIT_LINK: a user or admin explicitly linked the source to the creator
 * - SELF_CLAIM: the creator (or their delegate) proved ownership of the account
 */
export const IDENTITY_LINK_RELATIONSHIP_TYPES = [
  "CREATED_WITH",
  "EXPLICIT_LINK",
  "SELF_CLAIM",
] as const;
export type IdentityLinkRelationshipType =
  (typeof IDENTITY_LINK_RELATIONSHIP_TYPES)[number];

export const IDENTITY_VERIFICATION_METHODS = [
  "NONE",
  "PROVIDER_OATH", // reserved: ownership proven by provider OAuth (e.g. X OAuth)
  "META_TAG", // website: <meta name="callledger-verification" ...>
  "HANDLE_BIO", // provider profile bio contains a CallLedger proof string
  "PROVIDER_DID", // Bluesky DID / RSS feed ownership already asserted upstream
  "MANUAL_ADMIN", // an administrator reviewed and confirmed the claim
  "IMPORTED", // migrated / system created
] as const;
export type IdentityVerificationMethod =
  (typeof IDENTITY_VERIFICATION_METHODS)[number];

export interface CreatorSource {
  id: string;
  creatorId: string;
  sourceType: CreatorSourceType;
  externalId: string | null;
  handle: string | null;
  canonicalUrl: string;
  status: CreatorSourceStatus;
  verificationStatus: CreatorSourceVerificationStatus;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  lastFetchedAt: Date | null;
  nextFetchAt: Date | null;
  lastCursor: string | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  retryCount: number;
  etag?: string | null;
  lastModified?: string | null;
  crawlAuthorized?: boolean;
  providerMeta?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatorSourceSummary {
  id: string;
  sourceType: CreatorSourceType;
  handle: string | null;
  canonicalUrl: string;
  status: CreatorSourceStatus;
  verificationStatus: CreatorSourceVerificationStatus;
  lastFetchedAt: Date | null;
  nextFetchAt: Date | null;
  lastError: string | null;
}

/**
 * Normalized profile returned by adapters during validation / resolution.
 * Intentionally provider-agnostic.
 */
export interface ValidatedCreatorSource {
  sourceType: CreatorSourceType;
  /** Stable provider-side identifier (DID, feed id, X user id...). Null when unavailable. */
  externalId: string | null;
  handle: string | null;
  canonicalUrl: string;
  displayName: string | null;
  description: string | null;
  avatarUrl: string | null;
  /** Monitoring status the platform can offer for this source right now. */
  status: CreatorSourceStatus;
  /** Informational messages for the UI (e.g. WAITING_FOR_AUTHORIZED_ACCESS). */
  notices: string[];
  /**
   * Provider-specific payload retained for Phase 2B fetching.
   * Must remain serializable and never contain secrets.
   */
  providerMeta?: Record<string, unknown>;
}

export interface ResolvedCreator {
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  source: ValidatedCreatorSource;
}

export interface FetchPostsInput {
  source: CreatorSource;
  /** Provider cursor from the previous successful run. */
  cursor: string | null;
  limit?: number;
  /** Conditional-request validators from the previous successful run. */
  conditional?: { etag?: string | null; lastModified?: string | null };
}

/**
 * Normalized post as returned by an adapter. The worker maps this into
 * `creator_source_posts`. Optional fields are additive (Phase 2B).
 */
export interface NormalizedPost {
  /** Stable provider-side post identifier. */
  sourcePostId: string;
  /** Provider-side author identity, verified against the source externalId. */
  sourceAuthorId: string | null;
  /** Null when the provider gave no usable date. Never fabricated. */
  publishedAt: Date | null;
  /** SHA-256 of normalized title/content, computed before persistence. */
  contentHash: string;
  text: string | null;
  url: string | null;
  publicMetrics?: Record<string, unknown> | null;
  /** Optional title (RSS item title, website page title). */
  title?: string | null;
  authorHandle?: string | null;
  isReply?: boolean;
  isRepost?: boolean;
  mediaUrls?: string[];
  status?: "ACTIVE" | "DELETED" | "UNAVAILABLE";
  rawMetadata?: Record<string, unknown>;
}

export interface FetchPostsResult {
  available: boolean;
  /** Reason code when `available === false`. */
  unavailableReason?: string;
  posts: NormalizedPost[];
  nextCursor: string | null;
  /** True when the upstream reported no change (HTTP 304). No posts returned. */
  notModified?: boolean;
  /** Validators to store for the next conditional request. */
  etag?: string | null;
  lastModified?: string | null;
}

export interface CreatorSourceAdapter {
  readonly sourceType: CreatorSourceType;
  /** Human-readable explanation when this adapter cannot ingest right now. */
  readonly unavailableMessage?: string;
  validate(input: unknown): Promise<ValidatedCreatorSource>;
  resolveCreator(input: ValidatedCreatorSource): Promise<ResolvedCreator>;
  fetchLatestPosts(input: FetchPostsInput): Promise<FetchPostsResult>;
}

/** Adapter error carrying a stable machine-readable code. */
export class SourceAdapterError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
    readonly retryable = false,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "SourceAdapterError";
  }
}

export const X_UNAVAILABLE_MESSAGE =
  "X monitoring is not currently available. This creator has been saved to your CallLedger following list and can be monitored when an authorized source is configured.";

/** User-facing follow record. */
export interface UserCreatorFollow {
  id: string;
  userId: string;
  creatorId: string;
  isActive: boolean;
  notificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowedCreatorView {
  followId: string;
  followedAt: Date;
  creator: CreatorSummary & { sources: CreatorSourceSummary[] };
}

export interface CreatorSummary {
  id: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  status: CreatorStatus;
  createdAt: Date;
}

/**
 * @call-ledger/arkiv — Real Arkiv Rabdi testnet integration.
 *
 * Provides:
 *  - createArkivPublicClient()  — read-only queries
 *  - createArkivWalletClient()  — authenticated writes
 *  - ArchivedXPostSchema        — typed entity schema
 *  - archivePost()              — write a new archived post entity
 *  - checkPostExists()          — deduplication check before write
 *  - queryPosts()               — query posts with filters
 *  - getPostByEntityKey()       — fetch single entity by key
 *  - getArchiveStats()          — aggregate counts
 *
 * SECURITY:
 *  - ARKIV_ARCHIVER_PRIVATE_KEY must NEVER be logged, returned, or exposed.
 *  - ARKIV_ACCESS_KEY must NEVER be sent to the frontend.
 *  - All Arkiv RPC calls must happen server-side only.
 */

import {
  ExpirationTime,
  bool,
  createPublicClient,
  createWalletClient,
  defineSchema,
  str,
  u64,
} from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { and, asc, desc, eq, gte, lte } from "@arkiv-network/sdk/query";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Schema ─────────────────────────────────────────────────────────────────

/**
 * Arkiv schema for CallLedger archived X posts.
 * Namespace: "callledger.archived_x_post.v1"
 *
 * Only fields used in where() clauses are indexed — indexing has cost.
 * topics/assets stored as JSON strings (SDK str is up to 128 KiB).
 */
export const ArchivedXPostSchema = defineSchema(
  "callledger.archived_x_post.v1",
  {
    sourcePlatform:    str().indexed(),   // always "x"
    sourcePostId:      str().indexed(),   // the X status ID (dedup key)
    authorUsername:    str().indexed(),   // lowercase normalized X handle
    authorDisplayName: str(),             // display name at capture time
    postText:          str(),             // post content (verbatim or summary)
    postUrl:           str(),             // canonical X status URL
    originalCreatedAt: u64().indexed(),   // unix ms; 0 when unknown
    capturedAt:        u64().indexed(),   // unix ms when archived
    contentFidelity:   str().indexed(),   // VERBATIM | PROVIDER_SUMMARY | UNKNOWN
    captureProvider:   str(),             // "firecrawl"
    tradingRelated:    bool().indexed(),  // true = trading signal content
    topics:            str(),             // JSON string array
    assets:            str(),             // JSON string array
    schemaVersion:     str(),             // "1"
  },
);

// ─── Public types ─────────────────────────────────────────────────────────

export interface ArchivedPost {
  entityKey: string;
  txHash: string | null;
  ownerAddress: string | null;
  expiresAt: Date | null;
  sourcePlatform: string;
  sourcePostId: string;
  authorUsername: string;
  authorDisplayName: string;
  postText: string;
  postUrl: string;
  originalCreatedAt: Date | null;
  capturedAt: Date;
  contentFidelity: string;
  captureProvider: string;
  tradingRelated: boolean;
  topics: string[];
  assets: string[];
  schemaVersion: string;
}

export interface ArkivConfig {
  accessKey: string;
  rpcUrl?: string;
}

export interface ArkivWalletConfig extends ArkivConfig {
  /** Hex 0x-prefixed private key. Must be funded on Rabdi testnet. */
  privateKey: string;
}

export interface ArchivePostInput {
  sourcePostId: string;
  authorUsername: string;
  authorDisplayName: string;
  postText: string;
  postUrl: string;
  originalCreatedAt: Date | null;
  capturedAt: Date;
  contentFidelity: "VERBATIM" | "PROVIDER_SUMMARY" | "UNKNOWN";
  tradingRelated: boolean;
  topics: string[];
  assets: string[];
  expiryDays: number;
}

export interface ArchivePostResult {
  entityKey: string;
  txHash: string;
  expiresAt: Date;
}

export interface QueryPostsOptions {
  authorUsername?: string;
  sourcePostId?: string;
  tradingRelated?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}

// ─── Client factories ────────────────────────────────────────────────────

/** Create a read-only Arkiv public client. */
export function createArkivPublicClient(config: ArkivConfig) {
  const chainOptions: { accessKey: string; rpcUrl?: string } = {
    accessKey: config.accessKey,
  };
  if (config.rpcUrl) chainOptions.rpcUrl = config.rpcUrl;
  const chain = rabdi(chainOptions);
  return createPublicClient({ chain, transport: http() });
}

/** Create an Arkiv wallet client for authenticated writes. */
export function createArkivWalletClient(config: ArkivWalletConfig) {
  const chainOptions: { accessKey: string; rpcUrl?: string } = {
    accessKey: config.accessKey,
  };
  if (config.rpcUrl) chainOptions.rpcUrl = config.rpcUrl;
  const chain = rabdi(chainOptions);
  const account = privateKeyToAccount(config.privateKey as `0x${string}`);
  const client = createWalletClient({ chain, transport: http(), account });
  return { client, account };
}

// ─── Write ───────────────────────────────────────────────────────────────

/**
 * Archive a single X post to Arkiv Rabdi.
 *
 * Prerequisites:
 *  - walletClient must be created with createArkivWalletClient()
 *  - The wallet address must hold Rabdi testnet tGLM for gas
 *  - Call checkPostExists() first to prevent duplicates
 */
export async function archivePost(
  walletClient: ReturnType<typeof createArkivWalletClient>["client"],
  input: ArchivePostInput,
): Promise<ArchivePostResult> {
  const capturedAtMs = BigInt(input.capturedAt.getTime());
  const originalCreatedAtMs = input.originalCreatedAt
    ? BigInt(input.originalCreatedAt.getTime())
    : BigInt(0);

  const expiration = ExpirationTime.fromDays(input.expiryDays);
  const expiresAt = new Date(
    Date.now() + input.expiryDays * 24 * 60 * 60 * 1000,
  );

  const { entityKey, txHash } = await walletClient.createEntity(
    ArchivedXPostSchema,
    {
      sourcePlatform:    str("x"),
      sourcePostId:      str(input.sourcePostId),
      authorUsername:    str(input.authorUsername.toLowerCase()),
      authorDisplayName: str(input.authorDisplayName || input.authorUsername),
      postText:          str((input.postText || "").slice(0, 4000)),
      postUrl:           str(input.postUrl || ""),
      originalCreatedAt: u64(originalCreatedAtMs),
      capturedAt:        u64(capturedAtMs),
      contentFidelity:   str(input.contentFidelity),
      captureProvider:   str("firecrawl"),
      tradingRelated:    bool(input.tradingRelated),
      topics:            str(JSON.stringify(input.topics)),
      assets:            str(JSON.stringify(input.assets)),
      schemaVersion:     str("1"),
    },
    { expiration },
  );

  return { entityKey, txHash, expiresAt };
}

// ─── Read ─────────────────────────────────────────────────────────────────

/**
 * Check if a post with the given sourcePostId is already archived.
 * Returns the entityKey if found, null if not archived.
 *
 * This is the primary duplicate-prevention gate.
 */
export async function checkPostExists(
  publicClient: ReturnType<typeof createArkivPublicClient>,
  sourcePostId: string,
): Promise<string | null> {
  try {
    const result = await publicClient
      .select({ $key: true } as const)
      .from(ArchivedXPostSchema)
      .where(
        and(
          eq("sourcePlatform", str("x")),
          eq("sourcePostId", str(sourcePostId)),
        ),
      )
      .limit(1)
      .fetch();

    const entity = result.entities[0];
    if (!entity) return null;
    return String(entity.$key);
  } catch {
    return null;
  }
}

/**
 * Query archived posts with optional filters.
 * Uses key-based pagination (pass nextKey to get the next page).
 */
export async function queryPosts(
  publicClient: ReturnType<typeof createArkivPublicClient>,
  options: QueryPostsOptions & { afterKey?: string } = {},
): Promise<{ posts: ArchivedPost[]; hasMore: boolean; nextKey: string | null }> {
  const limit = Math.min(options.limit ?? 20, 50);

  try {
    // Build a base query — always filtered by schema name via .from()
    let query = publicClient
      .select({
        $key: true,
        $owner: true,
        $expiresAt: true,
        sourcePlatform:    true,
        sourcePostId:      true,
        authorUsername:    true,
        authorDisplayName: true,
        postText:          true,
        postUrl:           true,
        originalCreatedAt: true,
        capturedAt:        true,
        contentFidelity:   true,
        captureProvider:   true,
        tradingRelated:    true,
        topics:            true,
        assets:            true,
        schemaVersion:     true,
      } as const)
      .from(ArchivedXPostSchema);

    // Apply filters — only indexed columns may be used in where()
    if (options.authorUsername && options.fromDate && options.toDate) {
      query = query.where(
        and(
          eq("authorUsername", str(options.authorUsername.toLowerCase())),
          gte("capturedAt", u64(BigInt(options.fromDate.getTime()))),
          lte("capturedAt", u64(BigInt(options.toDate.getTime()))),
        ),
      );
    } else if (options.authorUsername && options.fromDate) {
      query = query.where(
        and(
          eq("authorUsername", str(options.authorUsername.toLowerCase())),
          gte("capturedAt", u64(BigInt(options.fromDate.getTime()))),
        ),
      );
    } else if (options.authorUsername && options.toDate) {
      query = query.where(
        and(
          eq("authorUsername", str(options.authorUsername.toLowerCase())),
          lte("capturedAt", u64(BigInt(options.toDate.getTime()))),
        ),
      );
    } else if (options.authorUsername && options.tradingRelated !== undefined) {
      query = query.where(
        and(
          eq("authorUsername", str(options.authorUsername.toLowerCase())),
          eq("tradingRelated", bool(options.tradingRelated)),
        ),
      );
    } else if (options.authorUsername) {
      query = query.where(
        eq("authorUsername", str(options.authorUsername.toLowerCase())),
      );
    } else if (options.sourcePostId) {
      query = query.where(
        and(
          eq("sourcePlatform", str("x")),
          eq("sourcePostId", str(options.sourcePostId)),
        ),
      );
    } else if (options.tradingRelated !== undefined) {
      query = query.where(eq("tradingRelated", bool(options.tradingRelated)));
    } else if (options.fromDate && options.toDate) {
      query = query.where(
        and(
          gte("capturedAt", u64(BigInt(options.fromDate.getTime()))),
          lte("capturedAt", u64(BigInt(options.toDate.getTime()))),
        ),
      );
    } else if (options.fromDate) {
      query = query.where(
        gte("capturedAt", u64(BigInt(options.fromDate.getTime()))),
      );
    }

    const result = await query
      .orderBy(desc("capturedAt"))
      .limit(limit + 1)
      .fetch();

    const hasMore = result.entities.length > limit;
    const page = hasMore ? result.entities.slice(0, limit) : result.entities;
    const lastEntity = page.at(-1);
    const nextKey =
      hasMore && lastEntity ? String(lastEntity.$key) : null;

    return {
      posts: page.map((e) => rowToArchivedPost(e as ArkivQueryRow)),
      hasMore,
      nextKey,
    };
  } catch {
    return { posts: [], hasMore: false, nextKey: null };
  }
}

/**
 * Get a single archived post by its Arkiv entity key.
 */
export async function getPostByEntityKey(
  publicClient: ReturnType<typeof createArkivPublicClient>,
  entityKey: string,
): Promise<ArchivedPost | null> {
  try {
    const entity = await publicClient.getEntity(entityKey as `0x${string}`, ArchivedXPostSchema);
    if (!entity) return null;
    return entityToArchivedPost(entityKey, entity);
  } catch {
    return null;
  }
}

/**
 * Return aggregate statistics from the archive (bounded scan).
 */
export async function getArchiveStats(
  publicClient: ReturnType<typeof createArkivPublicClient>,
): Promise<{
  totalPosts: number;
  tradingRelatedPosts: number;
  uniqueTraders: number;
  oldestPost: Date | null;
  newestPost: Date | null;
}> {
  try {
    const [allResult, tradingResult] = await Promise.all([
      publicClient
        .select({ $key: true, authorUsername: true, capturedAt: true } as const)
        .from(ArchivedXPostSchema)
        .orderBy(asc("capturedAt"))
        .limit(100)
        .fetch(),
      publicClient
        .select({ $key: true } as const)
        .from(ArchivedXPostSchema)
        .where(eq("tradingRelated", bool(true)))
        .limit(100)
        .fetch(),
    ]);

    const traders = new Set<string>();
    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const e of allResult.entities) {
      const row = e as {
        authorUsername?: { value?: string };
        capturedAt?: { value?: bigint };
      };
      const username = row.authorUsername?.value;
      const capturedAtMs = row.capturedAt?.value;
      if (username) traders.add(username);
      if (capturedAtMs) {
        const d = new Date(Number(capturedAtMs));
        if (!oldest || d < oldest) oldest = d;
        if (!newest || d > newest) newest = d;
      }
    }

    return {
      totalPosts: allResult.entities.length,
      tradingRelatedPosts: tradingResult.entities.length,
      uniqueTraders: traders.size,
      oldestPost: oldest,
      newestPost: newest,
    };
  } catch {
    return {
      totalPosts: 0,
      tradingRelatedPosts: 0,
      uniqueTraders: 0,
      oldestPost: null,
      newestPost: null,
    };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function parseJsonArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function bigintMsToDate(v: bigint | undefined | null): Date | null {
  if (!v || v === BigInt(0)) return null;
  return new Date(Number(v));
}

type ArkivQueryRow = {
  $key?: unknown;
  $owner?: unknown;
  $expiresAt?: unknown;
  sourcePlatform?: { value?: string };
  sourcePostId?: { value?: string };
  authorUsername?: { value?: string };
  authorDisplayName?: { value?: string };
  postText?: { value?: string };
  postUrl?: { value?: string };
  originalCreatedAt?: { value?: bigint };
  capturedAt?: { value?: bigint };
  contentFidelity?: { value?: string };
  captureProvider?: { value?: string };
  tradingRelated?: { value?: boolean };
  topics?: { value?: string };
  assets?: { value?: string };
  schemaVersion?: { value?: string };
};

function rowToArchivedPost(row: ArkivQueryRow): ArchivedPost {
  const capturedAtMs = row.capturedAt?.value;
  return {
    entityKey:         String(row.$key ?? ""),
    txHash:            null,
    ownerAddress:      row.$owner ? String(row.$owner) : null,
    expiresAt:         row.$expiresAt
      ? new Date(Number(row.$expiresAt as bigint))
      : null,
    sourcePlatform:    row.sourcePlatform?.value ?? "x",
    sourcePostId:      row.sourcePostId?.value ?? "",
    authorUsername:    row.authorUsername?.value ?? "",
    authorDisplayName: row.authorDisplayName?.value ?? "",
    postText:          row.postText?.value ?? "",
    postUrl:           row.postUrl?.value ?? "",
    originalCreatedAt: bigintMsToDate(row.originalCreatedAt?.value),
    capturedAt:        capturedAtMs
      ? new Date(Number(capturedAtMs))
      : new Date(),
    contentFidelity:   row.contentFidelity?.value ?? "UNKNOWN",
    captureProvider:   row.captureProvider?.value ?? "firecrawl",
    tradingRelated:    row.tradingRelated?.value ?? false,
    topics:            parseJsonArray(row.topics?.value),
    assets:            parseJsonArray(row.assets?.value),
    schemaVersion:     row.schemaVersion?.value ?? "1",
  };
}

// Entity returned by getEntity() — same field shape as a query row
function entityToArchivedPost(entityKey: string, entity: unknown): ArchivedPost {
  return rowToArchivedPost({ $key: entityKey, ...(entity as object) });
}

// ─── Re-exports ─────────────────────────────────────────────────────────
export { ExpirationTime };

import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  creatorIdentityLinks,
  creatorSources,
  creators,
  db,
  userCreatorFollows,
} from "@call-ledger/database";
import {
  SourceAdapterError,
  type CreatorSourceAdapter,
  type CreatorSourceSummary,
  type CreatorSourceType,
  type ResolveCreatorSourceInput,
  type ValidatedCreatorSource,
} from "@call-ledger/shared";
import { sanitizePublicUrl } from "../utils/public-url";

/**
 * Creator / source management.
 *
 * Global identity rule: one `creators` row per real-world creator. The same
 * creator followed by many users shares a single record. Handles that merely
 * *look* alike are never auto-merged — linking is always explicit and recorded
 * in `creator_identity_links`.
 */

export interface ResolveSourceResult {
  validated: ValidatedCreatorSource;
  existingSource: CreatorSourceSummary | null;
  existingCreatorId: string | null;
}

/** Validates a source without persisting anything. */
export async function resolveSourceInput(
  adapter: CreatorSourceAdapter,
  input: unknown,
): Promise<ValidatedCreatorSource> {
  return adapter.validate(input);
}

function adapterInputFromResolveInput(
  input: ResolveCreatorSourceInput,
): unknown {
  switch (input.sourceType) {
    case "X":
      return input.username;
    case "BLUESKY":
      return input.handle;
    case "RSS":
      return input.feedUrl;
    case "WEBSITE":
      return {
        url: input.websiteUrl,
        authorized: input.authorized,
        maxPages: input.maxPages,
      };
  }
}

export function toAdapterInput(input: ResolveCreatorSourceInput): unknown {
  return adapterInputFromResolveInput(input);
}

/** Finds an existing source row matching a validated source identity. */
export async function findSourceByIdentity(
  validated: ValidatedCreatorSource,
) {
  const identityConditions = [];
  if (validated.externalId) {
    identityConditions.push(eq(creatorSources.externalId, validated.externalId));
  }
  if (validated.handle) {
    identityConditions.push(
      sql`lower(${creatorSources.handle}) = ${validated.handle.toLowerCase()}`,
    );
  }
  identityConditions.push(
    eq(creatorSources.canonicalUrl, validated.canonicalUrl),
  );

  const [row] = await db
    .select()
    .from(creatorSources)
    .where(
      and(
        eq(creatorSources.sourceType, validated.sourceType),
        or(...identityConditions),
      ),
    )
    .limit(1);

  return row ?? null;
}

export interface CreateCreatorResult {
  creator: CreatorDetail;
  source: CreatorSourceSummary;
  isExistingCreator: boolean;
  notices: string[];
}

/**
 * Creates a creator + its first source, or attaches the source to the existing
 * global creator that already owns this identity. Runs in a transaction.
 */
export async function createCreatorWithSource(params: {
  sourceType: CreatorSourceType;
  validated: ValidatedCreatorSource;
  userId: string;
  createdVia?: "USER_SUBMISSION" | "MANUAL";
}): Promise<CreateCreatorResult> {
  const { validated, userId } = params;

  const existingSource = await findSourceByIdentity(validated);
  if (existingSource) {
    // Duplicate source identity: return the existing creator instead of
    // creating a second row for the same creator.
    const creator = await getCreatorDetail(existingSource.creatorId);
    if (!creator) {
      throw new SourceAdapterError(
        "CREATOR_NOT_FOUND",
        "Source exists but its creator is missing",
        500,
      );
    }
    return {
      creator,
      source: toSourceSummary(existingSource),
      isExistingCreator: true,
      notices: [
        "This creator is already on CallLedger. We reused the existing global record.",
      ],
    };
  }

  const result = await db.transaction(async (tx) => {
    const [creator] = await tx
      .insert(creators)
      .values({
        displayName: validated.displayName?.trim() || validated.handle || "Creator",
        description: validated.description,
        avatarUrl: validated.avatarUrl,
        // Legacy X columns are only populated for X sources.
        xUserId: validated.sourceType === "X" ? validated.externalId : null,
        xUsername: validated.sourceType === "X" ? validated.handle : null,
        bio: validated.description,
        status: "DISCOVERED",
        discoverySource: params.createdVia ?? "USER_SUBMISSION",
      })
      .returning();

    if (!creator) throw new Error("Failed to create creator");

    const [source] = await tx
      .insert(creatorSources)
      .values({
        creatorId: creator.id,
        sourceType: validated.sourceType,
        externalId: validated.externalId,
        handle: validated.handle,
        canonicalUrl: validated.canonicalUrl,
        status: validated.status,
        verificationStatus: "UNVERIFIED",
        displayName: validated.displayName,
        description: validated.description,
        avatarUrl: validated.avatarUrl,
        crawlAuthorized:
          validated.sourceType === "WEBSITE"
            ? Boolean(validated.providerMeta?.authorized)
            : false,
        providerMeta: validated.providerMeta
          ? JSON.stringify(validated.providerMeta)
          : null,
      })
      .returning();

    if (!source) throw new Error("Failed to create creator source");

    // Record how this identity came to be associated with the creator.
    await tx.insert(creatorIdentityLinks).values({
      creatorId: creator.id,
      creatorSourceId: source.id,
      relationshipType: "CREATED_WITH",
      verificationMethod: "NONE",
      verifiedByUserId: userId,
      evidence: `Source provided on creator creation (${validated.sourceType})`,
    });

    return { creator, source };
  });

  const detail = await getCreatorDetail(result.creator.id);
  if (!detail) throw new Error("Creator vanished after creation");

  return {
    creator: detail,
    source: toSourceSummary(result.source),
    isExistingCreator: false,
    notices: validated.notices,
  };
}

/**
 * Explicitly links a new source to an EXISTING creator.
 * Used when a user or admin confirms that two profiles belong to one person.
 */
export async function linkSourceToCreator(params: {
  creatorId: string;
  validated: ValidatedCreatorSource;
  userId: string;
}): Promise<CreatorSourceSummary> {
  const { creatorId, validated, userId } = params;

  const [creator] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) {
    throw new SourceAdapterError(
      "CREATOR_NOT_FOUND",
      `Creator '${creatorId}' was not found`,
      404,
    );
  }

  const existing = await findSourceByIdentity(validated);
  if (existing) {
    if (existing.creatorId === creatorId) {
      return toSourceSummary(existing);
    }
    throw new SourceAdapterError(
      "SOURCE_ALREADY_LINKED",
      "This source identity is already linked to a different creator. Source identities cannot be duplicated.",
      409,
    );
  }

  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(creatorSources)
      .values({
        creatorId,
        sourceType: validated.sourceType,
        externalId: validated.externalId,
        handle: validated.handle,
        canonicalUrl: validated.canonicalUrl,
        status: validated.status,
        verificationStatus: "UNVERIFIED",
        displayName: validated.displayName,
        description: validated.description,
        avatarUrl: validated.avatarUrl,
        crawlAuthorized:
          validated.sourceType === "WEBSITE"
            ? Boolean(validated.providerMeta?.authorized)
            : false,
        providerMeta: validated.providerMeta
          ? JSON.stringify(validated.providerMeta)
          : null,
      })
      .returning();

    if (!source) throw new Error("Failed to create creator source");

    await tx.insert(creatorIdentityLinks).values({
      creatorId,
      creatorSourceId: source.id,
      relationshipType: "EXPLICIT_LINK",
      verificationMethod: "NONE",
      verifiedByUserId: userId,
      evidence: `Source explicitly linked to existing creator (${validated.sourceType})`,
    });

    return toSourceSummary(source);
  });
}

export function toSourceSummary(row: {
  id: string;
  sourceType: string;
  handle: string | null;
  canonicalUrl: string;
  status: string;
  verificationStatus: string;
  lastFetchedAt: Date | null;
  nextFetchAt: Date | null;
  lastError: string | null;
}): CreatorSourceSummary {
  return {
    id: row.id,
    sourceType: row.sourceType as CreatorSourceType,
    handle: row.handle,
    canonicalUrl: sanitizePublicUrl(row.canonicalUrl) ?? "",
    status: row.status as CreatorSourceSummary["status"],
    verificationStatus:
      row.verificationStatus as CreatorSourceSummary["verificationStatus"],
    lastFetchedAt: row.lastFetchedAt,
    nextFetchAt: row.nextFetchAt,
    lastError: row.lastError,
  };
}

export interface CreatorDetail {
  id: string;
  displayName: string;
  description: string | null;
  avatarUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sources: Array<
    CreatorSourceSummary & {
      externalId: string | null;
      linkRelationshipType: string | null;
      linkVerificationMethod: string | null;
    }
  >;
  followersCount: number;
}

export async function getCreatorDetail(
  creatorId: string,
): Promise<CreatorDetail | null> {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) return null;

  const sources = await db
    .select({
      id: creatorSources.id,
      sourceType: creatorSources.sourceType,
      handle: creatorSources.handle,
      canonicalUrl: creatorSources.canonicalUrl,
      status: creatorSources.status,
      verificationStatus: creatorSources.verificationStatus,
      lastFetchedAt: creatorSources.lastFetchedAt,
      nextFetchAt: creatorSources.nextFetchAt,
      lastError: creatorSources.lastError,
      externalId: creatorSources.externalId,
      linkRelationshipType: creatorIdentityLinks.relationshipType,
      linkVerificationMethod: creatorIdentityLinks.verificationMethod,
    })
    .from(creatorSources)
    .leftJoin(
      creatorIdentityLinks,
      eq(creatorIdentityLinks.creatorSourceId, creatorSources.id),
    )
    .where(eq(creatorSources.creatorId, creatorId))
    .orderBy(creatorSources.createdAt);

  const [followers] = await db
    .select({ total: count() })
    .from(userCreatorFollows)
    .where(
      and(
        eq(userCreatorFollows.creatorId, creatorId),
        eq(userCreatorFollows.isActive, true),
      ),
    );

  return {
    id: creator.id,
    displayName: creator.displayName,
    description: creator.description ?? creator.bio ?? null,
    avatarUrl: creator.avatarUrl,
    status: creator.status,
    createdAt: creator.createdAt,
    updatedAt: creator.updatedAt,
    sources: sources.map((s) => ({
      ...toSourceSummary(s),
      externalId: s.externalId,
      linkRelationshipType: s.linkRelationshipType ?? null,
      linkVerificationMethod: s.linkVerificationMethod ?? null,
    })),
    followersCount: Number(followers?.total ?? 0),
  };
}

export interface ListCreatorsQuery {
  page: number;
  limit: number;
  sourceType?: CreatorSourceType;
  search?: string;
}

export async function listCreators(query: ListCreatorsQuery) {
  const { page, limit, sourceType, search } = query;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        sql`lower(${creators.displayName}) like ${`%${search.toLowerCase()}%`}`,
        sql`lower(${creators.xUsername}) like ${`%${search.toLowerCase()}%`}`,
      ),
    );
  }

  if (sourceType) {
    const matching = await db
      .select({ id: creatorSources.creatorId })
      .from(creatorSources)
      .where(eq(creatorSources.sourceType, sourceType));
    const ids = matching.map((m) => m.id);
    conditions.push(ids.length > 0 ? inArray(creators.id, ids) : sql`false`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ total: count() })
    .from(creators)
    .where(whereClause);
  const total = Number(totalResult?.total ?? 0);

  const rows = await db
    .select()
    .from(creators)
    .where(whereClause)
    .orderBy(desc(creators.createdAt))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.id);
  const sourceRows =
    ids.length > 0
      ? await db
          .select()
          .from(creatorSources)
          .where(inArray(creatorSources.creatorId, ids))
      : [];

  const data = rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    description: row.description ?? row.bio ?? null,
    avatarUrl: row.avatarUrl,
    status: row.status,
    createdAt: row.createdAt,
    sources: sourceRows
      .filter((s) => s.creatorId === row.id)
      .map((s) => toSourceSummary(s)),
  }));

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getSourceById(sourceId: string) {
  const [source] = await db
    .select()
    .from(creatorSources)
    .where(eq(creatorSources.id, sourceId))
    .limit(1);

  if (!source) return null;

  const [link] = await db
    .select()
    .from(creatorIdentityLinks)
    .where(eq(creatorIdentityLinks.creatorSourceId, sourceId))
    .limit(1);

  return {
    ...toSourceSummary(source),
    creatorId: source.creatorId,
    externalId: source.externalId,
    displayName: source.displayName,
    description: source.description,
    avatarUrl: source.avatarUrl,
    lastCursor: source.lastCursor,
    retryCount: source.retryCount,
    etag: source.etag,
    lastModified: source.lastModified,
    crawlAuthorized: source.crawlAuthorized,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    identityLink: link
      ? {
          relationshipType: link.relationshipType,
          verificationMethod: link.verificationMethod,
          createdAt: link.createdAt,
        }
      : null,
  };
}

/** Deletes a source. A creator with no remaining sources is removed too. */
export async function deleteSource(sourceId: string) {
  const [source] = await db
    .select()
    .from(creatorSources)
    .where(eq(creatorSources.id, sourceId))
    .limit(1);

  if (!source) {
    throw new SourceAdapterError(
      "SOURCE_NOT_FOUND",
      `Source '${sourceId}' was not found`,
      404,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(creatorSources)
      .where(eq(creatorSources.id, sourceId));

    const [remaining] = await tx
      .select({ total: count() })
      .from(creatorSources)
      .where(eq(creatorSources.creatorId, source.creatorId));

    if (Number(remaining?.total ?? 0) === 0) {
      await tx.delete(creators).where(eq(creators.id, source.creatorId));
    }
  });

  return { creatorId: source.creatorId, deleted: true };
}

/**
 * Ownership check used by source deletion: was this source added by the given
 * user? Administrators bypass this in the controller.
 */
export async function isSourceCreatedByUser(
  sourceId: string,
  userId: string,
): Promise<boolean> {
  const [link] = await db
    .select({ id: creatorIdentityLinks.id })
    .from(creatorIdentityLinks)
    .where(
      and(
        eq(creatorIdentityLinks.creatorSourceId, sourceId),
        eq(creatorIdentityLinks.verifiedByUserId, userId),
      ),
    )
    .limit(1);
  return Boolean(link);
}

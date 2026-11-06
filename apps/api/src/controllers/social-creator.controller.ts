import type { Request, Response } from "express";
import {
  addCreatorSourceSchema,
  creatorSourceQuerySchema,
  followCreatorSchema,
  followingQuerySchema,
  resolveCreatorSourceSchema,
  uuidParamSchema,
} from "@call-ledger/shared";
import { env } from "../config/env";
import {
  createAdapterRegistry,
  getAdapter,
} from "../integrations/sources/index";
import * as creatorSourceService from "../services/creator-source.service";
import * as followService from "../services/creator-follow.service";
import { getSourceMonitoringOverview as loadSourceOverview } from "../services/source-monitoring.service";
import { sendError, sendSuccess } from "../utils/api-response";

/**
 * Adapter registry shared by the API process. The X adapter is enabled only
 * when an authorized X ingestion provider is configured.
 */
const registry = createAdapterRegistry({
  xIngestionEnabled: Boolean(env.X_INGESTION_ENABLED),
  firecrawl: {
    enabled: Boolean(env.FIRECRAWL_ENABLED),
    apiKey: env.FIRECRAWL_API_KEY ?? null,
    maxPagesPerRun: env.FIRECRAWL_MAX_PAGES_PER_RUN,
    maxResponseBytes: env.FIRECRAWL_MAX_RESPONSE_BYTES,
    baseUrl: env.FIRECRAWL_BASE_URL,
  },
});

/** POST /api/creators/resolve — validate a source without persisting. */
export async function resolveCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const input = resolveCreatorSourceSchema.parse(req.body);
  const adapter = getAdapter(registry, input.sourceType);
  const validated = await creatorSourceService.resolveSourceInput(
    adapter,
    creatorSourceService.toAdapterInput(input),
  );

  const existing = await creatorSourceService.findSourceByIdentity(validated);

  sendSuccess(res, {
    sourceType: validated.sourceType,
    handle: validated.handle,
    externalId: validated.externalId,
    canonicalUrl: validated.canonicalUrl,
    displayName: validated.displayName,
    description: validated.description,
    avatarUrl: validated.avatarUrl,
    status: validated.status,
    notices: validated.notices,
    existingCreatorId: existing?.creatorId ?? null,
    alreadyExists: Boolean(existing),
  });
}

/** POST /api/creators — create a creator with its first source. */
export async function createCreator(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const input = resolveCreatorSourceSchema.parse(req.body);
  const adapter = getAdapter(registry, input.sourceType);
  const validated = await creatorSourceService.resolveSourceInput(
    adapter,
    creatorSourceService.toAdapterInput(input),
  );

  const result = await creatorSourceService.createCreatorWithSource({
    sourceType: input.sourceType,
    validated,
    userId: req.auth.id,
    createdVia: req.auth.isAdmin ? "MANUAL" : "USER_SUBMISSION",
    adapter,
  });

  sendSuccess(
    res,
    {
      creator: result.creator,
      source: result.source,
      notices: result.notices,
      alreadyExisted: result.isExistingCreator,
    },
    undefined,
    result.isExistingCreator ? 200 : 201,
  );
}

/** GET /api/creators — paginated global creator directory. */
export async function getCreators(req: Request, res: Response): Promise<void> {
  const query = creatorSourceQuerySchema.parse(req.query);
  const result = await creatorSourceService.listCreators({
    page: query.page,
    limit: query.limit,
    sourceType: query.sourceType,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
  sendSuccess(res, result.data, result.meta);
}

/** GET /api/creators/:creatorId */
export async function getCreatorById(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const detail = await creatorSourceService.getCreatorDetail(id);

  if (!detail) {
    sendError(res, "CREATOR_NOT_FOUND", `Creator '${id}' was not found`, 404);
    return;
  }

  const following = req.auth
    ? await followService.isFollowing(req.auth.id, id)
    : false;

  sendSuccess(res, { ...detail, isFollowing: following });
}

/** POST /api/creators/:creatorId/follow */
export async function followCreator_(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const { id } = uuidParamSchema.parse(req.params);
  const body = followCreatorSchema.parse(req.body ?? {});

  const result = await followService.followCreator({
    userId: req.auth.id,
    creatorId: id,
    notificationEnabled: body.notificationEnabled,
  });

  sendSuccess(res, result, undefined, result.created ? 201 : 200);
}

/** DELETE /api/creators/:creatorId/follow */
export async function unfollowCreator(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const { id } = uuidParamSchema.parse(req.params);
  const result = await followService.unfollowCreator({
    userId: req.auth.id,
    creatorId: id,
  });

  sendSuccess(res, result);
}

/** GET /api/me/following */
export async function getFollowing(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const query = followingQuerySchema.parse(req.query);
  const result = await followService.listFollowing(req.auth.id, query);
  sendSuccess(res, result.data, result.meta);
}

/** POST /api/creator-sources — explicitly link a source to an existing creator. */
export async function addCreatorSource(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const input = addCreatorSourceSchema.parse(req.body);
  const adapter = getAdapter(registry, input.sourceType);

  const { creatorId, ...rest } = input;
  const validated = await creatorSourceService.resolveSourceInput(
    adapter,
    creatorSourceService.toAdapterInput(
      rest as Parameters<typeof creatorSourceService.toAdapterInput>[0],
    ),
  );

  const source = await creatorSourceService.linkSourceToCreator({
    creatorId,
    validated,
    userId: req.auth.id,
  });

  sendSuccess(res, source, undefined, 201);
}

/** GET /api/creator-sources/:sourceId */
export async function getCreatorSource(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const source = await creatorSourceService.getSourceById(id);

  if (!source) {
    sendError(res, "SOURCE_NOT_FOUND", `Source '${id}' was not found`, 404);
    return;
  }

  sendSuccess(res, source);
}

/**
 * DELETE /api/creator-sources/:sourceId
 *
 * Ownership rule: administrators may remove any source. Regular users may only
 * remove sources they personally created (evidenced by creator_identity_links).
 */
export async function deleteCreatorSource(
  req: Request,
  res: Response,
): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }

  const { id } = uuidParamSchema.parse(req.params);
  const source = await creatorSourceService.getSourceById(id);

  if (!source) {
    sendError(res, "SOURCE_NOT_FOUND", `Source '${id}' was not found`, 404);
    return;
  }

  if (!req.auth.isAdmin) {
    const owned = await creatorSourceService.isSourceCreatedByUser(
      id,
      req.auth.id,
    );
    if (!owned) {
      sendError(
        res,
        "FORBIDDEN",
        "You can only remove creator sources that you added.",
        403,
      );
      return;
    }
  }

  const result = await creatorSourceService.deleteSource(id);
  sendSuccess(res, result);
}

/**
 * GET /api/monitoring/sources/overview
 * Configuration/status only — no worker runs in Phase 2A.
 */
export async function getSourceMonitoringOverview(
  _req: Request,
  res: Response,
): Promise<void> {
  const overview = await loadSourceOverview();
  sendSuccess(res, overview);
}

/** POST /api/creators/:id/refresh — trigger an immediate fetch of latest posts. */
export async function refreshCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const inserted = await creatorSourceService.refreshCreatorPosts(id, registry);
  sendSuccess(res, { refreshed: true, postsInserted: inserted });
}

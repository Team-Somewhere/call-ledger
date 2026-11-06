/**
 * Archive controller — serves Arkiv read endpoints.
 *
 * GET /api/archive/posts
 * GET /api/archive/posts/:entityKey
 * GET /api/archive/traders/:username/posts
 * GET /api/archive/stats
 * GET /api/archive/status   (x-monitor + arkiv config status)
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  getArchivedPost,
  getArkivStats,
  getXMonitorStatus,
  isArkivConfigured,
  listArchivedPosts,
  listTraderArchivedPosts,
} from "../services/archive.service";
import { sendError, sendSuccess } from "../utils/api-response";

const listQuerySchema = z.object({
  username: z.string().optional(),
  sourcePostId: z.string().optional(),
  tradingRelated: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  from: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((v) => !v || !isNaN(v.getTime()), { message: "Invalid from date" }),
  to: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((v) => !v || !isNaN(v.getTime()), { message: "Invalid to date" }),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(1, parseInt(v, 10)), 50) : 20)),
  cursor: z.string().optional(),
});

/**
 * GET /api/archive/posts
 * Query archived posts. Reads directly from Arkiv Rabdi.
 */
export async function listPosts(req: Request, res: Response): Promise<void> {
  if (!isArkivConfigured()) {
    sendError(
      res,
      "ARKIV_NOT_CONFIGURED",
      "Arkiv integration is not configured on this deployment. Set ARKIV_ACCESS_KEY to enable it.",
      503,
    );
    return;
  }

  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, "VALIDATION_ERROR", "Invalid query parameters", 400, query.error.format());
    return;
  }

  const result = await listArchivedPosts(query.data);
  sendSuccess(res, result.posts, {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
    source: result.source,
  });
}

/**
 * GET /api/archive/posts/:entityKey
 * Fetch a single archived post by Arkiv entity key.
 */
export async function getPost(req: Request, res: Response): Promise<void> {
  if (!isArkivConfigured()) {
    sendError(res, "ARKIV_NOT_CONFIGURED", "Arkiv integration is not configured.", 503);
    return;
  }

  const entityKey = req.params.entityKey;
  if (!entityKey || typeof entityKey !== "string" || entityKey.length > 512) {
    sendError(res, "BAD_REQUEST", "Invalid entity key", 400);
    return;
  }

  const result = await getArchivedPost(entityKey);
  if (!result.post) {
    sendError(
      res,
      "POST_NOT_FOUND",
      `Archived post with entity key '${entityKey}' was not found or has expired.`,
      404,
    );
    return;
  }

  sendSuccess(res, result.post, { source: result.source });
}

/**
 * GET /api/archive/traders/:username/posts
 * Archived posts for a specific trader by X username.
 */
export async function listTraderPosts(req: Request, res: Response): Promise<void> {
  if (!isArkivConfigured()) {
    sendError(res, "ARKIV_NOT_CONFIGURED", "Arkiv integration is not configured.", 503);
    return;
  }

  const username = Array.isArray(req.params.username)
    ? req.params.username[0]
    : req.params.username;
  if (!username || !/^[A-Za-z0-9_]{1,15}$/.test(username)) {
    sendError(res, "INVALID_HANDLE", "Invalid X username format", 400);
    return;
  }

  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, "VALIDATION_ERROR", "Invalid query parameters", 400, query.error.format());
    return;
  }

  const result = await listTraderArchivedPosts(username, query.data);
  sendSuccess(res, result.posts, {
    hasMore: result.hasMore,
    nextCursor: result.nextCursor,
    source: result.source,
    username: username.toLowerCase(),
  });
}

/**
 * GET /api/archive/stats
 * Aggregate archive statistics.
 */
export async function getStats(req: Request, res: Response): Promise<void> {
  const stats = await getArkivStats();
  sendSuccess(res, stats);
}

/**
 * GET /api/archive/status
 * X monitoring + Arkiv configuration status (for admin dashboards).
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const status = await getXMonitorStatus();
  sendSuccess(res, status);
}

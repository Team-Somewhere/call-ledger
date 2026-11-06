import type { Request, Response } from "express";
import { z } from "zod";
import {
  creatorQuerySchema,
  paginationQuerySchema,
  uuidParamSchema,
} from "@call-ledger/shared";
import * as creatorDiscoveryService from "../services/creator-discovery.service";
import * as creatorMonitoringService from "../services/creator-monitoring.service";
import * as creatorQualificationService from "../services/creator-qualification.service";
import * as creatorService from "../services/creator.service";
import * as postService from "../services/post.service";
import { sendError, sendSuccess } from "../utils/api-response";

const onboardCreatorSchema = z.object({
  xUsername: z.string().min(1, "X username is required"),
  notes: z.string().optional(),
  sourceType: z.enum(["MANUAL", "USER_SUBMISSION", "DIRECTORY"]).optional(),
});

const qualifyCreatorSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  criteria: z
    .object({
      signalClarity: z.number().min(0).max(100),
      tradingActivity: z.number().min(0).max(100),
      historicalTrackRecord: z.number().min(0).max(100),
      consistency: z.number().min(0).max(100),
      verifiability: z.number().min(0).max(100),
    })
    .optional(),
});

const reasonSchema = z.object({
  reason: z.string().optional(),
});

export async function getCreators(req: Request, res: Response): Promise<void> {
  const parsedQuery = creatorQuerySchema.parse(req.query);
  const result = await creatorService.findCreators(parsedQuery);
  sendSuccess(res, result.data, result.meta);
}

export async function getCreatorById(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const creator = await creatorService.findCreatorById(id);

  if (!creator) {
    sendError(
      res,
      "CREATOR_NOT_FOUND",
      `Creator with ID '${id}' was not found`,
      404,
    );
    return;
  }

  sendSuccess(res, creator);
}

/**
 * POST /api/creators
 * Manual creator onboarding or user submission by X handle.
 * Resolves account via official X API before creating record.
 */
export async function createCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const input = onboardCreatorSchema.parse(req.body);
  const result = await creatorDiscoveryService.onboardCreatorByUsername({
    xUsername: input.xUsername,
    sourceType: input.sourceType || "MANUAL",
    notes: input.notes,
  });

  sendSuccess(res, result.creator, undefined, result.isExisting ? 200 : 201);
}

/**
 * POST /api/creators/:id/qualify
 */
export async function qualifyCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const input = qualifyCreatorSchema.parse(req.body);

  const updated = await creatorQualificationService.qualifyCreator({
    creatorId: id,
    score: input.score,
    criteria: input.criteria,
    notes: input.notes,
  });

  sendSuccess(res, updated);
}

/**
 * POST /api/creators/:id/reject
 */
export async function rejectCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const { reason } = reasonSchema.parse(req.body || {});

  const updated = await creatorQualificationService.rejectCreator(id, reason);
  sendSuccess(res, updated);
}

/**
 * POST /api/creators/:id/suspend
 */
export async function suspendCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const { reason } = reasonSchema.parse(req.body || {});

  const updated = await creatorQualificationService.suspendCreator(id, reason);
  sendSuccess(res, updated);
}

/**
 * POST /api/creators/:id/reactivate
 */
export async function reactivateCreator(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const updated = await creatorQualificationService.reactivateCreator(id);
  sendSuccess(res, updated);
}

/**
 * POST /api/creators/:id/monitoring/enable
 */
export async function enableMonitoring(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const updated = await creatorMonitoringService.enableMonitoring(id);
  sendSuccess(res, updated);
}

/**
 * POST /api/creators/:id/monitoring/disable
 */
export async function disableMonitoring(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const updated = await creatorMonitoringService.disableMonitoring(id);
  sendSuccess(res, updated);
}

/**
 * GET /api/creators/:id/monitoring
 */
export async function getMonitoring(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const details = await creatorMonitoringService.getCreatorMonitoringDetails(id);
  sendSuccess(res, details);
}

/**
 * GET /api/creators/:id/posts
 */
export async function getCreatorPosts(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const pagination = paginationQuerySchema.parse(req.query);
  const result = await postService.findPostsByCreatorId(id, pagination);
  sendSuccess(res, result.data, result.meta);
}

import type { Request, Response } from "express";
import { z } from "zod";
import * as monitoringDashboard from "../services/monitoring-dashboard.service";
import * as postService from "../services/post.service";
import { sendError, sendSuccess } from "../utils/api-response";
import { paginationQuerySchema, uuidParamSchema } from "@call-ledger/shared";

export async function getOverview(req: Request, res: Response): Promise<void> {
  const overview = await monitoringDashboard.getMonitoringDashboard();
  sendSuccess(res, overview);
}

export async function getLogs(req: Request, res: Response): Promise<void> {
  const query = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(25),
      sourceId: z.string().uuid().optional(),
    })
    .parse(req.query);
  const logs = await monitoringDashboard.listMonitoringLogs(
    query.limit,
    query.sourceId,
  );
  sendSuccess(res, logs);
}

export async function getSourceStatus(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse({ id: req.params.sourceId });
  const source = await monitoringDashboard.getCreatorSourceStatus(id);
  if (!source) {
    sendError(
      res,
      "SOURCE_NOT_FOUND",
      "The creator source was not found.",
      404,
    );
    return;
  }
  sendSuccess(res, source);
}

export async function getPostById(req: Request, res: Response): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const post = await postService.findPostById(id);

  if (!post) {
    sendError(res, "POST_NOT_FOUND", `Post with ID '${id}' was not found`, 404);
    return;
  }

  sendSuccess(res, post);
}

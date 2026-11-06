/**
 * Monitoring status controller — Phase 3 routes.
 *
 * GET  /api/monitoring/status
 * GET  /api/monitoring/traders
 * PATCH /api/monitoring/traders/:traderId
 * POST /api/monitoring/pause
 * POST /api/monitoring/resume
 * POST /api/monitoring/run-now
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  getWorkerStatus,
  listTraderMonitoringStates,
  pauseAllMonitoring,
  pauseTraderMonitoring,
  resumeAllMonitoring,
  resumeTraderMonitoring,
  triggerRunNow,
} from "../services/monitoring-status.service";
import { sendError, sendSuccess } from "../utils/api-response";

export async function getStatus(req: Request, res: Response): Promise<void> {
  const status = await getWorkerStatus();
  sendSuccess(res, status);
}

export async function listTraders(req: Request, res: Response): Promise<void> {
  const traders = await listTraderMonitoringStates();
  sendSuccess(res, traders);
}

const patchTraderSchema = z.object({
  enabled: z.boolean(),
});

export async function patchTrader(req: Request, res: Response): Promise<void> {
  const traderId = Array.isArray(req.params.traderId) 
    ? req.params.traderId[0] 
    : req.params.traderId;
  if (!traderId || !/^[0-9a-f-]{36}$/.test(traderId)) {
    sendError(res, "BAD_REQUEST", "Invalid traderId", 400);
    return;
  }

  const body = patchTraderSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, "VALIDATION_ERROR", "Body must include { enabled: boolean }", 400);
    return;
  }

  if (body.data.enabled) {
    await resumeTraderMonitoring(traderId);
  } else {
    await pauseTraderMonitoring(traderId);
  }

  sendSuccess(res, { traderId, enabled: body.data.enabled });
}

export async function pauseAll(req: Request, res: Response): Promise<void> {
  await pauseAllMonitoring();
  sendSuccess(res, { paused: true });
}

export async function resumeAll(req: Request, res: Response): Promise<void> {
  await resumeAllMonitoring();
  sendSuccess(res, { resumed: true });
}

export async function runNow(req: Request, res: Response): Promise<void> {
  const result = await triggerRunNow();
  sendSuccess(res, {
    triggered: true,
    sourcesReset: result.sourcesReset,
    message: `${result.sourcesReset} X source(s) scheduled for immediate pickup. The worker will process them on its next cycle (within 60 seconds).`,
  });
}

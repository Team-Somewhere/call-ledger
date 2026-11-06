import { Router } from "express";
import * as monitoringController from "../controllers/monitoring.controller";
import * as monitoringStatusController from "../controllers/monitoring-status.controller";
import * as socialCreatorController from "../controllers/social-creator.controller";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const monitoringRouter = Router();

// ── Existing Phase 2 routes ────────────────────────────────────────────────

monitoringRouter.get(
  "/overview",
  requireAdmin,
  asyncHandler(monitoringController.getOverview),
);
monitoringRouter.get(
  "/logs",
  requireAdmin,
  asyncHandler(monitoringController.getLogs),
);

// Phase 2A: source-level monitoring configuration & status
monitoringRouter.get(
  "/sources/overview",
  asyncHandler(socialCreatorController.getSourceMonitoringOverview),
);

// ── Phase 3 routes ─────────────────────────────────────────────────────────

// Worker status + budget — no auth required (non-sensitive operational data)
monitoringRouter.get(
  "/status",
  asyncHandler(monitoringStatusController.getStatus),
);

// Per-trader monitoring state — no auth required (public trader list)
monitoringRouter.get(
  "/traders",
  asyncHandler(monitoringStatusController.listTraders),
);

// Admin: toggle a single trader's monitoring
monitoringRouter.patch(
  "/traders/:traderId",
  requireAdmin,
  asyncHandler(monitoringStatusController.patchTrader),
);

// Admin: pause all X monitoring
monitoringRouter.post(
  "/pause",
  requireAdmin,
  asyncHandler(monitoringStatusController.pauseAll),
);

// Admin: resume all X monitoring
monitoringRouter.post(
  "/resume",
  requireAdmin,
  asyncHandler(monitoringStatusController.resumeAll),
);

// Admin: trigger immediate run (resets nextFetchAt for all due sources)
monitoringRouter.post(
  "/run-now",
  requireAdmin,
  asyncHandler(monitoringStatusController.runNow),
);

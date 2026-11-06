import { Router } from "express";
import * as monitoringController from "../controllers/monitoring.controller";
import * as socialCreatorController from "../controllers/social-creator.controller";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const monitoringRouter = Router();

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

// Phase 2A: source-level monitoring configuration & status (no worker runs).
monitoringRouter.get(
  "/sources/overview",
  asyncHandler(socialCreatorController.getSourceMonitoringOverview),
);

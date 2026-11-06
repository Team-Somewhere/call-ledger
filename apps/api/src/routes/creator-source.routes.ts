import { Router } from "express";
import * as activityController from "../controllers/activity.controller";
import * as socialCreatorController from "../controllers/social-creator.controller";
import * as monitoringController from "../controllers/monitoring.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

/**
 * Phase 2A creator management routes.
 *
 * Mounted under /api/creator-sources and /api/me. Creator-scoped following
 * routes are registered in creator.routes.ts alongside the existing Phase 2
 * creator endpoints.
 */
export const creatorSourceRouter = Router();

creatorSourceRouter.post(
  "/",
  requireAuth,
  asyncHandler(socialCreatorController.addCreatorSource),
);
creatorSourceRouter.get(
  "/:id",
  asyncHandler(socialCreatorController.getCreatorSource),
);
creatorSourceRouter.get(
  "/:sourceId/status",
  asyncHandler(monitoringController.getSourceStatus),
);
creatorSourceRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(socialCreatorController.deleteCreatorSource),
);

export const meRouter = Router();

meRouter.get(
  "/following",
  requireAuth,
  asyncHandler(socialCreatorController.getFollowing),
);
meRouter.get(
  "/activity",
  requireAuth,
  asyncHandler(activityController.getMyActivity),
);

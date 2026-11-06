import { Router } from "express";
import * as creatorController from "../controllers/creator.controller";
import * as socialCreatorController from "../controllers/social-creator.controller";
import * as activityController from "../controllers/activity.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const creatorRouter = Router();

// ---------------------------------------------------------------------------
// Phase 2A: multi-source creator management, resolution & following
// ---------------------------------------------------------------------------

// Validate a source (X / Bluesky / RSS / Website) without persisting it.
creatorRouter.post(
  "/resolve",
  asyncHandler(socialCreatorController.resolveCreator),
);

// Create a creator together with its first source.
creatorRouter.post(
  "/",
  requireAuth,
  asyncHandler(socialCreatorController.createCreator),
);

// Global creator directory.
creatorRouter.get("/", asyncHandler(socialCreatorController.getCreators));

// Creator profile (multi-source aware).
creatorRouter.get("/:id", asyncHandler(socialCreatorController.getCreatorById));

// Immediate refresh of posts for a creator
creatorRouter.post(
  "/:id/refresh",
  asyncHandler(socialCreatorController.refreshCreator),
);

// Following (off-chain, wallet-scoped).
creatorRouter.post(
  "/:id/follow",
  requireAuth,
  asyncHandler(socialCreatorController.followCreator_),
);
creatorRouter.delete(
  "/:id/follow",
  requireAuth,
  asyncHandler(socialCreatorController.unfollowCreator),
);

// ---------------------------------------------------------------------------
// Phase 2 (legacy): X-only discovery, qualification & monitoring endpoints.
// Preserved unchanged so existing Phase 1/2 behaviour keeps working.
// ---------------------------------------------------------------------------

creatorRouter.post(
  "/:id/qualify",
  asyncHandler(creatorController.qualifyCreator),
);
creatorRouter.post(
  "/:id/reject",
  asyncHandler(creatorController.rejectCreator),
);
creatorRouter.post(
  "/:id/suspend",
  asyncHandler(creatorController.suspendCreator),
);
creatorRouter.post(
  "/:id/reactivate",
  asyncHandler(creatorController.reactivateCreator),
);

creatorRouter.post(
  "/:id/monitoring/enable",
  asyncHandler(creatorController.enableMonitoring),
);
creatorRouter.post(
  "/:id/monitoring/disable",
  asyncHandler(creatorController.disableMonitoring),
);
creatorRouter.get(
  "/:id/monitoring",
  asyncHandler(creatorController.getMonitoring),
);

creatorRouter.get(
  "/:id/posts",
  asyncHandler(activityController.getCreatorPosts),
);

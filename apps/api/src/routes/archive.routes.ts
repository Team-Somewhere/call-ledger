/**
 * Archive routes — Arkiv read endpoints.
 *
 * All reads query Arkiv Rabdi directly.
 * No archive endpoints write to Arkiv (writes happen in the worker).
 */

import { Router } from "express";
import * as archiveController from "../controllers/archive.controller";
import { asyncHandler } from "../utils/async-handler";

export const archiveRouter = Router();

// GET /api/archive/stats — aggregate stats (no auth required, non-sensitive)
archiveRouter.get("/stats", asyncHandler(archiveController.getStats));

// GET /api/archive/status — X monitor + Arkiv config health
archiveRouter.get("/status", asyncHandler(archiveController.getStatus));

// GET /api/archive/traders/:username/posts — posts for a specific trader
archiveRouter.get(
  "/traders/:username/posts",
  asyncHandler(archiveController.listTraderPosts),
);

// GET /api/archive/posts/:entityKey — single entity by key (before /posts list)
archiveRouter.get(
  "/posts/:entityKey",
  asyncHandler(archiveController.getPost),
);

// GET /api/archive/posts — paginated post list
archiveRouter.get("/posts", asyncHandler(archiveController.listPosts));

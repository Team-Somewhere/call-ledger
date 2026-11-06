import { Router } from "express";
import * as monitoringController from "../controllers/monitoring.controller";
import { asyncHandler } from "../utils/async-handler";

export const postRouter = Router();

postRouter.get("/:id", asyncHandler(monitoringController.getPostById));


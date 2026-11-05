import { Router } from "express";
import * as healthController from "../controllers/health.controller";
import { asyncHandler } from "../utils/async-handler";

export const healthRouter = Router();

healthRouter.get("/", asyncHandler(healthController.getHealth));

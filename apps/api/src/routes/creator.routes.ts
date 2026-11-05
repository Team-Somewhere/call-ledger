import { Router } from "express";
import * as creatorController from "../controllers/creator.controller";
import { asyncHandler } from "../utils/async-handler";

export const creatorRouter = Router();

creatorRouter.get("/", asyncHandler(creatorController.getCreators));
creatorRouter.get("/:id", asyncHandler(creatorController.getCreatorById));

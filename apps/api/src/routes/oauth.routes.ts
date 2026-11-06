import { Router } from "express";
import * as oauthController from "../controllers/oauth.controller";
import { asyncHandler } from "../utils/async-handler";

export const oauthRouter = Router();

oauthRouter.get("/connect", asyncHandler(oauthController.connectX));
oauthRouter.get("/callback", asyncHandler(oauthController.callbackX));
oauthRouter.get("/status", asyncHandler(oauthController.getXStatus));
oauthRouter.delete("/disconnect", asyncHandler(oauthController.disconnectX));


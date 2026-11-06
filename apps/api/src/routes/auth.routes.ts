import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post(
  "/wallet/nonce",
  asyncHandler(authController.requestNonce),
);
authRouter.post(
  "/wallet/verify",
  asyncHandler(authController.verifyWallet),
);
authRouter.get("/me", requireAuth, asyncHandler(authController.getSession));

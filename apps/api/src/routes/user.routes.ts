import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { asyncHandler } from "../utils/async-handler";

export const userRouter = Router();

userRouter.get("/", asyncHandler(userController.getUsers));
userRouter.get("/:id", asyncHandler(userController.getUserById));

import type { Request, Response } from "express";
import { paginationQuerySchema, uuidParamSchema } from "@call-ledger/shared";
import * as userService from "../services/user.service";
import { sendError, sendSuccess } from "../utils/api-response";

export async function getUsers(req: Request, res: Response): Promise<void> {
  const parsedQuery = paginationQuerySchema.parse(req.query);
  const result = await userService.findUsers(parsedQuery);
  sendSuccess(res, result.data, result.meta);
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const user = await userService.findUserById(id);

  if (!user) {
    sendError(res, "USER_NOT_FOUND", `User with ID '${id}' was not found`, 404);
    return;
  }

  sendSuccess(res, user);
}

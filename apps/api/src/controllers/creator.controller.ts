import type { Request, Response } from "express";
import { creatorQuerySchema, uuidParamSchema } from "@call-ledger/shared";
import * as creatorService from "../services/creator.service";
import { sendError, sendSuccess } from "../utils/api-response";

export async function getCreators(req: Request, res: Response): Promise<void> {
  const parsedQuery = creatorQuerySchema.parse(req.query);
  const result = await creatorService.findCreators(parsedQuery);
  sendSuccess(res, result.data, result.meta);
}

export async function getCreatorById(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = uuidParamSchema.parse(req.params);
  const creator = await creatorService.findCreatorById(id);

  if (!creator) {
    sendError(
      res,
      "CREATOR_NOT_FOUND",
      `Creator with ID '${id}' was not found`,
      404,
    );
    return;
  }

  sendSuccess(res, creator);
}

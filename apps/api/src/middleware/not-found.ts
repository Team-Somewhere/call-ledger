import type { Request, Response } from "express";
import { sendError } from "../utils/api-response";

export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    "NOT_FOUND",
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
  );
}

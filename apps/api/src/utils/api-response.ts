import type { Response } from "express";
import type { ApiPaginationMeta } from "@call-ledger/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: ApiPaginationMeta | Record<string, unknown>,
  statusCode = 200,
): Response {
  const payload: { success: true; data: T; meta?: unknown } = {
    success: true,
    data,
  };
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown,
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

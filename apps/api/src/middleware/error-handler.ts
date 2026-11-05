import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/api-response";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    sendError(
      res,
      "VALIDATION_ERROR",
      "Input validation failed",
      400,
      err.format(),
    );
    return;
  }

  if (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status: number }).status === 400
  ) {
    sendError(res, "BAD_REQUEST", "Malformed JSON in request body", 400);
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[API Error]", err);

  sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : message,
    500,
  );
}

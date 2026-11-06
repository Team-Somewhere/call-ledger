import type { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/api-response";

/**
 * Detects a Zod validation error by shape. `instanceof ZodError` is unreliable
 * in this monorepo because workspace packages can resolve their own copy of
 * `zod`, so the class identity check fails across module boundaries.
 */
function isZodError(err: unknown): err is { format: () => unknown } {
  return (
    err instanceof Error &&
    err.name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

function isSourceAdapterError(
  err: unknown,
): err is { code: string; message: string; statusCode: number } {
  return (
    err instanceof Error &&
    typeof (err as { code?: unknown }).code === "string" &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isSourceAdapterError(err)) {
    // Domain errors (validation, SSRF, unauthorized source, provider failure)
    // carry an intentional status code and a safe, user-facing message.
    sendError(res, err.code, err.message, err.statusCode);
    return;
  }

  if (isZodError(err)) {
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

/**
 * X API error classification and normalization.
 *
 * Maps HTTP status codes and X error types to structured errors
 * so callers can make decisions without inspecting raw HTTP responses.
 */

export type XErrorCategory =
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE"
  | "UNKNOWN";

export class XApiError extends Error {
  public readonly category: XErrorCategory;
  public readonly httpStatus?: number;
  public readonly rateLimitResetAt?: Date;

  constructor(
    message: string,
    category: XErrorCategory,
    httpStatus?: number,
    rateLimitResetAt?: Date,
  ) {
    super(message);
    Object.setPrototypeOf(this, XApiError.prototype);
    this.name = "XApiError";
    this.category = category;
    this.httpStatus = httpStatus;
    this.rateLimitResetAt = rateLimitResetAt;
  }

  get isRetryable(): boolean {
    return (
      this.category === "SERVER_ERROR" || this.category === "NETWORK_ERROR"
    );
  }

  get isPermanent(): boolean {
    return (
      this.category === "FORBIDDEN" ||
      this.category === "NOT_FOUND" ||
      this.category === "UNAUTHORIZED"
    );
  }
}

export function categorizeHttpError(
  status: number,
  headers?: Headers,
  body?: unknown,
): XApiError {
  const rateLimitReset = headers?.get("x-rate-limit-reset");
  const rateLimitResetAt = rateLimitReset
    ? new Date(parseInt(rateLimitReset, 10) * 1000)
    : undefined;

  switch (status) {
    case 429:
      return new XApiError(
        "X API rate limit exceeded",
        "RATE_LIMITED",
        status,
        rateLimitResetAt,
      );
    case 401:
      return new XApiError(
        "X API authentication failed — token may be expired or revoked",
        "UNAUTHORIZED",
        status,
      );
    case 403:
      return new XApiError(
        "X API access forbidden — insufficient permissions or access tier",
        "FORBIDDEN",
        status,
      );
    case 404:
      return new XApiError("X API resource not found", "NOT_FOUND", status);
    default:
      if (status >= 500) {
        return new XApiError(
          `X API server error (${status})`,
          "SERVER_ERROR",
          status,
        );
      }
      return new XApiError(
        `Unexpected X API response (${status})`,
        "UNKNOWN",
        status,
      );
  }
}


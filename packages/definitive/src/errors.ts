/**
 * Typed error thrown by the Definitive Flash client.
 * Sanitized to never leak API keys, authorization tokens, or signing secrets.
 */
export class DefinitiveApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(sanitizeErrorMessage(message));
    this.name = "DefinitiveApiError";
  }
}

/**
 * Remove sensitive credentials from error strings before logging or rendering.
 */
function sanitizeErrorMessage(msg: unknown): string {
  const str =
    typeof msg === "string"
      ? msg
      : typeof (msg as any)?.message === "string"
        ? (msg as any).message
        : typeof (msg as any)?.error === "string"
          ? (msg as any).error
          : typeof msg === "object" && msg !== null
            ? JSON.stringify(msg)
            : String(msg ?? "Unknown error");

  return str
    .replace(/(x-definitive-api-key\s*[:=]\s*)['"]?[^'"\s\\]+['"]?/gi, "$1[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, "$1[REDACTED]")
    .replace(/(0x[a-fA-F0-9]{64})/g, "[HASH/KEY_REDACTED]");
}


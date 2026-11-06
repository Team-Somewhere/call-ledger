import { SourceAdapterError } from "@call-ledger/shared";
import { assertSafeUrl } from "./ssrf";

export interface SafeFetchOptions {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** Maximum bytes to read from the response body. */
  maxBytes?: number;
  /** Maximum redirect hops to follow manually. */
  maxRedirects?: number;
  headers?: Record<string, string>;
  /** Restrict accepted content types (substring match against content-type). */
  acceptContentTypes?: string[];
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  /** True when the upstream answered 304 Not Modified to a conditional GET. */
  notModified: boolean;
  body: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_MAX_REDIRECTS = 3;

/**
 * Fetches a remote resource with SSRF protection, a hard timeout and a
 * response-size cap. Redirects are followed manually so every hop can be
 * re-validated against the SSRF guard (a redirect to 127.0.0.1 must fail).
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = await assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchImpl(currentUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "CallLedgerBot/2.0 (+https://callledger.app)",
          accept: "*/*",
          ...options.headers,
        },
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        throw new SourceAdapterError(
          "UPSTREAM_TIMEOUT",
          `Request to ${currentUrl.hostname} timed out after ${timeoutMs}ms`,
          504,
          true,
        );
      }
      throw new SourceAdapterError(
        "UPSTREAM_UNREACHABLE",
        `Could not reach ${currentUrl.hostname}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        502,
        true,
      );
    }

    try {
      if (response.status === 304) {
        return {
          url: currentUrl.toString(),
          status: 304,
          contentType: response.headers.get("content-type"),
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
          notModified: true,
          body: "",
        };
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new SourceAdapterError(
            "REDIRECT_WITHOUT_LOCATION",
            "Upstream returned a redirect without a Location header",
            502,
          );
        }
        const next = new URL(location, currentUrl);
        // Re-run the full SSRF guard on every redirect target.
        currentUrl = await assertSafeUrl(next.toString());
        continue;
      }

      if (!response.ok) {
        const retryAfter = response.headers.get("retry-after");
        throw new SourceAdapterError(
          "UPSTREAM_HTTP_ERROR",
          `Upstream responded with HTTP ${response.status}`,
          response.status === 429 ? 429 : 502,
          response.status === 429 || response.status >= 500,
          response.status === 429 ? parseRetryAfter(retryAfter) : null,
        );
      }

      const contentType = response.headers.get("content-type");
      if (options.acceptContentTypes?.length) {
        const normalized = (contentType ?? "").toLowerCase();
        const accepted = options.acceptContentTypes.some((t) =>
          normalized.includes(t.toLowerCase()),
        );
        if (!accepted) {
          throw new SourceAdapterError(
            "UNSUPPORTED_CONTENT_TYPE",
            `Unsupported content type: ${contentType ?? "unknown"}`,
            415,
          );
        }
      }

      let body: string;
      try {
        body = await readBodyWithLimit(response, maxBytes);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new SourceAdapterError(
            "UPSTREAM_TIMEOUT",
            `Request to ${currentUrl.hostname} timed out after ${timeoutMs}ms`,
            504,
            true,
          );
        }
        throw error;
      }

      return {
        url: currentUrl.toString(),
        status: response.status,
        contentType,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        notModified: false,
        body,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SourceAdapterError(
    "TOO_MANY_REDIRECTS",
    `Exceeded ${maxRedirects} redirects`,
    502,
  );
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && parseInt(declaredLength, 10) > maxBytes) {
    throw new SourceAdapterError(
      "RESPONSE_TOO_LARGE",
      `Response exceeds the ${maxBytes} byte limit`,
      413,
    );
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new SourceAdapterError(
          "RESPONSE_TOO_LARGE",
          `Response exceeds the ${maxBytes} byte limit`,
          413,
        );
      }
      chunks.push(value);
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

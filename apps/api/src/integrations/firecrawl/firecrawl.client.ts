import { SourceAdapterError } from "@call-ledger/shared";
import { assertSafeUrl } from "../sources/ssrf";

/**
 * Minimal server-side Firecrawl client.
 *
 * Docs: https://docs.firecrawl.dev/
 *
 * Safety rules enforced here:
 * - never runs unless FIRECRAWL_ENABLED=true AND FIRECRAWL_API_KEY is set
 * - the API key is read server-side only and never logged or returned
 * - URLs are SSRF-validated before the request leaves the process
 * - a hard per-run page limit is applied
 * - requests time out
 * - Firecrawl is NEVER used to reach x.com / twitter.com
 */

export interface FirecrawlConfig {
  enabled: boolean;
  apiKey: string | null;
  baseUrl?: string;
  maxPagesPerRun: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
}

export interface FirecrawlScrapeResult {
  url: string;
  title: string | null;
  description: string | null;
  markdown: string | null;
  statusCode: number | null;
  publishedAt: string | null;
}

const BLOCKED_TARGET_HOSTS = [
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "t.co",
];

export class FirecrawlClient {
  readonly enabled: boolean;
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly maxPagesPerRun: number;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: FirecrawlConfig) {
    this.apiKey = config.apiKey?.trim() || null;
    this.enabled = Boolean(config.enabled && this.apiKey);
    this.baseUrl = (config.baseUrl ?? "https://api.firecrawl.dev").replace(
      /\/$/,
      "",
    );
    this.maxPagesPerRun = config.maxPagesPerRun;
    this.timeoutMs = config.timeoutMs ?? 20_000;
    this.maxResponseBytes = config.maxResponseBytes ?? 2 * 1024 * 1024;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Throws a stable, user-safe error when the integration is not usable. */
  assertAvailable(): void {
    if (!this.enabled) {
      throw new SourceAdapterError(
        "FIRECRAWL_DISABLED",
        "Website crawling is not enabled on this deployment. Set FIRECRAWL_ENABLED=true and FIRECRAWL_API_KEY to enable it.",
        503,
        false,
      );
    }
  }

  async scrape(rawUrl: string): Promise<FirecrawlScrapeResult> {
    this.assertAvailable();

    const url = await assertSafeUrl(rawUrl);

    if (BLOCKED_TARGET_HOSTS.includes(url.hostname.toLowerCase())) {
      throw new SourceAdapterError(
        "TARGET_NOT_ALLOWED",
        "Firecrawl may not be used to access X/Twitter content",
        403,
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/scrape`, {
        method: "POST",
        signal: controller.signal,
        redirect: "error",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url: url.toString(),
          // Only ever fetch the single authorized page — never a whole domain.
          limit: Math.min(1, this.maxPagesPerRun),
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        throw new SourceAdapterError(
          "FIRECRAWL_TIMEOUT",
          "The website crawling provider did not respond in time",
          504,
          true,
        );
      }
      throw new SourceAdapterError(
        "FIRECRAWL_UNREACHABLE",
        "Could not reach the website crawling provider",
        502,
        true,
      );
    }

    try {
      if (response.status === 401 || response.status === 403) {
        throw new SourceAdapterError(
          "FIRECRAWL_UNAUTHORIZED",
          "The website crawling provider rejected the configured credentials",
          502,
        );
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        throw new SourceAdapterError(
          "FIRECRAWL_RATE_LIMITED",
          "The website crawling provider rate limit was reached",
          429,
          true,
          parseRetryAfter(retryAfter),
        );
      }

      if (!response.ok) {
        // Never surface the provider's raw body: it may echo the API key.
        throw new SourceAdapterError(
          "FIRECRAWL_PROVIDER_ERROR",
          `The website crawling provider responded with HTTP ${response.status}`,
          502,
          response.status >= 500,
        );
      }

      const payload = (await readJsonWithLimit(
        response,
        this.maxResponseBytes,
      )) as {
        success?: boolean;
        data?: {
          markdown?: string;
          metadata?: {
            title?: string;
            description?: string;
            sourceURL?: string;
            statusCode?: number;
            publishedTime?: string;
            ogUrl?: string;
          };
        };
      } | null;

      if (!payload?.data) {
        throw new SourceAdapterError(
          "FIRECRAWL_EMPTY_RESULT",
          "The website crawling provider returned no content",
          502,
        );
      }

      return {
        url:
          payload.data.metadata?.ogUrl ??
          payload.data.metadata?.sourceURL ??
          url.toString(),
        title: payload.data.metadata?.title?.trim() || null,
        description: payload.data.metadata?.description?.trim() || null,
        markdown: payload.data.markdown ?? null,
        statusCode: payload.data.metadata?.statusCode ?? null,
        publishedAt: payload.data.metadata?.publishedTime ?? null,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

async function readJsonWithLimit(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new SourceAdapterError(
      "FIRECRAWL_RESPONSE_TOO_LARGE",
      "The website crawling provider returned too much content",
      502,
    );
  }

  if (!response.body) {
    throw new SourceAdapterError(
      "FIRECRAWL_INVALID_RESPONSE",
      "The website crawling provider returned an empty response",
      502,
    );
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new SourceAdapterError(
        "FIRECRAWL_RESPONSE_TOO_LARGE",
        "The website crawling provider returned too much content",
        502,
      );
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new SourceAdapterError(
      "FIRECRAWL_INVALID_RESPONSE",
      "The website crawling provider returned malformed data",
      502,
    );
  }
}

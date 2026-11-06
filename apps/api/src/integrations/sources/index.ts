import type {
  CreatorSourceAdapter,
  CreatorSourceType,
} from "@call-ledger/shared";
import { SourceAdapterError } from "@call-ledger/shared";
import {
  FirecrawlClient,
  type FirecrawlConfig,
} from "../firecrawl/firecrawl.client";
import { BlueskyAdapter } from "./bluesky.adapter";
import { RssAdapter } from "./rss.adapter";
import { WebsiteAdapter } from "./website.adapter";
import { XAdapter } from "./x.adapter";

export interface AdapterRegistryOptions {
  xIngestionEnabled?: boolean;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  firecrawl?: FirecrawlConfig;
  /** Override adapters (used by tests). */
  overrides?: Partial<Record<CreatorSourceType, CreatorSourceAdapter>>;
}

const ADAPTERS = new WeakMap<
  AdapterRegistryOptions,
  Map<CreatorSourceType, CreatorSourceAdapter>
>();

/**
 * Resolves the adapter for a source type. The rest of the application depends
 * only on the `CreatorSourceAdapter` interface — never on a concrete provider.
 */
export function createAdapterRegistry(
  options: AdapterRegistryOptions = {},
): Map<CreatorSourceType, CreatorSourceAdapter> {
  const cached = ADAPTERS.get(options);
  if (cached) return cached;

  const firecrawl = new FirecrawlClient(
    options.firecrawl ?? {
      enabled: false,
      apiKey: null,
      maxPagesPerRun: 5,
    },
  );

  const registry = new Map<CreatorSourceType, CreatorSourceAdapter>([
    ["X", new XAdapter({ ingestionEnabled: options.xIngestionEnabled })],
    [
      "BLUESKY",
      new BlueskyAdapter({
        timeoutMs: options.requestTimeoutMs,
        maxResponseBytes: options.maxResponseBytes,
      }),
    ],
    [
      "RSS",
      new RssAdapter({
        fetchOptions: {
          timeoutMs: options.requestTimeoutMs,
          maxBytes: options.maxResponseBytes,
        },
      }),
    ],
    ["WEBSITE", new WebsiteAdapter({ firecrawl })],
  ]);

  for (const [type, adapter] of Object.entries(options.overrides ?? {})) {
    if (adapter) registry.set(type as CreatorSourceType, adapter);
  }

  ADAPTERS.set(options, registry);
  return registry;
}

export function getAdapter(
  registry: Map<CreatorSourceType, CreatorSourceAdapter>,
  sourceType: CreatorSourceType,
): CreatorSourceAdapter {
  const adapter = registry.get(sourceType);
  if (!adapter) {
    throw new SourceAdapterError(
      "UNSUPPORTED_SOURCE_TYPE",
      `No adapter registered for source type '${sourceType}'`,
      400,
    );
  }
  return adapter;
}

export { FirecrawlClient } from "../firecrawl/firecrawl.client";
export { BlueskyAdapter } from "./bluesky.adapter";
export { RssAdapter } from "./rss.adapter";
export { WebsiteAdapter } from "./website.adapter";
export { XAdapter } from "./x.adapter";
export { assertSafeUrl, assertSafeUrlStructure, blockedIpReason } from "./ssrf";
export { safeFetch } from "./safe-fetch";

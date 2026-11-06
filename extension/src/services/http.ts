import { REQUEST_TIMEOUT_MS } from "../config/constants";

/** Typed error for provider calls, so the UI can show an honest reason. */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly kind: "rate_limited" | "timeout" | "network" | "http" | "invalid_response" | "not_found",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** fetch with a hard timeout. Never retries automatically: retries spend the user's quota. */
export async function fetchJson(provider: string, url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (res.status === 429) {
      throw new ProviderError(provider, "rate_limited", `${provider} rate limit reached. Try again shortly.`, 429);
    }
    if (res.status === 404) {
      throw new ProviderError(provider, "not_found", `${provider} has no data for this request.`, 404);
    }
    if (!res.ok) {
      throw new ProviderError(provider, "http", `${provider} returned HTTP ${res.status}.`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ProviderError(provider, "timeout", `${provider} did not respond in time.`);
    }
    throw new ProviderError(provider, "network", `Could not reach ${provider}.`);
  } finally {
    clearTimeout(timer);
  }
}

/** Serialises calls to one provider so they respect its per-minute limit. */
export function createThrottle(minIntervalMs: number) {
  let chain: Promise<void> = Promise.resolve();
  let last = 0;
  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = Math.max(0, last + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
      return task();
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/** Small in-memory TTL cache. Entries expire; failures are never cached. */
export class TtlCache<V> {
  private readonly store = new Map<string, { value: V; expires: number }>();
  constructor(private readonly ttlMs: number) {}
  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
  set(key: string, value: V): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

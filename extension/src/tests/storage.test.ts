import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPreferences, setPreferences, DEFAULT_PREFERENCES } from "../services/storage";

describe("Storage service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns default preferences when chrome.storage is not available", async () => {
    const originalChrome = globalThis.chrome;
    // @ts-expect-error test mock
    delete globalThis.chrome;
    const prefs = await getPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    globalThis.chrome = originalChrome;
  });

  it("reads and writes preferences via chrome.storage.local", async () => {
    const store: Record<string, unknown> = {};
    const originalChrome = globalThis.chrome;

    globalThis.chrome = {
      ...originalChrome,
      storage: {
        ...originalChrome?.storage,
        local: {
          get: vi.fn(async (key?: unknown) => {
            if (typeof key === "string") return { [key]: store[key] };
            return store;
          }) as unknown as typeof chrome.storage.local.get,
          set: vi.fn(async (obj: Record<string, unknown>) => {
            Object.assign(store, obj);
          }) as unknown as typeof chrome.storage.local.set,
        } as unknown as typeof chrome.storage.local,
      } as unknown as typeof chrome.storage,
    } as unknown as typeof chrome;

    const initial = await getPreferences();
    expect(initial.currency).toBe("USD");

    await setPreferences({ currency: "INR" });
    const updated = await getPreferences();
    expect(updated.currency).toBe("INR");

    globalThis.chrome = originalChrome;
  });
});

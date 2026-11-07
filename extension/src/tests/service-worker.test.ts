import { describe, it, expect, vi, beforeEach } from "vitest";
import { handle } from "../background/service-worker";

// Mock external dependencies
vi.mock("../features/tokens/market-data", () => ({
  resolveSymbol: vi.fn(async (symbol: string) => ({
    symbol,
    name: "Ethereum",
    address: "0x123",
    priceUsd: 3000,
  })),
  fetchChart: vi.fn(async () => ({ points: [] })),
}));

vi.mock("../features/tokens/fx-service", () => ({
  getUsdToInr: vi.fn(async () => 85.5),
}));

const mockStorage: Record<string, unknown> = {};
vi.mock("../services/storage", () => ({
  getPreferences: vi.fn(async () => mockStorage.preferences ?? { currency: "USD" }),
  setPreferences: vi.fn(async (next: { currency: "USD" | "INR" }) => {
    mockStorage.preferences = { currency: next.currency };
    return mockStorage.preferences;
  }),
  getWalletSession: vi.fn(async () => null),
  setWalletSession: vi.fn(async () => undefined),
}));

describe("Service Worker Message Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete mockStorage.preferences;
  });

  it("handles PING message", async () => {
    const res = await handle({ type: "PING" });
    expect(res).toEqual({ ok: true, data: { pong: true } });
  });

  it("rejects unknown message type", async () => {
    const res = await handle({ type: "UNKNOWN" });
    expect(res).toEqual({
      ok: false,
      error: { code: "INVALID_MESSAGE", message: "Unrecognised request." },
    });
  });

  it("rejects malicious or invalid symbol in RESOLVE_TOKEN", async () => {
    const res = await handle({ type: "RESOLVE_TOKEN", symbol: "<script>" });
    expect(res).toEqual({
      ok: false,
      error: { code: "INVALID_MESSAGE", message: "Unrecognised request." },
    });
  });

  it("accepts valid symbol in RESOLVE_TOKEN", async () => {
    const res = await handle({ type: "RESOLVE_TOKEN", symbol: "ETH" });
    expect(res).toEqual({
      ok: true,
      data: {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x123",
        priceUsd: 3000,
      },
    });
  });

  it("handles GET_PREFERENCES", async () => {
    const res = await handle({ type: "GET_PREFERENCES" });
    expect(res).toEqual({ ok: true, data: { currency: "USD" } });
  });

  it("handles SET_PREFERENCES and updates currency", async () => {
    const setRes = await handle({ type: "SET_PREFERENCES", currency: "INR" });
    expect(setRes).toEqual({ ok: true, data: { currency: "INR" } });

    const getRes = await handle({ type: "GET_PREFERENCES" });
    expect(getRes).toEqual({ ok: true, data: { currency: "INR" } });
  });

  it("handles GET_FX", async () => {
    const res = await handle({ type: "GET_FX" });
    expect(res).toEqual({ ok: true, data: 85.5 });
  });

  it("handles GET_SESSION", async () => {
    const res = await handle({ type: "GET_SESSION" });
    expect(res).toEqual({
      ok: true,
      data: { connected: false },
    });
  });
});


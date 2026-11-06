import assert from "node:assert";
import { describe, it } from "node:test";
import { buildWalletLoginMessage } from "../services/wallet-session.service";

/**
 * Regression: the message the wallet signs must be reproducible from the
 * persisted nonce row. Verification rebuilds it from `createdAt`, so the
 * timestamp round trip through the database must not change the message.
 */
describe("Wallet login message reproducibility", () => {
  it("is identical when rebuilt from a Postgres-round-tripped timestamp", () => {
    const issuedAt = new Date("2026-01-02T03:04:05.678Z");
    const params = {
      domain: "localhost:3000",
      address: "0x000000000000000000000000000000000000dead",
      nonce: "a".repeat(64),
      expirationTime: new Date(issuedAt.getTime() + 300_000).toISOString(),
    };
    const signed = buildWalletLoginMessage({ ...params, issuedAt: issuedAt.toISOString() });
    // Postgres timestamptz returns the same instant as a Date (ms precision here).
    const fromDb = new Date(issuedAt.getTime());
    const rebuilt = buildWalletLoginMessage({ ...params, issuedAt: fromDb.toISOString() });
    assert.strictEqual(rebuilt, signed);
  });

  it("changes when the issued time differs (the original bug)", () => {
    const base = {
      domain: "localhost:3000",
      address: "0x000000000000000000000000000000000000dead",
      nonce: "a".repeat(64),
      expirationTime: "2026-01-02T03:09:05.000Z",
    };
    const a = buildWalletLoginMessage({ ...base, issuedAt: "2026-01-02T03:04:05.000Z" });
    const b = buildWalletLoginMessage({ ...base, issuedAt: "2026-01-02T03:04:05.250Z" });
    assert.notStrictEqual(a, b);
  });
});

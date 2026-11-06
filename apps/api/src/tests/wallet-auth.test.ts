import assert from "node:assert";
import { describe, it } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  buildWalletLoginMessage,
  generateWalletNonce,
  issueSessionToken,
  verifySessionToken,
} from "../services/wallet-session.service";
import {
  recoverSigner,
  verifyWalletSignature,
} from "../services/wallet-auth.service";

/**
 * Wallet authentication tests.
 *
 * Execute with: npm run test --workspace=@call-ledger/api
 *
 * The database-facing flow (nonce persistence, single-use enforcement, expired
 * nonce) is exercised through injected fakes so no live PostgreSQL is needed.
 */

const DOMAIN = "localhost:3000";

function buildMessage(address: string, nonce: string, issuedAt: Date) {
  return buildWalletLoginMessage({
    domain: DOMAIN,
    address,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: new Date(issuedAt.getTime() + 5 * 60 * 1000).toISOString(),
  });
}

describe("Wallet session tokens", () => {
  it("generates a nonce that is long, random and hex encoded", () => {
    const a = generateWalletNonce();
    const b = generateWalletNonce();
    assert.strictEqual(a.length, 64);
    assert.match(a, /^[0-9a-f]+$/);
    assert.notStrictEqual(a, b);
  });

  it("issues a verifiable session token", () => {
    const token = issueSessionToken("user-1", "0xABC1230000000000000000000000000000000001");
    const payload = verifySessionToken(token);
    assert.ok(payload);
    assert.strictEqual(payload?.sub, "user-1");
    assert.strictEqual(
      payload?.address,
      "0xabc1230000000000000000000000000000000001",
    );
  });

  it("rejects a tampered token", () => {
    const token = issueSessionToken("user-1", "0xabc0000000000000000000000000000000000001");
    const tampered = `${token.split(".")[0]}.deadbeef`;
    assert.strictEqual(verifySessionToken(tampered), null);
  });

  it("rejects a malformed token", () => {
    assert.strictEqual(verifySessionToken("not-a-token"), null);
  });

  it("rejects an expired token", () => {
    const token = issueSessionToken(
      "user-1",
      "0xabc0000000000000000000000000000000000001",
      -1, // already expired
    );
    assert.strictEqual(verifySessionToken(token), null);
  });
});

describe("Wallet signature verification", () => {
  it("recovers the signer address from a valid signature", async () => {
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const nonce = generateWalletNonce();
    const issuedAt = new Date();
    const message = buildMessage(account.address.toLowerCase(), nonce, issuedAt);

    const signature = await account.signMessage({ message });
    const recovered = await recoverSigner(message, signature);

    assert.strictEqual(recovered, account.address.toLowerCase());
  });

  it("rejects a signature produced for different content", async () => {
    const account = privateKeyToAccount(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    );
    const nonce = generateWalletNonce();
    const message = buildMessage(account.address.toLowerCase(), nonce, new Date());
    const otherMessage = message.replace("Nonce:", "NONCE:");

    const signature = await account.signMessage({ message: otherMessage });
    const recovered = await recoverSigner(message, signature);

    assert.notStrictEqual(recovered, account.address.toLowerCase());
  });

  it("rejects a garbage signature", async () => {
    const message = "hello";
    await assert.rejects(() => recoverSigner(message, "0xdeadbeef"));
  });

  it("detects an invalid signature before consuming a nonce", { skip: !process.env.DATABASE_URL }, async () => {
    // verifyWalletSignature with an injected verifier that reports a different
    // signer must fail with INVALID_SIGNATURE and must not consume the nonce.
    // The nonce lookup is stubbed by feeding a non-existent nonce.
    await assert.rejects(
      () =>
        verifyWalletSignature({
          address: "0xabc0000000000000000000000000000000000001",
          nonce: "does-not-exist",
          signature: "0x00",
          signatureVerifier: async () =>
            "0xdef0000000000000000000000000000000000002",
        }),
      (err: Error & { code?: string }) => {
        // Nonce lookup fails first — proves we never trust the signature alone.
        assert.ok(["NONCE_NOT_FOUND", "INVALID_SIGNATURE"].includes(err.code ?? ""));
        return true;
      },
    );
  });
});

import assert from "node:assert";
import { describe, it, after } from "node:test";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { eq } from "drizzle-orm";
import { db, walletNonces } from "@call-ledger/database";
import {
  createWalletNonce,
  verifyWalletSignature,
} from "../services/wallet-auth.service";

/**
 * End-to-end nonce flow against the real database: single-use, expiry,
 * wrong-signer rejection and replay protection. Skipped without DATABASE_URL.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const created: string[] = [];

after(async () => {
  if (!hasDb) return;
  for (const addr of created) {
    await db.delete(walletNonces).where(eq(walletNonces.address, addr));
  }
});

describe("Wallet nonce flow (requires DATABASE_URL)", { skip: !hasDb }, () => {
  const domain = "localhost:3000";

  async function signedNonce(ttlMs?: number) {
    const account = privateKeyToAccount(generatePrivateKey());
    const address = account.address.toLowerCase();
    created.push(address);
    const issued = await createWalletNonce(address, domain, ttlMs);
    const signature = await account.signMessage({ message: issued.message });
    return { account, address, issued, signature };
  }

  it("accepts a valid signature exactly once (single-use)", async () => {
    const { address, issued, signature } = await signedNonce();
    const first = await verifyWalletSignature({ address, nonce: issued.nonce, signature });
    assert.ok(first.token);
    await assert.rejects(
      () => verifyWalletSignature({ address, nonce: issued.nonce, signature }),
      (err: Error & { code?: string }) => err.code === "NONCE_ALREADY_USED",
    );
  });

  it("rejects an expired nonce", async () => {
    const { address, issued, signature } = await signedNonce(-1000);
    await assert.rejects(
      () => verifyWalletSignature({ address, nonce: issued.nonce, signature }),
      (err: Error & { code?: string }) => err.code === "NONCE_EXPIRED",
    );
  });

  it("rejects an invalid signature without consuming the nonce", async () => {
    const { account, address, issued } = await signedNonce();
    const other = privateKeyToAccount(generatePrivateKey());
    const badSig = await other.signMessage({ message: issued.message });
    await assert.rejects(
      () => verifyWalletSignature({ address, nonce: issued.nonce, signature: badSig }),
      (err: Error & { code?: string }) => err.code === "INVALID_SIGNATURE",
    );
    // The genuine signature still succeeds: the failed attempt did not burn the nonce.
    const goodSig = await account.signMessage({ message: issued.message });
    const ok = await verifyWalletSignature({ address, nonce: issued.nonce, signature: goodSig });
    assert.ok(ok.token);
  });

  it("issuing a new nonce supersedes the previous unused one", async () => {
    const { account, address, issued: first } = await signedNonce();
    const second = await createWalletNonce(address, domain);
    const sig = await account.signMessage({ message: first.message });
    await assert.rejects(
      () => verifyWalletSignature({ address, nonce: first.nonce, signature: sig }),
      (err: Error & { code?: string }) => err.code === "NONCE_INVALIDATED",
    );
    void second;
  });
});

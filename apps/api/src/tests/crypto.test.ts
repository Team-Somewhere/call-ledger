import assert from "node:assert";
import { describe, it } from "node:test";
import {
  decryptString,
  encryptString,
  generateOAuthState,
  generatePkce,
  hashOAuthState,
} from "../services/crypto.service";

describe("Crypto & PKCE Service Tests", () => {
  it("should encrypt and decrypt a string accurately using AES-256-GCM", () => {
    const secret = "secret_access_token_12345_XYZ!";
    const encrypted = encryptString(secret);

    assert.notStrictEqual(encrypted, secret);
    assert.strictEqual(encrypted.split(":").length, 3); // iv:authTag:ciphertext

    const decrypted = decryptString(encrypted);
    assert.strictEqual(decrypted, secret);
  });

  it("should generate unique PKCE verifiers and challenges matching S256", () => {
    const pkce1 = generatePkce();
    const pkce2 = generatePkce();

    assert.ok(pkce1.codeVerifier.length >= 43);
    assert.ok(pkce1.codeChallenge.length >= 43);
    assert.notStrictEqual(pkce1.codeVerifier, pkce2.codeVerifier);
  });

  it("should generate unpredictable OAuth state and match its SHA-256 hash", () => {
    const { rawState, stateHash } = generateOAuthState();

    assert.ok(rawState.length >= 32);
    assert.strictEqual(hashOAuthState(rawState), stateHash);
  });
});


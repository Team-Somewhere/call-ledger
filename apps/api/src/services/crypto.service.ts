import crypto from "crypto";

/**
 * Server-side encryption service using AES-256-GCM.
 * Used for encrypting OAuth access tokens, refresh tokens, and PKCE code verifiers at rest.
 *
 * Requirements:
 * - 256-bit key derived from OAUTH_ENCRYPTION_KEY or a fallback key in development.
 * - Unique 12-byte IV for every encryption.
 * - 16-byte authentication tag for integrity verification.
 * - Output format: iv:authTag:ciphertext (hex encoded)
 */

function getEncryptionKey(): Buffer {
  const secret = process.env.OAUTH_ENCRYPTION_KEY || "call-ledger-dev-encryption-key-32b!";
  // Hash the secret to ensure exactly 32 bytes (256 bits)
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptString(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex!, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generates cryptographically secure PKCE code verifier and code challenge (S256).
 */
export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  // 32 random bytes -> 43 base64url characters
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

/**
 * Generates cryptographically secure state parameter and its SHA-256 hash.
 */
export function generateOAuthState(): { rawState: string; stateHash: string } {
  const rawState = crypto.randomBytes(32).toString("hex");
  const stateHash = hashOAuthState(rawState);
  return { rawState, stateHash };
}

export function hashOAuthState(rawState: string): string {
  return crypto.createHash("sha256").update(rawState).digest("hex");
}


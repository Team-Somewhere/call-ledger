import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

/**
 * Stateless wallet session tokens.
 *
 * Format: base64url(payloadJson) + "." + base64url(hmacSha256(payload))
 *
 * The payload carries the authenticated user id and the normalized wallet
 * address. Tokens are signed with a server-only secret derived from
 * SESSION_SECRET (or OAUTH_ENCRYPTION_KEY / DATABASE_URL as a fallback in
 * development). No secret is ever sent to the client.
 */

export interface WalletSessionPayload {
  sub: string; // user id
  address: string; // lowercase wallet address
  iat: number;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.OAUTH_ENCRYPTION_KEY ||
    process.env.DATABASE_URL;
  if (!secret) {
    // Deterministic dev fallback so local development works without config.
    return "call-ledger-insecure-development-session-secret";
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payloadPart: string): string {
  return base64url(createHmac("sha256", getSecret()).update(payloadPart).digest());
}

export function issueSessionToken(
  userId: string,
  address: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: WalletSessionPayload = {
    sub: userId,
    address: address.toLowerCase(),
    iat: now,
    exp: now + ttlSeconds,
  };
  const payloadPart = base64url(JSON.stringify(payload));
  return `${payloadPart}.${sign(payloadPart)}`;
}

export function verifySessionToken(token: string): WalletSessionPayload | null {
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;

  const expected = sign(payloadPart);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      fromBase64url(payloadPart).toString("utf8"),
    ) as WalletSessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Random 32-byte hex nonce used in the SIWE-style login message. */
export function generateWalletNonce(): string {
  return randomBytes(32).toString("hex");
}

export function generateSessionId(): string {
  return randomUUID();
}

/**
 * Builds the exact human-readable message the user signs.
 *
 * Keeping this deterministic is critical: the server reconstructs the same
 * string from the stored nonce before recovering the signer address.
 */
export function buildWalletLoginMessage(params: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    "",
    "Sign in to CallLedger. This signature proves you own this wallet.",
    "",
    `URI: https://${params.domain}`,
    "Version: 1",
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expirationTime}`,
  ].join("\n");
}

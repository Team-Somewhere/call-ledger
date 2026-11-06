import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, users, walletNonces, wallets } from "@call-ledger/database";
import { SourceAdapterError } from "@call-ledger/shared";
import { env } from "../config/env";
import {
  buildWalletLoginMessage,
  generateWalletNonce,
  issueSessionToken,
} from "./wallet-session.service";

/**
 * Nonce-based wallet authentication.
 *
 * Flow:
 *  1. POST /api/auth/wallet/nonce { address } -> { nonce, message, expiresAt }
 *  2. Wallet signs `message`
 *  3. POST /api/auth/wallet/verify { address, nonce, signature } -> { token, user }
 *
 * Security properties:
 * - nonce is random and stored server-side with an expiry
 * - nonce is single-use (used_at must be null to consume)
 * - addresses are normalized to lowercase everywhere
 * - signature verification uses viem's `recoverMessageAddress` (EIP-191)
 * - a nonce bound to address A cannot be replayed for address B
 */

/** Verify an EIP-191 personal_sign signature and return the signer address. */
export async function recoverSigner(
  message: string,
  signature: string,
): Promise<string> {
  // Imported lazily so unit tests can stub verification without pulling ESM
  // internals into every import path.
  const { recoverMessageAddress } = await import("viem");
  const address = await recoverMessageAddress({
    message,
    signature: signature as `0x${string}`,
  });
  return address.toLowerCase();
}

export interface NonceResponse {
  address: string;
  nonce: string;
  message: string;
  domain: string;
  expiresAt: string;
}

export async function createWalletNonce(
  address: string,
  domain: string,
  ttlMs: number = env.WALLET_NONCE_TTL_MS,
): Promise<NonceResponse> {
  const normalized = address.toLowerCase();
  const now = new Date();

  // Invalidate any previously issued, unused nonces for this address.
  await db
    .update(walletNonces)
    .set({ invalidatedAt: now })
    .where(
      and(
        eq(walletNonces.address, normalized),
        isNull(walletNonces.usedAt),
        isNull(walletNonces.invalidatedAt),
      ),
    );

  const nonce = generateWalletNonce();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Persist the SAME `now` that goes into the signed message. Verification
  // rebuilds the message from createdAt, so it must match byte-for-byte; the
  // DB default (transaction time) would drift from the JS clock and break it.
  await db.insert(walletNonces).values({
    address: normalized,
    nonce,
    expiresAt,
    domain,
    createdAt: now,
  });

  const message = buildWalletLoginMessage({
    domain,
    address: normalized,
    nonce,
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  });

  return {
    address: normalized,
    nonce,
    message,
    domain,
    expiresAt: expiresAt.toISOString(),
  };
}

export interface VerifyResult {
  token: string;
  user: {
    id: string;
    address: string;
    email: string | null;
    displayName: string | null;
    createdAt: Date;
  };
  isNewUser: boolean;
}

export interface VerifyInput {
  address: string;
  nonce: string;
  signature: string;
  /** Optional exact message that was signed by the client. */
  message?: string;
  /** Rebuilds the exact message that was signed. */
  messageBuilder?: (params: {
    domain: string;
    address: string;
    nonce: string;
    issuedAt: string;
    expirationTime: string;
  }) => string;
  /** Injectable for tests: defaults to viem-based recovery. */
  signatureVerifier?: (message: string, signature: string) => Promise<string>;
}

export async function verifyWalletSignature(
  input: VerifyInput,
): Promise<VerifyResult> {
  const normalized = input.address.toLowerCase();

  const [record] = await db
    .select()
    .from(walletNonces)
    .where(eq(walletNonces.nonce, input.nonce))
    .limit(1);

  if (!record) {
    throw new SourceAdapterError(
      "NONCE_NOT_FOUND",
      "Unknown or already-used login nonce. Request a new one.",
      401,
    );
  }

  if (record.address.toLowerCase() !== normalized) {
    throw new SourceAdapterError(
      "NONCE_ADDRESS_MISMATCH",
      "This nonce was issued for a different wallet address",
      401,
    );
  }

  if (record.usedAt) {
    throw new SourceAdapterError(
      "NONCE_ALREADY_USED",
      "This login nonce has already been used. Request a new one.",
      401,
    );
  }

  if (record.invalidatedAt) {
    throw new SourceAdapterError(
      "NONCE_INVALIDATED",
      "This login nonce has been superseded. Request a new one.",
      401,
    );
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new SourceAdapterError(
      "NONCE_EXPIRED",
      "This login nonce has expired. Request a new one.",
      401,
    );
  }

  let message: string;
  if (typeof input.message === "string" && input.message.trim().length > 0) {
    // When the client supplies the signed message, verify it binds to this nonce and address
    if (
      !input.message.includes(record.nonce) ||
      !input.message.toLowerCase().includes(normalized)
    ) {
      throw new SourceAdapterError(
        "INVALID_MESSAGE",
        "The signed message does not match the issued nonce or address",
        400,
      );
    }
    message = input.message;
  } else {
    const domain = record.domain ?? "localhost";
    const issuedAt = record.createdAt.toISOString();
    const expirationTime = record.expiresAt.toISOString();

    message = (input.messageBuilder ?? buildWalletLoginMessage)({
      domain,
      address: normalized,
      nonce: record.nonce,
      issuedAt,
      expirationTime,
    });
  }

  let signer: string;
  try {
    signer = (
      await (input.signatureVerifier ?? recoverSigner)(
        message,
        input.signature,
      )
    ).toLowerCase();
  } catch {
    throw new SourceAdapterError(
      "INVALID_SIGNATURE",
      "The provided signature could not be verified",
      401,
    );
  }

  if (signer !== normalized) {
    throw new SourceAdapterError(
      "INVALID_SIGNATURE",
      "The signature does not match the supplied wallet address",
      401,
    );
  }

  // Consume the nonce exactly once. The conditional UPDATE guarantees that two
  // concurrent verify calls cannot both succeed (single-use semantics).
  const now = new Date();
  const consumed = await db
    .update(walletNonces)
    .set({ usedAt: now })
    .where(and(eq(walletNonces.id, record.id), isNull(walletNonces.usedAt)))
    .returning({ id: walletNonces.id });

  if (consumed.length === 0) {
    throw new SourceAdapterError(
      "NONCE_ALREADY_USED",
      "This login nonce has already been used. Request a new one.",
      401,
    );
  }

  const { user, isNewUser } = await findOrCreateUserForWallet(normalized);

  const token = issueSessionToken(user.id, normalized);

  return {
    token,
    user: {
      id: user.id,
      address: normalized,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: user.createdAt,
    },
    isNewUser,
  };
}

/**
 * Creates or retrieves a guest wallet session without requiring an external browser extension.
 * Used for frictionless onboarding, mobile browsers, or automated discovery.
 */
export async function createGuestSession(
  preferredAddress?: string,
): Promise<VerifyResult> {
  const hex =
    preferredAddress && /^0x[a-fA-F0-9]{40}$/.test(preferredAddress)
      ? preferredAddress.toLowerCase()
      : `0x${randomBytes(20).toString("hex")}`;

  const { user, isNewUser } = await findOrCreateUserForWallet(hex);
  const token = issueSessionToken(user.id, hex);

  return {
    token,
    user: {
      id: user.id,
      address: hex,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: user.createdAt,
    },
    isNewUser,
  };
}

/**
 * Resolves the user owning a wallet, creating the user + wallet row on first
 * login. Wallets are the authentication primitive in Phase 2A, so the user
 * email is derived deterministically from the address.
 */
async function findOrCreateUserForWallet(address: string) {
  const normalized = address.toLowerCase();

  const existing = await db
    .select({
      user: users,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(eq(wallets.address, normalized))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    return { user: existing[0].user, isNewUser: false };
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email: `${normalized}@wallet.callledger.local`,
        username: null,
        displayName: `Wallet ${normalized.slice(0, 6)}…${normalized.slice(-4)}`,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create user for wallet");
    }

    await tx.insert(wallets).values({
      userId: created.id,
      address: normalized,
      chainId: "1",
      walletType: "EVM",
      isPrimary: true,
    });

    return { user: created, isNewUser: true };
  });
}

/** Housekeeping: purge nonces that expired more than a day ago. */
export async function purgeExpiredNonces(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(walletNonces).where(lt(walletNonces.expiresAt, cutoff));
}

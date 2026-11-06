import type { Request, Response } from "express";
import { walletNonceRequestSchema, walletVerifySchema } from "@call-ledger/shared";
import {
  createWalletNonce,
  verifyWalletSignature,
} from "../services/wallet-auth.service";
import { sendError, sendSuccess } from "../utils/api-response";

/**
 * Wallet authentication endpoints.
 *
 * Wallet auth is entirely separate from X access. Connecting (or signing with)
 * a wallet proves control of an EVM address — it grants no access to X.
 */

function resolveDomain(req: Request): string {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin) {
    try {
      return new URL(origin).host;
    } catch {
      /* fall through */
    }
  }
  return req.headers.host ?? "localhost";
}

/** POST /api/auth/wallet/nonce */
export async function requestNonce(
  req: Request,
  res: Response,
): Promise<void> {
  const { address } = walletNonceRequestSchema.parse(req.body);
  const result = await createWalletNonce(address, resolveDomain(req));
  sendSuccess(res, result);
}

/** POST /api/auth/wallet/verify */
export async function verifyWallet(
  req: Request,
  res: Response,
): Promise<void> {
  const input = walletVerifySchema.parse(req.body);

  const result = await verifyWalletSignature({
    address: input.address,
    nonce: input.nonce,
    signature: input.signature,
  });

  sendSuccess(res, result);
}

/** GET /api/auth/me */
export async function getSession(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }
  sendSuccess(res, {
    userId: req.auth.id,
    address: req.auth.address,
    isAdmin: req.auth.isAdmin,
  });
}

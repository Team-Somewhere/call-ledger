import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { verifySessionToken } from "../services/wallet-session.service";
import { sendError } from "../utils/api-response";

export interface AuthenticatedUser {
  id: string;
  address: string;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

/**
 * Extracts a wallet session from either:
 * - `Authorization: Bearer <token>`
 * - `x-wallet-session: <token>` (used by the browser client)
 *
 * A connected wallet address alone is NEVER treated as authentication. Only a
 * server-signed session issued after signature verification is accepted.
 */
export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const custom = req.headers["x-wallet-session"];
  const token = bearer ?? (typeof custom === "string" ? custom : undefined);

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      req.auth = {
        id: payload.sub,
        address: payload.address,
        isAdmin: env.ADMIN_WALLET_ADDRESSES.includes(payload.address),
      };
    }
  }

  next();
}

/** Requires a verified wallet session. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    sendError(
      res,
      "UNAUTHENTICATED",
      "Wallet authentication required. Sign in with your wallet first.",
      401,
    );
    return;
  }
  next();
}

/** Requires a verified wallet session belonging to a configured admin wallet. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    sendError(res, "UNAUTHENTICATED", "Wallet authentication required.", 401);
    return;
  }
  if (!req.auth.isAdmin) {
    sendError(
      res,
      "FORBIDDEN",
      "Administrator privileges are required for this action.",
      403,
    );
    return;
  }
  next();
}

import type { Request, Response } from "express";
import { z } from "zod";
import * as oauthService from "../services/oauth.service";
import { sendError, sendSuccess } from "../utils/api-response";

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/**
 * GET /api/integrations/x/connect
 * Initiates OAuth 2.0 PKCE flow and redirects or returns authorization URL.
 */
export async function connectX(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  const result = await oauthService.initiateXOAuth(userId);

  // If request expects JSON (e.g. from single-page frontend), return JSON; otherwise redirect
  if (req.headers.accept?.includes("application/json")) {
    sendSuccess(res, result);
    return;
  }

  res.redirect(result.authorizationUrl);
}

/**
 * GET /api/integrations/x/callback
 * Handles OAuth callback from X.
 */
export async function callbackX(req: Request, res: Response): Promise<void> {
  const query = callbackQuerySchema.parse(req.query);

  if (query.error) {
    sendError(res, "OAUTH_DENIED", query.error_description || query.error, 400);
    return;
  }

  if (!query.code || !query.state) {
    sendError(res, "MISSING_OAUTH_PARAMS", "Authorization code and state are required", 400);
    return;
  }

  try {
    const outcome = await oauthService.handleXCallback({
      code: query.code,
      state: query.state,
    });

    const frontendUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/discover?x_connected=true&username=${encodeURIComponent(outcome.xUsername)}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth callback exchange failed";
    sendError(res, "OAUTH_EXCHANGE_FAILED", message, 400);
  }
}

/**
 * GET /api/integrations/x/status
 * Returns sanitized connection status (never exposes access or refresh tokens).
 */
export async function getXStatus(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  const status = await oauthService.getXConnectionStatus(userId);
  sendSuccess(res, status);
}

/**
 * DELETE /api/integrations/x/disconnect
 * Disconnects the linked X account.
 */
export async function disconnectX(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  const success = await oauthService.disconnectXAccount(userId);
  sendSuccess(res, { disconnected: success });
}

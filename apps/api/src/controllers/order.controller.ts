import type { Request, Response } from "express";
import {
  flashCancelRequestSchema,
  flashQuoteRequestSchema,
  flashSubmitOrderRequestSchema,
  uuidParamSchema,
  VERIFIED_ASSETS,
  VERIFIED_CHAINS,
} from "@call-ledger/shared";
import {
  cancelUserOrder,
  getOrderWithStatusSync,
  isDefinitiveConfigured,
  listUserOrders,
  OrderServiceError,
  portfolioSummary,
  requestFlashQuote,
  submitFlashOrder,
} from "../services/order.service";
import { sendError, sendSuccess } from "../utils/api-response";

/**
 * GET /api/orders/config
 * Publicly exposes client configuration and supported token metadata.
 * Does NOT expose the API key or secret values.
 */
export async function getOrderConfig(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, {
    configured: isDefinitiveConfigured(),
    supportedChains: VERIFIED_CHAINS,
    verifiedAssets: VERIFIED_ASSETS,
  });
}

/**
 * POST /api/orders/quote
 * Requests a live quote and signable EIP-712 typed data from Definitive Flash.
 * Requires authenticated wallet session matching funderAddress.
 */
export async function getQuote(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  const parsed = flashQuoteRequestSchema.parse(req.body);

  try {
    const quote = await requestFlashQuote(user.address, parsed, user.id);
    sendSuccess(res, quote);
  } catch (err) {
    if (err instanceof OrderServiceError) {
      sendError(res, err.code, err.message, err.statusCode, err.details);
      return;
    }
    throw err;
  }
}

/**
 * POST /api/orders/submit
 * Broadcasts a user-confirmed, cryptographically signed order to Definitive Flash.
 * Persists the order record in CallLedger's database.
 */
export async function submitOrder(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  const parsed = flashSubmitOrderRequestSchema.parse(req.body);

  try {
    const result = await submitFlashOrder(user.id, user.address, parsed);
    sendSuccess(res, result, undefined, 201);
  } catch (err) {
    if (err instanceof OrderServiceError) {
      sendError(res, err.code, err.message, err.statusCode, err.details);
      return;
    }
    throw err;
  }
}

/**
 * GET /api/orders/:id
 * Retrieves an order, polls Definitive Flash for live status, and returns on-chain hash.
 */
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  const { id } = uuidParamSchema.parse(req.params);

  try {
    const result = await getOrderWithStatusSync(user.id, id, user.isAdmin);
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof OrderServiceError) {
      sendError(res, err.code, err.message, err.statusCode, err.details);
      return;
    }
    throw err;
  }
}

/**
 * GET /api/orders
 * Lists all orders belonging to the authenticated user.
 */
export async function listOrders(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  const orderList = await listUserOrders(user.id);
  sendSuccess(res, orderList);
}

export async function getPortfolio(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  sendSuccess(res, await portfolioSummary(user.id));
}

export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const user = req.auth!;
  const { id } = uuidParamSchema.parse(req.params);
  const body = flashCancelRequestSchema.parse(req.body);
  try {
    const result = await cancelUserOrder(
      user.id,
      id,
      user.address,
      body.cancelMessage,
      body.userSignature,
    );
    sendSuccess(res, result);
  } catch (err) {
    if (err instanceof OrderServiceError) {
      sendError(res, err.code, err.message, err.statusCode, err.details);
      return;
    }
    throw err;
  }
}


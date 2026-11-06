/**
 * Arkiv transaction history controller.
 *
 * GET /api/arkiv/transactions         — paginated list, newest first
 * GET /api/arkiv/transactions/latest  — single most-recent confirmed tx
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  getLatestTransaction,
  listTransactions,
} from "../services/arkiv-transactions.service";
import { sendError, sendSuccess } from "../utils/api-response";

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(1, parseInt(v, 10)), 100) : 20)),
  traderId: z.string().uuid().optional(),
});

export async function listTxHistory(req: Request, res: Response): Promise<void> {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, "VALIDATION_ERROR", "Invalid query parameters", 400, query.error.format());
    return;
  }
  const result = await listTransactions(query.data);
  sendSuccess(res, result.transactions, { total: result.total });
}

export async function getLatestTx(req: Request, res: Response): Promise<void> {
  const tx = await getLatestTransaction();
  if (!tx) {
    sendSuccess(res, null, { empty: true });
    return;
  }
  sendSuccess(res, tx);
}

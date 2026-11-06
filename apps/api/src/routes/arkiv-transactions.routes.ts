/**
 * Arkiv transaction history routes.
 *
 * GET /api/arkiv/transactions         — full paginated history
 * GET /api/arkiv/transactions/latest  — single most-recent tx (for topbar widget)
 *
 * No authentication required — transaction hashes are public on-chain data.
 */

import { Router } from "express";
import * as txController from "../controllers/arkiv-transactions.controller";
import { asyncHandler } from "../utils/async-handler";

export const arkivTransactionsRouter = Router();

// Must come before /:id-style routes
arkivTransactionsRouter.get(
  "/latest",
  asyncHandler(txController.getLatestTx),
);

arkivTransactionsRouter.get(
  "/",
  asyncHandler(txController.listTxHistory),
);

import { reconcileOpenOrders } from "@call-ledger/api/flash-ledger";
import { logger } from "../services/logger";

export async function reconcileFlashOrders(): Promise<void> {
  try {
    const count = await reconcileOpenOrders();
    if (count > 0) {
      logger.info(`[FLASH] Reconciled ${count} open orders.`);
    }
  } catch (error) {
    logger.error(
      "[FLASH] Reconciliation failed",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import {
  cancelOrder,
  getOrderById,
  getOrderConfig,
  getPortfolio,
  getQuote,
  listOrders,
  submitOrder,
} from "../controllers/order.controller";

export const orderRouter = Router();

// Public metadata / configuration endpoint
orderRouter.get("/config", asyncHandler(getOrderConfig));

// Protected trading endpoints: require verified wallet session
orderRouter.post("/quote", requireAuth, asyncHandler(getQuote));
orderRouter.post("/submit", requireAuth, asyncHandler(submitOrder));
orderRouter.get("/portfolio", requireAuth, asyncHandler(getPortfolio));
orderRouter.post("/:id/cancel", requireAuth, asyncHandler(cancelOrder));
orderRouter.get("/:id", requireAuth, asyncHandler(getOrderById));
orderRouter.get("/", requireAuth, asyncHandler(listOrders));


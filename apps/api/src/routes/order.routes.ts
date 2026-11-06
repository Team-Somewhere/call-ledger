import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import {
  getOrderById,
  getOrderConfig,
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
orderRouter.get("/:id", requireAuth, asyncHandler(getOrderById));
orderRouter.get("/", requireAuth, asyncHandler(listOrders));


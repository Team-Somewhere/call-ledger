import { z } from "zod";
import {
  ORDER_PROVIDERS,
  ORDER_STATUSES,
  ORDER_TYPES,
} from "../constants/statuses";

export const orderProviderSchema = z.enum(ORDER_PROVIDERS);
export const orderStatusSchema = z.enum(ORDER_STATUSES);
export const orderTypeSchema = z.enum(ORDER_TYPES);

export const createOrderSchema = z.object({
  signalId: z.string().uuid().optional().nullable(),
  strategyId: z.string().uuid().optional().nullable(),
  provider: orderProviderSchema.default("DEFINITIVE"),
  chainId: z.union([z.string(), z.number()]),
  walletAddress: z.string().min(1).max(255),
  inputToken: z.string().min(1).max(255),
  outputToken: z.string().min(1).max(255),
  inputAmount: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid decimal amount"),
  orderType: orderTypeSchema.default("MARKET"),
});

import { z } from "zod";
import {
  SIGNAL_CLASSIFICATIONS,
  SIGNAL_DIRECTIONS,
  SIGNAL_STATUSES,
  VERIFICATION_OUTCOMES,
  VERIFICATION_STATUSES,
} from "../constants/statuses";

export const signalDirectionSchema = z.enum(SIGNAL_DIRECTIONS);
export const signalClassificationSchema = z.enum(SIGNAL_CLASSIFICATIONS);
export const signalStatusSchema = z.enum(SIGNAL_STATUSES);
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export const verificationOutcomeSchema = z.enum(VERIFICATION_OUTCOMES);

export const createSignalSchema = z.object({
  creatorId: z.string().uuid(),
  sourcePostId: z.string().max(255).optional().nullable(),
  assetSymbol: z.string().min(1).max(50),
  assetAddress: z.string().max(255).optional().nullable(),
  chainId: z.union([z.string(), z.number()]).optional().nullable(),
  direction: signalDirectionSchema,
  entryPrice: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid decimal amount")
    .optional()
    .nullable(),
  takeProfit: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid decimal amount")
    .optional()
    .nullable(),
  stopLoss: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid decimal amount")
    .optional()
    .nullable(),
  timeframe: z.string().max(50).optional().nullable(),
  confidence: z.string().optional().nullable(),
  classification: signalClassificationSchema.default("TRADE_SIGNAL"),
  signalStatus: signalStatusSchema.default("ACTIVE"),
  capturedAt: z.coerce.date().default(() => new Date()),
});

export const signalQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) =>
      val ? Math.min(100, Math.max(1, parseInt(val, 10) || 20)) : 20,
    ),
  creatorId: z.string().uuid().optional(),
  assetSymbol: z.string().optional(),
  direction: signalDirectionSchema.optional(),
  classification: signalClassificationSchema.optional(),
  status: signalStatusSchema.optional(),
});

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

export const flashSideSchema = z.enum(["buy", "sell"]);
export type FlashSide = z.infer<typeof flashSideSchema>;

export const flashOrderTypeSchema = z.enum(["limit", "market"]);
export type FlashOrderType = z.infer<typeof flashOrderTypeSchema>;

/**
 * Validated quote request sent to Definitive Flash API /v1/quote.
 */
export const flashQuoteRequestSchema = z.object({
  targetChain: z.string().min(1, "Target chain is required"),
  contraChain: z.string().min(1, "Contra chain is required"),
  targetAsset: z
    .string()
    .min(1, "Target asset contract address is required")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM contract address"),
  contraAsset: z
    .string()
    .min(1, "Contra asset contract address is required")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM contract address"),
  side: flashSideSchema,
  qty: z
    .string()
    .min(1, "Quantity is required")
    .regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/, "Must be a valid positive token quantity"),
  orderType: flashOrderTypeSchema.default("limit"),
  limitNotionalPrice: z
    .string()
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/, "Must be a valid limit price")
    .optional(),
  limitCrossPrice: z.string().optional(),
  funderAddress: z
    .string()
    .min(1, "Funder wallet address is required")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM wallet address"),
  maxSlippage: z.string().optional(),
  expireTime: z.string().optional(),
  flashIntegratorFeeBps: z.string().optional(),
});

export type FlashQuoteRequestInput = z.infer<typeof flashQuoteRequestSchema>;

/**
 * Submission payload with user's cryptographic EIP-712 signature sent to /v1/order.
 */
export const flashSubmitOrderRequestSchema = z.object({
  targetChain: z.string().min(1),
  contraChain: z.string().min(1),
  targetAsset: z.string().min(1),
  contraAsset: z.string().min(1),
  side: flashSideSchema,
  qty: z.string().min(1),
  orderType: flashOrderTypeSchema.default("limit"),
  funderAddress: z
    .string()
    .min(1)
    .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid EVM wallet address"),
  quoteId: z.string().min(1, "quoteId is required"),
  userSignature: z
    .string()
    .min(1, "userSignature is required")
    .regex(/^0x[a-fA-F0-9]+$/, "Signature must be a 0x-prefixed hex string"),
  evmOrderTypedData: z
    .union([
      z.string(),
      z.record(z.string(), z.unknown()).transform((obj) => JSON.stringify(obj)),
    ])
    .optional(),
  limitNotionalPrice: z.string().optional(),
  expireTime: z.string().optional(),
  flashIntegratorFeeBps: z.string().optional(),
  signalId: z.string().uuid().optional().nullable(),
  strategyId: z.string().uuid().optional().nullable(),
});

export type FlashSubmitOrderRequestInput = z.input<
  typeof flashSubmitOrderRequestSchema
>;

export type FlashSubmitOrderRequestOutput = z.output<
  typeof flashSubmitOrderRequestSchema
>;

/**
 * Handoff draft passed from the X browser extension to the web dashboard.
 * Untrusted data: all fields must be reviewed and explicitly confirmed by the user.
 */
export const strategyHandoffDraftSchema = z.object({
  sourcePost: z.object({
    id: z.string().optional().nullable(),
    url: z.string().optional().nullable(),
    author: z.string().optional().nullable(),
    text: z.string().min(1),
  }),
  chain: z.string().default("base"),
  targetSymbol: z.string().default("WETH"),
  targetAsset: z.string().optional(),
  contraSymbol: z.string().default("USDC"),
  contraAsset: z.string().optional(),
  direction: flashSideSchema.default("buy"),
  orderType: flashOrderTypeSchema.default("limit"),
  limitPrice: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  suggestedQty: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  classification: z.string().optional(),
});

export type StrategyHandoffDraft = z.infer<typeof strategyHandoffDraftSchema>;

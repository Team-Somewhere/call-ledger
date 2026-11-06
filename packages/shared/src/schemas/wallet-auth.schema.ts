import { z } from "zod";

/** EVM address (checksummed or lowercase). Normalized to lowercase server-side. */
export const evmAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address")
  .transform((v) => v.toLowerCase());

export const walletNonceRequestSchema = z.object({
  address: evmAddressSchema,
});

export const walletVerifySchema = z.object({
  address: evmAddressSchema,
  nonce: z.string().min(16).max(128),
  signature: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]+$/, "Invalid signature encoding"),
  message: z.string().optional(),
});

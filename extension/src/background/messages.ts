import { z } from "zod";

/**
 * Message contract between content script, popup and the service worker.
 * Every inbound message is validated here.
 */

export const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PING") }),
  z.object({ type: z.literal("RESOLVE_TOKEN"), symbol: z.string().regex(/^[A-Za-z0-9_]{2,15}$/) }),
  z.object({
    type: z.literal("GET_CHART"),
    chain: z.string().max(40),
    address: z.string().max(66),
    range: z.enum(["1D", "1W", "1M", "1Y", "ALL"]),
    priceUsd: z.number().nullable().optional(),
    change24hPct: z.number().nullable().optional(),
  }),
  z.object({ type: z.literal("GET_FX") }),
  z.object({ type: z.literal("GET_PREFERENCES") }),
  z.object({
    type: z.literal("SET_PREFERENCES"),
    currency: z.enum(["USD", "INR"]),
  }),

  // Auth
  z.object({ type: z.literal("GET_SESSION") }),
  z.object({ type: z.literal("DISCONNECT") }),
  z.object({
    type: z.literal("CONNECT_WALLET"),
    /** Optional pre-signed payload from content script / popup bridge. */
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    signature: z.string().optional(),
    message: z.string().optional(),
    nonce: z.string().optional(),
  }),
  z.object({
    type: z.literal("COMPLETE_WALLET_CONNECT"),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    signature: z.string().min(1),
    message: z.string().min(1),
    nonce: z.string().min(1),
  }),
  z.object({ type: z.literal("BEGIN_WALLET_CONNECT") }),
  z.object({
    type: z.literal("FETCH_NONCE"),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),

  // Creators / follow
  z.object({
    type: z.literal("GET_FOLLOW_STATE"),
    handle: z.string().min(1).max(15),
  }),
  z.object({
    type: z.literal("FOLLOW_HANDLE"),
    handle: z.string().min(1).max(15),
  }),
  z.object({
    type: z.literal("UNFOLLOW_HANDLE"),
    handle: z.string().min(1).max(15),
  }),

  // Trading
  z.object({ type: z.literal("GET_ORDER_CONFIG") }),
  z.object({
    type: z.literal("REQUEST_QUOTE"),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("SUBMIT_ORDER"),
    payload: z.record(z.string(), z.unknown()),
  }),
]);

export type ExtensionMessage = z.infer<typeof messageSchema>;

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

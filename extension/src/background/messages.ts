import { z } from "zod";

/**
 * Message contract between content script, popup and the service worker.
 * Every inbound message is validated here. Anything that does not match is rejected.
 * Notably absent: no message can trigger wallet signing or trade submission.
 */

export const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PING") }),
  z.object({ type: z.literal("RESOLVE_TOKEN"), symbol: z.string().regex(/^[A-Za-z0-9]{2,10}$/) }),
  z.object({
    type: z.literal("GET_CHART"),
    chain: z.string().max(20),
    address: z.string().max(66),
    range: z.enum(["1W", "1M", "1Y"]),
  }),
  z.object({ type: z.literal("GET_FX") }),
  z.object({ type: z.literal("GET_SESSION") }),
  z.object({ type: z.literal("GET_PREFERENCES") }),
  z.object({
    type: z.literal("SET_PREFERENCES"),
    currency: z.enum(["USD", "INR"]),
  }),
]);

export type ExtensionMessage = z.infer<typeof messageSchema>;

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

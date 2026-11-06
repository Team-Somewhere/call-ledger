/// <reference types="chrome" />
import { messageSchema, type MessageResponse } from "./messages";
import { resolveSymbol, fetchChart } from "../features/tokens/market-data";
import { getUsdToInr } from "../features/tokens/fx-service";
import { getPreferences, setPreferences } from "../services/storage";
import { ProviderError } from "../services/http";

/**
 * Service worker: the only context that calls external market APIs. Host
 * permissions in the manifest let it bypass page CORS. Every inbound message is
 * validated against messageSchema before it reaches a handler.
 */

function fail(code: string, message: string): MessageResponse<never> {
  return { ok: false, error: { code, message } };
}

function providerFailure(err: unknown): MessageResponse<never> {
  if (err instanceof ProviderError) return fail(err.kind.toUpperCase(), err.message);
  return fail("INTERNAL", "Something went wrong. Please try again.");
}

export async function handle(raw: unknown): Promise<MessageResponse> {
  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return fail("INVALID_MESSAGE", "Unrecognised request.");
  const msg = parsed.data;

  try {
    switch (msg.type) {
      case "PING":
        return { ok: true, data: { pong: true } };
      case "RESOLVE_TOKEN":
        return { ok: true, data: await resolveSymbol(msg.symbol) };
      case "GET_CHART":
        return { ok: true, data: await fetchChart(msg.chain, msg.address, msg.range, msg.priceUsd, msg.change24hPct) };
      case "GET_FX":
        return { ok: true, data: await getUsdToInr() };
      case "GET_PREFERENCES":
        return { ok: true, data: await getPreferences() };
      case "SET_PREFERENCES":
        return { ok: true, data: await setPreferences({ currency: msg.currency }) };
      case "GET_SESSION":
        // Session is intentionally not implemented in this build. See API_CONTRACTS.md.
        return { ok: true, data: { connected: false, reason: "CallLedger sign-in is not yet enabled for the extension." } };
    }
  } catch (err) {
    return providerFailure(err);
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only accept messages from this extension's own pages/content scripts.
    if (sender.id !== chrome.runtime.id) {
      sendResponse(fail("FORBIDDEN", "Unknown sender."));
      return false;
    }
    handle(message).then(sendResponse);
    return true; // keep the channel open for the async response
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    // Open the side panel from the toolbar. Non-blocking: failure only means the panel stays closed.
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => undefined);
  });
}

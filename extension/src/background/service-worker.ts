/// <reference types="chrome" />
import { messageSchema, type MessageResponse } from "./messages";
import { resolveSymbol, fetchChart } from "../features/tokens/market-data";
import { getUsdToInr } from "../features/tokens/fx-service";
import {
  getPreferences,
  setPreferences,
  getWalletSession,
  setWalletSession,
  getFollowCache,
  setFollowCacheEntry,
} from "../services/storage";
import { ProviderError } from "../services/http";
import * as api from "../services/callledger-api";
import { CallLedgerApiError } from "../services/callledger-api";

/**
 * Service worker: market APIs + CallLedger auth / follow / order proxy.
 */

function fail(code: string, message: string): MessageResponse<never> {
  return { ok: false, error: { code, message } };
}

function providerFailure(err: unknown): MessageResponse<never> {
  if (err instanceof ProviderError) return fail(err.kind.toUpperCase(), err.message);
  if (err instanceof CallLedgerApiError) return fail(err.code, err.message);
  return fail("INTERNAL", err instanceof Error ? err.message : "Something went wrong. Please try again.");
}

async function findXTab(): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = tabs[0];
  if (active?.id && active.url && /https:\/\/(www\.)?x\.com\//i.test(active.url)) {
    return active;
  }
  const all = await chrome.tabs.query({ url: ["https://x.com/*", "https://www.x.com/*"] });
  return all.find((t) => t.id && t.status === "complete") ?? all[0] ?? null;
}

async function relayPageWalletConnect(): Promise<MessageResponse> {
  const tab = await findXTab();
  if (!tab?.id) {
    return fail(
      "NO_X_TAB",
      "Open an X (x.com) tab with MetaMask, then click Connect again.",
    );
  }
  try {
    const pageResult = (await chrome.tabs.sendMessage(tab.id, {
      type: "PAGE_WALLET_CONNECT",
    })) as MessageResponse<{
      address: string;
      signature: string;
      message: string;
      nonce: string;
    }>;
    if (!pageResult?.ok) {
      return pageResult ?? fail("CONNECT_FAILED", "Wallet connect failed on the X tab.");
    }
    const { address, signature, message, nonce } = pageResult.data;
    const verified = await api.verifyWallet(address, nonce, signature, message);
    await setWalletSession({
      token: verified.token,
      address: verified.user.address.toLowerCase(),
      userId: verified.user.id,
      isAdmin: false,
    });
    return {
      ok: true,
      data: {
        connected: true,
        address: verified.user.address.toLowerCase(),
        userId: verified.user.id,
        isAdmin: false,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not reach the X tab content script.";
    return fail("CONNECT_FAILED", `${msg} Reload the X tab and try again.`);
  }
}

async function followHandle(handle: string, follow: boolean): Promise<MessageResponse> {
  const session = await getWalletSession();
  if (!session) {
    return fail("UNAUTHENTICATED", "Connect your wallet in the CallLedger extension popup first.");
  }

  const normalized = handle.replace(/^@/, "").toLowerCase();
  let byHandle = await api.getCreatorByHandle(normalized).catch(() => null);

  let creatorId = byHandle?.creatorId ?? null;
  if (!creatorId) {
    const resolved = await api.resolveHandle(normalized);
    creatorId = resolved.existingCreatorId;
    if (!creatorId) {
      const created = await api.createCreator(normalized);
      creatorId = created.creator.id;
    }
  }

  if (follow) {
    await api.followCreator(creatorId);
  } else {
    await api.unfollowCreator(creatorId);
  }

  await setFollowCacheEntry(normalized, { creatorId, isFollowing: follow });
  return {
    ok: true,
    data: {
      handle: normalized,
      creatorId,
      isFollowing: follow,
    },
  };
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
        return {
          ok: true,
          data: await fetchChart(
            msg.chain,
            msg.address,
            msg.range,
            msg.priceUsd,
            msg.change24hPct,
          ),
        };
      case "GET_FX":
        return { ok: true, data: await getUsdToInr() };
      case "GET_PREFERENCES":
        return { ok: true, data: await getPreferences() };
      case "SET_PREFERENCES":
        return { ok: true, data: await setPreferences({ currency: msg.currency }) };

      case "GET_SESSION": {
        const session = await getWalletSession();
        if (!session) {
          return { ok: true, data: { connected: false } };
        }
        try {
          const me = await api.getMe();
          if (me.address.toLowerCase() !== session.address.toLowerCase()) {
            await setWalletSession(null);
            return { ok: true, data: { connected: false } };
          }
          return {
            ok: true,
            data: {
              connected: true,
              address: me.address.toLowerCase(),
              userId: me.userId,
              isAdmin: me.isAdmin,
            },
          };
        } catch {
          await setWalletSession(null);
          return { ok: true, data: { connected: false } };
        }
      }

      case "DISCONNECT":
        await setWalletSession(null);
        return { ok: true, data: { connected: false } };

      case "BEGIN_WALLET_CONNECT":
      case "CONNECT_WALLET":
        return relayPageWalletConnect();

      case "FETCH_NONCE": {
        const nonce = await api.requestNonce(msg.address.toLowerCase());
        return { ok: true, data: nonce };
      }

      case "COMPLETE_WALLET_CONNECT": {
        const verified = await api.verifyWallet(
          msg.address,
          msg.nonce,
          msg.signature,
          msg.message,
        );
        await setWalletSession({
          token: verified.token,
          address: verified.user.address.toLowerCase(),
          userId: verified.user.id,
          isAdmin: false,
        });
        return {
          ok: true,
          data: {
            connected: true,
            address: verified.user.address.toLowerCase(),
            userId: verified.user.id,
            isAdmin: false,
          },
        };
      }

      case "GET_FOLLOW_STATE": {
        const handle = msg.handle.replace(/^@/, "").toLowerCase();
        const cache = await getFollowCache();
        const cached = cache[handle];
        if (cached && Date.now() - cached.at < 60_000) {
          return {
            ok: true,
            data: {
              handle,
              creatorId: cached.creatorId,
              isFollowing: cached.isFollowing,
              exists: true,
            },
          };
        }
        const session = await getWalletSession();
        if (!session) {
          return {
            ok: true,
            data: { handle, creatorId: null, isFollowing: false, exists: false, needsAuth: true },
          };
        }
        const state = await api.getCreatorByHandle(handle);
        if (state.creatorId) {
          await setFollowCacheEntry(handle, {
            creatorId: state.creatorId,
            isFollowing: state.isFollowing,
          });
        }
        return { ok: true, data: state };
      }

      case "FOLLOW_HANDLE":
        return followHandle(msg.handle, true);
      case "UNFOLLOW_HANDLE":
        return followHandle(msg.handle, false);

      case "GET_ORDER_CONFIG":
        return { ok: true, data: await api.getOrderConfig() };

      case "REQUEST_QUOTE": {
        const session = await getWalletSession();
        if (!session) return fail("UNAUTHENTICATED", "Connect your wallet first.");
        const quote = await api.requestQuote(msg.payload);
        return { ok: true, data: quote };
      }

      case "SUBMIT_ORDER": {
        const session = await getWalletSession();
        if (!session) return fail("UNAUTHENTICATED", "Connect your wallet first.");
        const result = await api.submitOrder(msg.payload);
        return { ok: true, data: result };
      }
    }
  } catch (err) {
    return providerFailure(err);
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) {
      sendResponse(fail("FORBIDDEN", "Unknown sender."));
      return false;
    }
    handle(message).then(sendResponse);
    return true;
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => undefined);
  });
}

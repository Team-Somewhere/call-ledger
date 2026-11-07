/// <reference types="chrome" />
import { sendMessage } from "../services/extension-messaging";
import {
  injectEthereumBridge,
  personalSign,
  requestAccounts,
} from "./ethereum-bridge-client";

/**
 * Handles PAGE_WALLET_CONNECT from the service worker (popup Connect flow).
 * Runs MetaMask prompts on the X page, then completes session via the SW.
 */

export function setupWalletConnectListener(): void {
  injectEthereumBridge();

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "PAGE_WALLET_CONNECT") return false;

    void (async () => {
      try {
        const accounts = await requestAccounts();
        const address = accounts[0]?.toLowerCase();
        if (!address) {
          sendResponse({
            ok: false,
            error: { code: "NO_ACCOUNT", message: "No wallet account was returned." },
          });
          return;
        }

        const nonceRes = await sendMessage<{
          address: string;
          nonce: string;
          message: string;
        }>({ type: "FETCH_NONCE", address });

        if (!nonceRes.ok) {
          sendResponse(nonceRes);
          return;
        }

        const signature = await personalSign(nonceRes.data.message, address);
        const complete = await sendMessage({
          type: "COMPLETE_WALLET_CONNECT",
          address,
          signature,
          message: nonceRes.data.message,
          nonce: nonceRes.data.nonce,
        });
        sendResponse(complete);
      } catch (err) {
        sendResponse({
          ok: false,
          error: {
            code: "CONNECT_FAILED",
            message: err instanceof Error ? err.message : "Wallet connect failed.",
          },
        });
      }
    })();

    return true;
  });
}

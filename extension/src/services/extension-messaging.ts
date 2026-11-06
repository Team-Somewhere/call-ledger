import type { ExtensionMessage } from "../background/messages";
import type { MessageResponse } from "../background/messages";

/**
 * Typed wrapper around chrome.runtime messaging for content scripts and pages.
 * Rejects when the extension context is gone (e.g. after an update), instead of hanging.
 */
export function sendMessage<T = unknown>(message: ExtensionMessage): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        return reject(new Error("Extension environment not available."));
      }
      chrome.runtime.sendMessage(message, (response: MessageResponse<T> | undefined) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message));
        if (!response) return reject(new Error("No response from CallLedger."));
        resolve(response);
      });
    } catch {
      reject(new Error("CallLedger was updated. Reload the page to continue."));
    }
  });
}

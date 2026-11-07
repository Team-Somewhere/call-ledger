/**
 * Content-script client for the MAIN-world ethereum bridge.
 */

const SOURCE = "callledger-extension-content";
const BRIDGE = "callledger-extension-bridge";
const TIMEOUT_MS = 120_000;

let injected = false;

export function injectEthereumBridge(): void {
  if (injected) return;
  injected = true;
  try {
    const src = chrome.runtime.getURL("src/injected/ethereum-bridge.js");
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    (document.documentElement || document.head || document.body).appendChild(script);
  } catch {
    // Extension context invalidated
  }
}

function requestBridge<T>(
  method: "eth_requestAccounts" | "eth_accounts" | "personal_sign" | "eth_signTypedData_v4",
  params?: unknown[],
): Promise<T> {
  injectEthereumBridge();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Wallet request timed out."));
    }, TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        source?: string;
        id?: string;
        result?: unknown;
        error?: string;
      };
      if (!data || data.source !== BRIDGE || data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.error) reject(new Error(data.error));
      else resolve(data.result as T);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ source: SOURCE, id, method, params }, window.location.origin);
  });
}

export async function requestAccounts(): Promise<string[]> {
  const accounts = await requestBridge<string[]>("eth_requestAccounts");
  return Array.isArray(accounts) ? accounts : [];
}

export async function personalSign(message: string, address: string): Promise<string> {
  const sig = await requestBridge<string>("personal_sign", [message, address]);
  if (typeof sig !== "string" || !sig.startsWith("0x")) {
    throw new Error("Wallet returned an invalid signature.");
  }
  return sig;
}

export async function signTypedDataV4(
  address: string,
  typedData: string | Record<string, unknown>,
): Promise<string> {
  const payload = typeof typedData === "string" ? typedData : JSON.stringify(typedData);
  const sig = await requestBridge<string>("eth_signTypedData_v4", [address, payload]);
  if (typeof sig !== "string" || !sig.startsWith("0x")) {
    throw new Error("Wallet returned an invalid typed-data signature.");
  }
  return sig;
}

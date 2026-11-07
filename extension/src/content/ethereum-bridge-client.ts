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
    const existing = document.querySelector("script[data-callledger-bridge]");
    if (existing?.getAttribute("src") === src) return;
    existing?.remove();
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.callledgerBridge = "1";
    (document.documentElement || document.head || document.body).appendChild(script);
  } catch {
    // Extension context invalidated
  }
}

function requestBridge<T>(
  method:
    | "eth_requestAccounts"
    | "eth_accounts"
    | "eth_chainId"
    | "personal_sign"
    | "eth_signTypedData_v4"
    | "wallet_switchEthereumChain"
    | "wallet_addEthereumChain"
    | "callledger_signTypedData",
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

const CHAIN_BY_NAME: Record<string, number> = {
  base: 8453,
  ethereum: 1,
  eth: 1,
  mainnet: 1,
  arbitrum: 42161,
  "arbitrum-one": 42161,
};

export async function signTypedDataV4(
  address: string,
  typedData: string | Record<string, unknown>,
  chainHint?: number | string,
): Promise<string> {
  const hinted =
    typeof chainHint === "number"
      ? chainHint
      : CHAIN_BY_NAME[(chainHint || "base").toLowerCase()] ?? 8453;
  const payload = typeof typedData === "string" ? typedData : JSON.stringify(typedData);
  const sig = await requestBridge<string>("callledger_signTypedData", [address, payload, hinted]);
  if (typeof sig !== "string" || !sig.startsWith("0x")) {
    throw new Error("Wallet returned an invalid typed-data signature.");
  }
  return sig;
}

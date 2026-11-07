/**
 * MAIN-world bridge so the isolated content script can talk to window.ethereum.
 * Loaded via web_accessible_resources + <script src="chrome-extension://...">.
 */

(() => {
  const SOURCE = "callledger-extension-bridge";
  const TARGET = "callledger-extension-content";

  type EthRequest = {
    source: typeof TARGET;
    id: string;
    method: "eth_requestAccounts" | "eth_accounts" | "personal_sign" | "eth_signTypedData_v4";
    params?: unknown[];
  };

  function reply(id: string, result?: unknown, error?: string) {
    window.postMessage({ source: SOURCE, id, result, error }, window.location.origin);
  }

  function getProvider(): { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } | null {
    const eth = (window as unknown as { ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
      providers?: Array<{ request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; isMetaMask?: boolean }>;
    } }).ethereum;
    if (!eth) return null;
    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0] ?? eth;
    }
    return eth;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data as EthRequest | undefined;
    if (!data || data.source !== TARGET || typeof data.id !== "string") return;

    const provider = getProvider();
    if (!provider) {
      reply(data.id, undefined, "MetaMask (or another EIP-1193 wallet) was not detected on this page.");
      return;
    }

    void (async () => {
      try {
        const result = await provider.request({
          method: data.method,
          params: data.params,
        });
        reply(data.id, result);
      } catch (err) {
        const anyErr = err as { code?: number; message?: string };
        if (anyErr?.code === 4001) {
          reply(data.id, undefined, "Request rejected in wallet.");
          return;
        }
        reply(data.id, undefined, anyErr?.message || "Wallet request failed.");
      }
    })();
  });

  window.postMessage({ source: SOURCE, type: "BRIDGE_READY" }, window.location.origin);
})();

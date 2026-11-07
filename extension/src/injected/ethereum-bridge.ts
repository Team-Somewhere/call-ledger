/**
 * MAIN-world bridge so the isolated content script can talk to window.ethereum.
 * Loaded via web_accessible_resources + <script src="chrome-extension://...">.
 *
 * Signing is done in this world as one sequence: switch network, wait until
 * MetaMask actually reports that chain, then eth_signTypedData_v4. Splitting
 * those across two postMessage calls lets MetaMask sign against the old chain.
 */

(() => {
  const FLAG = "__callledgerEthBridge";
  if ((window as unknown as Record<string, unknown>)[FLAG]) return;
  (window as unknown as Record<string, unknown>)[FLAG] = "3";

  const SOURCE = "callledger-extension-bridge";
  const TARGET = "callledger-extension-content";

  type Provider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
    providers?: Provider[];
  };

  type ChainSpec = {
    chainName: string;
    rpcUrls: string[];
    nativeCurrency: { name: string; symbol: string; decimals: number };
    blockExplorerUrls: string[];
  };

  const KNOWN_CHAINS: Record<number, ChainSpec> = {
    1: {
      chainName: "Ethereum",
      rpcUrls: ["https://ethereum-rpc.publicnode.com"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      blockExplorerUrls: ["https://etherscan.io"],
    },
    8453: {
      chainName: "Base",
      rpcUrls: ["https://mainnet.base.org"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      blockExplorerUrls: ["https://basescan.org"],
    },
    42161: {
      chainName: "Arbitrum One",
      rpcUrls: ["https://arb1.arbitrum.io/rpc"],
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      blockExplorerUrls: ["https://arbiscan.io"],
    },
  };

  type EthRequest = {
    source: typeof TARGET;
    id: string;
    method: string;
    params?: unknown[];
  };

  function reply(id: string, result?: unknown, error?: string) {
    window.postMessage({ source: SOURCE, id, result, error }, window.location.origin);
  }

  function listProviders(): Provider[] {
    const eth = (window as unknown as { ethereum?: Provider }).ethereum;
    if (!eth) return [];
    const all: Provider[] = [];
    if (Array.isArray(eth.providers)) all.push(...eth.providers);
    all.push(eth);
    const seen = new Set<Provider>();
    const unique = all.filter((provider) => {
      if (!provider || typeof provider.request !== "function" || seen.has(provider)) return false;
      seen.add(provider);
      return true;
    });
    unique.sort((a, b) => Number(Boolean(b.isMetaMask)) - Number(Boolean(a.isMetaMask)));
    return unique;
  }

  function normalizeChainId(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^0x[0-9a-f]+$/i.test(trimmed)) return parseInt(trimmed, 16);
      if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    }
    if (value && typeof value === "object") {
      const record = value as { hex?: unknown; _hex?: unknown };
      return normalizeChainId(record.hex ?? record._hex);
    }
    return null;
  }

  function chainIdFromTypedData(typedData: unknown): number | null {
    const text = typeof typedData === "string" ? typedData : JSON.stringify(typedData ?? "");
    const match = text.match(/"chainId"\s*:\s*"?(0x[0-9a-fA-F]+|\d+)"?/);
    if (match?.[1]) return normalizeChainId(match[1]);
    return null;
  }

  function errorMessage(err: unknown): string {
    const anyErr = err as { code?: number; message?: string };
    if (anyErr?.code === 4001) return "Request rejected in wallet.";
    const code = typeof anyErr?.code === "number" ? ` [${anyErr.code}]` : "";
    return `${anyErr?.message || "Wallet request failed."}${code}`;
  }

  function isUserReject(err: unknown): boolean {
    return (err as { code?: number })?.code === 4001;
  }

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function readChain(provider: Provider): Promise<number | null> {
    const current = await provider.request({ method: "eth_chainId" });
    return normalizeChainId(current);
  }

  function waitForChain(
    provider: Provider,
    chainId: number,
    timeoutMs: number,
  ): { promise: Promise<boolean>; cancel: () => void } {
    let finish: (matched: boolean) => void = () => undefined;
    const promise = new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      const poll = window.setInterval(() => {
        void readChain(provider)
          .then((current) => {
            if (current === chainId) finish(true);
          })
          .catch(() => undefined);
      }, 250);
      const onChange = (next: unknown) => {
        if (normalizeChainId(next) === chainId) finish(true);
      };
      finish = (matched: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        window.clearInterval(poll);
        try {
          provider.removeListener?.("chainChanged", onChange);
        } catch {
          // Provider may not implement removeListener.
        }
        resolve(matched);
      };
      try {
        provider.on?.("chainChanged", onChange);
      } catch {
        // Polling still covers providers without events.
      }
    });
    return { promise, cancel: () => finish(false) };
  }

  async function switchToChain(provider: Provider, chainId: number): Promise<void> {
    const hex = `0x${chainId.toString(16)}`;
    const known = KNOWN_CHAINS[chainId];
    const name = known?.chainName ?? `chain ${chainId}`;

    // Always ask MetaMask to select this chain. eth_chainId can report the
    // per-site network while the signature check still uses the network
    // selected in the wallet (31337 in local dev).
    const pending = waitForChain(provider, chainId, 60_000);
    const requestSwitch = () =>
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });

    try {
      await requestSwitch();
    } catch (err) {
      if (isUserReject(err)) {
        pending.cancel();
        throw new Error(`Switch to ${name} was rejected in MetaMask.`);
      }
      if (!known) {
        pending.cancel();
        throw new Error(errorMessage(err));
      }
      try {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hex,
              chainName: known.chainName,
              rpcUrls: known.rpcUrls,
              nativeCurrency: known.nativeCurrency,
              blockExplorerUrls: known.blockExplorerUrls,
            },
          ],
        });
      } catch (addErr) {
        if (isUserReject(addErr)) {
          pending.cancel();
          throw new Error(`Adding ${name} was rejected in MetaMask.`);
        }
        try {
          await requestSwitch();
        } catch (retryErr) {
          if (isUserReject(retryErr)) {
            pending.cancel();
            throw new Error(`Switch to ${name} was rejected in MetaMask.`);
          }
        }
      }
    }

    if ((await readChain(provider).catch(() => null)) === chainId) {
      pending.cancel();
      await delay(400);
      return;
    }

    const switched = await pending.promise;
    if (!switched) {
      const still = await readChain(provider).catch(() => null);
      throw new Error(
        `MetaMask is still on chain ${still ?? "unknown"}. Approve the ${name} network in the MetaMask popup, then click Confirm again.`,
      );
    }
    // MetaMask can report the new chain before signature checks use it.
    await delay(500);
  }

  async function signOnProvider(
    provider: Provider,
    address: string,
    payload: string,
    chainId: number,
  ): Promise<string> {
    await switchToChain(provider, chainId);
    try {
      const signature = await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, payload],
      });
      if (typeof signature !== "string" || !signature.startsWith("0x")) {
        throw new Error("Wallet returned an invalid typed-data signature.");
      }
      return signature;
    } catch (err) {
      const message = errorMessage(err);
      if (!/must match the active chainId/i.test(message)) throw new Error(message);
      await delay(600);
      await switchToChain(provider, chainId);
      try {
        const signature = await provider.request({
          method: "eth_signTypedData_v4",
          params: [address, payload],
        });
        if (typeof signature !== "string" || !signature.startsWith("0x")) {
          throw new Error("Wallet returned an invalid typed-data signature.");
        }
        return signature;
      } catch (retryErr) {
        const retryMessage = errorMessage(retryErr);
        if (/must match the active chainId/i.test(retryMessage)) {
          throw new Error(
            "MetaMask is still on the local network (31337). Open MetaMask, choose Base in the network dropdown, then click Confirm again.",
          );
        }
        throw new Error(retryMessage);
      }
    }
  }

  async function signTypedData(params: unknown[] | undefined): Promise<string> {
    const address = params?.[0];
    const typedData = params?.[1];
    const hinted = normalizeChainId(params?.[2]);
    if (typeof address !== "string" || !address.startsWith("0x")) {
      throw new Error("Missing wallet address for the order signature.");
    }
    if (typeof typedData !== "string" && (typeof typedData !== "object" || typedData == null)) {
      throw new Error("Quote did not include EIP-712 typed data to sign.");
    }
    const chainId = chainIdFromTypedData(typedData) ?? hinted ?? 8453;
    const payload = typeof typedData === "string" ? typedData : JSON.stringify(typedData);
    const providers = listProviders();
    if (providers.length === 0) {
      throw new Error("MetaMask (or another EIP-1193 wallet) was not detected on this page.");
    }

    let lastError = "Wallet request failed.";
    for (const provider of providers) {
      try {
        return await signOnProvider(provider, address, payload, chainId);
      } catch (err) {
        lastError = err instanceof Error ? err.message : errorMessage(err);
        if (/rejected/i.test(lastError)) throw new Error(lastError);
      }
    }
    throw new Error(lastError);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data as EthRequest | undefined;
    if (!data || data.source !== TARGET || typeof data.id !== "string" || typeof data.method !== "string") {
      return;
    }

    void (async () => {
      try {
        if (data.method === "callledger_signTypedData") {
          const signature = await signTypedData(data.params);
          reply(data.id, signature);
          return;
        }

        const provider = listProviders()[0];
        if (!provider) {
          reply(data.id, undefined, "MetaMask (or another EIP-1193 wallet) was not detected on this page.");
          return;
        }
        const result = await provider.request({
          method: data.method,
          params: data.params,
        });
        reply(data.id, result);
      } catch (err) {
        reply(data.id, undefined, err instanceof Error ? err.message : errorMessage(err));
      }
    })();
  });

  window.postMessage({ source: SOURCE, type: "BRIDGE_READY" }, window.location.origin);
})();

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  ApiRequestError,
  getSessionToken,
  setSessionToken,
} from "./api";

/**
 * Minimal EVM wallet integration using the browser's `window.ethereum`
 * provider (MetaMask / Rabby / Coinbase Wallet / any EIP-1193 wallet).
 *
 * Security:
 * - we never ask for a private key or seed phrase
 * - a connected wallet is NOT authenticated until a signature is verified
 *   by the backend (`personal_sign` over a server-issued nonce)
 * - following a creator never requires an on-chain transaction
 */

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
}

export interface SessionState {
  address: string | null;
  userId: string | null;
  isAdmin: boolean;
  isConnecting: boolean;
  error: string | null;
}

export interface WalletSessionContextValue extends SessionState {
  isAuthenticated: boolean;
  connect: () => Promise<boolean>;
  connectGuest: () => Promise<boolean>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  signTypedData: (typedData: Record<string, unknown> | string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (tx: { to: string; data?: string; value?: string }) => Promise<string>;
  switchChain: (targetChainId: number) => Promise<boolean>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** Get the primary EIP-1193 Ethereum provider, preferring MetaMask if multiple exist */
export function getEthereumProvider(): Eip1193Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;

  const eth = window.ethereum;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const metamask = eth.providers.find((p) => p.isMetaMask);
    if (metamask) return metamask;
    return eth.providers[0] ?? eth;
  }

  return eth;
}

const WalletSessionContext = createContext<WalletSessionContextValue | null>(null);

export function WalletSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<SessionState>({
    address: null,
    userId: null,
    isAdmin: false,
    isConnecting: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    const token = getSessionToken();
    const provider = getEthereumProvider();

    // Query MetaMask's active account in background without prompting
    let activeMetaMaskAddress: string | null = null;
    if (provider) {
      try {
        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];
        if (accounts?.[0]) {
          activeMetaMaskAddress = accounts[0].toLowerCase();
        }
      } catch {
        // Provider not ready or access denied
      }
    }

    if (!token) {
      setState((s) => ({
        ...s,
        address: activeMetaMaskAddress || null,
        userId: null,
        isAdmin: false,
      }));
      return;
    }

    try {
      const { data } = await api.me();
      const verifiedAddress = data.address.toLowerCase();

      // If MetaMask account is switched to a different address than the JWT token
      if (
        activeMetaMaskAddress &&
        activeMetaMaskAddress !== verifiedAddress
      ) {
        setSessionToken(null);
        setState((s) => ({
          ...s,
          address: activeMetaMaskAddress,
          userId: null,
          isAdmin: false,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        address: verifiedAddress,
        userId: data.userId,
        isAdmin: data.isAdmin,
      }));
    } catch {
      setSessionToken(null);
      setState((s) => ({
        ...s,
        address: activeMetaMaskAddress || null,
        userId: null,
        isAdmin: false,
      }));
    }
  }, []);

  // Initial refresh on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(() => {
    setSessionToken(null);
    setState({
      address: null,
      userId: null,
      isAdmin: false,
      isConnecting: false,
      error: null,
    });
  }, []);

  // Sync state when user switches or disconnects accounts in MetaMask
  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const list = (accounts as string[]) || [];
      if (!list || list.length === 0) {
        disconnect();
        return;
      }

      const newAddress = list[0]?.toLowerCase();
      if (!newAddress) {
        disconnect();
        return;
      }

      // Check if existing token matches the newly selected account
      const token = getSessionToken();
      if (token) {
        api
          .me()
          .then(({ data }) => {
            if (data.address.toLowerCase() === newAddress) {
              setState((s) => ({
                ...s,
                address: newAddress,
                userId: data.userId,
                isAdmin: data.isAdmin,
                error: null,
              }));
            } else {
              setSessionToken(null);
              setState((s) => ({
                ...s,
                address: newAddress,
                userId: null,
                isAdmin: false,
                error: null,
              }));
            }
          })
          .catch(() => {
            setSessionToken(null);
            setState((s) => ({
              ...s,
              address: newAddress,
              userId: null,
              isAdmin: false,
              error: null,
            }));
          });
      } else {
        setState((s) => ({
          ...s,
          address: newAddress,
          userId: null,
          isAdmin: false,
          error: null,
        }));
      }
    };

    const handleChainChanged = () => {
      void refresh();
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [disconnect, refresh]);

  const connect = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error(
          "MetaMask (or an EIP-1193 wallet) was not detected. Please install the MetaMask extension or use Guest Demo mode.",
        );
      }

      // 1. Request account access from MetaMask
      let accounts: string[] = [];
      try {
        accounts = (await provider.request({
          method: "eth_requestAccounts",
        })) as string[];
      } catch (err: unknown) {
        const anyErr = err as { code?: number; message?: string };
        if (anyErr?.code === 4001) {
          throw new Error("MetaMask connection request was rejected.");
        }
        throw new Error(anyErr?.message || "Failed to connect to MetaMask.");
      }

      const address = accounts?.[0]?.toLowerCase();
      if (!address) {
        throw new Error("No account was returned by MetaMask.");
      }

      // If we already have a valid session token for this address, activate it immediately
      const currentToken = getSessionToken();
      if (currentToken) {
        try {
          const { data } = await api.me();
          if (data.address.toLowerCase() === address) {
            setState({
              address,
              userId: data.userId,
              isAdmin: data.isAdmin,
              isConnecting: false,
              error: null,
            });
            return true;
          }
        } catch {
          // Token expired or invalid, proceed with signing challenge
        }
      }

      // 2. Request single-use login nonce bound to this address
      const nonceRes = await api.requestNonce(address);

      // 3. Sign the challenge message with personal_sign
      let signature: string;
      try {
        signature = (await provider.request({
          method: "personal_sign",
          params: [nonceRes.data.message, address],
        })) as string;
      } catch (signErr: unknown) {
        const anySignErr = signErr as { code?: number; message?: string };
        if (anySignErr?.code === 4001) {
          throw new Error("Signature request was cancelled in MetaMask.");
        }
        throw new Error(
          anySignErr?.message || "Failed to sign the login message with MetaMask.",
        );
      }

      // 4. Verify signature on backend
      const verifyRes = await api.verifyWallet(
        address,
        nonceRes.data.nonce,
        signature,
        nonceRes.data.message,
      );

      setSessionToken(verifyRes.data.token);
      setState({
        address: verifyRes.data.user.address.toLowerCase(),
        userId: verifyRes.data.user.id,
        isAdmin: false,
        isConnecting: false,
        error: null,
      });

      await refresh();
      return true;
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Wallet connection failed";
      setState((s) => ({ ...s, isConnecting: false, error: message }));
      return false;
    }
  }, [refresh]);

  const connectGuest = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));
    try {
      const guestRes = await api.guestLogin();
      setSessionToken(guestRes.data.token);
      setState({
        address: guestRes.data.user.address.toLowerCase(),
        userId: guestRes.data.user.id,
        isAdmin: false,
        isConnecting: false,
        error: null,
      });
      await refresh();
      return true;
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Guest session failed";
      setState((s) => ({ ...s, isConnecting: false, error: message }));
      return false;
    }
  }, [refresh]);

  const signTypedData = useCallback(
    async (typedData: Record<string, unknown> | string): Promise<string> => {
      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error("No EIP-1193 wallet (such as MetaMask) detected.");
      }

      // Resolve address from state or fallback directly to provider's connected account
      let signingAddress = state.address;
      if (!signingAddress) {
        try {
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          if (accounts?.[0]) {
            signingAddress = accounts[0].toLowerCase();
          }
        } catch {
          // ignore
        }
      }

      if (!signingAddress) {
        throw new Error("Wallet not connected. Connect your wallet first.");
      }

      const payloadString =
        typeof typedData === "string" ? typedData : JSON.stringify(typedData);

      try {
        const signature = (await provider.request({
          method: "eth_signTypedData_v4",
          params: [signingAddress, payloadString],
        })) as string;
        return signature;
      } catch (err: unknown) {
        const anyErr = err as { code?: number; message?: string };
        if (anyErr?.code === 4001) {
          throw new Error("Order signature request was rejected in your wallet.");
        }
        throw new Error(anyErr?.message || "Failed to sign order with wallet.");
      }
    },
    [state.address],
  );

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      const provider = getEthereumProvider();
      if (!provider) throw new Error("No EIP-1193 wallet detected.");
      let signingAddress = state.address;
      if (!signingAddress) {
        const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
        signingAddress = accounts?.[0]?.toLowerCase() ?? null;
      }
      if (!signingAddress) throw new Error("Wallet not connected.");
      try {
        return (await provider.request({
          method: "personal_sign",
          params: [message, signingAddress],
        })) as string;
      } catch (err: unknown) {
        const anyErr = err as { code?: number; message?: string };
        if (anyErr.code === 4001) {
          throw new Error("Cancellation signature was rejected in your wallet.");
        }
        throw new Error(anyErr.message || "Failed to sign the cancellation message.");
      }
    },
    [state.address],
  );

  const sendTransaction = useCallback(
    async (tx: { to: string; data?: string; value?: string }): Promise<string> => {
      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error("No EIP-1193 wallet (such as MetaMask) detected.");
      }

      let activeAddress = state.address;
      if (!activeAddress) {
        try {
          const accounts = (await provider.request({
            method: "eth_accounts",
          })) as string[];
          if (accounts?.[0]) {
            activeAddress = accounts[0].toLowerCase();
          }
        } catch {
          // ignore
        }
      }

      if (!activeAddress) {
        throw new Error("Wallet not connected. Connect your wallet first.");
      }

      try {
        const txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: activeAddress,
              to: tx.to,
              data: tx.data || "0x",
              value: tx.value
                ? tx.value.startsWith("0x")
                  ? tx.value
                  : `0x${BigInt(tx.value).toString(16)}`
                : "0x0",
            },
          ],
        })) as string;
        return txHash;
      } catch (err: unknown) {
        const anyErr = err as { code?: number; message?: string };
        if (anyErr?.code === 4001) {
          throw new Error("Transaction was rejected in your wallet.");
        }
        throw new Error(anyErr?.message || "Failed to send transaction with wallet.");
      }
    },
    [state.address],
  );

  const switchChain = useCallback(async (targetChainId: number): Promise<boolean> => {
    const provider = getEthereumProvider();
    if (!provider) return false;
    const hexChainId = `0x${targetChainId.toString(16)}`;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
      return true;
    } catch (err: unknown) {
      console.warn("Could not switch chain automatically:", err);
      return false;
    }
  }, []);

  const value = useMemo<WalletSessionContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.address && state.userId),
      connect,
      connectGuest,
      disconnect,
      refresh,
      signTypedData,
      signMessage,
      sendTransaction,
      switchChain,
    }),
    [state, connect, connectGuest, disconnect, refresh, signTypedData, signMessage, sendTransaction, switchChain],
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession(): WalletSessionContextValue {
  const context = useContext(WalletSessionContext);
  if (!context) {
    // If rendered outside provider (e.g. isolated test or SSR), return safe defaults
    return {
      address: null,
      userId: null,
      isAdmin: false,
      isConnecting: false,
      error: null,
      isAuthenticated: false,
      connect: async () => false,
      connectGuest: async () => false,
      disconnect: () => {},
      refresh: async () => {},
      signTypedData: async () => {
        throw new Error("Wallet session provider not mounted");
      },
      signMessage: async () => {
        throw new Error("Wallet session provider not mounted");
      },
      sendTransaction: async () => {
        throw new Error("Wallet session provider not mounted");
      },
      switchChain: async () => false,
    };
  }
  return context;
}


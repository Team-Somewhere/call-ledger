"use client";

import { useCallback, useEffect, useState } from "react";
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

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
}

interface SessionState {
  address: string | null;
  userId: string | null;
  isAdmin: boolean;
  isConnecting: boolean;
  error: string | null;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** Get the primary EIP-1193 Ethereum provider, preferring MetaMask if multiple exist */
function getEthereumProvider(): Eip1193Provider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;

  const eth = window.ethereum;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const metamask = eth.providers.find((p) => p.isMetaMask);
    if (metamask) return metamask;
    return eth.providers[0] ?? eth;
  }

  return eth;
}

export function useWalletSession() {
  const [state, setState] = useState<SessionState>({
    address: null,
    userId: null,
    isAdmin: false,
    isConnecting: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!getSessionToken()) {
      setState((s) => ({ ...s, address: null, userId: null, isAdmin: false }));
      return;
    }
    try {
      const { data } = await api.me();
      setState((s) => ({
        ...s,
        address: data.address,
        userId: data.userId,
        isAdmin: data.isAdmin,
      }));
    } catch {
      setSessionToken(null);
      setState((s) => ({ ...s, address: null, userId: null, isAdmin: false }));
    }
  }, []);

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

  // Sync state if user switches or disconnects accounts in MetaMask
  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list || list.length === 0) {
        disconnect();
      } else if (state.address && list[0]?.toLowerCase() !== state.address.toLowerCase()) {
        disconnect();
      }
    };

    provider.on("accountsChanged", handleAccountsChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [disconnect, state.address]);

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

      // 2. Request single-use login nonce bound to this address
      const nonceRes = await api.requestNonce(address);

      // 3. Sign the challenge message with personal_sign.
      //
      //    We pass the plain UTF-8 string directly (NOT hex-encoded).
      //
      //    Why:
      //    - MetaMask's personal_sign prepends the EIP-191 header
      //      "\x19Ethereum Signed Message:\n{len}" to the RAW BYTES of
      //      whatever you pass. If you pass the string, it signs the
      //      UTF-8 bytes of that string.
      //    - viem's recoverMessageAddress({ message: string }) does
      //      exactly the same: EIP-191-prefix + UTF-8 bytes of the string.
      //    - Both sides use the identical byte sequence → signatures verify.
      //
      //    If we hex-encode first, MetaMask would sign the UTF-8 bytes of
      //    the "0xABCD..." hex characters, NOT the decoded message bytes.
      //    The backend reconstructs the plain string and gets a completely
      //    different byte sequence → INVALID_SIGNATURE.
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
        address: verifyRes.data.user.address,
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
        address: guestRes.data.user.address,
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

  return {
    ...state,
    isAuthenticated: Boolean(state.address),
    connect,
    connectGuest,
    disconnect,
    refresh,
  };
}

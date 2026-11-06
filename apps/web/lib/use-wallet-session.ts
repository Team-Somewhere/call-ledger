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

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true, error: null }));

    try {
      const provider = window.ethereum;
      if (!provider) {
        throw new Error(
          "No EVM wallet detected. Install MetaMask, Rabby, or Coinbase Wallet to sign in.",
        );
      }

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      const address = accounts?.[0];
      if (!address) throw new Error("No account was returned by the wallet.");

      // Server issues a single-use nonce bound to this address.
      const nonceRes = await api.requestNonce(address);

      const signature = (await provider.request({
        method: "personal_sign",
        params: [nonceRes.data.message, address],
      })) as string;

      const verifyRes = await api.verifyWallet(
        address,
        nonceRes.data.nonce,
        signature,
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

  return { ...state, isAuthenticated: Boolean(state.address), connect, disconnect, refresh };
}

/**
 * CallLedger REST client for the extension service worker.
 * Attaches x-wallet-session when a session is present.
 */

import { CALLLEDGER_API_BASE } from "../config/constants";
import { getWalletSession } from "./storage";

export class CallLedgerApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CallLedgerApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: unknown;
  error?: { code?: string; message?: string };
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (opts.auth !== false) {
    const session = await getWalletSession();
    if (session?.token) headers["x-wallet-session"] = session.token;
  }

  const res = await fetch(`${CALLLEDGER_API_BASE}${path}`, {
    ...init,
    headers,
  });

  let payload: Envelope<T> | null = null;
  try {
    payload = (await res.json()) as Envelope<T>;
  } catch {
    // non-JSON
  }

  if (!res.ok || !payload?.success) {
    throw new CallLedgerApiError(
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }

  return payload.data as T;
}

export async function requestNonce(address: string) {
  return apiFetch<{
    address: string;
    nonce: string;
    message: string;
    domain: string;
    expiresAt: string;
  }>(
    "/auth/wallet/nonce",
    { method: "POST", body: JSON.stringify({ address }) },
    { auth: false },
  );
}

export async function verifyWallet(
  address: string,
  nonce: string,
  signature: string,
  message: string,
) {
  return apiFetch<{
    token: string;
    user: {
      id: string;
      address: string;
      email: string | null;
      displayName: string | null;
    };
    isNewUser: boolean;
  }>(
    "/auth/wallet/verify",
    {
      method: "POST",
      body: JSON.stringify({ address, nonce, signature, message }),
    },
    { auth: false },
  );
}

export async function getMe() {
  return apiFetch<{ userId: string; address: string; isAdmin: boolean }>(
    "/auth/me",
  );
}

export async function resolveHandle(username: string) {
  return apiFetch<{
    sourceType: string;
    handle: string;
    existingCreatorId: string | null;
    alreadyExists: boolean;
    displayName?: string | null;
    status?: string;
  }>("/creators/resolve", {
    method: "POST",
    body: JSON.stringify({ sourceType: "X", username }),
  }, { auth: false });
}

export async function createCreator(username: string) {
  return apiFetch<{
    creator: { id: string; displayName: string };
    source: { id: string; handle: string | null };
    alreadyExisted?: boolean;
  }>("/creators", {
    method: "POST",
    body: JSON.stringify({ sourceType: "X", username }),
  });
}

export async function getCreatorByHandle(handle: string) {
  return apiFetch<{
    creatorId: string | null;
    handle: string;
    displayName: string | null;
    isFollowing: boolean;
    exists: boolean;
  }>(`/creators/by-handle/${encodeURIComponent(handle)}`);
}

export async function followCreator(creatorId: string) {
  return apiFetch<{
    followId: string;
    creatorId: string;
    isActive: boolean;
    created: boolean;
  }>(`/creators/${creatorId}/follow`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function unfollowCreator(creatorId: string) {
  return apiFetch<{
    followId: string;
    creatorId: string;
    isActive: boolean;
  }>(`/creators/${creatorId}/follow`, { method: "DELETE" });
}

export async function getOrderConfig() {
  return apiFetch<{
    configured: boolean;
    supportedChains: Record<string, { name: string; chainId: number }>;
    verifiedAssets: Record<
      string,
      Record<string, { symbol: string; address: string; decimals: number; chain: string }>
    >;
  }>("/orders/config", undefined, { auth: false });
}

export async function requestQuote(body: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>("/orders/quote", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitOrder(body: Record<string, unknown>) {
  return apiFetch<{
    order: { id: string; status?: string };
    flashResponse?: { orderId?: string; status?: string };
  }>("/orders/submit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

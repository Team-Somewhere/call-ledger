import type { DisplayCurrency } from "../utils/formatting";

/**
 * chrome.storage wrapper for preferences and CallLedger wallet session.
 * The session token is a server-issued opaque string (not a private key).
 */

export interface Preferences {
  currency: DisplayCurrency;
}

export interface WalletSession {
  token: string;
  address: string;
  userId: string;
  isAdmin: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { currency: "USD" };

const SESSION_KEY = "callledger.wallet.session";
const FOLLOW_CACHE_KEY = "callledger.follow.cache";

export async function getPreferences(): Promise<Preferences> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return DEFAULT_PREFERENCES;
  }
  const stored = await chrome.storage.local.get("preferences");
  const raw = stored.preferences as Partial<Preferences> | undefined;
  return {
    currency: raw?.currency === "INR" ? "INR" : "USD",
  };
}

export async function setPreferences(next: Partial<Preferences>): Promise<Preferences> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return { ...DEFAULT_PREFERENCES, ...next };
  }
  const current = await getPreferences();
  const merged: Preferences = { ...current, ...next };
  await chrome.storage.local.set({ preferences: merged });
  return merged;
}

export async function getWalletSession(): Promise<WalletSession | null> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
  const stored = await chrome.storage.local.get(SESSION_KEY);
  const raw = stored[SESSION_KEY] as WalletSession | undefined;
  if (!raw?.token || !raw?.address || !raw?.userId) return null;
  return {
    token: raw.token,
    address: raw.address.toLowerCase(),
    userId: raw.userId,
    isAdmin: Boolean(raw.isAdmin),
  };
}

export async function setWalletSession(session: WalletSession | null): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  if (!session) {
    await chrome.storage.local.remove(SESSION_KEY);
    return;
  }
  await chrome.storage.local.set({
    [SESSION_KEY]: {
      token: session.token,
      address: session.address.toLowerCase(),
      userId: session.userId,
      isAdmin: Boolean(session.isAdmin),
    },
  });
}

export async function getFollowCache(): Promise<Record<string, { creatorId: string; isFollowing: boolean; at: number }>> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) return {};
  try {
    const stored = await chrome.storage.session.get(FOLLOW_CACHE_KEY);
    return (stored[FOLLOW_CACHE_KEY] as Record<string, { creatorId: string; isFollowing: boolean; at: number }>) ?? {};
  } catch {
    return {};
  }
}

export async function setFollowCacheEntry(
  handle: string,
  value: { creatorId: string; isFollowing: boolean },
): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.session) return;
  try {
    const current = await getFollowCache();
    current[handle.toLowerCase()] = { ...value, at: Date.now() };
    await chrome.storage.session.set({ [FOLLOW_CACHE_KEY]: current });
  } catch {
    // session storage may be unavailable
  }
}

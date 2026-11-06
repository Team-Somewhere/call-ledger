import type { DisplayCurrency } from "../utils/formatting";

/**
 * chrome.storage wrapper. Only non-sensitive preferences are stored here.
 * Session tokens and wallet data are NOT stored in chrome.storage (see SECURITY.md).
 */

export interface Preferences {
  currency: DisplayCurrency;
}

export const DEFAULT_PREFERENCES: Preferences = { currency: "USD" };

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

/**
 * Text from X is untrusted. Render it only as React text nodes (never innerHTML).
 * These helpers normalise and bound text before it is shown or parsed.
 */

const MAX_POST_TEXT = 4000;

export function cleanPostText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_POST_TEXT);
}

/** Only allow http(s) URLs to be rendered as links. */
export function safeHttpUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** X usernames: 1-15 letters, digits or underscores. */
export function isValidXHandle(handle: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(handle);
}

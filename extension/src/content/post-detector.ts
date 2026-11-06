/**
 * Detects X post containers and extracts author, text and post URL.
 *
 * X changes its markup often, so every lookup has a fallback chain and
 * nothing depends on one class name. A post is only returned when its
 * text can be read; otherwise it is skipped rather than guessed.
 */

export interface DetectedPost {
  /** The article element. Used as the stable key for injecting UI once. */
  element: HTMLElement;
  /** Post ID taken from the status URL. Null if no status link is found. */
  postId: string | null;
  /** Canonical post URL, when a status link is present. */
  postUrl: string | null;
  authorHandle: string | null;
  text: string;
}

/** A post is identified by its status link: https://x.com/<user>/status/<id> */
const STATUS_RE = /^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

export function findPostArticles(root: ParentNode): HTMLElement[] {
  const found = new Set<HTMLElement>();
  // Primary: X timeline/post articles. Fallback: any article with a status link.
  root.querySelectorAll<HTMLElement>('article[data-testid="tweet"], article[role="article"]').forEach((el) => found.add(el));
  if (found.size === 0) {
    root.querySelectorAll<HTMLElement>("article").forEach((el) => {
      if (el.querySelector('a[href*="/status/"]')) found.add(el);
    });
  }
  return [...found];
}

function readStatusLink(article: HTMLElement): { handle: string; id: string } | null {
  for (const a of article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')) {
    const path = new URL(a.href, location.origin).pathname;
    const m = path.match(STATUS_RE);
    if (m) return { handle: m[1], id: m[2] };
  }
  return null;
}

function readText(article: HTMLElement): string | null {
  const el = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
  if (el) {
    // textContent (not innerText) keeps the read consistent in jsdom and avoids layout reads during scroll.
    const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return null;
}

/** Extract post data from an article. Returns null when the post is unreadable (deleted, promoted, or blocked). */
export function extractPost(article: HTMLElement): DetectedPost | null {
  const link = readStatusLink(article);
  const text = readText(article);
  if (!text) return null;
  return {
    element: article,
    postId: link?.id ?? null,
    postUrl: link ? `https://x.com/${link.handle}/status/${link.id}` : null,
    authorHandle: link?.handle ?? null,
    text,
  };
}

/** Marks an article so it is processed exactly once. */
export const PROCESSED_ATTR = "data-cl-processed";

export function isProcessed(article: HTMLElement): boolean {
  return article.hasAttribute(PROCESSED_ATTR);
}

export function markProcessed(article: HTMLElement): void {
  article.setAttribute(PROCESSED_ATTR, "1");
}

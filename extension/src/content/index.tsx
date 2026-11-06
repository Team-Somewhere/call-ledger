import { createRoot, type Root } from "react-dom/client";
import { findPostArticles, extractPost, isProcessed, markProcessed } from "./post-detector";
import { observeX } from "./x-observer";
import { detectTokenMentions, uniqueSymbols } from "./token-detector";
import { CallLedgerPostBar } from "../components/PostBar";
import { TokenOverlay, triggerTokenOverlay, hideTokenOverlay, dismissTokenOverlay, clearDismissedTokenOverlay } from "../components/TokenOverlay";
import { PRODUCT_NAME } from "../config/constants";
import "./styles.css";

/**
 * Content script entry. Mounts:
 * 1. Post bars below the engagement row for posts with token/strategy mentions.
 * 2. A global floating TokenOverlay that displays the rich crypto chart popover
 *    whenever a user hovers over or clicks any $TICKER cashtag or CallLedger chip.
 */

const roots = new Map<HTMLElement, Root>();
let overlayRoot: Root | null = null;

function mountForPost(article: HTMLElement) {
  if (isProcessed(article)) return;

  const post = extractPost(article);
  if (!post || !post.text) return;
  const symbols = uniqueSymbols(detectTokenMentions(post.text));
  if (symbols.length === 0) return; // Nothing for CallLedger to show on this post.

  markProcessed(article);

  const host = document.createElement("div");
  host.setAttribute("data-callledger", "post-bar");
  host.style.cssText = "display: block; width: 100%; box-sizing: border-box; clear: both;";

  // Mount directly below the tweet action group (reply/repost/like) inside the tweet content column
  const actionBar = article.querySelector('div[role="group"]');
  if (actionBar && actionBar.parentElement) {
    actionBar.parentElement.insertBefore(host, actionBar.nextSibling);
  } else {
    article.appendChild(host);
  }

  const root = createRoot(host);
  root.render(<CallLedgerPostBar post={post} symbols={symbols} />);
  roots.set(article, root);
}

function cleanupRemoved() {
  for (const [article, root] of roots) {
    if (!article.isConnected) {
      root.unmount();
      roots.delete(article);
    }
  }
}

function extractCashtagSymbol(target: Element): string | null {
  // 1. CallLedger chip attribute
  const clToken = target.getAttribute("data-callledger-token");
  if (clToken) return clToken;

  // 2. Nearest anchor tag
  const anchor = target.closest("a");
  if (!anchor) return null;

  const href = anchor.getAttribute("href") || "";
  const text = (anchor.textContent || "").trim();

  // X cashtag links have ?q=%24SYMBOL or cashtag_click
  if (href.includes("cashtag_click") || href.includes("%24") || href.includes("?q=$")) {
    const symbolMatch = text.match(/^\$([A-Za-z0-9_]{2,15})/);
    if (symbolMatch) return symbolMatch[1];
    const urlMatch = href.match(/q=(?:%24|\$)([A-Za-z0-9_]{2,15})/i);
    if (urlMatch) return urlMatch[1];
  }

  // 3. Any $XYZ anchor inside tweet text
  if (/^\$[A-Za-z0-9_]{2,15}$/.test(text) && anchor.closest('[data-testid="tweetText"]')) {
    return text.replace(/^\$/, "");
  }

  return null;
}

function setupCashtagInterceptors() {
  // Hover to trigger overlay
  document.addEventListener("mouseover", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const symbol = extractCashtagSymbol(target);
    if (symbol) {
      const triggerEl = (target.closest("a") || target) as HTMLElement;
      if (triggerEl.hasAttribute("title")) triggerEl.removeAttribute("title");
      e.stopPropagation();
      triggerTokenOverlay(symbol, triggerEl, false);
    }
  });

  document.addEventListener("mouseout", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const symbol = extractCashtagSymbol(target);
    if (symbol) {
      hideTokenOverlay(false);
      clearDismissedTokenOverlay();
    }
  });

  // Click on cashtags: allow natural navigation to Twitter's native search/chart page!
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const symbol = extractCashtagSymbol(target);
      if (symbol) {
        const anchor = (target.closest("a") || target) as HTMLElement;
        // Dismiss our hover overlay so the user can verify on Twitter's native chart page
        dismissTokenOverlay(anchor);
      }
    },
    true, // capture phase to cleanly dismiss overlay before page transition
  );
}

function initTokenOverlay() {
  let host = document.getElementById("callledger-portal-root");
  if (!host) {
    host = document.createElement("div");
    host.id = "callledger-portal-root";
    host.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; pointer-events: none; z-index: 2147483647;";
    document.body.appendChild(host);
  }
  if (!overlayRoot) {
    overlayRoot = createRoot(host);
    overlayRoot.render(<TokenOverlay />);
  }
}

function start() {
  initTokenOverlay();
  setupCashtagInterceptors();

  const handle = observeX((rootNode) => {
    findPostArticles(rootNode).forEach(mountForPost);
    cleanupRemoved();
  });

  window.addEventListener("pagehide", () => handle.stop(), { once: true });
  console.info(`[${PRODUCT_NAME}] content script active`);
}

start();

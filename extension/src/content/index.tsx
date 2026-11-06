import { createRoot, type Root } from "react-dom/client";
import { findPostArticles, extractPost, isProcessed, markProcessed } from "./post-detector";
import { observeX } from "./x-observer";
import { detectTokenMentions, uniqueSymbols } from "./token-detector";
import { CallLedgerPostBar } from "../components/PostBar";
import { PRODUCT_NAME } from "../config/constants";
import "./styles.css";

/**
 * Content script entry. Mounts one small React root per post, only for posts
 * that contain a readable trading signal or token mention. Each post is
 * processed once, and roots are unmounted when the post leaves the DOM.
 */

const roots = new Map<HTMLElement, Root>();

function mountForPost(article: HTMLElement) {
  if (isProcessed(article)) return;
  markProcessed(article);

  const post = extractPost(article);
  if (!post) return;
  const symbols = uniqueSymbols(detectTokenMentions(post.text));
  if (symbols.length === 0) return; // Nothing for CallLedger to show on this post.

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

function start() {
  const handle = observeX((rootNode) => {
    findPostArticles(rootNode).forEach(mountForPost);
    cleanupRemoved();
  });
  window.addEventListener("pagehide", () => handle.stop(), { once: true });
  console.info(`[${PRODUCT_NAME}] content script active`);
}

start();

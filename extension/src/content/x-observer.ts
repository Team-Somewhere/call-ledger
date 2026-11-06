/**
 * Watches X for new posts and SPA navigation. Work is batched with
 * requestAnimationFrame and only touches newly added nodes, so long timelines
 * stay responsive. Observers are disconnected on teardown.
 */

export type PostsHandler = (root: ParentNode) => void;

export interface ObserverHandle {
  stop(): void;
}

export function observeX(onPostsAdded: PostsHandler): ObserverHandle {
  let scheduled = false;
  const pendingRoots = new Set<Node>();

  const flush = () => {
    scheduled = false;
    for (const root of pendingRoots) {
      if (root instanceof Element || root instanceof Document) onPostsAdded(root);
    }
    pendingRoots.clear();
  };

  const schedule = (node: Node) => {
    pendingRoots.add(node);
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };

  // Only the added nodes are processed; the whole DOM is never rescanned.
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof Element) schedule(node);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // X is a single-page app: detect URL changes without a reload.
  let lastHref = location.href;
  const onNav = () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      schedule(document.body);
    }
  };
  const navTimer = window.setInterval(onNav, 800);
  window.addEventListener("popstate", onNav);

  // Process whatever is already on the page at start-up.
  schedule(document.body);

  return {
    stop() {
      mo.disconnect();
      window.clearInterval(navTimer);
      window.removeEventListener("popstate", onNav);
      pendingRoots.clear();
    },
  };
}

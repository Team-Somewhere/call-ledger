import { createRoot, type Root } from "react-dom/client";
import { useCallback, useEffect, useState } from "react";
import { sendMessage } from "../services/extension-messaging";

const HOST_ATTR = "data-callledger-follow";
const EXCLUDED = new Set([
  "home",
  "explore",
  "search",
  "notifications",
  "messages",
  "i",
  "settings",
  "compose",
  "login",
  "signup",
  "tos",
  "privacy",
  "jobs",
  "communities",
]);

function parseProfileHandle(): string | null {
  const path = window.location.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const handle = parts[0];
  if (!handle || EXCLUDED.has(handle.toLowerCase())) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return handle;
}

function FollowButton({ handle }: { handle: string }) {
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const session = await sendMessage<{ connected: boolean }>({ type: "GET_SESSION" });
    const isConnected = session.ok && session.data.connected;
    setConnected(isConnected);
    if (!isConnected) {
      setFollowing(false);
      return;
    }
    const state = await sendMessage<{
      isFollowing: boolean;
      needsAuth?: boolean;
    }>({ type: "GET_FOLLOW_STATE", handle });
    if (state.ok) setFollowing(Boolean(state.data.isFollowing));
  }, [handle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!connected) {
        const connect = await sendMessage({ type: "BEGIN_WALLET_CONNECT" });
        if (!connect.ok) {
          setError(connect.error.message);
          return;
        }
        setConnected(true);
      }
      const action = following
        ? await sendMessage({ type: "UNFOLLOW_HANDLE", handle })
        : await sendMessage({ type: "FOLLOW_HANDLE", handle });
      if (!action.ok) {
        setError(action.error.message);
        return;
      }
      setFollowing(!following);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cl-root cl-follow" data-testid="callledger-follow">
      <button
        type="button"
        className={following ? "cl-btn cl-btn--ghost" : "cl-btn cl-btn--active"}
        disabled={busy}
        onClick={() => void onClick()}
        title="Follow this trader on CallLedger (off-chain)"
      >
        <span className="cl-brand__tag" style={{ marginRight: 4 }}>
          CALL
        </span>
        {busy
          ? "Working…"
          : !connected
            ? "Connect & Follow on CallLedger"
            : following
              ? "Following on CallLedger"
              : "Follow on CallLedger"}
      </button>
      {error && <div className="cl-follow__error">{error}</div>}
    </div>
  );
}

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
let lastHandle: string | null = null;

function findMountPoint(): HTMLElement | null {
  // Prefer the user actions row near Follow/Following.
  const followBtn =
    document.querySelector<HTMLElement>('[data-testid="placementTracking"]') ||
    document.querySelector<HTMLElement>('[data-testid="userActions"]') ||
    document.querySelector<HTMLElement>('div[data-testid="UserName"]')?.parentElement;
  return followBtn ?? null;
}

function unmount() {
  if (root) {
    root.unmount();
    root = null;
  }
  hostEl?.remove();
  hostEl = null;
  lastHandle = null;
}

export function syncProfileFollowButton(): void {
  const handle = parseProfileHandle();
  if (!handle) {
    unmount();
    return;
  }

  if (lastHandle === handle && hostEl?.isConnected) return;

  unmount();
  const mount = findMountPoint();
  if (!mount) return;

  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, handle);
  host.style.cssText = "margin: 8px 0; width: 100%;";
  mount.insertAdjacentElement("afterend", host);

  hostEl = host;
  lastHandle = handle;
  root = createRoot(host);
  root.render(<FollowButton handle={handle} />);
}

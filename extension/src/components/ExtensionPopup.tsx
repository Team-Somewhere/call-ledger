import { useEffect, useState } from "react";
import { Link2, Loader2, LogOut, Settings, ShieldCheck, Wallet } from "lucide-react";
import { CALLLEDGER_APP_URL, PRODUCT_NAME } from "../config/constants";
import { getPreferences, setPreferences } from "../services/storage";
import { sendMessage } from "../services/extension-messaging";
import type { DisplayCurrency } from "../utils/formatting";

/**
 * Popup: CallLedger wallet session, display currency, and web app link.
 * Connect prompts MetaMask on the active X tab via the content-script bridge.
 */
export function ExtensionPopup() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [session, setSession] = useState<{
    connected: boolean;
    address?: string;
    reason?: string;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    const res = await sendMessage<{
      connected: boolean;
      address?: string;
      reason?: string;
    }>({ type: "GET_SESSION" });
    if (res.ok) setSession(res.data);
  };

  useEffect(() => {
    getPreferences()
      .then((p) => setCurrency(p.currency))
      .catch(() => undefined);
    void refreshSession().catch(() => undefined);
  }, []);

  const changeCurrency = async (next: DisplayCurrency) => {
    setCurrency(next);
    try {
      await setPreferences({ currency: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch {
      // ignore
    }
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendMessage<{
        connected: boolean;
        address?: string;
      }>({ type: "BEGIN_WALLET_CONNECT" });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setSession({
        connected: true,
        address: res.data.address,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendMessage({ type: "DISCONNECT" });
      setSession({ connected: false });
    } finally {
      setBusy(false);
    }
  };

  const short =
    session?.address && session.address.length > 10
      ? `${session.address.slice(0, 6)}…${session.address.slice(-4)}`
      : session?.address;

  return (
    <div className="pp">
      <header className="pp__head">
        <div className="pp__brand">
          <span className="pp__mark">CALL</span>
          <span className="pp__name">{PRODUCT_NAME}</span>
        </div>
        <span className="pp__tag">for X</span>
      </header>

      <section className="pp__card" aria-labelledby="pp-account">
        <div className="pp__row">
          <h2 id="pp-account" className="pp__h">
            <ShieldCheck size={14} aria-hidden /> Account
          </h2>
          <span className={session?.connected ? "pp__pill pp__pill--ok" : "pp__pill"}>
            {session?.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="pp__muted">
          {session?.connected
            ? `Signed in as ${short}. Follow traders and implement trades on X without opening the app.`
            : "Connect MetaMask on an open X tab to follow traders and implement trades in-feed."}
        </p>
        {error && <p className="pp__error">{error}</p>}
        <div className="pp__actions">
          {session?.connected ? (
            <button type="button" className="pp__btn pp__btn--ghost" disabled={busy} onClick={() => void disconnect()}>
              {busy ? <Loader2 size={14} className="cl-spin" /> : <LogOut size={14} />}
              Disconnect
            </button>
          ) : (
            <button type="button" className="pp__btn" disabled={busy} onClick={() => void connect()}>
              {busy ? <Loader2 size={14} className="cl-spin" /> : <Wallet size={14} />}
              Connect Wallet
            </button>
          )}
        </div>
      </section>

      <section className="pp__card" aria-labelledby="pp-currency">
        <h2 id="pp-currency" className="pp__h">
          <Settings size={14} aria-hidden /> Display currency
        </h2>
        <div className="pp__seg" role="radiogroup" aria-label="Display currency">
          {(["USD", "INR"] as DisplayCurrency[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={currency === c}
              className={currency === c ? "pp__seg-btn pp__seg-btn--on" : "pp__seg-btn"}
              onClick={() => changeCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="pp__muted pp__small">
          {currency === "INR"
            ? "INR is for display only. Trades settle in tokens."
            : "Prices are shown in US dollars."}
          {saved ? " Saved." : ""}
        </p>
      </section>

      <a className="pp__link" href={CALLLEDGER_APP_URL} target="_blank" rel="noreferrer">
        <Link2 size={14} aria-hidden /> Open CallLedger
      </a>
      <p className="pp__muted pp__small">
        Unofficial. Not affiliated with X. Not financial advice.
      </p>
    </div>
  );
}

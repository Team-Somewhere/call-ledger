import { useEffect, useState } from "react";
import { Link2, Settings, ShieldCheck } from "lucide-react";
import { CALLLEDGER_APP_URL, PRODUCT_NAME } from "../config/constants";
import { getPreferences, setPreferences } from "../services/storage";
import { sendMessage } from "../services/extension-messaging";
import type { DisplayCurrency } from "../utils/formatting";

/**
 * Popup: shows CallLedger connection status, the display currency and a link
 * to the web app. Wallet and sign-in state come from the service worker, and
 * the popup never handles private keys or signing.
 */
export function ExtensionPopup() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [session, setSession] = useState<{ connected: boolean; reason?: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPreferences()
      .then((p) => setCurrency(p.currency))
      .catch(() => undefined);
    sendMessage<{ connected: boolean; reason?: string }>({ type: "GET_SESSION" })
      .then((res) => {
        if (res.ok) setSession(res.data);
      })
      .catch(() => undefined);
  }, []);

  const changeCurrency = async (next: DisplayCurrency) => {
    setCurrency(next);
    try {
      await setPreferences({ currency: next });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    } catch {
      // ignore in environments without chrome.storage
    }
  };

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
            ? "Signed in to CallLedger."
            : session?.reason ?? "Sign in to CallLedger in the web app to use trading actions."}
        </p>
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
            ? "INR is for display only. Trades always settle in tokens; amounts are converted with a fresh quote."
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

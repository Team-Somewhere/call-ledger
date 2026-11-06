import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionPopup } from "../components/ExtensionPopup";
import "../popup/popup.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExtensionPopup />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionPopup } from "../components/ExtensionPopup";
import "../popup/popup.css";

/** Side panel shares the popup's settings view for now; strategy review opens from the X post. */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ExtensionPopup />
  </StrictMode>,
);

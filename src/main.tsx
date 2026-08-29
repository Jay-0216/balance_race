import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/*
 * Installable, and playable with the network off.
 *
 * Only in a real build: in dev the modules are served unhashed and one from
 * yesterday's cache would be a very confusing afternoon.
 */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {
        // a browser that refuses is a browser that just does not install it
      });
  });
}

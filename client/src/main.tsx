import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeIncognito, isIncognito } from "./lib/incognito";
// @ts-ignore
import { registerSW } from "virtual:pwa-register";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.filter((key) => key.startsWith("workbox-") || key === "pubchem-images")
        .forEach((key) => caches.delete(key));
    });
  }
}

async function start() {
  await initializeIncognito().catch(console.error);

  if (import.meta.env.PROD && !isIncognito()) {
    registerSW({
      immediate: true,
      onRegisterError: console.error,
      onOfflineReady() {
        console.log("App is ready to work offline");
      },
    });
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

void start();

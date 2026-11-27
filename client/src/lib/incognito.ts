import { useSyncExternalStore } from "react";
import { OFFLINE_WORKER_FILE, PREPARE_SHIELD, incognitoSettingsScope, readIncognito, readShieldSnapshot, shieldPreferenceKey, writeIncognito } from "./incognitoStorage";

const listeners = new Set<() => void>();
let enabled = false;
let networkController = new AbortController();
let updates: BroadcastChannel | undefined;

export function isIncognito() {
  return enabled;
}

function applyIncognito(next: boolean) {
  if (enabled === next) return;

  enabled = next;
  if (next) {
    networkController.abort();
  } else {
    networkController = new AbortController();
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIncognito() {
  return useSyncExternalStore(subscribe, isIncognito);
}

function scopeUrl() {
  return new URL(import.meta.env.BASE_URL, location.href).href;
}

export async function initializeIncognito() {
  if (!("caches" in window)) return;

  async function refresh() {
    applyIncognito(await readIncognito(scopeUrl()));
  }

  if ("BroadcastChannel" in window) {
    updates = new BroadcastChannel(`phlogiston-incognito:${incognitoSettingsScope(scopeUrl())}`);
    updates.onmessage = () => {
      void refresh().catch(console.error);
    };
  }

  await refresh();
}

function prepareSnapshot(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("Shield preparation timed out"));
    }, 30000);
    channel.port1.onmessage = ({ data }) => {
      window.clearTimeout(timer);
      channel.port1.close();
      if (data === true) resolve();
      else reject(new Error("Offline snapshot is incomplete"));
    };
    worker.postMessage(PREPARE_SHIELD, [channel.port2]);
  });
}

export async function shieldSnapshotMissing(): Promise<boolean> {
  if (!import.meta.env.PROD) return false;
  const scope = scopeUrl();
  const requested = new URLSearchParams(location.search).get("shield") === "1" ||
    localStorage.getItem(shieldPreferenceKey(scope)) === "1";
  if (!requested) return false;
  const snapshot = await readShieldSnapshot(scope);
  return !snapshot || !await caches.match(new URL("index.html", scope).href, { cacheName: snapshot }) ||
    navigator.serviceWorker?.controller?.scriptURL !== new URL(OFFLINE_WORKER_FILE, scope).href;
}

export async function setIncognito(next: boolean) {
  const scope = scopeUrl();
  if (next && import.meta.env.PROD) {
    const worker = navigator.serviceWorker?.controller;
    if (worker?.scriptURL !== new URL(OFFLINE_WORKER_FILE, scope).href) {
      throw new Error("The offline service worker is not ready");
    }
    await prepareSnapshot(worker);
    applyIncognito(true);
    try {
      localStorage.setItem(shieldPreferenceKey(scope), "1");
    } catch {
      // The worker already persisted the snapshot in Cache Storage.
    }
  } else {
    await writeIncognito(scope, next);
    applyIncognito(next);
    if (import.meta.env.PROD) localStorage.removeItem(shieldPreferenceKey(scope));
  }

  updates?.postMessage(null);
}

export function networkFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = networkController.signal;
  if (signal.aborted) return Promise.reject(signal.reason);

  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : null);
  return fetch(input, {
    ...init,
    signal: callerSignal ? AbortSignal.any([signal, callerSignal]) : signal,
  });
}

export function isLocalImageSource(source: string) {
  return /^(?:data:image\/|blob:)/i.test(source);
}

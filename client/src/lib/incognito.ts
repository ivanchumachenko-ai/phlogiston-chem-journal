import { useSyncExternalStore } from "react";
import { OFFLINE_WORKER_FILE, readIncognito, writeIncognito } from "./incognitoStorage";

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
    updates = new BroadcastChannel(`phlogiston-incognito:${scopeUrl()}`);
    updates.onmessage = () => {
      void refresh().catch(console.error);
    };
  }

  await refresh();
}

export async function setIncognito(next: boolean) {
  const scope = scopeUrl();
  if (
    next && import.meta.env.PROD &&
    navigator.serviceWorker?.controller?.scriptURL !== new URL(OFFLINE_WORKER_FILE, scope).href
  ) {
    throw new Error("The offline service worker is not ready");
  }

  await writeIncognito(scope, next);
  applyIncognito(next);
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

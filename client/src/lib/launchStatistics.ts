const origin = "https://ivanchumachenko-ai.github.io";
const api = "https://phlogiston-statistics.politeloom64.chatgpt.site/api";
const browserKey = "phlogiston-statistics:browser";
const statsKey = "phlogiston-statistics:totals";
const queuePrefix = "phlogiston-statistics:launch:";
const app = "phlogiston";
const appPath = "/phlogiston-chem-journal/";

export const isPublishedApp = location.origin === origin && location.pathname.startsWith(appPath);
export const isPinnedApp = isPublishedApp && location.pathname.startsWith(appPath + "pinned/");

export function launchedFromHomeScreen() {
  return matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const updatePreferenceKey = "phlogiston:pause-updates:" + app;
const pinnedScope = new URL(appPath + "pinned/", origin).href;
const pinnedCache = "phlogiston-installed:" + pinnedScope;

export function updatesPaused() {
  try {
    return localStorage.getItem(updatePreferenceKey) === "true";
  } catch {
    return false;
  }
}

export async function setUpdatesPaused(paused: boolean) {
  if (paused && !isPinnedApp) {
    if (!navigator.onLine || !("serviceWorker" in navigator) || !("caches" in window)) {
      throw new Error("Cannot save the installed version");
    }
    const previous = await navigator.serviceWorker.getRegistration(pinnedScope);
    if (previous?.scope === pinnedScope) await previous.unregister();
    await caches.delete(pinnedCache);
    const registration = await navigator.serviceWorker.register(
      new URL("phlogiston-sw.js", pinnedScope), { updateViaCache: "none" },
    );
    const worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error("No worker for the installed version");
    await new Promise<void>((resolve, reject) => {
      function check() {
        if (worker?.state !== "activated" && worker?.state !== "redundant") return;
        worker.removeEventListener("statechange", check);
        if (worker.state === "activated") resolve();
        else reject(new Error("Cannot cache the installed version"));
      }
      worker.addEventListener("statechange", check);
      check();
    });
    if (!await caches.match(pinnedScope + "index.html", { cacheName: pinnedCache })) {
      throw new Error("The installed version is missing");
    }
  }
  localStorage.setItem(updatePreferenceKey, String(paused));
}

export async function openPreferredApp() {
  if (!isPublishedApp || (!isPinnedApp && !launchedFromHomeScreen())) return false;
  const paused = updatesPaused();
  if (isPinnedApp && !paused && navigator.onLine) {
    location.replace(appPath + location.search + location.hash);
    return true;
  }
  if (!isPinnedApp && paused) {
    if (navigator.onLine || ("caches" in window &&
        await caches.match(pinnedScope + "index.html", { cacheName: pinnedCache }))) {
      location.replace(appPath + "pinned/" + location.search + location.hash);
      return true;
    }
  }
  return false;
}

type Launch = { id: string; browserId: string; app: string; standalone: boolean };
type NetworkFetch = typeof fetch;
export type Totals = {
  launches: number;
  browsers: number;
  standalone: number;
  since: string | null;
  updatedAt: string;
};

let sending: Promise<void> | undefined;

function flush(network: NetworkFetch, isPrivate: () => boolean): Promise<void> {
  if (sending) return sending;
  sending = (async () => {
    while (!isPrivate() && navigator.onLine) {
      const events: Launch[] = [];
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(queuePrefix)) continue;
        const value = localStorage.getItem(key);
        if (value) events.push(JSON.parse(value) as Launch);
        if (events.length === 25) break;
      }
      if (!events.length) return;
      const response = await network(api + "/launches", {
        method: "POST",
        body: JSON.stringify(events),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (response.status !== 204) return;
      events.forEach(({ id }) => localStorage.removeItem(queuePrefix + id));
    }
  })().catch(() => {}).finally(() => { sending = undefined; });
  return sending;
}

export function recordLaunch(network: NetworkFetch, isPrivate: () => boolean) {
  if (!isPublishedApp || isPrivate() || !["", "#", "#/"].includes(location.hash)) return;
  const send = () => void flush(network, isPrivate);
  window.addEventListener("online", send);
  window.addEventListener("pageshow", send);
  try {
    const browserId = localStorage.getItem(browserKey) ?? crypto.randomUUID();
    localStorage.setItem(browserKey, browserId);
    const id = crypto.randomUUID();
    const standalone = launchedFromHomeScreen();
    const event: Launch = { id, browserId, app, standalone };
    localStorage.setItem(queuePrefix + id, JSON.stringify(event));
    send();
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function readCachedTotals(): Totals | null {
  try {
    return JSON.parse(localStorage.getItem(statsKey) ?? "null") as Totals | null;
  } catch {
    return null;
  }
}

export async function loadTotals(network: NetworkFetch, signal: AbortSignal): Promise<Totals> {
  await sending;
  const response = await network(api + "/stats", { signal, credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error("Statistics unavailable");
  const totals = await response.json() as Totals;
  if (![totals.launches, totals.browsers, totals.standalone].every(
    (count) => Number.isSafeInteger(count) && count >= 0,
  ) || !Number.isFinite(Date.parse(totals.updatedAt)) ||
    (totals.since !== null && !Number.isFinite(Date.parse(totals.since)))) {
    throw new Error("Invalid statistics");
  }
  try {
    localStorage.setItem(statsKey, JSON.stringify(totals));
  } catch {
    // Current totals are still available even if local storage is full.
  }
  return totals;
}

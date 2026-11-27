/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { PrecacheController, PrecacheRoute } from "workbox-precaching";
import { NavigationRoute, RegExpRoute, Router } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { PREPARE_SHIELD, readIncognito, readShieldSnapshot, writeIncognito } from "./lib/incognitoStorage";
import { shieldFailure } from "./lib/shieldPage";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const scope = self.registration.scope;
const index = new URL("index.html", scope).href;
const precache = new PrecacheController({
  plugins: [{
    async requestWillFetch({ request }) {
      if (await readIncognito(scope)) throw new Error("Incognito mode is enabled");
      return request;
    },
  }],
});

precache.precache(self.__WB_MANIFEST);

self.addEventListener("install", (event) => event.waitUntil((async () => {
  if (await readIncognito(scope)) throw new Error("Shield is on");
  await self.skipWaiting();
})()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const router = new Router();
router.registerRoute(new PrecacheRoute(precache));
router.registerRoute(new NavigationRoute(precache.createHandlerBoundToURL(index), {
  denylist: [/phlogiston\.zip$/, /\/(?:installed|pinned)(?:\/|$)/],
}));
router.registerRoute(new RegExpRoute(
  /^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug\/compound\/cid\/.*\/PNG/,
  new CacheFirst({
    cacheName: "pubchem-images",
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
));

const snapshotName = "phlogiston-shield:" + scope;
const snapshotManifest = new URL(".shield-files", scope).href;
const shieldPolicy = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

async function saveSnapshot(): Promise<void> {
  if (await readShieldSnapshot(scope)) return;
  const files = precache.getCachedURLs().filter((url) => url.startsWith(scope));
  if (!files.includes(index)) throw new Error("Missing app entry");
  await caches.delete(snapshotName);
  const snapshot = await caches.open(snapshotName);
  try {
    for (const url of files) {
      const response = await precache.matchPrecache(url);
      if (!response?.ok) throw new Error("Missing app file");
      await snapshot.put(url, response);
    }
    await snapshot.put(snapshotManifest, Response.json(files));
    await writeIncognito(scope, true, snapshotName);
  } catch (error) {
    await caches.delete(snapshotName);
    throw error;
  }
}

let preparation: Promise<void> | undefined;
self.addEventListener("message", (event) => {
  if (event.data !== PREPARE_SHIELD || !event.ports[0]) return;
  const port = event.ports[0];
  preparation ??= saveSnapshot().finally(() => { preparation = undefined; });
  event.waitUntil(preparation.then(() => port.postMessage(true), () => port.postMessage(false)));
});

function missingSnapshot(): Response {
  return new Response(shieldFailure(scope), {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function respond(event: FetchEvent): Promise<Response> {
  const { request } = event;
  const url = new URL(request.url);
  const navigate = request.mode === "navigate";
  const requested = navigate && url.searchParams.get("shield") === "1";
  const snapshot = await readShieldSnapshot(scope);
  if (requested || snapshot || await readIncognito(scope)) {
    if (request.method !== "GET" || !request.url.startsWith(scope)) return Response.error();
    if (snapshot || requested) {
      if (!snapshot) return navigate ? missingSnapshot() : Response.error();
      if (navigate && url.pathname === new URL("installed/", scope).pathname) {
        return Response.redirect(new URL("?shield=1", scope));
      }
      if (navigate && url.pathname !== new URL(scope).pathname && url.pathname !== new URL(index).pathname) {
        return Response.error();
      }
      if (navigate) {
        if (!await caches.has(snapshot)) return missingSnapshot();
        const saved = await caches.open(snapshot);
        const manifest = await saved.match(snapshotManifest);
        if (!manifest) return missingSnapshot();
        const files: string[] = await manifest.json();
        const available = new Set((await saved.keys()).map((entry) => entry.url));
        if (files.some((file) => !available.has(file))) return missingSnapshot();
      }
      const response = await caches.match(navigate ? index : url.href, { cacheName: snapshot });
      if (!response) return navigate ? missingSnapshot() : Response.error();
      if (!navigate) return response;
      const headers = new Headers(response.headers);
      headers.delete("Content-Encoding");
      headers.delete("Content-Length");
      headers.set("Content-Security-Policy", shieldPolicy);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { headers });
    }
    // Older versions used only the Workbox cache while Incognito was active.
    if (navigate && url.pathname === new URL(scope).pathname) {
      return await precache.matchPrecache(index) ?? missingSnapshot();
    }
    return await precache.matchPrecache(url.href) ?? Response.error();
  }

  return router.handleRequest({ event, request }) ?? fetch(request);
}

self.addEventListener("fetch", (event) => event.respondWith(respond(event)));

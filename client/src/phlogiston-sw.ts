/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { PrecacheController, PrecacheRoute } from "workbox-precaching";
import { NavigationRoute, RegExpRoute, Router } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { readIncognito } from "./lib/incognitoStorage";

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

self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const router = new Router();
router.registerRoute(new PrecacheRoute(precache));
router.registerRoute(new NavigationRoute(precache.createHandlerBoundToURL(index), {
  denylist: [/phlogiston\.zip$/, /\/installed(?:\/|$)/],
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

async function respond(event: FetchEvent): Promise<Response> {
  const { request } = event;
  if (await readIncognito(scope)) {
    if (request.method !== "GET" || !request.url.startsWith(scope)) return Response.error();
    const url = new URL(request.url);
    if (request.mode === "navigate" && url.pathname === new URL(scope).pathname) {
      return await precache.matchPrecache(index) ?? Response.error();
    }
    return await precache.matchPrecache(url.href) ?? Response.error();
  }

  return router.handleRequest({ event, request }) ?? fetch(request);
}

self.addEventListener("fetch", (event) => event.respondWith(respond(event)));

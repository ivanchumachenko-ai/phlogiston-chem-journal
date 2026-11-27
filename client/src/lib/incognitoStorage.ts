export const OFFLINE_WORKER_FILE = "phlogiston-sw.js";

const settingsCache = "phlogiston-settings";

function incognitoKey(scope: string) {
  return new URL(".phlogiston-incognito", scope).href;
}

export async function readIncognito(scope: string): Promise<boolean> {
  return Boolean(await caches.match(incognitoKey(scope), { cacheName: settingsCache }));
}

export async function writeIncognito(scope: string, enabled: boolean): Promise<void> {
  const cache = await caches.open(settingsCache);
  const key = incognitoKey(scope);

  if (enabled) {
    await cache.put(key, new Response("enabled"));
  } else {
    await cache.delete(key);
  }
}

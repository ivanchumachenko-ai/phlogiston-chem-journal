export const OFFLINE_WORKER_FILE = "phlogiston-sw.js";
export const PREPARE_SHIELD = "phlogiston:prepare-shield";

export function shieldPreferenceKey(scope: string) {
  return "phlogiston:shield:" + incognitoSettingsScope(scope);
}

const settingsCache = "phlogiston-settings";

export function incognitoSettingsScope(scope: string) {
  return scope.endsWith("/pinned/") ? new URL("../", scope).href : scope;
}

function incognitoKey(scope: string) {
  return new URL(".phlogiston-incognito", incognitoSettingsScope(scope)).href;
}

export async function readIncognito(scope: string): Promise<boolean> {
  return Boolean(await caches.match(incognitoKey(scope), { cacheName: settingsCache }));
}

export async function readShieldSnapshot(scope: string): Promise<string | null> {
  const response = await caches.match(incognitoKey(scope), { cacheName: settingsCache });
  const value = await response?.text();
  return value?.startsWith("phlogiston-shield:") ? value : null;
}

export async function writeIncognito(scope: string, enabled: boolean, snapshot = "enabled"): Promise<void> {
  const cache = await caches.open(settingsCache);
  const key = incognitoKey(scope);

  if (enabled) {
    await cache.put(key, new Response(snapshot));
  } else {
    await cache.delete(key);
  }
}

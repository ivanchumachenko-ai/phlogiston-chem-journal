import { shieldPreferenceKey } from "./incognitoStorage";

export function shieldFailure(scope: string): string {
  const settingsURL = new URL(".phlogiston-incognito", scope).href;
  return `<!doctype html><html><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; form-action 'none'">
    <title>Phlogiston Shield</title></head><body><main>
    <h1>Shield</h1>
    <p>Сохранённая сборка недоступна. Shield остаётся включённым.</p>
    <p>The saved build is unavailable. Shield is still on.</p>
    <button type="button" id="exit">Выключить Shield и открыть сайт / Exit Shield and open the site</button>
    <p id="status" role="status"></p>
    <script>
      document.getElementById("exit").onclick = async () => {
        if (!confirm("Открыть Phlogiston онлайн? / Open Phlogiston online?")) return;
        try {
          const cache = await caches.open("phlogiston-settings");
          await cache.delete(${JSON.stringify(settingsURL)});
          localStorage.removeItem(${JSON.stringify(shieldPreferenceKey(scope))});
          location.replace(${JSON.stringify(scope)} + location.hash);
        } catch {
          document.getElementById("status").textContent = "Не удалось выйти из Shield. / Could not exit Shield.";
        }
      };
    </script></main></body></html>`;
}

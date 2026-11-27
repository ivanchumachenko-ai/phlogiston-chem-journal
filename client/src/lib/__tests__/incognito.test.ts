import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get_properties_async } from "../chemistry";
import { initializeIncognito, isIncognito, networkFetch, setIncognito } from "../incognito";

describe("Incognito", () => {
  beforeEach(() => {
    const cache = new Map<string, Response>();
    const cacheStorage = {
      match: async (key: string) => cache.get(key),
      open: async () => ({
        put: async (key: string, response: Response) => cache.set(key, response),
        delete: async (key: string) => cache.delete(key),
      }),
    };
    vi.stubGlobal("caches", cacheStorage);
    vi.stubGlobal("window", { caches: cacheStorage });
    vi.stubGlobal("location", new URL("https://example.com/"));
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "chemcalc_custom_reagents"
        ? JSON.stringify([{ shortcut: "mine", name: "Local reagent", formula: "NaCl" }])
        : null,
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
  });

  afterEach(async () => {
    await setIncognito(false);
    vi.unstubAllGlobals();
  });

  it("blocks new requests and aborts existing requests until turned off", async () => {
    const url = "https://example.com/online";
    await networkFetch(url);
    const fetchMock = vi.mocked(fetch);
    const pendingSignal = fetchMock.mock.calls[0][1]?.signal;

    await setIncognito(true);

    expect(pendingSignal?.aborted).toBe(true);
    await expect(networkFetch(url)).rejects.toHaveProperty("name", "AbortError");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await setIncognito(false);
    await expect(networkFetch(url)).resolves.toHaveProperty("ok", true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("restores the stored setting and resolves local reagents without online lookups", async () => {
    await caches.open("phlogiston-settings").then((cache) => cache.put(
      new URL(".phlogiston-incognito", location.href).href,
      new Response("enabled"),
    ));
    await initializeIncognito();

    expect(isIncognito()).toBe(true);
    await expect(get_properties_async("mine")).resolves.toMatchObject({ name: "Local reagent", formula: "NaCl" });
    await expect(get_properties_async("unknown reagent")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps a lookup entered in Incognito local if the mode changes before it runs", async () => {
    await expect(get_properties_async("unknown reagent", true)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

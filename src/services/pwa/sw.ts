/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision?: string | null }[];
};
const prefix = `gachachess-react:${new URL(self.registration.scope).pathname}:`;
const cacheName = prefix + __APP_RELEASE__;
const assets = self.__WB_MANIFEST.map(
  (entry) => new URL(entry.url, self.registration.scope).href,
);
const index = new URL("index.html", self.registration.scope).href;
const isolated = (response: Response) => {
  if (!response.ok || response.type === "opaque") return response;
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      try {
        let cursor = 0;
        const fetched = await Promise.allSettled(
          Array.from({ length: 4 }, async () => {
            while (cursor < assets.length) {
              const url = assets[cursor++];
              const response = await fetch(
                new Request(url, { cache: "reload" }),
              );
              if (!response.ok) throw new Error(`Precache failed: ${url}`);
              await cache.put(url, isolated(response));
            }
          }),
        );
        const failed = fetched.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") throw failed.reason;
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Keep the preceding release for old open clients until their safe update.
      const all = await caches.keys(),
        keys = all.filter((key) => key.startsWith(prefix)),
        legacy: string[] = [];
      for (const key of all.filter((key) => /^chess-vault-v\d+$/.test(key))) {
        const requests = await (await caches.open(key)).keys();
        if (
          requests.length &&
          requests.every((request) =>
            request.url.startsWith(self.registration.scope),
          )
        )
          legacy.push(key);
      }
      const precedingReact = keys.filter((key) => key !== cacheName).at(-1);
      const previous =
        precedingReact ||
        legacy
          .sort(
            (a, b) =>
              Number(a.replace("chess-vault-v", "")) -
              Number(b.replace("chess-vault-v", "")),
          )
          .at(-1);
      await Promise.all(
        [...keys, ...legacy]
          .filter((key) => key !== cacheName && key !== previous)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (["SKIP_WAITING", "ACTIVATE_UPDATE"].includes(event.data?.type))
    void self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(self.registration.scope)
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      const navigation = event.request.mode === "navigate";
      const exact = await cache.match(event.request);
      if (exact) return isolated(exact);
      if (navigation) {
        const shell = await cache.match(index);
        if (shell) return isolated(shell);
        return new Response(
          "Офлайн-копия приложения недоступна. Повторите загрузку после восстановления соединения.",
          {
            status: 503,
            headers: { "Content-Type": "text/plain;charset=utf-8" },
          },
        );
      }
      // Exact URLs only: never substitute one release's chunk for another.
      for (const name of (await caches.keys()).filter(
        (name) =>
          (name.startsWith(prefix) && name !== cacheName) ||
          /^chess-vault-v\d+$/.test(name),
      )) {
        const previous = await (await caches.open(name)).match(event.request);
        if (previous) return isolated(previous);
      }
      const response = isolated(await fetch(event.request));
      if (response.ok && assets.includes(event.request.url))
        await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
export {};

const CACHE_NAME = "lift-log-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
];

const cacheRequest = async request => {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { mode: "no-cors" });
    await cache.put(request, response.clone());
    return response;
  } catch {
    return null;
  }
};

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async asset => {
      try {
        const response = await fetch(asset, { mode: "no-cors" });
        await cache.put(asset, response);
      } catch {}
    }));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isHttp = requestUrl.protocol.startsWith("http");

  if (!isHttp) return;
  if (requestUrl.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      try {
        const fresh = await fetch(event.request);
        await cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(event.request)) || (await cache.match("./index.html"));
      }
    }

    const cached = await cache.match(event.request) || await cache.match(requestUrl.href);
    if (cached) {
      event.waitUntil(cacheRequest(event.request));
      return cached;
    }

    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) {
        await cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});

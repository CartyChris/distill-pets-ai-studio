// Cache the public app shell only. API requests, keys, and model responses
// never enter this cache. Saved work remains in the app's browser storage.
const CACHE = 'pip-shell-v5-distill-pets';
const CORE = ['/', '/manifest.webmanifest', '/icons/pip-192.png', '/icons/pip-512.png', '/icons/apple-touch-icon.png'];
const staticURL = url => url.origin === self.location.origin && (
  url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest'
);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/', { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    const html = await response.clone().text();
    await cache.put('/', response);
    const urls = new Set(CORE.slice(1));
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const url = new URL(match[1], self.location.origin);
      if (staticURL(url)) urls.add(url.href);
    }
    await Promise.all([...urls].map(async url => {
      const asset = await fetch(url, { cache: 'reload' });
      if (asset.ok) await cache.put(url, asset);
    }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('pip-shell-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) await cache.put('/', response.clone());
        return response;
      } catch {
        const saved = await cache.match('/');
        if (!saved) return Response.error();
        const html = (await saved.text()).replace(/<html\b/i, '<html data-offline-shell="true"');
        const headers = new Headers(saved.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');
        return new Response(html, { status: 200, headers });
      }
    })());
  } else if (staticURL(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});

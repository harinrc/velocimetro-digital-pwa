const APP_CACHE = 'velocimetro-app-v49';
const RUNTIME_CACHE = 'velocimetro-runtime-v49';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|json|svg|png|jpg|jpeg|webp|ico|html)$/.test(pathname);
}

function isThirdPartyAsset(url) {
  return (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('openstreetmap.org')
  );
}

// 1. Instalar el Service Worker y almacenar archivos en caché
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      console.log('Cacheando archivos de la interfaz...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activar el Service Worker y limpiar cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== APP_CACHE && key !== RUNTIME_CACHE) {
            console.log('Eliminando caché antigua:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(async () => {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }
      return self.clients.claim();
    })
  );
});

// 3. Estrategia de respuesta: Cache First (Priorizar Caché para modo Offline)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const requestUrl = new URL(e.request.url);
  const sameOrigin = isSameOrigin(requestUrl);

  if (e.request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const appShellCandidates = [
          './index.html',
          './',
          new URL('./index.html', self.location.href).toString(),
          new URL('./', self.location.href).toString(),
        ];

        for (const candidate of appShellCandidates) {
          const cachedShell = await caches.match(candidate);
          if (cachedShell) {
            return cachedShell;
          }
        }

        try {
          const preloadResponse = await e.preloadResponse;
          if (preloadResponse) {
            const cache = await caches.open(APP_CACHE);
            cache.put('./index.html', preloadResponse.clone());
            return preloadResponse;
          }

          const networkResponse = await fetch(e.request);
          const cache = await caches.open(APP_CACHE);
          cache.put('./index.html', networkResponse.clone());
          return networkResponse;
        } catch {
          const cachedPage = await caches.match('./index.html');
          if (cachedPage) return cachedPage;

          return new Response(
            '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050608;color:#f5f7ff;font-family:Segoe UI,sans-serif}main{padding:20px;text-align:center;max-width:420px}h1{font-size:1.2rem;margin:0 0 .6rem}p{opacity:.88;line-height:1.45}</style></head><body><main><h1>Sin conexión</h1><p>Abre la app al menos una vez con internet para guardar la interfaz offline.</p></main></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
    return;
  }

  if (sameOrigin && isStaticAsset(requestUrl.pathname)) {
    e.respondWith(
      (async () => {
        const cachedResponse = await caches.match(e.request);
        const networkResponse = await fetch(e.request)
          .then(async (networkResponse) => {
            const cache = await caches.open(APP_CACHE);
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || networkResponse || Response.error();
      })()
    );
    return;
  }

  if (isThirdPartyAsset(requestUrl)) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(e.request);

        try {
          const networkResponse = await fetch(e.request);
          // Aceptar respuestas opaque para recursos CORS de CDNs.
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            cache.put(e.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(async (networkResponse) => {
        if (sameOrigin) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(e.request, networkResponse.clone());
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(e.request);
        return cachedResponse || Response.error();
      })
  );
});

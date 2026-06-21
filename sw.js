const APP_CACHE = 'velocimetro-app-v3';
const RUNTIME_CACHE = 'velocimetro-runtime-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg'
];

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isStaticAsset(pathname) {
  return /\.(?:css|js|json|svg|png|jpg|jpeg|webp|ico|html)$/.test(pathname);
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
        try {
          const preloadResponse = await e.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }

          const networkResponse = await fetch(e.request);
          const cache = await caches.open(APP_CACHE);
          cache.put('./index.html', networkResponse.clone());
          return networkResponse;
        } catch {
          const cachedPage = await caches.match('./index.html');
          return cachedPage || Response.error();
        }
      })()
    );
    return;
  }

  if (sameOrigin && isStaticAsset(requestUrl.pathname)) {
    e.respondWith(
      (async () => {
        const cachedResponse = await caches.match(e.request);
        const networkPromise = fetch(e.request)
          .then(async (networkResponse) => {
            const cache = await caches.open(APP_CACHE);
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          })
          .catch(() => null);

        return cachedResponse || networkPromise || Response.error();
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

const CACHE_NAME = 'focofacil-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/favicon.png',
  '/manifest.json'
];

// Instalação do Service Worker e caching de recursos essenciais
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Usa a opção de addAll com tratamento de erros individuais se necessário
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Limpeza de caches antigos na ativação
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de requisições: Stale-While-Revalidate
self.addEventListener('fetch', (e) => {
  // Evita cachear chamadas de API de sincronização
  if (e.request.url.includes('/api/sync')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Atualiza o cache silenciosamente em background
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignora falhas de rede offline
          });
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});

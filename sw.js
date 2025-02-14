// sw.js

const CACHE_NAME = 'v1';
const urlsToCache = [
  '/',             
  '/index.html',   
  '/styles.css',
  '/script.js'
];

// Installazione: pre-caching delle risorse essenziali
self.addEventListener('install', event => {
  console.log('Service Worker installato');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching delle risorse predefinite');
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.error(`Errore durante il caching di ${url}:`, err);
            });
          })
        );
      })
      .catch(err => console.error('Errore durante il pre-caching:', err))
  );
  self.skipWaiting();
});

// Attivazione: pulizia delle cache vecchie
self.addEventListener('activate', event => {
  console.log('Service Worker attivato');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercetta le richieste fetch e utilizza la rete, con fallback sulla cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        let responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cacheResponse => {
            if (cacheResponse) {
              return cacheResponse;
            }
            return new Response('Resource not available', {
              status: 404,
              statusText: 'Resource not available'
            });
          });
      })
  );
});
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open('static-cache').then(cache => {
            return cache.addAll([
                './index.html',
                './customer.html',
                './styles.css',
                './script.js',
                './manifest.json'
            ]).catch(err => console.log('Errore durante il caching:', err));
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).catch(() => caches.match('/offline.html'));
        })
    );
});

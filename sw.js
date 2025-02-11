// sw.js
self.addEventListener('install', event => {
  console.log('Service Worker installato');
  // Qui puoi aprire un cache e memorizzare le risorse statiche se lo desideri
});

self.addEventListener('fetch', event => {
  // Strategia di fetch semplice: rete prima
  event.respondWith(fetch(event.request));
});

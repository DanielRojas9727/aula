// Service worker: guarda la app para abrir rápido y sin conexión. Los datos los maneja Firestore.
// Para publicar una versión nueva, cambia el número de V.
const V = 'aula-v2';
const ASSETS = ['./', 'index.html', 'app.css', 'app.js', 'data.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Red primero sin caché HTTP (para recibir actualizaciones al instante); copia local si no hay conexión
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

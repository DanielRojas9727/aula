// Service worker: guarda la app para abrir rápido y sin conexión. Los datos los maneja Firestore.
// Para publicar una versión nueva, cambia el número de V.
const V = 'aula-v6';
const SDK = 'aula-sdk-10.12.2'; // librerías de Firebase (versión fija): se guardan para funcionar sin conexión
const ASSETS = ['./', 'index.html', 'app.css', 'app.js', 'data.js', 'reorg.js', 'stats.js', 'firebase-config.js', 'manifest.webmanifest', 'icon-192.png'];
const SDK_URLS = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => 'https://www.gstatic.com/firebasejs/10.12.2/' + f);
self.addEventListener('install', (e) => { e.waitUntil(Promise.all([
  caches.open(V).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))),
  caches.open(SDK).then((c) => c.addAll(SDK_URLS)).catch(() => {}), // si falla, se guardan al primer uso
])); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V && k !== SDK).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK).then((c) => c.match(e.request).then((r) => r || fetch(e.request).then((n) => { if (n.ok) c.put(e.request, n.clone()); return n; }))));
    return;
  }
  if (u.origin !== location.origin) return;
  // Red primero sin caché HTTP (para recibir actualizaciones al instante); copia local si no hay conexión
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

// Naikkan versi ini setiap kali file aplikasi diubah agar HP mengunduh versi baru
const CACHE = 'dompetku-v7';
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Utamakan jaringan (selalu cek versi terbaru ke server), pakai cache saat offline
self.addEventListener('fetch', (e) => {
  // Hanya file aplikasi sendiri; permintaan ke luar (mis. Gemini) dibiarkan langsung ke jaringan
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(new Request(e.request.url, { cache: 'no-cache' }))
      .then((res) => {
        // Hanya simpan jawaban yang berhasil, agar halaman error tidak menimpa salinan offline
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

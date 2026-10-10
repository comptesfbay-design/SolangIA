// Service worker : garde une copie des fichiers de l'app pour fonctionner hors connexion.
// À chaque mise en ligne, changer VERSION ici ET dans js/version.js (le test le vérifie).
const VERSION = '0.3.0';
const CACHE = `suivi-chantier-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/backup.js',
  './js/db.js',
  './js/model.js',
  './js/photos.js',
  './js/ui.js',
  './js/version.js',
  './js/zip.js',
  './vendor/jszip.min.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // `cache: 'reload'` : on ignore le cache HTTP pour être sûr d'avoir les nouveaux fichiers.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('suivi-chantier-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// L'app demande d'activer la nouvelle version quand on touche « Mettre à jour ».
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      return await fetch(req);
    } catch (e) {
      if (req.mode === 'navigate') return caches.match('./index.html');
      throw e;
    }
  })());
});

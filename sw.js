// کش آفلاین اپ
const CACHE = 'sarresid-v1';
const ASSETS = [
  './',
  'css/app.css',
  'fonts/Vazirmatn.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/app.js',
  'js/db.js',
  'js/ink.js',
  'js/jalali.js',
  'js/lock.js',
  'js/pickers.js',
  'js/tasks-common.js',
  'js/util.js',
  'js/views/agreements.js',
  'js/views/notes.js',
  'js/views/people.js',
  'js/views/search.js',
  'js/views/settings.js',
  'js/views/tasks.js',
  'js/views/today.js',
  'manifest.webmanifest',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // ابتدا از کش (آفلاین)، و هم‌زمان به‌روزرسانی از شبکه
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === 'navigate' ? c.match('./index.html') : Response.error());
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});

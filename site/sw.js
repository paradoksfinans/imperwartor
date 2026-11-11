/**
 * Service Worker für imperWARtor.
 *
 * Aufgabe: Das Spiel nach dem ersten Besuch offline verfügbar machen.
 * Vorgehen - zuerst das Netz, bei Erfolg den Zwischenspeicher auffrischen,
 * bei Misserfolg aus dem Zwischenspeicher liefern. So bekommt man beim
 * nächsten Besuch die neue Fassung, ohne offline auf dem Trockenen zu sitzen.
 */

const LAGER = 'imperwartor-202611112234';
const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './symbol.svg',
  './symbol-192.png',
  './symbol-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(LAGER)
      .then((c) => c.addAll(DATEIEN))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n !== LAGER).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(LAGER).then((c) => c.put(e.request, kopie)).catch(() => {});
        return antwort;
      })
      .catch(() => caches.match(e.request).then((t) => t || caches.match('./index.html'))),
  );
});

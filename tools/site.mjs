/**
 * Baut aus der Einzeldatei die veroeffentlichbare Web-Fassung.
 *
 * Unterschied zur Einzeldatei: Diese Fassung laesst sich auf dem iPhone
 * ueber "Zum Home-Bildschirm" wie eine App ablegen. Dafuer braucht es
 *   - ein Manifest (Name, Symbol, Vollbild),
 *   - einen Service Worker, damit das Spiel auch ohne Netz startet,
 *   - Apple-eigene Angaben, weil Safari das Manifest nur teilweise liest,
 *   - und einen Hinweis, wie man es installiert: Safari fragt von sich aus
 *     nicht danach, und ohne Hinweis findet es fast niemand.
 *
 * Aufruf: node tools/site.mjs
 */

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const WURZEL = path.join(import.meta.dirname, '..');
const SITE = path.join(WURZEL, 'site');
/** Muss zum Ausgabeordner aus build.mjs passen. */
const GEBAUT = existsSync('/mnt/user-data')
  ? '/mnt/user-data/outputs'
  : path.join(WURZEL, 'dist');
const NAME = 'imperWARtor';
const KURZ = 'imperWARtor';
const BESCHREIBUNG =
  'Rundenbasiertes Strategiespiel auf der Landkarte: Antike bis 1914. '
  + 'Wirtschaft, Diplomatie, Spionage und Krieg - ohne Schlachtanimationen, '
  + 'dafuer mit offengelegter Rechnung.';

await mkdir(SITE, { recursive: true });

/* ------------------------------------------------------------------ */
/* Spiel einbetten                                                     */
/* ------------------------------------------------------------------ */

const spiel = await readFile(path.join(GEBAUT, 'imperwartor.html'), 'utf8');

/** Marke fuer den Zwischenspeicher - erzwingt beim Besucher die neue Fassung. */
const stand = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

const kopfZusatz = `
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./symbol.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="${KURZ}" />
    <meta property="og:title" content="${NAME}" />
    <meta property="og:description" content="${BESCHREIBUNG}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="./symbol-512.png" />
    <meta name="twitter:card" content="summary_large_image" />`;

const installHinweis = `
    <style>
      /* Hinweis zum Ablegen auf dem Home-Bildschirm. Nur auf iOS-Safari
         sichtbar und nur, solange die Seite nicht schon als App laeuft. */
      #install-hinweis {
        position: fixed; left: 50%; transform: translateX(-50%);
        bottom: calc(12px + env(safe-area-inset-bottom));
        z-index: 9999; display: none;
        width: min(460px, calc(100vw - 20px));
        background: linear-gradient(180deg, #1b2733, #121b23);
        border: 1px solid rgba(214,168,78,.5); border-radius: 15px;
        padding: 13px 15px; color: #e7eef5;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 16px 40px rgba(0,0,0,.55);
      }
      #install-hinweis b { color: #d6a84e; }
      #install-hinweis p { margin: 5px 0 10px; font-size: 13.5px; line-height: 1.5; color: #b7c4d0; }
      #install-hinweis button {
        background: #223243; color: #e7eef5; border: 1px solid rgba(255,255,255,.18);
        border-radius: 9px; padding: 8px 14px; font-size: 13px; cursor: pointer;
      }
    </style>
    <div id="install-hinweis" role="note">
      <b>Als App ablegen</b>
      <p>Unten in Safari auf <b>Teilen</b> tippen, dann
         <b>Zum Home-Bildschirm</b>. Danach startet ${NAME} im Vollbild und
         läuft auch ohne Netz.</p>
      <button type="button" id="install-weg">Verstanden</button>
    </div>
    <script>
      (function () {
        var hinweis = document.getElementById('install-hinweis');
        var weg = document.getElementById('install-weg');
        var SCHLUESSEL = 'imperwartor:install-hinweis-weg';
        function gesehen() {
          try { return localStorage.getItem(SCHLUESSEL) === '1'; } catch (e) { return false; }
        }
        var istIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
          || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var laeuftAlsApp = window.navigator.standalone === true
          || window.matchMedia('(display-mode: standalone)').matches;
        if (istIOS && !laeuftAlsApp && !gesehen()) {
          // Erst zeigen, wenn das Spiel steht - sonst liegt der Hinweis
          // ueber einer noch leeren Seite.
          setTimeout(function () { hinweis.style.display = 'block'; }, 2600);
        }
        weg.addEventListener('click', function () {
          hinweis.style.display = 'none';
          try { localStorage.setItem(SCHLUESSEL, '1'); } catch (e) { /* kein Speicher */ }
        });

        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function () {
            navigator.serviceWorker.register('./sw.js').catch(function () {
              /* Ohne Service Worker laeuft das Spiel trotzdem, nur nicht offline. */
            });
          });
        }
      })();
    </script>`;

let seite = spiel.replace('</head>', kopfZusatz + '\n  </head>');
seite = seite.replace('</body>', installHinweis + '\n  </body>');

await writeFile(path.join(SITE, 'index.html'), seite, 'utf8');

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

const manifest = {
  name: NAME,
  short_name: KURZ,
  description: BESCHREIBUNG,
  // Relativ, damit es unter jedem Unterpfad funktioniert - auf GitHub
  // Pages liegt die Seite nicht im Wurzelverzeichnis.
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#0d151d',
  theme_color: '#0d151d',
  lang: 'de',
  categories: ['games', 'strategy'],
  icons: [
    { src: './symbol-192.png', sizes: '192x192', type: 'image/png' },
    { src: './symbol-512.png', sizes: '512x512', type: 'image/png' },
    {
      src: './symbol-maskable-512.png', sizes: '512x512',
      type: 'image/png', purpose: 'maskable',
    },
  ],
};
await writeFile(
  path.join(SITE, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2) + '\n', 'utf8',
);

/* ------------------------------------------------------------------ */
/* Service Worker                                                      */
/* ------------------------------------------------------------------ */

const sw = `/**
 * Service Worker für ${NAME}.
 *
 * Aufgabe: Das Spiel nach dem ersten Besuch offline verfügbar machen.
 * Vorgehen - zuerst das Netz, bei Erfolg den Zwischenspeicher auffrischen,
 * bei Misserfolg aus dem Zwischenspeicher liefern. So bekommt man beim
 * nächsten Besuch die neue Fassung, ohne offline auf dem Trockenen zu sitzen.
 */

const LAGER = 'imperwartor-${stand}';
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
`;
await writeFile(path.join(SITE, 'sw.js'), sw, 'utf8');

/* GitHub Pages soll den Ordner nicht durch Jekyll schicken. */
await writeFile(path.join(SITE, '.nojekyll'), '', 'utf8');

/* Die Einzeldateien zum Herunterladen mit ausliefern. */
for (const d of ['imperwartor.html', 'imperwartor-klein.html']) {
  try {
    await copyFile(path.join(GEBAUT, d), path.join(SITE, d));
  } catch { /* nicht vorhanden - nicht schlimm */ }
}

const kb = (s) => (s.length / 1024).toFixed(1) + ' kB';
console.log('site/index.html           ', kb(seite));
console.log('site/manifest.webmanifest, sw.js, Symbole, .nojekyll');
console.log('Stand des Zwischenspeichers:', stand);

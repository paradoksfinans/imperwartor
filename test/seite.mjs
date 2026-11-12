/**
 * Prueft die veroeffentlichbare Web-Fassung in einem echten Browser.
 *
 * Geprueft wird, was auf dem iPhone ueber Erfolg oder Misserfolg entscheidet:
 *   - laedt das Spiel ohne Fehler,
 *   - findet der Browser Manifest und Symbole (sonst keine Installation),
 *   - meldet sich der Service Worker an (sonst kein Offline-Betrieb),
 *   - erscheint der Installationshinweis auf einem iPhone und
 *     bleibt er auf dem Schreibtischrechner aus.
 *
 * Es wird ueber einen echten Webserver geprueft, nicht ueber file:// -
 * Service Worker gibt es nur in einem sicheren Kontext.
 *
 * Aufruf: node test/seite.mjs
 */

import { chromium, devices } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = path.join(import.meta.dirname, '..', 'site');
/** Unterpfad wie auf GitHub Pages - deckt Fehler mit absoluten Pfaden auf. */
const BASIS = '/imperwartor';

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  let p = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!p.startsWith(BASIS)) { res.writeHead(404).end('ausserhalb'); return; }
  p = p.slice(BASIS.length) || '/';
  if (p.endsWith('/')) p += 'index.html';
  try {
    const daten = await readFile(path.join(SITE, p));
    res.writeHead(200, { 'content-type': TYPEN[path.extname(p)] ?? 'application/octet-stream' });
    res.end(daten);
  } catch {
    res.writeHead(404).end('nicht gefunden');
  }
});
await new Promise((f) => server.listen(0, '127.0.0.1', f));
const adresse = `http://127.0.0.1:${server.address().port}${BASIS}/`;
console.log('Server:', adresse);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

let fehler = 0;
const melde = (gut, text) => {
  console.log(`  ${gut ? 'ok  ' : 'FEHL'} ${text}`);
  if (!gut) fehler++;
};

/* ------------------------------------------------------------------ */
/* 1. iPhone                                                           */
/* ------------------------------------------------------------------ */

console.log('\niPhone 14');
{
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const seite = await ctx.newPage();

  const konsole = [];
  const netzFehler = [];
  seite.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  seite.on('pageerror', (e) => konsole.push('pageerror: ' + e.message));
  seite.on('response', (r) => { if (r.status() >= 400) netzFehler.push(`${r.status()} ${r.url()}`); });

  await seite.goto(adresse, { waitUntil: 'load' });
  await seite.waitForTimeout(1200);

  melde(await seite.locator('h1').first().innerText() === 'imperWARtor', 'Titel steht');
  melde(konsole.length === 0, `keine Konsolenfehler${konsole.length ? ': ' + konsole[0] : ''}`);
  melde(netzFehler.length === 0, `alle Dateien gefunden${netzFehler.length ? ': ' + netzFehler.join(', ') : ''}`);

  // Manifest: der Browser muss es wirklich geladen haben.
  const manifest = await seite.evaluate(async () => {
    const l = document.querySelector('link[rel=manifest]');
    if (!l) return null;
    const a = await fetch(l.href).then((r) => r.json()).catch(() => null);
    return a;
  });
  melde(manifest?.name === 'imperWARtor', 'Manifest lesbar, Name richtig');
  melde(manifest?.display === 'standalone', 'Vollbild (standalone) gesetzt');
  melde((manifest?.icons ?? []).length === 3, 'drei Symbole eingetragen');

  // Apple-Angaben - ohne die legt iOS kein brauchbares Symbol ab.
  const apple = await seite.evaluate(() => ({
    symbol: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    app: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    titel: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  }));
  melde(apple.symbol === './apple-touch-icon.png', 'apple-touch-icon verknuepft');
  melde(apple.app === 'yes', 'Vollbild fuer Safari erlaubt');
  melde(apple.titel === 'imperWARtor', 'App-Name fuer den Startbildschirm');

  // Service Worker
  const sw = await seite.evaluate(() => navigator.serviceWorker.ready
    .then((r) => ({ da: true, umfang: r.scope }))
    .catch((e) => ({ da: false, grund: String(e) })));
  melde(sw.da, `Service Worker angemeldet (${sw.umfang ?? sw.grund})`);
  melde(String(sw.umfang ?? '').endsWith(`${BASIS}/`), 'Umfang auf den Unterpfad begrenzt');

  // Installationshinweis - erscheint verzoegert
  await seite.waitForTimeout(2200);
  melde(await seite.locator('#install-hinweis').isVisible(), 'Installationshinweis erscheint');
  await seite.locator('#install-weg').click();
  melde(!(await seite.locator('#install-hinweis').isVisible()), 'Hinweis laesst sich wegtippen');

  // Nach dem Wegtippen bleibt er weg.
  const zweite = await ctx.newPage();
  await zweite.goto(adresse, { waitUntil: 'load' });
  await zweite.waitForTimeout(3400);
  melde(!(await zweite.locator('#install-hinweis').isVisible()), 'Hinweis kommt nicht wieder');

  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 2. Schreibtischrechner                                              */
/* ------------------------------------------------------------------ */

console.log('\nSchreibtisch 1440x900');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const seite = await ctx.newPage();
  const konsole = [];
  seite.on('console', (m) => { if (m.type() === 'error') konsole.push(m.text()); });
  seite.on('pageerror', (e) => konsole.push('pageerror: ' + e.message));
  await seite.goto(adresse, { waitUntil: 'load' });
  await seite.waitForTimeout(3400);
  melde(konsole.length === 0, `keine Konsolenfehler${konsole.length ? ': ' + konsole[0] : ''}`);
  melde(!(await seite.locator('#install-hinweis').isVisible()), 'kein iPhone-Hinweis am Rechner');

  // Eine Partie wirklich starten - die Seite darf nicht nur im Menue laufen.
  await seite.locator('[data-neues-spiel]').click();
  await seite.waitForTimeout(600);
  await seite.locator('[data-starten]').click();
  await seite.waitForTimeout(1400);
  // Die Karte gilt als da, wenn wirklich Gebietsflaechen gezeichnet sind.
  const gebiete = await seite.locator("svg path[data-province]").count();
  melde(gebiete > 50, `Karte gezeichnet (${gebiete} Flaechen)`);
  melde(konsole.length === 0, `Partie ohne Fehler${konsole.length ? ': ' + konsole[0] : ''}`);
  await seite.screenshot({ path: '/tmp/seite-desktop.png' });
  await ctx.close();
}

/* ------------------------------------------------------------------ */
/* 3. Offline                                                          */
/* ------------------------------------------------------------------ */

console.log('\nOhne Netz');
{
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const seite = await ctx.newPage();
  await seite.goto(adresse, { waitUntil: 'load' });
  await seite.evaluate(() => navigator.serviceWorker.ready);
  await seite.waitForTimeout(1500);

  await ctx.setOffline(true);
  const zweite = await ctx.newPage();
  const konsole = [];
  zweite.on('pageerror', (e) => konsole.push(e.message));
  await zweite.goto(adresse, { waitUntil: 'load' }).catch((e) => konsole.push(String(e)));
  await zweite.waitForTimeout(900);
  const titel = await zweite.locator('h1').first().innerText().catch(() => '');
  melde(titel === 'imperWARtor', `Spiel startet ohne Netz (gelesen: "${titel}")`);
  await ctx.close();
}

await browser.close();
server.close();

console.log(fehler === 0 ? '\nAlles in Ordnung.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);

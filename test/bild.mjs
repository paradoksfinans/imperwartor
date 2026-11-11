/**
 * Macht Bildschirmfotos der fertigen HTML-Datei in einem echten Browser.
 *
 * Erst damit laesst sich die Gestaltung wirklich pruefen: Ueberlappungen,
 * Farbwirkung und Lesbarkeit sieht man nicht in Zahlen.
 *
 * Aufruf: node test/bild.mjs [szenarioIndex] [name]
 */
import { chromium } from 'playwright-core';
import path from 'node:path';

const DATEI = 'file:///mnt/user-data/outputs/imperwartor.html';
const AUS = '/tmp/bilder';

const szenarioIndex = Number(process.argv[2] ?? 0);
const markierung = process.argv[3] ?? 'a';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

/** Klickt ueber das Dokument statt mit dem Zeiger: Ueberlagerungen wie das
    Bottom-Sheet fangen echte Zeigerklicks ab und lassen den Test haengen. */
async function tippe(seite, auswahl, index = 0) {
  return seite.evaluate(([sel, i]) => {
    const el = document.querySelectorAll(sel)[i];
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }, [auswahl, index]);
}

async function schiess(seite, name) {
  const ziel = path.join(AUS, `${markierung}-${name}.png`);
  await seite.screenshot({ path: ziel });
  console.log('  ' + ziel);
}

/* ---------------- Telefon ---------------- */
const telefon = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const t = await telefon.newPage();
const meldungen = [];
t.on('console', (m) => { if (m.type() === 'error') meldungen.push(m.text()); });
t.on('pageerror', (e) => meldungen.push('pageerror: ' + e.message));

await t.goto(DATEI, { waitUntil: 'load' });
await t.waitForTimeout(700);
await schiess(t, 'tel-01-menue');

await tippe(t, '[data-neues-spiel]');
await t.waitForTimeout(500);
await tippe(t, '[data-szenario]', szenarioIndex);
await t.waitForTimeout(600);
await schiess(t, 'tel-02-aufbau');

await tippe(t, '[data-starten]');
await t.waitForTimeout(800);
await schiess(t, 'tel-03-karte');

/* Ein eigenes Gebiet antippen */
const anzahl = (await t.$$('[data-province]')).length;
for (let i = 0; i < Math.min(anzahl, 50); i++) {
  await tippe(t, '[data-province]', i);
  await t.waitForTimeout(200);
  const txt = await t.evaluate(() => document.querySelector('.sheet')?.textContent || '');
  if (/Aushebung|Verlegen/.test(txt)) break;
  await tippe(t, '[data-sheet-zu]');
  await t.waitForTimeout(60);
}
await schiess(t, 'tel-04-gebiet');

await tippe(t, '[data-sheet-zu]');
await t.waitForTimeout(200);
for (const p of ['diplomatie', 'militaer', 'rangliste']) {
  await tippe(t, `.reiterleiste [data-panel="${p}"]`);
  await t.waitForTimeout(400);
  await schiess(t, 'tel-05-' + p);
  await tippe(t, '[data-sheet-zu]');
  await t.waitForTimeout(150);
}

/* Runden bis zu einem Ereignis */
for (let i = 0; i < 6; i++) {
  if (await t.$('.modal button')) {
    await schiess(t, 'tel-06-modal');
    await tippe(t, '.modal button');
    await t.waitForTimeout(250);
  }
  if (!(await tippe(t, '[data-runde]'))) break;
  await t.waitForTimeout(420);
}
await schiess(t, 'tel-07-spaeter');

/* ---------------- Rechner ---------------- */
const gross = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const g = await gross.newPage();
g.on('pageerror', (e) => meldungen.push('pageerror(gross): ' + e.message));
await g.goto(DATEI, { waitUntil: 'load' });
await g.waitForTimeout(600);
await tippe(g, '[data-neues-spiel]');
await g.waitForTimeout(400);
await tippe(g, '[data-szenario]', szenarioIndex);
await g.waitForTimeout(600);
await schiess(g, 'pc-01-aufbau');
await tippe(g, '[data-starten]');
await g.waitForTimeout(800);
await schiess(g, 'pc-02-karte');

const anzahl2 = (await g.$$('[data-province]')).length;
for (let i = 0; i < Math.min(anzahl2, 50); i++) {
  await tippe(g, '[data-province]', i);
  await g.waitForTimeout(170);
  const txt = await g.evaluate(() => document.querySelector('.gebietsleiste')?.textContent || '');
  if (/Aushebung/.test(txt)) break;
}
await schiess(g, 'pc-03-gebiet');

for (const p of ['militaer', 'wirtschaft', 'rangliste']) {
  await tippe(g, `.schiene [data-panel="${p}"]`);
  await g.waitForTimeout(400);
  await schiess(g, 'pc-04-' + p);
}

console.log('\nKonsolenfehler: ' + meldungen.length);
meldungen.slice(0, 8).forEach((m) => console.log('  - ' + m.slice(0, 250)));
await browser.close();

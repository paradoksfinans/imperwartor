/**
 * Misst, wie flüssig sich die Bedienung anfühlt.
 *
 * Zwei Dinge werden geprüft, die der Spieler unmittelbar merkt:
 *
 * 1. Wie lange ein Tipper braucht, bis das Bild mit der Antwort steht.
 *    Gemessen wird im Browser selbst, vom Klick bis zum zweiten Bildlauf -
 *    alles, was dieses Skript drumherum verbraucht, bliebe sonst in der Zahl
 *    stecken. Über etwa 100 ms empfindet man als träge.
 * 2. Ob ein einzelner Fingertipp genügt. Wird beim Zeichnen das Element
 *    unter dem Finger ausgetauscht, kommt gar kein Klick an - dann muss man
 *    mehrfach tippen. Deshalb wird mit echten Zeigerereignissen getippt,
 *    nicht mit element.click().
 *
 * Aufruf: node test/tempo.mjs
 */

import { chromium, devices } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const DATEI = process.env.SPIEL_DATEI ?? '/mnt/user-data/outputs/imperwartor.html';

const server = createServer(async (_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(await readFile(DATEI));
});
await new Promise((f) => server.listen(0, '127.0.0.1', f));
const adresse = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
// Ein Telefon rechnet deutlich langsamer als dieser Rechner. Ohne Bremse
// sieht hier alles schnell aus und auf dem iPhone ruckelt es trotzdem.
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
const seite = await ctx.newPage();
const cdp = await ctx.newCDPSession(seite);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const fehler = [];
seite.on('pageerror', (e) => fehler.push(e.message));
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });

let schlecht = 0;
const melde = (gut, text) => {
  console.log(`  ${gut ? 'ok  ' : 'FEHL'} ${text}`);
  if (!gut) schlecht++;
};

/**
 * Tippt wie ein Finger: einmal niederdrücken, einmal loslassen.
 *
 * Vorher wird geprüft, dass an der Stelle auch wirklich das gemeinte Element
 * liegt. Sonst misst man unbemerkt etwas anderes - genau darauf bin ich beim
 * Schreiben dieses Skripts schon einmal hereingefallen.
 */
async function tippe(wahl, { pruefen = true } = {}) {
  const el = seite.locator(wahl).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.scrollIntoViewIfNeeded();
  await seite.waitForTimeout(60);
  const k = await el.boundingBox();
  if (!k) throw new Error('kein Kasten: ' + wahl);
  const x = k.x + k.width / 2; const y = k.y + k.height / 2;
  if (pruefen) {
    // Auf dem gebremsten Geraet kann eine Einblendung noch unterwegs sein.
    // Kurz nachfassen, bevor das als Verdeckung gilt.
    let frei = false;
    for (let v = 0; v < 12 && !frei; v++) {
      frei = await el.evaluate((ziel, [px, py]) => {
        const oben = document.elementFromPoint(px, py);
        return !!oben && (ziel === oben || ziel.contains(oben));
      }, [x, y]);
      if (!frei) await seite.waitForTimeout(150);
    }
    if (!frei) {
      const wer = await seite.evaluate(([px, py]) => {
        const e = document.elementFromPoint(px, py);
        const k = []; let n = e;
        while (n && k.length < 4) { k.push(n.tagName + '.' + String(n.className || '')); n = n.parentElement; }
        return k.join(' < ');
      }, [x, y]);
      throw new Error(`dauerhaft verdeckt: ${wahl} -- davor liegt: ${wer}`);
    }
  }
  await seite.touchscreen.tap(x, y);
}

/**
 * Tippt den Schleier oberhalb des Blattes an - das schliesst es.
 *
 * Wichtig ist die Stelle: Der Schleier liegt ueber dem ganzen Bildschirm,
 * aber in der unteren Haelfte liegt das Blatt darueber. Ein Tipp in die
 * Mitte landet deshalb im Blatt und schliesst gar nichts.
 */
async function tippeNebenDasBlatt() {
  const { width } = seite.viewportSize();
  await seite.touchscreen.tap(width / 2, 60);
}

/* Erkennt das Blatt in beiden Bauweisen: in der neuen steht es dauerhaft im
   Geruest und wird aus- und eingeblendet, in der alten wurde es bei jedem
   Zeichnen neu erzeugt. So lassen sich beide Faessungen vergleichen. */
async function blattOffen() {
  return seite.evaluate(() => {
    const b = document.querySelector('.sheet');
    return !!b && !b.hidden && b.getBoundingClientRect().height > 10;
  });
}

/** Schliesst ein offenes Blatt, damit jede Messung gleich anfaengt. */
async function aufraeumen() {
  for (let i = 0; i < 4 && await blattOffen(); i++) {
    await tippeNebenDasBlatt();
    await seite.waitForTimeout(350);
  }
  if (await blattOffen()) throw new Error('Blatt laesst sich nicht schliessen.');
}

async function messe(name, wahl, runden = 5) {
  const zeiten = [];
  for (let i = 0; i < runden; i++) {
    await aufraeumen();
    await seite.evaluate(() => {
      window.__dauer = null;
      const start = () => {
        const t0 = performance.now();
        document.removeEventListener('click', start, true);
        // Zwei Bildlaeufe: der erste kommt nach dem Rechnen, der zweite
        // erst, wenn der Browser auch gezeichnet hat.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          window.__dauer = performance.now() - t0;
        }));
      };
      document.addEventListener('click', start, true);
    });
    await tippe(wahl);
    try {
      await seite.waitForFunction(() => window.__dauer !== null, null, { timeout: 5000 });
    } catch {
      throw new Error(`Bei "${wahl}" kam kein Klick an - der Tipp wurde verschluckt.`);
    }
    zeiten.push(await seite.evaluate(() => window.__dauer));
    await seite.waitForTimeout(150);
  }
  zeiten.sort((a, b) => a - b);
  const mittel = zeiten[Math.floor(zeiten.length / 2)];
  console.log(`  ${mittel < 100 ? 'ok  ' : 'ZÄH '} ${name.padEnd(26)} `
    + `${mittel.toFixed(0).padStart(4)} ms   (${zeiten.map((z) => z.toFixed(0)).join(', ')})`);
  if (mittel >= 100) schlecht++;
}

/* ------------------------------------------------------------------ */

await seite.goto(adresse, { waitUntil: 'load' });
await seite.waitForTimeout(800);

console.log('\nPartie starten');
await tippe('[data-neues-spiel]');
await seite.waitForTimeout(500);
await tippe('[data-starten]');
await seite.waitForTimeout(2500);
console.log('  Karte steht,', await seite.locator('svg polygon').count(), 'Flächen');
await tippe('[data-einstieg-aus]');
await seite.waitForTimeout(400);

console.log('\nAntwortzeiten (Telefon, vierfach gebremst)');
await messe('Kartenansicht wechseln', '[data-filter="terrain"]');
await messe('Bereich öffnen', '.reiterleiste [data-panel="wirtschaft"]');
await messe('Gebiet antippen', 'svg .gebiet.eigen');

console.log('\nEin Tipp genügt');
/* Der Kern der Beschwerde: "auf Schließen muss ich öfter tippen". */
for (let i = 1; i <= 4; i++) {
  await aufraeumen();
  await tippe('.reiterleiste [data-panel="diplomatie"]');
  await seite.waitForTimeout(350);
  const auf = await blattOffen();
  await tippeNebenDasBlatt();
  await seite.waitForTimeout(350);
  const zu = !(await blattOffen());
  melde(auf && zu, `Durchgang ${i}: ein Tipp öffnet (${auf}), ein Tipp schließt (${zu})`);
}

console.log('\nSchieben der Karte');
{
  await aufraeumen();
  const kasten = await seite.locator('.karte').first().boundingBox();
  const mx = kasten.x + kasten.width / 2; const my = kasten.y + kasten.height / 2;
  await seite.evaluate(() => {
    window.__bilder = 0;
    const zaehle = () => { window.__bilder++; requestAnimationFrame(zaehle); };
    requestAnimationFrame(zaehle);
  });
  const t0 = Date.now();
  await seite.mouse.move(mx, my);
  await seite.mouse.down();
  for (let i = 0; i < 30; i++) {
    await seite.mouse.move(mx - i * 4, my - i * 2);
  }
  await seite.mouse.up();
  const proSekunde = (await seite.evaluate(() => window.__bilder)) / ((Date.now() - t0) / 1000);
  console.log(`  ${proSekunde > 25 ? 'ok  ' : 'ZÄH '} `
    + `${proSekunde.toFixed(0)} Bilder je Sekunde beim Schieben`);
  if (proSekunde <= 25) schlecht++;
}

console.log('\nKonsole');
melde(fehler.length === 0, `${fehler.length} Fehler${fehler.length ? ': ' + fehler[0] : ''}`);

await browser.close();
server.close();
console.log(schlecht === 0 ? '\nAlles flüssig.' : `\n${schlecht} Punkte zäh oder fehlerhaft.`);
process.exit(schlecht === 0 ? 0 : 1);

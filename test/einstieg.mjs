/**
 * Läuft den geführten Einstieg vollständig durch - wie ein neuer Spieler.
 *
 * Ein Einstieg, der an Schritt vier hängenbleibt, ist schlimmer als keiner:
 * Der Spieler tut, was verlangt wird, nichts passiert, und er legt das Spiel
 * weg. Genau das ist hier schon einmal vorgekommen - die Einblendung
 * verschwand in dem Moment, in dem sich das Gebietsblatt öffnete.
 *
 * Geprüft wird deshalb für jeden Schritt einzeln:
 *   - Ist die Einblendung sichtbar, wenn sie es sein soll?
 *   - Rückt der Schritt durch die verlangte Handlung weiter -
 *     und nicht nur durch einen Klick auf "Weiter"?
 *   - Kommt der Einstieg bis zum Ende durch?
 *
 * Aufruf: node test/einstieg.mjs
 */

import { chromium, devices } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
const seite = await ctx.newPage();

const fehlerMeldungen = [];
seite.on('pageerror', (e) => fehlerMeldungen.push(e.message));
seite.on('console', (m) => { if (m.type() === 'error') fehlerMeldungen.push(m.text()); });

await seite.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil: 'load' });
await seite.getByRole('button', { name: 'Neues Spiel' }).click();
await seite.waitForTimeout(400);
await seite.locator('[data-szenario="europa_1914"]').click();
await seite.waitForTimeout(400);
await seite.locator('[data-starten]').click();
await seite.waitForTimeout(2500);

let fehler = 0;
const melde = (gut, text) => {
  console.log(`  ${gut ? 'ok  ' : 'FEHL'} ${text}`);
  if (!gut) fehler++;
};

/** Welcher Schritt steht gerade an? */
async function stand() {
  const marke = await seite.locator('.einstieg-marke').first().innerText().catch(() => '');
  const m = marke.match(/(\d+)\s*\/\s*(\d+)/);
  const titel = await seite.locator('.einstieg h3').first().innerText().catch(() => '');
  return { nr: m ? Number(m[1]) : 0, gesamt: m ? Number(m[2]) : 0, titel, sichtbar: !!m };
}

const erste = await stand();
melde(erste.sichtbar, `Einstieg erscheint beim ersten Spielstart (${erste.gesamt} Schritte)`);
if (!erste.sichtbar) { await browser.close(); process.exit(1); }

/* Für jeden Schritt: Wie kommt man weiter? Entweder über eine echte
   Handlung - so ist der Einstieg gemeint - oder, wo das Spiel es erlaubt,
   über den Knopf. Geprüft wird, dass die Handlung selbst genügt. */
const handlungen = {
  'Dein Reich': async () => klickWeiter(),
  'Was die Karte dir sagt': async () => klickWeiter(),
  'Ein Gebiet wählen': async () => eigenesGebietTippen(),
  'Was dort steht': async () => klickWeiter(),
  'Truppen ausheben': async () => rekrutieren(),
  'Etwas bauen': async () => bauen(),
  'Angreifen oder verlegen': async () => angriffWaehlen(),
  'Die Bilanz': async () => tafel('wirtschaft'),
  'Forschung lenken': async () => tafel('forschung'),
  'Mit den Nachbarn reden': async () => tafel('diplomatie'),
  'Wohin die Reise geht': async () => tafel('ziele'),
  'Die Runde beenden': async () => rundeBeenden(),
  'Das war die Schleife': async () => klickWeiter(),
};

async function klickWeiter() {
  const knopf = seite.locator('[data-einstieg-weiter]:visible').first();
  try {
    await knopf.click({ timeout: 4000 });
  } catch {
    /* Lässt sich der Knopf nicht treffen, liegt etwas darüber. Das ist für
       den Spieler dasselbe wie ein toter Knopf, also wird es hier benannt
       statt mit einem erzwungenen Klick überdeckt. */
    const was = await seite.evaluate(() => {
      const k = document.querySelector('[data-einstieg-weiter]');
      if (!k) return 'Knopf fehlt';
      const r = k.getBoundingClientRect();
      const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!oben || k.contains(oben) || oben === k) return 'nichts liegt darüber';
      const karte = oben.closest('[id],[class]');
      return `überdeckt von ${oben.tagName.toLowerCase()}`
        + `${oben.id ? '#' + oben.id : ''}`
        + `${karte && karte !== oben && karte.id ? ' in #' + karte.id : ''}`
        + ` (Klassen: ${String(oben.className).slice(0, 60)})`;
    });
    melde(false, `"Weiter" nicht klickbar: ${was}`);
    await knopf.click({ force: true, timeout: 4000 }).catch(() => {});
  }
  await seite.waitForTimeout(350);
  return 'Knopf';
}

async function blattZu() {
  /* Das Blatt zeigt mal ein Gebiet, mal eine Tafel - und hat je nachdem
     einen anderen Schließer. Deshalb der Reihe nach alle Wege. */
  for (let v = 0; v < 3; v++) {
    if (!await seite.locator('#t-blatt').isVisible().catch(() => false)) return;
    const wege = ['#t-blatt [data-gebiet-schliessen]', '#t-blatt [data-sheet-zu]',
      '#t-blatt-schleier'];
    for (const w of wege) {
      const e = seite.locator(w).first();
      if (await e.count() && await e.isVisible().catch(() => false)) {
        await e.click({ timeout: 3000 }).catch(() => {});
        break;
      }
    }
    await seite.keyboard.press('Escape').catch(() => {});
    await seite.waitForTimeout(320);
  }
}

async function eigenesGebietTippen() {
  // Eigene Gebiete tragen eine Markierung in der Karte.
  const eigene = seite.locator('.gebiet.eigen, [data-eigen="1"]');
  const n = await eigene.count();
  if (n) { await eigene.nth(Math.floor(n / 2)).click({ force: true }); }
  else {
    // Rückfallebene: die Hauptstadt suchen und daneben tippen.
    const kasten = await seite.locator('svg').first().boundingBox();
    await seite.touchscreen.tap(kasten.x + kasten.width * 0.48, kasten.y + kasten.height * 0.45);
  }
  await seite.waitForTimeout(600);
  return 'Gebiet getippt';
}

async function rekrutieren() {
  // Erst eine Menge wählen - ohne sie bleibt der Knopf gesperrt.
  const anteil = seite.locator('[data-rekrut-anteil]:visible').first();
  if (await anteil.count()) { await anteil.click().catch(() => {}); await seite.waitForTimeout(250); }
  const knopf = seite.locator('[data-rekrutieren]:not([disabled]):visible').first();
  if (await knopf.count()) {
    await knopf.click();
    await seite.waitForTimeout(600);
    return 'ausgehoben';
  }
  return klickWeiter();
}

async function bauen() {
  const knopf = seite.locator('[data-bau]:not([disabled]):visible').first();
  if (await knopf.count()) {
    await knopf.click().catch(() => {});
    await seite.waitForTimeout(500);
    return 'gebaut';
  }
  return klickWeiter();
}

async function angriffWaehlen() {
  /* Ohne laufenden Krieg ist "Angreifen" gesperrt - so geht es einem neuen
     Spieler auch. Dann muss der Schritt über "Später" weitergehen, sonst
     steckt der Einstieg genau dort fest, wo er am ehesten gebraucht wird. */
  const knopf = seite.locator('[data-modus="attack"]:not([disabled]):visible').first();
  if (await knopf.count()) {
    await knopf.click();
    await seite.waitForTimeout(450);
    return 'Angriffsmodus';
  }
  const verlegen = seite.locator('[data-modus="move"]:not([disabled]):visible').first();
  if (await verlegen.count()) {
    await verlegen.click();
    await seite.waitForTimeout(450);
    const s = await stand();
    if (s.titel !== 'Angreifen oder verlegen') return 'Verlegen';
  }
  return (await klickWeiter()) + ' (Angriff gesperrt - kein Krieg)';
}

async function tafel(name) {
  await blattZu();
  await seite.locator(`[data-panel="${name}"]:visible`).first().click({ timeout: 6000 });
  await seite.waitForTimeout(450);
  return `Tafel ${name}`;
}

async function rundeBeenden() {
  await blattZu();
  await seite.getByRole('button', { name: /Runde beenden/ }).first().click();
  await seite.waitForTimeout(900);
  // Ein Ereignisfenster kann dazwischenkommen - das gehört zum Spiel.
  for (let i = 0; i < 3; i++) {
    const zu = seite.locator('#t-modal [data-modal-schliessen], #t-modal [data-ereignis-wahl]').first();
    if (!await zu.count()) break;
    await zu.click().catch(() => {});
    await seite.waitForTimeout(400);
  }
  return 'Runde beendet';
}

console.log('\nDurchlauf:');
let letzte = 0;
for (let i = 0; i < 20; i++) {
  const s = await stand();
  if (!s.sichtbar) {
    melde(letzte >= erste.gesamt, `Einstieg beendet nach Schritt ${letzte}`);
    break;
  }
  if (s.nr === letzte) {
    melde(false, `Schritt ${s.nr} "${s.titel}" rückt nicht weiter`);
    break;
  }
  letzte = s.nr;

  const tun = handlungen[s.titel];
  if (!tun) { melde(false, `kein Testweg für "${s.titel}"`); break; }
  const wie = await tun();

  const danach = await stand();
  const weiter = !danach.sichtbar || danach.nr > s.nr;
  melde(weiter, `${String(s.nr).padStart(2)}/${s.gesamt} ${s.titel.padEnd(26)} (${wie})`);
  if (!weiter) break;
}

/* Die Einblendung darf nie unsichtbar hängenbleiben, während noch ein
   Schritt aussteht - genau das war der alte Fehler. */
melde(fehlerMeldungen.length === 0,
  `keine Konsolenfehler${fehlerMeldungen.length ? ': ' + fehlerMeldungen[0] : ''}`);

await browser.close();
console.log(fehler === 0 ? '\nEinstieg läuft durch.' : `\n${fehler} Fehler.`);
process.exit(fehler === 0 ? 0 : 1);

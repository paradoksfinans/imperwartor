/**
 * Misst, wie schnell das Spiel auf Eingaben reagiert.
 *
 * Der Vorwurf lautet: Es ruckelt, und ein Tipp auf "Schließen" muss oft
 * wiederholt werden.
 *
 * Gemessen wird ausschliesslich innerhalb der Seite: von dem Augenblick, in
 * dem der Browser die Berührung meldet, bis zu dem Bild, das danach steht.
 * Die Fernsteuerung des Testbrowsers darf nicht mitgezaehlt werden, sonst
 * misst man die Leitung statt das Spiel.
 *
 * Gemessen wird mit gedrosselter Rechenleistung, weil ein Telefon deutlich
 * langsamer rechnet als dieser Rechner.
 *
 * Aufruf: node test/tempo.mjs [--klein] [--drossel N]
 */

import { chromium, devices } from 'playwright-core';

const args = process.argv.slice(2);
const DATEI = args.includes('--klein')
  ? '/mnt/user-data/outputs/imperwartor-klein.html'
  : '/mnt/user-data/outputs/imperwartor.html';
const i = args.indexOf('--drossel');
/** So viel langsamer als dieser Rechner rechnet ein mittleres Telefon. */
const DROSSEL = i >= 0 ? Number(args[i + 1]) : 4;

/** Ab hier fühlt sich eine Antwort nicht mehr sofort an. */
const GRENZE = 120;

export async function messe({ drossel = DROSSEL, datei = DATEI, still = false } = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const seite = await ctx.newPage();
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });

  await seite.goto('file://' + datei, { waitUntil: 'load' });
  const cdp = await ctx.newCDPSession(seite);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: drossel });
  const sag = (...a) => { if (!still) console.log(...a); };
  sag(`Rechenleistung auf 1/${drossel} gedrosselt (Telefon-Nähe)\n`);

  await seite.getByRole('button', { name: 'Neues Spiel' }).click();
  await seite.waitForTimeout(400);
  await seite.locator('[data-szenario="europa_1914"]').click();
  await seite.waitForTimeout(400);
  await seite.locator('[data-starten]').click();
  await seite.waitForTimeout(2500);
  await seite.locator('[data-einstieg-aus]').click().catch(() => {});
  await seite.waitForTimeout(500);

  /* Die Uhr laeuft in der Seite: Startpunkt ist der Zeitstempel, den der
     Browser der Beruehrung selbst mitgibt, Endpunkt das naechste fertige
     Bild. Dazwischen liegt genau das, was der Spieler als Verzoegerung
     empfindet - und nichts von der Fernsteuerung. */
  await seite.evaluate(() => {
    window.__proben = [];
    const horch = (e) => {
      const anDispatch = performance.now();
      const warten = anDispatch - e.timeStamp;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        window.__proben.push({ warten, arbeit: performance.now() - anDispatch });
      }));
    };
    /* Gemessen wird ab dem Klick, nicht ab dem Aufsetzen des Fingers:
       Zwischen Aufsetzen und Abheben liegt die Beruehrung selbst, und deren
       Dauer bestimmt der Mensch, nicht das Spiel. Was als Traegheit
       empfunden wird, ist die Spanne vom Abheben bis zum neuen Bild.
       In der Erfassungsphase, damit die Uhr vor den Spielhandlungen laeuft. */
    document.addEventListener('click', horch, true);
  });

  const umfang = await seite.evaluate(() => ({
    flaechen: document.querySelectorAll('.gebiet').length,
    svg: document.querySelectorAll('svg *').length,
    gesamt: document.querySelectorAll('*').length,
  }));
  sag(`Karte: ${umfang.flaechen} Gebiete, ${umfang.svg} SVG-Knoten, ${umfang.gesamt} Knoten gesamt`);

  const beruehrung = await seite.evaluate(() => {
    const out = {};
    for (const w of ['button', '[data-sheet]', '.schiene button']) {
      const el = document.querySelector(w);
      if (el) out[w] = getComputedStyle(el).touchAction;
    }
    out.body = getComputedStyle(document.body).touchAction;
    return out;
  });
  sag('\ntouch-action der Bedienelemente (ohne "manipulation" wartet iOS ~300 ms):');
  let tippBremse = 0;
  for (const [w, v] of Object.entries(beruehrung)) {
    const gut = v === 'manipulation' || v === 'none';
    if (!gut) tippBremse++;
    sag(`  ${gut ? 'ok  ' : 'WARN'} ${w}: ${v}`);
  }

  /**
   * Misst eine Handlung.
   *
   * `vorbereiten` raeumt offene Blaetter und Fenster weg - das sind selbst
   * Tipps, und sie wuerden die Messung verfaelschen. Erst danach laeuft die
   * Uhr an, und gemessen wird allein der Tipp, um den es geht.
   *
   * Von jedem Durchgang bleiben zwei Zahlen:
   *   warten - bis der Browser das Ereignis zustellt (Taktung, nicht Spiel)
   *   arbeit - vom Eintreffen bis zum fertigen Bild (das ist das Spiel)
   */
  async function miss(name, vorbereiten, tun, runden = 6) {
    const arbeit = [];
    for (let k = 0; k < runden; k++) {
      await vorbereiten(k);
      await seite.evaluate(() => { window.__proben = []; });
      await tun(k);
      await seite.waitForTimeout(320);
      const p = await seite.evaluate(() => window.__proben.slice());
      if (p.length) arbeit.push(p[0].arbeit);
    }
    if (!arbeit.length) { sag(`  ?    ${name}: keine Messwerte`); return { name, mitte: 0, hoch: 0 }; }
    arbeit.sort((a, b) => a - b);
    const mitte = arbeit[Math.floor(arbeit.length / 2)];
    const hoch = arbeit[arbeit.length - 1];
    sag(`  ${hoch < GRENZE ? 'ok  ' : 'LANGSAM'} ${name}: Mitte ${mitte.toFixed(0)} ms, längste ${hoch.toFixed(0)} ms`);
    return { name, mitte, hoch };
  }

  sag('\nAntwortzeiten (Berührung bis fertiges Bild, in der Seite gemessen):');
  const kasten = await seite.locator('svg').first().boundingBox();
  const werte = [];
  werte.push(await miss('Gebiet antippen',
    async () => { await fensterWeg(); await blattSchliessen(); },
    async (k) => seite.touchscreen.tap(kasten.x + 90 + k * 31, kasten.y + 200 + k * 25)));

  /* Nach dem Gebietstipp liegt auf dem Telefon ein Blatt ueber der Leiste.
     Es muss weg, sonst misst man nur Wartezeit auf einen verdeckten Knopf. */
  /* Nach "Runde beenden" liegt oft ein Ereignisfenster auf dem Schirm.
     Das gehört zum Spiel, stört aber die Messung der nächsten Handlung. */
  async function fensterWeg() {
    for (let v = 0; v < 4; v++) {
      const zu = seite.locator('#t-modal [data-modal-schliessen], #t-modal [data-ereignis-wahl]').first();
      if (!await zu.count()) return;
      await zu.tap().catch(() => {});
      await seite.waitForTimeout(300);
    }
  }

  async function blattSchliessen() {
    await fensterWeg();
    for (let v = 0; v < 3; v++) {
      if (!await seite.locator('#t-blatt').isVisible().catch(() => false)) return;
      await seite.keyboard.press('Escape');
      await seite.waitForTimeout(300);
    }
  }
  await blattSchliessen();

  const reiter = ['ziele', 'diplomatie', 'militaer', 'wirtschaft', 'forschung'];
  werte.push(await miss('Leiste wechseln',
    async () => { await fensterWeg(); await blattSchliessen(); },
    async (k) => seite.locator(`[data-panel="${reiter[k % reiter.length]}"]:visible`).first().tap()));
  await blattSchliessen();

  werte.push(await miss('Runde beenden',
    async () => { await fensterWeg(); await blattSchliessen(); },
    async () => seite.getByRole('button', { name: /Runde beenden/ }).first().tap(), 4));
  await fensterWeg();

  /* Schliesst ein einzelner Tipp das Blatt?
     Das war der Vorwurf: "ich muss auf schliessen oefter tippen". Geprueft
     wird der Schliessen-Knopf im Gebietsblatt, nicht der Schleier - der
     Knopf ist das, was der Spieler trifft. */
  sag('\nSchließen mit einem Tipp:');
  let verschluckt = 0; let laeufe = 0;
  for (let k = 0; k < 8; k++) {
    await fensterWeg();
    await seite.touchscreen.tap(kasten.x + 95 + k * 27, kasten.y + 210 + k * 22);
    await seite.waitForTimeout(350);
    if (!await seite.locator('#t-blatt').isVisible().catch(() => false)) continue;
    const zu = seite.locator('#t-blatt [data-gebiet-schliessen]').first();
    if (!await zu.count()) { sag('  kein Schließen-Knopf im Blatt'); break; }
    laeufe++;
    await zu.tap();
    await seite.waitForTimeout(350);
    if (await seite.locator('#t-blatt').isVisible().catch(() => false)) {
      verschluckt++;
      await blattSchliessen();
    }
  }
  sag(verschluckt === 0
    ? `  ok   alle ${laeufe} Tipps haben geschlossen`
    : `  FEHL ${verschluckt} von ${laeufe} Tipps verschluckt`);

  sag('\nKonsolenfehler: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  await browser.close();
  return { werte, verschluckt, laeufe, tippBremse, fehler, umfang };
}

if (import.meta.filename === process.argv[1]) {
  const e = await messe();
  const schlecht = e.werte.some((w) => w.hoch >= GRENZE) || e.verschluckt > 0 || e.tippBremse > 0;
  process.exit(schlecht ? 1 : 0);
}

/**
 * Klickt die fertige HTML-Datei in einer Browserumgebung durch.
 *
 * Geprueft wird unter den Bedingungen, die in einer Chat-Vorschau auf dem
 * Telefon gelten: schmales Fenster und gesperrter localStorage.
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const datei = process.argv[2] || '/mnt/user-data/outputs/empire-tactics.html';
const fehler = [];

const dom = new JSDOM(fs.readFileSync(datei, 'utf8'), {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.org/',
  beforeParse(w) {
    w.matchMedia = (q) => {
      const m = /max-width:\s*(\d+)/.exec(q);
      return {
        matches: m ? 390 <= parseInt(m[1], 10) : false,
        media: q, onchange: null,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, dispatchEvent() { return true; },
      };
    };
    Object.defineProperty(w, 'innerWidth', { value: 390 });
    Object.defineProperty(w, 'innerHeight', { value: 780 });
    // Abgeschotteter Rahmen: Speicher verweigert den Dienst
    Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } });
    w.scrollTo = () => {};
    if (!w.SVGElement.prototype.setPointerCapture) {
      w.SVGElement.prototype.setPointerCapture = function () {};
      w.SVGElement.prototype.releasePointerCapture = function () {};
    }
    w.AudioContext = undefined;
    w.onerror = (m, s, l, c, err) => fehler.push('onerror: ' + (err && err.stack || m));
    w.console.error = (...a) => fehler.push('console.error: ' + a.map(String).join(' ').slice(0, 400));
  },
});

const { window } = dom;
const doc = window.document;
const alle = (sel) => [...doc.querySelectorAll(sel)];
const klick = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => (doc.getElementById('app')?.textContent || '').replace(/\s+/g, ' ');

function tipp(el) {
  const o = { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 };
  el.dispatchEvent(new window.PointerEvent('pointerdown', o));
  el.dispatchEvent(new window.PointerEvent('pointerup', o));
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

const pruefungen = [];
function pruefe(name, bedingung, zusatz = '') {
  pruefungen.push({ name, ok: !!bedingung, zusatz });
  console.log(`${bedingung ? ' ok ' : 'FEHL'}  ${name}${zusatz ? '  (' + zusatz + ')' : ''}`);
}

(async () => {
  await warte(500);
  pruefe('Startbildschirm erscheint', doc.getElementById('app')?.children.length > 0);
  pruefe('Ladehinweis verschwindet', !doc.getElementById('boot'));

  klick(alle('button').find((b) => /Neues Spiel/.test(b.textContent)));
  await warte(350);
  pruefe('Aufbaubildschirm', /Neue Partie/.test(text()));
  const gebieteVorschau = alle('[data-province]').length;
  pruefe('Vorschaukarte zeichnet Gebiete', gebieteVorschau > 10, gebieteVorschau + ' Gebiete');

  // Szenario wechseln
  const szenarien = alle('[data-szenario]');
  pruefe('Mehrere Szenarien', szenarien.length >= 5, szenarien.length + ' Szenarien');
  if (szenarien[1]) { klick(szenarien[1]); await warte(400); }
  pruefe('Szenariowechsel ohne Fehler', fehler.length === 0);

  klick(alle('button').find((b) => /Partie starten/.test(b.textContent)));
  await warte(450);
  pruefe('Spielbildschirm', /Runde/.test(text()));
  pruefe('Karte vorhanden', !!doc.querySelector('.karte-svg'));
  pruefe('Reiterleiste (schmal)', !!doc.querySelector('.reiterleiste'));

  // Gebiet antippen bis ein eigenes dabei ist
  let gebietOffen = false;
  for (const f of alle('[data-province]')) {
    tipp(f);
    await warte(160);
    const sheet = doc.querySelector('.sheet');
    if (sheet && /Aushebung|Verlegen/.test(sheet.textContent)) { gebietOffen = true; break; }
    const zu = doc.querySelector('[data-sheet-zu]');
    if (zu) klick(zu);
    await warte(60);
  }
  pruefe('Tipp auf eigenes Gebiet oeffnet Aktionen', gebietOffen);

  // Ziehen darf nicht auswaehlen
  const zu = doc.querySelector('[data-sheet-zu]'); if (zu) klick(zu);
  await warte(120);
  const svg = doc.querySelector('.karte-svg');
  if (svg) {
    svg.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, pointerId: 2, clientX: 40, clientY: 40 }));
    for (let i = 1; i <= 6; i++) {
      svg.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 40 + i * 12, clientY: 40 }));
    }
    svg.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 112, clientY: 40 }));
    klick(alle('[data-province]')[0]);
    await warte(150);
  }
  pruefe('Ziehen waehlt nicht aus', !doc.querySelector('.sheet'));

  // Alle Bereiche
  const fehlend = [];
  // Die Knoepfe nach jedem Neuzeichnen frisch suchen - alte Verweise zeigen
  // auf entfernte Elemente und erreichen den Empfaenger nicht mehr.
  const panelIds = alle('.reiterleiste [data-panel]').map((b) => b.getAttribute('data-panel'));
  for (const id of panelIds) {
    const b = doc.querySelector(`.reiterleiste [data-panel="${id}"]`);
    if (!b) { fehlend.push(id + '(Knopf fehlt)'); continue; }
    klick(b);
    await warte(140);
    const s = doc.querySelector('.sheet');
    if (!s || s.textContent.trim().length < 20) fehlend.push(id);
    const x = doc.querySelector('[data-sheet-zu]'); if (x) klick(x);
    await warte(60);
  }
  pruefe('Alle Bereiche liefern Inhalt', fehlend.length === 0, fehlend.join(', '));

  // Kartenfilter
  const filter = alle('[data-filter]');
  for (const f of filter) { klick(f); await warte(60); }
  pruefe('Alle Kartenansichten', filter.length >= 8, filter.length + ' Ansichten');

  // Runden spielen
  let runden = 0;
  for (let i = 0; i < 12; i++) {
    const modalKnopf = alle('.modal button')[0];
    if (modalKnopf) { klick(modalKnopf); await warte(130); }
    const beenden = alle('button').find((b) => /Runde beenden/.test(b.textContent));
    if (!beenden || beenden.disabled) break;
    klick(beenden);
    await warte(200);
    runden++;
  }
  pruefe('Mehrere Runden spielbar', runden >= 8, runden + ' Runden');
  pruefe('Anzeige lebt nach den Runden', text().length > 200);

  console.log('\nFehler gesamt: ' + fehler.length);
  fehler.slice(0, 10).forEach((f) => console.log('  - ' + f.slice(0, 300)));

  const durchgefallen = pruefungen.filter((p) => !p.ok).length;
  console.log(`Pruefungen: ${pruefungen.length - durchgefallen}/${pruefungen.length} bestanden`);
  process.exit(durchgefallen || fehler.length ? 1 : 0);
})().catch((e) => { console.error('Testabbruch:', e); process.exit(1); });

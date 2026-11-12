/**
 * Einstiegspunkt und Zusammenbau der Oberflaeche.
 *
 * Aufbau: ein einziger Anwendungszustand, eine Zeichenfunktion, ein
 * gebuendelter Klickempfaenger. Nach jeder Aktion wird neu gezeichnet - bei
 * dieser Menge an Anzeigen ist das einfacher und weniger fehleranfaellig als
 * punktuelle Aktualisierungen, und schnell genug: nur die Karte wird
 * weiterverwendet statt neu aufgebaut.
 */

import './ui/styles.css';

import type {
  BattleReport, Difficulty, GameState, UnitId, WarGoalId,
} from './core/types';
import {
  UNITS, UNIT_ORDER, maxActionPoints, regimentsTotal, regimentsCopy,
} from './core/rules';
import { createNewGame } from './core/setup';
import { endTurn, addLog } from './core/turn';
import {
  attackableTargets, estimatePower, movableTargets, moveRegiments, resolveBattle,
} from './core/combat';
import {
  build, hireGeneral, assignGeneral, recruit, maxAushebung,
  setResearchBudget, setTaxRate, startResearch,
} from './core/actions';
import { applyPeace, performDiplomacy } from './core/diplomacy';
import { applyEventEffects } from './core/events';
import { recalculateSupply } from './core/economy';
import { checkGameStatus } from './core/victory';
import { createRandom } from './core/rng';
import {
  AUTOSAVE_SLOT, autosave, deleteSave, downloadState, exportState,
  importState, loadGame, saveGame,
} from './core/save';
import { scenarios } from './data/index';

import { MapView, MAP_FILTERS, type MapFilterId, type SelectionMode } from './ui/map';
import { PANEL_TABS, gebietsAnsicht, kopfleiste, panelInhalt, type PanelId } from './ui/panels';
import {
  ereignisModal, friedensModal, kampfberichtModal, spielendeModal,
} from './ui/modals';
import { handbuchModal } from './ui/handbuch';
import { aufbauGeruest, hauptmenue, type SetupAuswahl } from './ui/screens';
import { esc } from './ui/dom';
import { spieleTon, setzeTon } from './ui/sound';
import {
  einstiegAbbrechen, einstiegErledigt, einstiegEreignis, einstiegHtml,
  einstiegLaeuft, einstiegStarten, einstiegWeiter,
} from './ui/einstieg';
import type { EinstiegEreignis } from './ui/einstieg';

/* ------------------------------------------------------------------ */
/* Anwendungszustand                                                   */
/* ------------------------------------------------------------------ */

type Bildschirm = 'menue' | 'aufbau' | 'spiel';

interface AppZustand {
  bildschirm: Bildschirm;
  spiel: GameState | null;

  /* Aufbau */
  setup: SetupAuswahl;
  vorschau: GameState | null;

  /* Spielbildschirm */
  panel: PanelId | null;
  gewaehltesGebiet: string | null;
  modus: SelectionMode;
  zielGebiet: string | null;
  truppenauswahl: Record<string, number>;
  rekrutGattung: UnitId;
  rekrutMenge: number;
  diploZiel: string | null;
  kriegsziel: WarGoalId;

  /* Darstellung */
  thema: 'dunkel' | 'hell';
  tonAn: boolean;
  sheetOffen: 'gebiet' | 'panel' | null;

  /* Ueberlagerungen */
  modal: string | null;
  /** Offenes Handbuchkapitel; "liste" zeigt am Telefon die Übersicht. */
  handbuchKapitel: string;
  handbuchListe: boolean;
  offenerBericht: BattleReport | null;
  meldung: { text: string; art: 'ok' | 'fehler' } | null;
  spielendeGezeigt: boolean;
}

const app: AppZustand = {
  bildschirm: 'menue',
  spiel: null,
  setup: { scenarioId: scenarios[0].id, countryId: scenarios[0].countries[0].id, difficulty: 'normal' },
  vorschau: null,
  panel: null,
  gewaehltesGebiet: null,
  modus: 'none',
  zielGebiet: null,
  truppenauswahl: {},
  rekrutGattung: 'infantry',
  rekrutMenge: 0,
  diploZiel: null,
  kriegsziel: 'conquest',
  thema: 'dunkel',
  tonAn: true,
  sheetOffen: null,
  modal: null,
  handbuchKapitel: 'ueberblick',
  handbuchListe: true,
  offenerBericht: null,
  meldung: null,
  spielendeGezeigt: false,
};

let karte: MapView | null = null;
let vorschauKarte: MapView | null = null;
let meldungsUhr = 0;

const wurzel = document.getElementById('app')!;

/** Beim ersten Zeichnen einer neuen Partie auf das eigene Reich zoomen. */
let aufReichZentrieren = false;

/**
 * true auf schmalen Geraeten - dort liegen die Bereiche in Blaettern.
 *
 * Die Grenze muss auf das Stylesheet passen. Sie stand hier einmal auf 900px,
 * im Stylesheet aber auf 880px: Zwischen 881 und 900 Pixeln blendete das
 * Stylesheet die Reiterleiste aus, waehrend der Code Schiene und Pult
 * weggelassen hatte - es gab dort schlicht keine Bedienung mehr.
 */
const SCHMAL = '(max-width: 880px)';
function istKompakt(): boolean {
  return window.matchMedia(SCHMAL).matches;
}

function melde(text: string, art: 'ok' | 'fehler' = 'ok'): void {
  app.meldung = { text, art };
  window.clearTimeout(meldungsUhr);
  meldungsUhr = window.setTimeout(() => { app.meldung = null; zeichneMeldung(); }, 3400);
  if (art === 'fehler') spieleTon('fehler');
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

/**
 * Zwischenspeicher der zuletzt geschriebenen Teilstücke.
 *
 * Früher baute jeder Tipper die gesamte Oberfläche neu auf. Das kostete auf
 * dem Telefon spürbar Zeit und riss - schlimmer - genau das Element unter dem
 * Finger weg. Ein Fingertipp löst nur dann einen Klick aus, wenn Nieder- und
 * Hochgehen dasselbe Element treffen; wurde dazwischen neu gebaut, verschluckte
 * der Browser den Tipp. Genau daher kam das "ich muss dreimal auf Schließen
 * tippen". Jetzt steht das Gerüst fest, und jedes Teilstück wird nur angefasst,
 * wenn sich sein HTML wirklich geändert hat.
 */
const teilStand = new Map<string, string>();
let geruestSteht = false;

function setzeTeil(id: string, html: string): void {
  if (teilStand.get(id) === html) return;
  teilStand.set(id, html);
  const el = document.getElementById(id);
  if (!el) return;
  // Die Bildlaufhöhe überlebt den Austausch - sonst springt eine lange
  // Tafel bei jeder Kleinigkeit wieder an den Anfang.
  const lauf = el.scrollTop;
  el.innerHTML = html;
  if (lauf) el.scrollTop = lauf;
}

function zeigeTeil(id: string, sichtbar: boolean): void {
  const el = document.getElementById(id);
  if (el && el.hidden === sichtbar) el.hidden = !sichtbar;
}

/** Verwirft das Gerüst - nötig beim Wechsel des Bildschirms. */
function geruestVerwerfen(): void {
  teilStand.clear();
  geruestSteht = false;
}

function zeichne(): void {
  document.documentElement.dataset.thema = app.thema === 'hell' ? 'hell' : 'dunkel';

  if (app.bildschirm === 'menue') {
    karte = null;
    vorschauKarte = null;
    geruestVerwerfen();
    wurzel.innerHTML = hauptmenue() + modalHuelle();
    return;
  }
  if (app.bildschirm === 'aufbau') {
    karte = null;
    geruestVerwerfen();
    zeichneAufbau();
    return;
  }
  zeichneSpiel();
}

function zeichneAufbau(): void {
  const alteKarte = vorschauKarte;
  wurzel.innerHTML = aufbauGeruest(app.setup, app.vorschau) + modalHuelle();

  const behaelter = document.getElementById('vorschau-karte');
  if (behaelter && app.vorschau) {
    // Die Karte wird nur bei Szenariowechsel neu gebaut - sonst ginge bei
    // jedem Klick der Zoom verloren.
    if (!alteKarte || alteKarte.kartenId !== app.vorschau.mapId) {
      vorschauKarte = new MapView(app.vorschau, {
        onSelect: (pid) => {
          const besitzer = app.vorschau?.provinces[pid]?.ownerId;
          if (besitzer) { app.setup.countryId = besitzer; baueVorschau(); zeichne(); }
        },
      });
    } else {
      vorschauKarte = alteKarte;
      vorschauKarte.setState(app.vorschau);
    }
    const eigene = app.vorschau.provinceOrder.filter(
      (id) => app.vorschau!.provinces[id].ownerId === app.setup.countryId,
    );
    vorschauKarte.setAuswahl(
      app.vorschau.countries[app.setup.countryId]?.capitalProvinceId ?? null, 'none', eigene,
    );
    behaelter.appendChild(vorschauKarte.element);
  }
}

/**
 * Das feste Gerüst des Spielbildschirms.
 *
 * Alles, was nicht leer ist, bekommt eine Kennung und wird später einzeln
 * befüllt. Welche Teile sichtbar sind, entscheidet das Stylesheet anhand der
 * Fensterbreite - deshalb stehen Schiene, Pult und Reiterleiste immer hier,
 * auch wenn jeweils nur eine Hälfte davon zu sehen ist.
 */
const SPIEL_GERUEST = `
  <div class="spiel">
    <header class="kopfleiste" id="t-kopf"></header>
    <div class="arbeitsflaeche">
      <nav class="schiene" id="t-schiene" aria-label="Bereiche"></nav>
      <div class="karten-feld" id="karten-feld">
        <div class="filter-leiste" id="t-filter" role="group" aria-label="Kartenansicht"></div>
      </div>
      <aside class="pult" id="t-pult" hidden>
        <div class="pult-kopf">
          <h2 id="t-pult-titel"></h2>
          <button class="ghost small" data-panel-zu>Schließen</button>
        </div>
        <div class="pult-koerper" id="t-pult-koerper"></div>
      </aside>
    </div>
    <section class="gebietsleiste" id="t-gebietsleiste" hidden></section>
    <nav class="reiterleiste" id="t-reiter" aria-label="Bereiche"></nav>
  </div>
  <div class="sheet-schleier" id="t-blatt-schleier" data-sheet-zu hidden></div>
  <div class="sheet" id="t-blatt" role="dialog" aria-modal="true" hidden>
    <div class="sheet-griff"></div>
    <div class="sheet-koerper" id="t-blatt-koerper"></div>
  </div>
  <div id="t-einstieg"></div>
  <div id="t-modal"></div>
  <div id="meldungs-platz"></div>`;

function zeichneSpiel(): void {
  const s = app.spiel!;
  const kompakt = istKompakt();

  if (!geruestSteht) {
    wurzel.innerHTML = SPIEL_GERUEST;
    geruestSteht = true;
    teilStand.clear();
  }

  /* Karte wiederverwenden statt neu aufbauen - erhält Zoom und Position.
     Sie wird genau einmal eingehängt: Ein SVG mit hunderten Flächen
     umzuhängen zwingt den Browser zum vollständigen Neuzeichnen. */
  if (!karte || karte.kartenId !== s.mapId) {
    karte?.element.remove();
    karte = new MapView(s, {
      onSelect: (pid) => waehleGebiet(pid),
      onLongPress: (pid) => { waehleGebiet(pid); karte?.zeigeAuf(pid); },
    });
  } else {
    karte.setState(s);
  }
  if (!karte.element.isConnected) {
    const feld = document.getElementById('karten-feld')!;
    feld.insertBefore(karte.element, feld.firstChild);
  }

  const filterLeiste = MAP_FILTERS.map((f) => `
    <button data-filter="${esc(f.id)}"
      aria-pressed="${(karte?.getFilter() ?? 'political') === f.id}">${esc(f.label)}</button>`).join('');

  const schiene = PANEL_TABS.map((t) => `
    <button data-panel="${esc(t.id)}" aria-pressed="${app.panel === t.id}">
      <span class="schienen-zeichen">${t.zeichen}</span>${esc(t.label)}</button>`).join('');

  /* Beide Seiten sind teuer: Die Gebietsansicht rechnet den Haushalt des
     Gebiets durch, die Tafel je nach Reiter die Finanzen des ganzen
     Reiches. Gebraucht wird aber selten beides - am Telefon zeigt das Blatt
     entweder das eine oder das andere. Vorher wurden beide bei jedem
     Tippen gebaut und eines davon weggeworfen. Jetzt entsteht nur, was
     auch zu sehen ist; das Zwischenergebnis hält es für einen zweiten
     Abruf im selben Durchgang fest. */
  let gebietsZwischen: string | null = null;
  const gebietsHtml = (): string => (gebietsZwischen
    ??= app.gewaehltesGebiet ? gebietsAnsichtHtml() : '');
  let panelZwischen: string | null = null;
  const panelHtml = (): string => (panelZwischen ??= app.panel
    ? panelInhalt(app.panel, s, {
      diploZiel: app.diploZiel, kriegsziel: app.kriegsziel,
      thema: app.thema, tonAn: app.tonAn,
    })
    : '');

  setzeTeil('t-kopf', kopfleiste(s));
  setzeTeil('t-filter', filterLeiste);
  setzeTeil('t-schiene', schiene);
  setzeTeil('t-reiter', `
    <button data-sheet="gebiet" ${app.gewaehltesGebiet ? '' : 'disabled'}
      aria-pressed="${app.sheetOffen === 'gebiet'}">
      <span class="schienen-zeichen">◉</span>Gebiet</button>
    ${schiene}`);

  /* Pult und Gebietsleiste tragen am Rechner den Inhalt, das Blatt auf dem
     Telefon. Es wird jeweils nur die Seite befüllt, die auch zu sehen ist. */
  zeigeTeil('t-pult', !!app.panel);
  if (!kompakt && app.panel) {
    setzeTeil('t-pult-titel', esc(PANEL_TABS.find((t) => t.id === app.panel)?.label ?? ''));
    setzeTeil('t-pult-koerper', panelHtml());
  }
  zeigeTeil('t-gebietsleiste', !!app.gewaehltesGebiet);
  if (!kompakt && app.gewaehltesGebiet) setzeTeil('t-gebietsleiste', gebietsHtml());

  zeigeTeil('t-blatt', !!app.sheetOffen);
  zeigeTeil('t-blatt-schleier', !!app.sheetOffen);
  if (app.sheetOffen) {
    setzeTeil('t-blatt-koerper', app.sheetOffen === 'gebiet' ? gebietsHtml() : panelHtml());
  }

  /* Bei einem offenen Fenster tritt der Einstieg ganz zurück. Bei einem
     offenen Blatt wandert er stattdessen nach oben: Die Schritte drei bis
     fünf erklären gerade das, was im Blatt steht - er darf dort nicht
     verschwinden, aber auch nichts verdecken. */
  /* Solange der Einstieg läuft, bekommt das Blatt weniger Höhe: Sonst
     liegt die Einstiegskarte über genau den Knöpfen, die sie zu drücken
     verlangt - und der Spieler kommt an der Stelle nicht weiter, an der
     er die Führung am nötigsten braucht. */
  document.body.classList.toggle('einstieg-laeuft', einstiegLaeuft() && !app.modal);
  setzeTeil('t-einstieg', app.modal ? '' : einstiegHtml(!!app.sheetOffen));
  setzeTeil('t-modal', modalHuelle());

  if (aufReichZentrieren) {
    aufReichZentrieren = false;
    // Erst nach dem Einhaengen messbar - deshalb im naechsten Bildlauf.
    requestAnimationFrame(() => karte?.zeigeReich(s.playerCountryId));
  }
  aktualisiereKartenAuswahl();
  karte.zeichne();
  zeichneMeldung();
}

function gebietsAnsichtHtml(): string {
  const s = app.spiel!;
  const pid = app.gewaehltesGebiet!;
  const p = s.provinces[pid];
  if (!p) return '';
  const eigen = p.ownerId === s.playerCountryId;

  const ziele = eigen
    ? {
      bewegen: movableTargets(s, s.playerCountryId, pid),
      angreifen: attackableTargets(s, s.playerCountryId, pid),
    }
    : { bewegen: [], angreifen: [] };

  let vorschau = null;
  if (app.modus === 'attack' && app.zielGebiet) {
    const ziel = s.provinces[app.zielGebiet];
    const truppen = bereinigteAuswahl();
    if (ziel && regimentsTotal(truppen) > 0) {
      vorschau = estimatePower(s, s.playerCountryId, p, ziel, truppen);
    }
  }

  return gebietsAnsicht(s, pid, {
    modus: app.modus,
    zielId: app.zielGebiet,
    auswahl: app.truppenauswahl,
    rekrutGattung: app.rekrutGattung,
    rekrutMenge: app.rekrutMenge,
  }, ziele, vorschau);
}

function modalHuelle(): string {
  if (!app.modal) return '';
  return `<div class="modal-schleier" data-schleier>${app.modal}</div>`;
}

function zeichneMeldung(): void {
  const platz = document.getElementById('meldungs-platz');
  if (!platz) return;
  platz.innerHTML = app.meldung
    ? `<div class="meldung ${app.meldung.art === 'fehler' ? 'fehler' : ''}" role="status">
        ${esc(app.meldung.text)}</div>` : '';
}

function aktualisiereKartenAuswahl(): void {
  if (!karte || !app.spiel) return;
  const s = app.spiel;
  let ziele: string[] = [];
  if (app.gewaehltesGebiet && app.modus !== 'none') {
    ziele = app.modus === 'move'
      ? movableTargets(s, s.playerCountryId, app.gewaehltesGebiet)
      : attackableTargets(s, s.playerCountryId, app.gewaehltesGebiet);
  }
  karte.setAuswahl(app.gewaehltesGebiet, app.modus, ziele);
}

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen zum Spielzustand                                    */
/* ------------------------------------------------------------------ */

function baueVorschau(): void {
  try {
    app.vorschau = createNewGame({
      scenarioId: app.setup.scenarioId,
      playerCountryId: app.setup.countryId,
      difficulty: app.setup.difficulty,
      seed: 1,
    });
  } catch (e) {
    app.vorschau = null;
    melde(e instanceof Error ? e.message : 'Vorschau nicht möglich.', 'fehler');
  }
}

function waehleGebiet(pid: string): void {
  const s = app.spiel;
  if (!s) return;

  // Im Befehlsmodus zählt ein Tipp auf ein gueltiges Ziel als Zielwahl.
  if (app.gewaehltesGebiet && app.modus !== 'none') {
    const erlaubt = app.modus === 'move'
      ? movableTargets(s, s.playerCountryId, app.gewaehltesGebiet)
      : attackableTargets(s, s.playerCountryId, app.gewaehltesGebiet);
    if (erlaubt.includes(pid)) {
      setzeZiel(pid);
      return;
    }
  }

  app.gewaehltesGebiet = pid;
  setzeModus('none');
  if (istKompakt()) app.sheetOffen = 'gebiet';
  einstiegEreignis('gebiet-gewaehlt');
  if (s.provinces[pid]?.ownerId === s.playerCountryId) {
    einstiegEreignis('eigenes-gebiet-gewaehlt');
  }
  zeichne();
}

function setzeModus(m: SelectionMode): void {
  app.modus = m;
  app.zielGebiet = null;
  app.truppenauswahl = {};
  karte?.pfeileLoeschen();
}

function setzeZiel(pid: string): void {
  const s = app.spiel!;
  app.zielGebiet = pid;
  const von = s.provinces[app.gewaehltesGebiet!];
  // Standardmaessig drei Viertel aller Truppen anbieten - der haeufigste Fall.
  app.truppenauswahl = {};
  for (const u of UNIT_ORDER) {
    const da = von.regiments[u] ?? 0;
    if (da > 0) app.truppenauswahl[u] = Math.max(1, Math.floor(da * 0.75));
  }
  karte?.zeigePfeil(app.gewaehltesGebiet!, pid, app.modus === 'attack' ? 'attack' : 'move');
  zeichne();
}

/** Auswahl auf tatsächlich vorhandene Truppen begrenzen. */
function bereinigteAuswahl(): Record<string, number> {
  const s = app.spiel!;
  const p = s.provinces[app.gewaehltesGebiet!];
  const raus: Record<string, number> = {};
  for (const u of UNIT_ORDER) {
    const gewuenscht = app.truppenauswahl[u] ?? 0;
    const da = p.regiments[u] ?? 0;
    const n = Math.max(0, Math.min(gewuenscht, da));
    if (n > 0) raus[u] = n;
  }
  return raus;
}

function nachAktion(): void {
  const s = app.spiel!;
  recalculateSupply(s);
  checkGameStatus(s);
  zeichne();
}

/* ------------------------------------------------------------------ */
/* Rundenwechsel                                                       */
/* ------------------------------------------------------------------ */

function rundeBeenden(): void {
  const s = app.spiel!;
  if (s.pendingEvent) { melde('Entscheide zuerst das offene Ereignis.', 'fehler'); return; }
  if (s.status !== 'playing') { melde('Die Partie ist beendet.', 'fehler'); return; }

  const gebieteVorher = s.provinceOrder.filter((id) => s.provinces[id].ownerId === s.playerCountryId).length;

  einstiegEreignis('runde-beendet');
  setzeModus('none');
  app.gewaehltesGebiet = null;
  endTurn(s);
  autosave(s);

  const gebieteNachher = s.provinceOrder.filter((id) => s.provinces[id].ownerId === s.playerCountryId).length;
  if (gebieteNachher < gebieteVorher) spieleTon('verlust');
  else spieleTon('runde');

  if (s.pendingEvent) app.modal = ereignisModal(s.pendingEvent);
  else if (s.pendingPeaceOffers.length) app.modal = friedensModal(s, s.pendingPeaceOffers[0]);
  else if (s.status !== 'playing' && !app.spielendeGezeigt) {
    app.spielendeGezeigt = true;
    app.modal = spielendeModal(s);
    spieleTon(s.status === 'victory' ? 'sieg' : 'niederlage');
  }
  zeichne();
}

/* ------------------------------------------------------------------ */
/* Klicks                                                              */
/* ------------------------------------------------------------------ */

function attr(el: HTMLElement, name: string): string | null {
  const treffer = el.closest(`[${name}]`) as HTMLElement | null;
  return treffer ? treffer.getAttribute(name) : null;
}

wurzel.addEventListener('click', (ereignis) => {
  const ziel = ereignis.target as HTMLElement;
  if (!ziel) return;

  /* ---- Hauptmenü ---- */
  if (ziel.closest('[data-neues-spiel]')) {
    app.bildschirm = 'aufbau';
    baueVorschau();
    spieleTon('klick');
    zeichne(); return;
  }
  const weiter = attr(ziel, 'data-weiter');
  if (weiter) {
    const eintrag = loadGame(weiter);
    if (eintrag) {
      app.spiel = eintrag.state;
      app.bildschirm = 'spiel';
      app.spielendeGezeigt = false;
      aufReichZentrieren = true;
      recalculateSupply(app.spiel);
      spieleTon('klick');
      zeichne();
    } else melde('Dieser Spielstand ist nicht lesbar.', 'fehler');
    return;
  }
  if (ziel.closest('[data-hilfe]')) {
    // Am Telefon zuerst die Kapitelübersicht, am Rechner gleich das Kapitel:
    // dort steht die Liste ohnehin daneben.
    app.handbuchListe = window.innerWidth < 900;
    app.modal = handbuchModal(app.handbuchKapitel, app.handbuchListe);
    zeichne(); return;
  }
  const hbKapitel = ziel.closest<HTMLElement>('[data-handbuch-kapitel]');
  if (hbKapitel) {
    app.handbuchKapitel = attr(hbKapitel, 'data-handbuch-kapitel') ?? 'ueberblick';
    app.handbuchListe = false;
    app.modal = handbuchModal(app.handbuchKapitel, false);
    zeichne(); return;
  }
  if (ziel.closest('[data-handbuch-liste]')) {
    app.handbuchListe = true;
    app.modal = handbuchModal(app.handbuchKapitel, true);
    zeichne(); return;
  }

  /* ---- Aufbau ---- */
  const szenario = attr(ziel, 'data-szenario');
  if (szenario) {
    app.setup.scenarioId = szenario;
    const sc = scenarios.find((x) => x.id === szenario);
    if (sc) app.setup.countryId = sc.countries[0].id;
    baueVorschau(); spieleTon('klick'); zeichne(); return;
  }
  const land = attr(ziel, 'data-land');
  if (land) { app.setup.countryId = land; baueVorschau(); spieleTon('klick'); zeichne(); return; }
  const grad = attr(ziel, 'data-grad');
  if (grad) { app.setup.difficulty = grad as Difficulty; baueVorschau(); zeichne(); return; }
  if (ziel.closest('[data-zurueck]')) { app.bildschirm = 'menue'; zeichne(); return; }
  if (ziel.closest('[data-starten]')) {
    try {
      app.spiel = createNewGame({
        scenarioId: app.setup.scenarioId,
        playerCountryId: app.setup.countryId,
        difficulty: app.setup.difficulty,
        seed: Math.floor(Math.random() * 1e9),
      });
      recalculateSupply(app.spiel);
      app.bildschirm = 'spiel';
      app.spielendeGezeigt = false;
      aufReichZentrieren = true;
      app.panel = istKompakt() ? null : 'ziele';
      spieleTon('start');
      // Beim allerersten Spiel durch eine Runde führen. Danach nie wieder,
      // es sei denn, man ruft ihn in den Einstellungen erneut auf.
      if (!einstiegErledigt()) einstiegStarten();
      zeichne();
    } catch (e) {
      melde(e instanceof Error ? e.message : 'Start fehlgeschlagen.', 'fehler');
    }
    return;
  }

  /* ---- Modale ---- */
  if (ziel.closest('[data-modal-schliessen]')) {
    app.modal = null; app.offenerBericht = null; zeichne(); return;
  }
  const ereignisWahl = attr(ziel, 'data-ereignis-wahl');
  const offen = app.spiel?.pendingEvent ?? null;
  if (ereignisWahl !== null && app.spiel && offen) {
    const s = app.spiel;
    const wahl = offen.choices[Number(ereignisWahl)];
    if (wahl) {
      applyEventEffects(s, wahl.effects);
      addLog(s, 'event', `${offen.name}: ${wahl.text}`);
    }
    s.pendingEvent = null;
    app.modal = s.pendingPeaceOffers.length ? friedensModal(s, s.pendingPeaceOffers[0]) : null;
    spieleTon('klick');
    nachAktion(); return;
  }
  const frieden = attr(ziel, 'data-frieden');
  if (frieden && app.spiel) {
    const s = app.spiel;
    const angebot = s.pendingPeaceOffers.shift();
    if (angebot && frieden === 'ja') {
      applyPeace(s, angebot, (t) => addLog(s, 'peace', t));
      melde('Der Frieden ist geschlossen.');
      spieleTon('frieden');
    } else if (angebot) {
      addLog(s, 'war', 'Das Friedensangebot wurde abgelehnt.');
    }
    app.modal = s.pendingPeaceOffers.length ? friedensModal(s, s.pendingPeaceOffers[0]) : null;
    nachAktion(); return;
  }
  const teilen = attr(ziel, 'data-teilen');
  if (teilen) {
    navigator.clipboard?.writeText(teilen)
      .then(() => melde('Ergebnis kopiert.'))
      .catch(() => melde('Kopieren wurde abgelehnt.', 'fehler'));
    return;
  }
  const bericht = attr(ziel, 'data-bericht');
  if (bericht && app.spiel) {
    const b = app.spiel.battleReports.find((x) => x.id === bericht);
    if (b) { app.modal = kampfberichtModal(app.spiel, b); zeichne(); }
    return;
  }
  if (ziel.closest('[data-schleier]') && ziel.classList.contains('modal-schleier')) {
    // Klick neben das Fenster schliesst nur unkritische Anzeigen.
    if (!app.spiel?.pendingEvent && !app.spiel?.pendingPeaceOffers.length) {
      app.modal = null; zeichne();
    }
    return;
  }

  if (!app.spiel) return;
  const s = app.spiel;

  /* ---- Einführung ---- */
  if (ziel.closest('[data-einstieg-aus]')) { einstiegAbbrechen(); zeichne(); return; }
  if (ziel.closest('[data-einstieg-weiter]')) { einstiegWeiter(); zeichne(); return; }

  /* ---- Spielbildschirm ---- */
  if (ziel.closest('[data-runde]')) { rundeBeenden(); return; }

  const filter = attr(ziel, 'data-filter');
  if (filter) { karte?.setFilter(filter as MapFilterId); zeichne(); return; }

  const panel = attr(ziel, 'data-panel');
  if (panel) {
    // Der Einstieg verlangt, einzelne Tafeln einmal zu öffnen. Statt für
    // jede eine eigene Abfrage: Die Kennung der Tafel ist die Kennung des
    // Schritts.
    einstiegEreignis(`panel-${panel}` as EinstiegEreignis);
    const neu = panel as PanelId;
    if (istKompakt()) {
      app.panel = neu; app.sheetOffen = 'panel';
    } else {
      app.panel = app.panel === neu ? null : neu;
    }
    spieleTon('klick'); zeichne(); return;
  }
  if (ziel.closest('[data-panel-zu]')) { app.panel = null; zeichne(); return; }
  const sheet = attr(ziel, 'data-sheet');
  if (sheet) { app.sheetOffen = sheet as 'gebiet' | 'panel'; zeichne(); return; }
  if (ziel.closest('[data-sheet-zu]')) { app.sheetOffen = null; zeichne(); return; }
  if (ziel.closest('[data-gebiet-schliessen]')) {
    app.gewaehltesGebiet = null; setzeModus('none'); app.sheetOffen = null;
    aktualisiereKartenAuswahl(); zeichne(); return;
  }

  const springe = attr(ziel, 'data-springe');
  if (springe) {
    app.gewaehltesGebiet = springe; setzeModus('none');
    karte?.zeigeAuf(springe);
    app.sheetOffen = istKompakt() ? 'gebiet' : null;
    zeichne(); return;
  }

  /* ---- Gebietsaktionen ---- */
  const modus = attr(ziel, 'data-modus');
  if (modus) {
    setzeModus(app.modus === modus ? 'none' : modus as SelectionMode);
    if (modus === 'attack') einstiegEreignis('angriff-gestartet');
    if (modus === 'move') einstiegEreignis('bewegt');
    aktualisiereKartenAuswahl(); zeichne(); return;
  }
  const zielGebiet = attr(ziel, 'data-ziel');
  if (zielGebiet) { setzeZiel(zielGebiet); return; }
  if (ziel.closest('[data-abbrechen]')) {
    setzeModus('none'); aktualisiereKartenAuswahl(); zeichne(); return;
  }
  const anteil = attr(ziel, 'data-anteil');
  if (anteil && app.gewaehltesGebiet) {
    const p = s.provinces[app.gewaehltesGebiet];
    const f = Number(anteil) / 100;
    app.truppenauswahl = {};
    for (const u of UNIT_ORDER) {
      const da = p.regiments[u] ?? 0;
      if (da > 0) app.truppenauswahl[u] = Math.max(1, Math.round(da * f));
    }
    zeichne(); return;
  }

  if (ziel.closest('[data-ausfuehren]') && app.gewaehltesGebiet && app.zielGebiet) {
    const truppen = bereinigteAuswahl();
    if (regimentsTotal(truppen) < 1) { melde('Keine Truppen gewaehlt.', 'fehler'); return; }

    if (app.modus === 'move') {
      const r = moveRegiments(s, app.gewaehltesGebiet, app.zielGebiet, truppen);
      if (!r.ok) { melde(r.message, 'fehler'); return; }
      s.countries[s.playerCountryId].actionPoints -= 1;
      melde(r.message);
      spieleTon('marsch');
      karte?.blitz(app.zielGebiet, '#9fd0ff');
      setzeModus('none');
    } else {
      const ergebnis = resolveBattle(s, s.playerCountryId, app.gewaehltesGebiet, app.zielGebiet, truppen);
      if (!ergebnis) { melde('Der Angriff ist nicht möglich.', 'fehler'); return; }
      s.countries[s.playerCountryId].actionPoints -= 1;
      app.modal = kampfberichtModal(s, ergebnis.report);
      spieleTon(ergebnis.report.attackerWon ? 'sieg-klein' : 'verlust');
      karte?.blitz(app.zielGebiet, ergebnis.report.attackerWon ? '#8fe0a8' : '#e08f8f');
      setzeModus('none');
    }
    aktualisiereKartenAuswahl();
    nachAktion(); return;
  }

  const gattung = attr(ziel, 'data-gattung');
  if (gattung && app.gewaehltesGebiet) {
    app.rekrutGattung = gattung as UnitId;
    const grenze = maxAushebung(s, s.playerCountryId, app.gewaehltesGebiet, app.rekrutGattung);
    app.rekrutMenge = Math.min(app.rekrutMenge || 1, grenze);
    zeichne(); return;
  }
  const rekrutAnteil = attr(ziel, 'data-rekrut-anteil');
  if (rekrutAnteil && app.gewaehltesGebiet) {
    const grenze = maxAushebung(s, s.playerCountryId, app.gewaehltesGebiet, app.rekrutGattung);
    app.rekrutMenge = Math.max(1, Math.floor(grenze * (Number(rekrutAnteil) / 100)));
    zeichne(); return;
  }
  if (ziel.closest('[data-rekrutieren]') && app.gewaehltesGebiet) {
    const r = recruit(s, s.playerCountryId, app.gewaehltesGebiet, app.rekrutGattung, app.rekrutMenge);
    melde(r.message, r.ok ? 'ok' : 'fehler');
    if (r.ok) { app.rekrutMenge = 0; spieleTon('bau'); einstiegEreignis('rekrutiert'); }
    nachAktion(); return;
  }
  const bau = attr(ziel, 'data-bau');
  if (bau && app.gewaehltesGebiet) {
    const r = build(s, s.playerCountryId, app.gewaehltesGebiet, bau as any);
    melde(r.message, r.ok ? 'ok' : 'fehler');
    if (r.ok) { spieleTon('bau'); einstiegEreignis('ausbau'); }
    nachAktion(); return;
  }
  const generalHin = attr(ziel, 'data-general-hin');
  if (generalHin && app.gewaehltesGebiet) {
    const r = assignGeneral(s, generalHin, app.gewaehltesGebiet);
    melde(r.message, r.ok ? 'ok' : 'fehler'); nachAktion(); return;
  }
  const generalAb = attr(ziel, 'data-general-ab');
  if (generalAb) {
    const r = assignGeneral(s, generalAb, null);
    melde(r.message, r.ok ? 'ok' : 'fehler'); nachAktion(); return;
  }
  if (ziel.closest('[data-general-werben]')) {
    const rnd = createRandom(s.rngState);
    const r = hireGeneral(s, s.playerCountryId, rnd);
    s.rngState = rnd.state();
    melde(r.message, r.ok ? 'ok' : 'fehler'); nachAktion(); return;
  }

  /* ---- Diplomatie ---- */
  const diplo = attr(ziel, 'data-diplo');
  if (diplo) { app.diploZiel = app.diploZiel === diplo ? null : diplo; zeichne(); return; }
  const diploAktion = attr(ziel, 'data-diploaktion');
  if (diploAktion && app.diploZiel) {
    const r = performDiplomacy(
      s, s.playerCountryId, app.diploZiel, diploAktion as any,
      (t) => addLog(s, 'info', t), app.kriegsziel,
    );
    melde(r.message, r.ok ? 'ok' : 'fehler');
    if (r.ok) spieleTon(diploAktion === 'declareWar' ? 'krieg' : 'klick');
    nachAktion(); return;
  }

  /* ---- Forschung ---- */
  const forschung = attr(ziel, 'data-forschung');
  if (forschung) {
    const r = startResearch(s, s.playerCountryId, forschung as any);
    melde(r.message, r.ok ? 'ok' : 'fehler'); nachAktion(); return;
  }

  /* ---- Einstellungen ---- */
  const thema = attr(ziel, 'data-thema');
  if (thema) { app.thema = thema as 'dunkel' | 'hell'; zeichne(); return; }
  if (ziel.closest('[data-ton]')) {
    app.tonAn = !app.tonAn; setzeTon(app.tonAn);
    if (app.tonAn) spieleTon('klick');
    zeichne(); return;
  }
  const speichern = attr(ziel, 'data-speichern');
  if (speichern) { melde(saveGame(speichern, s).message); zeichne(); return; }
  const laden = attr(ziel, 'data-laden');
  if (laden) {
    const e = loadGame(laden);
    if (e) {
      app.spiel = e.state; app.gewaehltesGebiet = null; setzeModus('none');
      app.spielendeGezeigt = false;
      recalculateSupply(app.spiel);
      melde('Spielstand geladen.');
      zeichne();
    } else melde('Dieser Platz ist leer oder nicht lesbar.', 'fehler');
    return;
  }
  const loeschen = attr(ziel, 'data-loeschen');
  if (loeschen) { melde(deleteSave(loeschen).message); zeichne(); return; }
  if (ziel.closest('[data-kopieren]')) {
    navigator.clipboard?.writeText(exportState(s))
      .then(() => melde('Spielstand in die Zwischenablage kopiert.'))
      .catch(() => melde('Kopieren wurde abgelehnt.', 'fehler'));
    return;
  }
  if (ziel.closest('[data-datei-export]')) { melde(downloadState(s).message); return; }
  if (ziel.closest('[data-datei-import]')) { dateiWaehlen(); return; }
  if (ziel.closest('[data-text-import]')) { textImport(); return; }
  if (ziel.closest('[data-beenden]')) {
    app.bildschirm = 'menue'; app.spiel = null; app.modal = null;
    app.gewaehltesGebiet = null; app.panel = null; app.sheetOffen = null;
    zeichne(); return;
  }
});

/* Regler reagieren auf Bewegung, nicht auf Klick. */
wurzel.addEventListener('input', (ereignis) => {
  const el = ereignis.target as HTMLInputElement;
  if (!el || el.tagName !== 'INPUT') return;
  const s = app.spiel;
  if (!s) return;

  const truppe = el.getAttribute('data-truppe');
  if (truppe) {
    app.truppenauswahl[truppe] = Number(el.value);
    // Nur die unmittelbar betroffenen Anzeigen auffrischen, damit der Regler
    // unter dem Finger nicht neu aufgebaut wird und die Geste abreisst.
    const anzeige = el.parentElement?.querySelector('.wert');
    if (anzeige) {
      anzeige.textContent = `${el.value} / ${el.max}`;
    }
    return;
  }
  if (el.hasAttribute('data-rekrut-menge')) {
    app.rekrutMenge = Number(el.value);
    const anzeige = el.parentElement?.querySelector('.wert');
    if (anzeige) anzeige.textContent = String(app.rekrutMenge);
    return;
  }
  const regler = el.getAttribute('data-regler');
  if (regler === 'steuer') {
    setTaxRate(s, s.playerCountryId, Number(el.value));
    const z = el.previousElementSibling?.querySelector('.wert');
    if (z) z.textContent = `${Math.round(Number(el.value) * 100)} %`;
    return;
  }
  if (regler === 'forschung') {
    setResearchBudget(s, s.playerCountryId, Number(el.value));
    const z = el.previousElementSibling?.querySelector('.wert');
    if (z) z.textContent = `${Math.round(Number(el.value) * 100)} %`;
  }
});

/* Regler losgelassen: jetzt darf vollständig neu gezeichnet werden. */
wurzel.addEventListener('change', (ereignis) => {
  const el = ereignis.target as HTMLElement;
  if (el.tagName === 'SELECT' && el.hasAttribute('data-kriegsziel')) {
    app.kriegsziel = (el as HTMLSelectElement).value as WarGoalId;
    zeichne(); return;
  }
  if (el.tagName === 'INPUT') {
    const i = el as HTMLInputElement;
    if (i.hasAttribute('data-truppe') || i.hasAttribute('data-rekrut-menge')
      || i.hasAttribute('data-regler')) zeichne();
  }
});

/* Tastatur: schnelles Spielen am Rechner. */
window.addEventListener('keydown', (e) => {
  if (app.bildschirm !== 'spiel' || !app.spiel) return;
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  if (e.key === 'Escape') {
    if (app.modal && !app.spiel.pendingEvent) { app.modal = null; zeichne(); }
    // Das Blatt liegt über allem anderen - es muss zuerst weichen. Sonst
    // bliebe auf dem Telefon ein leeres Blatt stehen, während darunter
    // schon die Auswahl aufgehoben ist.
    else if (app.sheetOffen) { app.sheetOffen = null; zeichne(); }
    else if (app.modus !== 'none') { setzeModus('none'); aktualisiereKartenAuswahl(); zeichne(); }
    else if (app.gewaehltesGebiet) { app.gewaehltesGebiet = null; zeichne(); }
    return;
  }
  if (app.modal) return;
  if (e.key === 'Enter' && !e.repeat) { rundeBeenden(); return; }
  if (e.key === 'm' && app.gewaehltesGebiet) { setzeModus('move'); aktualisiereKartenAuswahl(); zeichne(); }
  if (e.key === 'a' && app.gewaehltesGebiet) { setzeModus('attack'); aktualisiereKartenAuswahl(); zeichne(); }
  const zahl = Number(e.key);
  if (zahl >= 1 && zahl <= PANEL_TABS.length) {
    app.panel = PANEL_TABS[zahl - 1].id;
    if (istKompakt()) app.sheetOffen = 'panel';
    zeichne();
  }
});

/* Bildschirmdrehung oder Groessenwechsel: Aufbau neu entscheiden. */
let groessenUhr = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(groessenUhr);
  groessenUhr = window.setTimeout(() => { if (app.bildschirm === 'spiel') zeichne(); }, 180);
});

/* ------------------------------------------------------------------ */
/* Dateien                                                             */
/* ------------------------------------------------------------------ */

function dateiWaehlen(): void {
  const eingabe = document.createElement('input');
  eingabe.type = 'file';
  eingabe.accept = 'application/json';
  eingabe.addEventListener('change', async () => {
    const datei = eingabe.files?.[0];
    if (!datei) return;
    try {
      app.spiel = importState(await datei.text());
      recalculateSupply(app.spiel);
      app.bildschirm = 'spiel';
      melde('Spielstand geladen.');
      zeichne();
    } catch (e) {
      melde(e instanceof Error ? e.message : 'Die Datei ist kein Spielstand.', 'fehler');
    }
  });
  eingabe.click();
}

function textImport(): void {
  const text = window.prompt('Spielstand als Text einfügen:');
  if (!text) return;
  try {
    app.spiel = importState(text);
    recalculateSupply(app.spiel);
    app.bildschirm = 'spiel';
    melde('Spielstand übernommen.');
    zeichne();
  } catch (e) {
    melde(e instanceof Error ? e.message : 'Der Text ist kein Spielstand.', 'fehler');
  }
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

function start(): void {
  try {
    const gesichert = loadGame(AUTOSAVE_SLOT);
    if (gesichert) {
      // Nur anbieten, nicht automatisch laden - das Menue zeigt den Stand.
      void gesichert;
    }
  } catch { /* ohne Speicher läuft das Spiel trotzdem */ }
  setzeTon(app.tonAn);
  zeichne();
  const start = document.getElementById('boot');
  if (start?.parentNode) start.parentNode.removeChild(start);
}

try {
  start();
} catch (e) {
  wurzel.innerHTML = `<div class="menue"><div class="menue-innen">
    <h1>Startfehler</h1>
    <pre class="fehlertext">${esc(e instanceof Error ? (e.stack ?? e.message) : String(e))}</pre>
  </div></div>`;
}

/* Unbehandelte Fehler sollen nicht als schwarze Flaeche enden. */
window.addEventListener('error', (e) => {
  if (!document.getElementById('app')?.children.length) {
    wurzel.innerHTML = `<div class="menue"><div class="menue-innen">
      <h1>Fehler beim Start</h1>
      <pre class="fehlertext">${esc(e.message)}</pre></div></div>`;
  }
});

/* Unbenutzte Einfuhr vermeiden, ohne die Typpruefung zu lockern. */
void UNITS; void maxActionPoints; void regimentsCopy;

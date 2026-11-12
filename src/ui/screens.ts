/**
 * Hauptmenü und Aufbaubildschirm.
 *
 * Beide liefern HTML und melden Entscheidungen über Datenattribute zurueck.
 * Die Landauswahl zeigt bereits die echte Karte des Szenarios - was man
 * aussucht, sieht man danach genauso wieder.
 */

import type { Difficulty, GameState } from '../core/types';
import { scenarios, getMap } from '../data/index';
import { listSaves } from '../core/save';
import { umrissPfad, umrissPunkte } from '../core/koordinaten';
import { esc } from './dom';
import { wappenSvg } from './heraldry';
import { flaggeSvg } from './flaggen';
import { landVorschau } from './panels';
import { jahrText } from '../core/format';

export const SCHWIERIGKEITEN: Array<{ id: Difficulty; name: string; hinweis: string }> = [
  { id: 'easy',   name: 'Leicht', hinweis: 'Die Gegner handeln zögerlich und lassen Gelegenheiten aus.' },
  { id: 'normal', name: 'Normal', hinweis: 'Die Gegner planen solide und nutzen klare Vorteile.' },
  { id: 'hard',   name: 'Schwer', hinweis: 'Die Gegner handeln konsequent - ohne zusätzliche Mittel.' },
];

/* ------------------------------------------------------------------ */
/* Hauptmenü                                                          */
/* ------------------------------------------------------------------ */

export function hauptmenue(): string {
  const staende = listSaves();
  const fortsetzen = staende.length ? staende.map((e) => `
    <button class="wahl" data-weiter="${esc(e.slot)}">
      <h3>${esc(e.scenarioName)}</h3>
      <p>${esc(e.countryName)} &middot; ${esc(jahrText(e.year))} &middot; Runde ${e.turn}</p>
      <span class="fussnote">${e.slot === 'auto' ? 'Automatisch' : e.slot.toUpperCase()}
        &middot; ${new Date(e.savedAt).toLocaleString('de-DE')}</span>
    </button>`).join('') : '';

  return `
    <div class="menue">
      <div class="menue-innen">
        <div class="titel-block">
          <div class="titel-wappen">${wappenSvg(7, '#d6a84e', 68, 'E')}</div>
          <h1>imperWARtor</h1>
          <p class="untertitel">Ein rundenbasiertes Strategiespiel auf der Landkarte</p>
        </div>
        <div class="zierlinie breit"></div>

        <p class="lede mittig">
          Du führst ein Land durch Haushalt, Diplomatie und Krieg. Keine Schlachtanimationen:
          jeder Kampf ist eine offengelegte Rechnung, die du vorher abschätzen und hinterher
          nachlesen kannst.
        </p>

        <div class="aktions-reihe mittig gross">
          <button class="haupt gross" data-neues-spiel>Neues Spiel</button>
          ${staende.length ? '' : '<button data-hilfe>Spielhilfe</button>'}
        </div>

        ${staende.length ? `
          <div class="schritt">
            <span class="schritt-nr">Gespeichert</span>
            <h2>Fortsetzen</h2>
          </div>
          <div class="wahl-gitter">${fortsetzen}</div>
          <div class="aktions-reihe mittig">
            <button data-hilfe>Spielhilfe</button>
          </div>` : ''}

        <div class="menue-fuß">
          <span class="leise-text">Version 1.0 &middot; läuft vollständig im Browser,
          ohne Server und ohne Konto.</span>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Aufbaubildschirm                                                    */
/* ------------------------------------------------------------------ */

export interface SetupAuswahl {
  scenarioId: string;
  countryId: string;
  difficulty: Difficulty;
}

/** Gerueste den Aufbaubildschirm. Die Karte hängt der Aufrufer selbst ein. */
/**
 * Kleines Kartenbild für eine Szenariokachel.
 *
 * Die Auswahl war bisher eine reine Textliste - man musste das Szenario
 * starten, um zu sehen, wie die Welt darin aussieht. Das Bild zeigt sofort
 * Ausschnitt und Machtverteilung. Es wird bewusst grob gezeichnet: keine
 * Umrisse, keine Beschriftung, nur Farbflächen.
 */
function szenarioBild(sc: any): string {
  const karte = getMap(sc.mapId);
  if (!karte) return '';

  // Besitzer je Gebiet aus den Länderlisten des Szenarios.
  const besitzer = new Map<string, string>();
  for (const land of sc.countries) {
    for (const pid of land.provinces ?? []) besitzer.set(pid, land.color);
  }

  // Enger Ausschnitt, damit das Land die Kachel füllt.
  const teiler = karte.ringTeiler ?? 8;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of karte.provinces) {
    const z = umrissPunkte(p, teiler);
    for (let i = 0; i < z.length; i += 2) {
      const x = z[i]; const y = z[i + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return '';
  const luft = Math.max(maxX - minX, maxY - minY) * 0.02;

  const flaechen = karte.provinces.map((p) => {
    const farbe = besitzer.get(p.id) ?? '#3a4752';
    return `<path d="${umrissPfad(p, teiler)}" fill="${farbe}" fill-rule="evenodd"/>`;
  }).join('');

  return `<svg class="szenario-bild" viewBox="${minX - luft} ${minY - luft}
      ${(maxX - minX) + luft * 2} ${(maxY - minY) + luft * 2}"
      preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g class="szenario-bild-land">${flaechen}</g>
  </svg>`;
}

export function aufbauGeruest(wahl: SetupAuswahl, vorschau: GameState | null): string {
  const szenarien = scenarios.map((sc) => {
    const karte = getMap(sc.mapId);
    return `<button class="wahl szenario-wahl" data-szenario="${esc(sc.id)}"
        aria-pressed="${wahl.scenarioId === sc.id}">
      ${szenarioBild(sc)}
      <div class="szenario-text">
        <h3>${esc(sc.name)}</h3>
        <p>${esc(sc.description)}</p>
        <span class="fussnote">
          ${esc(jahrText(sc.startYear))} &middot; ${sc.monthsPerTurn} Monate je Runde
          &middot; ${karte ? karte.provinces.length : '?'} Gebiete
          &middot; ${sc.countries.length} Länder
        </span>
      </div>
    </button>`;
  }).join('');

  const aktuell = scenarios.find((s) => s.id === wahl.scenarioId);
  const laender = aktuell ? aktuell.countries.map((c: any) => `
    <button class="wahl land-wahl" data-land="${esc(c.id)}"
        aria-pressed="${wahl.countryId === c.id}">
      <span class="land-wahl-kopf">
        ${flaggeSvg(c.flag, c.color, 34, c.emblem)}
        <h3>${esc(c.name)}</h3>
      </span>
      <p>${esc(c.description)}</p>
    </button>`).join('') : '';

  const grade = SCHWIERIGKEITEN.map((g) => `
    <button class="wahl" data-grad="${esc(g.id)}" aria-pressed="${wahl.difficulty === g.id}">
      <h3>${esc(g.name)}</h3>
      <p>${esc(g.hinweis)}</p>
    </button>`).join('');

  const landInfo = vorschau && vorschau.countries[wahl.countryId]
    ? `<div class="karte-block">${landVorschau(vorschau, vorschau.countries[wahl.countryId])}</div>`
    : '';

  return `
    <div class="menue">
      <div class="menue-innen">
        <div class="titel-block klein">
          <h1>Neue Partie</h1>
        </div>
        <div class="zierlinie breit"></div>

        <div class="schritt"><span class="schritt-nr">01</span><h2>Szenario</h2></div>
        <div class="wahl-gitter">${szenarien}</div>

        <div class="schritt"><span class="schritt-nr">02</span><h2>Land</h2></div>
        <p class="leise-text">Tippe ein Gebiet auf der Karte an oder wähle unten aus der Liste.</p>
        <div class="vorschau-karte" id="vorschau-karte"></div>
        ${landInfo}
        <div class="wahl-gitter">${laender}</div>

        <div class="schritt"><span class="schritt-nr">03</span><h2>Schwierigkeit</h2></div>
        <div class="wahl-gitter">${grade}</div>

        <div class="aktions-reihe mittig gross">
          <button class="ghost" data-zurueck>Zurück</button>
          <button class="haupt gross" data-starten>Partie starten</button>
        </div>
      </div>
    </div>`;
}

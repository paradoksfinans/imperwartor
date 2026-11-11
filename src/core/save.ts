/**
 * Spielstände.
 *
 * Zwei Ebenen: normalerweise der localStorage, in abgeschotteten Rahmen
 * (etwa einer Vorschau im Chat) ein Speicher im Arbeitsspeicher. Die
 * Speicherplaetze funktionieren dann weiter, ueberstehen aber kein Neuladen.
 * Der Unterschied wird im Spiel benannt statt verschwiegen.
 */

import type { GameState } from './types';
import { KOSTEN_BEZUG } from './rules';
import { provinceOutput } from './economy';

interface Backend {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const speicher = new Map<string, string>();
const memoryBackend: Backend = {
  getItem: (k) => speicher.get(k) ?? null,
  setItem: (k, v) => void speicher.set(k, v),
  removeItem: (k) => void speicher.delete(k),
};

function pruefe(): { backend: Backend; dauerhaft: boolean } {
  try {
    const k = 'et:test';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return { backend: window.localStorage, dauerhaft: true };
  } catch {
    return { backend: memoryBackend, dauerhaft: false };
  }
}

const erkannt = typeof window === 'undefined'
  ? { backend: memoryBackend, dauerhaft: false }
  : pruefe();

const store = erkannt.backend;
export const speicherIstDauerhaft = erkannt.dauerhaft;

export const AUTOSAVE_SLOT = 'auto';
export const MANUAL_SLOTS = ['s1', 's2', 's3'] as const;
export type SlotId = typeof MANUAL_SLOTS[number] | typeof AUTOSAVE_SLOT;

const PRAEFIX = 'imperwartor:v2:';
/** Schlüssel der Fassung, die noch "Empire Tactics" hieß. Wird nur gelesen,
    damit vorhandene Spielstände nach der Umbenennung nicht verschwinden. */
const PRAEFIX_ALT = 'empire-tactics:v2:';
const schluessel = (slot: string) => `${PRAEFIX}${slot}`;

export interface SaveMeta {
  slot: string;
  scenarioName: string;
  countryName: string;
  turn: number;
  year: number;
  savedAt: string;
}

export interface SaveEntry extends SaveMeta {
  state: GameState;
}

export interface SaveResult {
  ok: boolean;
  message: string;
}

export function saveGame(slot: string, state: GameState): SaveResult {
  try {
    const eintrag: SaveEntry = {
      slot,
      scenarioName: state.scenarioName,
      countryName: state.countries[state.playerCountryId]?.name ?? '-',
      turn: state.turn,
      year: state.year,
      savedAt: new Date().toISOString(),
      state,
    };
    store.setItem(schluessel(slot), JSON.stringify(eintrag));
    return {
      ok: true,
      message: speicherIstDauerhaft
        ? 'Spielstand gespeichert.'
        : 'Spielstand gespeichert - gilt nur für diese Sitzung.',
    };
  } catch (e) {
    return { ok: false, message: `Speichern fehlgeschlagen: ${(e as Error).message}` };
  }
}

export function loadGame(slot: string): SaveEntry | null {
  try {
    // Nach der Umbenennung zuerst unter dem neuen Schlüssel suchen, dann
    // unter dem alten - sonst waeren vorhandene Spielstaende weg.
    const roh = store.getItem(schluessel(slot)) ?? store.getItem(PRAEFIX_ALT + slot);
    if (!roh) return null;
    const eintrag = JSON.parse(roh) as SaveEntry;
    if (!eintrag?.state?.provinces) return null;
    // Auch gespeicherte Stände können aus einer älteren Fassung stammen.
    ergaenzeFehlendes(eintrag.state);
    return eintrag;
  } catch {
    return null;
  }
}

export function listSaves(): SaveMeta[] {
  const out: SaveMeta[] = [];
  for (const slot of [AUTOSAVE_SLOT, ...MANUAL_SLOTS]) {
    const e = loadGame(slot);
    if (e) {
      const { state, ...meta } = e;
      void state;
      out.push(meta);
    }
  }
  return out;
}

export function deleteSave(slot: string): SaveResult {
  try {
    store.removeItem(schluessel(slot));
    return { ok: true, message: 'Spielstand gelöscht.' };
  } catch (e) {
    return { ok: false, message: `Loeschen fehlgeschlagen: ${(e as Error).message}` };
  }
}

export function autosave(state: GameState): void {
  try { saveGame(AUTOSAVE_SLOT, state); } catch { /* Autosave ist nie kritisch */ }
}

export function exportState(state: GameState): string {
  return JSON.stringify({ format: 'imperwartor', version: 2, state }, null, 1);
}

/**
 * Ergänzt Felder, die ältere Spielstände noch nicht kennen.
 *
 * Ohne das stürzt ein Spielstand aus einer früheren Fassung ab, sobald die
 * erste Berechnung auf ein fehlendes Feld trifft - der Spieler verlöre seine
 * Partie. Jeder neue Wert bekommt hier einen vernünftigen Ersatz.
 */
export function ergaenzeFehlendes(s: GameState): GameState {
  if (!Array.isArray(s.missions)) s.missions = [];
  if (typeof s.missionZaehler !== 'number') s.missionZaehler = s.missions.length;
  if (typeof s.seed !== 'number') s.seed = s.rngState ?? 0;

  /* Der Kostenmassstab wird sonst undefiniert und alle Baukosten zu NaN.
     Er wird genauso berechnet wie beim Spielaufbau. */
  if (typeof s.kostenFaktor !== 'number' || !Number.isFinite(s.kostenFaktor)) {
    const summen: number[] = [];
    for (const cid of s.countryOrder ?? []) {
      let summe = 0;
      for (const pid of s.provinceOrder ?? []) {
        if (s.provinces[pid]?.ownerId === cid) summe += provinceOutput(s.provinces[pid]);
      }
      if (summe > 0) summen.push(summe);
    }
    summen.sort((a, b) => a - b);
    if (summen.length) {
      const median = summen[Math.floor(summen.length / 2)];
      const schnitt = summen.reduce((a, b) => a + b, 0) / summen.length;
      s.kostenFaktor = Math.min(6, Math.max(0.6, ((median + schnitt) / 2) / KOSTEN_BEZUG));
    } else {
      s.kostenFaktor = 1;
    }
  }

  // Herrscher fehlen in älteren Ständen; sie entstehen beim nächsten
  // Rundenwechsel von selbst, hier nur der Name als Rückfallebene.
  for (const cid of s.countryOrder ?? []) {
    const c = s.countries[cid];
    if (c && !c.intel) c.intel = {};
  }
  return s;
}

export function importState(text: string): GameState {
  const daten = JSON.parse(text);
  const s = daten?.state ?? daten;
  if (!s?.provinces || !s?.countries) throw new Error('Das ist kein gültiger Spielstand.');
  return ergaenzeFehlendes(s as GameState);
}

export async function copyToClipboard(state: GameState): Promise<SaveResult> {
  try {
    await navigator.clipboard.writeText(exportState(state));
    return { ok: true, message: 'Spielstand in die Zwischenablage kopiert.' };
  } catch {
    return { ok: false, message: 'Kopieren wurde abgelehnt. Nutze das Textfeld.' };
  }
}

export function downloadState(state: GameState): SaveResult {
  try {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imperwartor-${state.scenarioId}-runde${state.turn}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, message: 'Datei wurde erzeugt.' };
  } catch {
    return { ok: false, message: 'Der Rahmen erlaubt keinen Download. Nutze das Kopieren als Text.' };
  }
}

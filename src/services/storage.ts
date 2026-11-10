/**
 * Speichern und Laden von Spielständen über localStorage.
 * Alle Zugriffe sind gegen Fehler abgesichert (privater Modus, volle Quota usw.).
 */
import type { GameState } from '../models/types';
import { SAVE_VERSION } from '../engine/rules';

const PREFIX = 'empire-tactics';
export const SAVE_SLOTS = ['slot1', 'slot2', 'slot3'] as const;
export const AUTOSAVE_SLOT = 'autosave';

export type SaveSlotId = (typeof SAVE_SLOTS)[number] | typeof AUTOSAVE_SLOT;

export interface SaveSlotInfo {
  id: SaveSlotId;
  label: string;
  exists: boolean;
  scenarioName: string;
  countryName: string;
  turn: number;
  year: number;
  savedAt: string;
}

interface SavePayload {
  version: number;
  savedAt: string;
  state: GameState;
}

function storageKey(slot: SaveSlotId): string {
  return `${PREFIX}:${slot}`;
}

function isStorageAvailable(): boolean {
  try {
    const testKey = `${PREFIX}:test`;
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function saveGame(slot: SaveSlotId, state: GameState): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const payload: SavePayload = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state
    };
    window.localStorage.setItem(storageKey(slot), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Spielstand konnte nicht gespeichert werden:', error);
    return false;
  }
}

export function loadGame(slot: SaveSlotId): GameState | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slot));
    if (!raw) return null;
    const payload = JSON.parse(raw) as SavePayload;
    if (!payload || typeof payload !== 'object' || !payload.state) return null;
    if (payload.version !== SAVE_VERSION) {
      console.warn('Spielstand hat eine abweichende Version und wird ignoriert.');
      return null;
    }
    return payload.state;
  } catch (error) {
    console.error('Spielstand konnte nicht geladen werden:', error);
    return null;
  }
}

export function deleteGame(slot: SaveSlotId): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(storageKey(slot));
  } catch (error) {
    console.error('Spielstand konnte nicht gelöscht werden:', error);
  }
}

export function getSlotInfo(slot: SaveSlotId, label: string): SaveSlotInfo {
  const empty: SaveSlotInfo = {
    id: slot,
    label,
    exists: false,
    scenarioName: '',
    countryName: '',
    turn: 0,
    year: 0,
    savedAt: ''
  };
  if (!isStorageAvailable()) return empty;
  try {
    const raw = window.localStorage.getItem(storageKey(slot));
    if (!raw) return empty;
    const payload = JSON.parse(raw) as SavePayload;
    const state = payload?.state;
    if (!state) return empty;
    const country = state.countries[state.playerCountryId];
    return {
      id: slot,
      label,
      exists: true,
      scenarioName: state.scenarioName,
      countryName: country ? country.name : 'Unbekannt',
      turn: state.turn,
      year: state.year,
      savedAt: payload.savedAt ?? ''
    };
  } catch {
    return empty;
  }
}

export function listSlots(): SaveSlotInfo[] {
  return [
    getSlotInfo(AUTOSAVE_SLOT, 'Automatisch'),
    getSlotInfo('slot1', 'Platz 1'),
    getSlotInfo('slot2', 'Platz 2'),
    getSlotInfo('slot3', 'Platz 3')
  ];
}

/** Spielstand als JSON-Text exportieren. */
export function exportGame(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, savedAt: new Date().toISOString(), state }, null, 2);
}

/** Spielstand aus JSON-Text importieren. Gibt null zurück, wenn ungültig. */
export function importGame(text: string): GameState | null {
  try {
    const payload = JSON.parse(text) as SavePayload;
    if (!payload?.state?.countries || !payload.state.territories) return null;
    if (payload.version !== SAVE_VERSION) return null;
    return payload.state;
  } catch (error) {
    console.error('Import fehlgeschlagen:', error);
    return null;
  }
}

/**
 * Siegbedingungen, Niederlage und das Ausscheiden von Laendern.
 */

import type { GameState, VictoryCondition } from './types';
import { countryArmy, powerScore, provincesOf } from './rules';
import { computeFinances } from './economy';

export interface VictoryProgress {
  condition: VictoryCondition;
  current: number;
  target: number;
  fulfilled: boolean;
}

export function victoryProgress(state: GameState, countryId: string): VictoryProgress[] {
  const out: VictoryProgress[] = [];
  for (const b of state.victoryConditions) {
    let aktuell = 0;
    if (b.type === 'provinces') {
      aktuell = provincesOf(state, countryId).length;
    } else if (b.type === 'capitals') {
      const ziele = b.targets ?? [];
      aktuell = ziele.filter((pid) => {
        const p = state.provinces[pid];
        // Die eigene Hauptstadt zählt nicht als Eroberung.
        return p && p.ownerId === countryId && p.coreOf !== countryId;
      }).length;
    } else if (b.type === 'survive') {
      aktuell = state.turn;
    } else if (b.type === 'economy') {
      aktuell = Math.round(computeFinances(state, countryId).taxIncome);
    }
    out.push({ condition: b, current: aktuell, target: b.value, fulfilled: aktuell >= b.value });
  }
  return out;
}

/** Länder ohne Gebiete scheiden aus. */
export function updateCountrySurvival(state: GameState, melde: (t: string) => void): void {
  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    if (!c.alive) continue;
    if (provincesOf(state, cid).length === 0) {
      c.alive = false;
      c.overlordId = null;
      melde(`${c.name} ist von der Landkarte verschwunden.`);
      // Vasallen werden frei.
      for (const id of state.countryOrder) {
        if (state.countries[id].overlordId === cid) state.countries[id].overlordId = null;
      }
      // Bündnisse bereinigen
      for (const al of state.alliances) {
        al.memberIds = al.memberIds.filter((m) => m !== cid);
      }
      state.alliances = state.alliances.filter((al) => al.memberIds.length > 1);
    }
  }
}

export function checkGameStatus(state: GameState): void {
  if (state.status !== 'playing') return;
  const spieler = state.countries[state.playerCountryId];
  if (!spieler) return;

  const eigene = provincesOf(state, state.playerCountryId);
  if (eigene.length === 0 || !spieler.alive) {
    spieler.alive = false;
    state.status = 'defeat';
    state.statusMessage = `${spieler.name} hat alle Gebiete verloren. Die Partie ist beendet.`;
    return;
  }

  if (!state.sandbox) {
    const erfuellt = victoryProgress(state, state.playerCountryId).find((e) => e.fulfilled);
    if (erfuellt) {
      state.status = 'victory';
      state.statusMessage = `Siegbedingung erfüllt: ${erfuellt.condition.description}`;
      return;
    }
  }

  if (!state.sandbox && state.endYear && state.year >= state.endYear) {
    // Zeit abgelaufen: Wer die größte Macht hat, gewinnt nach Punkten.
    const rang = state.countryOrder
      .filter((id) => state.countries[id].alive)
      .map((id) => ({ id, p: powerScore(state, id) }))
      .sort((a, b) => b.p - a.p);
    const gewonnen = rang[0]?.id === state.playerCountryId;
    state.status = gewonnen ? 'victory' : 'defeat';
    state.statusMessage = gewonnen
      ? `Das Zeitalter endet mit ${spieler.name} als führender Macht.`
      : `Das Zeitalter endet. ${state.countries[rang[0].id].name} führt die Welt an.`;
  }
}

export function rangliste(state: GameState) {
  return state.countryOrder
    .map((id) => ({
      id,
      name: state.countries[id].name,
      color: state.countries[id].color,
      alive: state.countries[id].alive,
      provinces: provincesOf(state, id).length,
      army: countryArmy(state, id),
      power: powerScore(state, id),
      gold: Math.round(state.countries[id].gold),
    }))
    .sort((a, b) => b.power - a.power);
}

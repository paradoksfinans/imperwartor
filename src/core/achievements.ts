/**
 * Erfolge.
 *
 * Sie belohnen nicht das Durchhalten, sondern erkennbares Können: ein
 * gewonnener Krieg gegen einen Staerkeren, eine Festung im Sturm, ein Reich
 * ohne Unruhe. Jeder Erfolg wird genau einmal vergeben.
 */

import type { GameState } from './types';
import { countryArmy, powerScore, provincesOf, vassalsOf } from './rules';
import { computeFinances } from './economy';

interface ErfolgsDefinition {
  id: string;
  name: string;
  beschreibung: string;
  pruefe: (state: GameState, spielerId: string) => boolean;
}

const ERFOLGE: ErfolgsDefinition[] = [
  {
    id: 'erste_eroberung', name: 'Erste Eroberung',
    beschreibung: 'Ein fremdes Gebiet erobert.',
    pruefe: (s, id) => provincesOf(s, id).some((p) => p.coreOf && p.coreOf !== id),
  },
  {
    id: 'doppelt', name: 'Verdoppelt',
    beschreibung: 'Das eigene Reich auf die doppelte Anfangsgröße gebracht.',
    pruefe: (s, id) => {
      const start = s.history.find((h) => h.countryId === id)?.provinces ?? 0;
      return start > 0 && provincesOf(s, id).length >= start * 2;
    },
  },
  {
    id: 'hauptstadt', name: 'Fall einer Hauptstadt',
    beschreibung: 'Die Hauptstadt eines anderen Landes eingenommen.',
    pruefe: (s, id) => provincesOf(s, id).some((p) => p.isCapital && p.coreOf !== id),
  },
  {
    id: 'festungsbrecher', name: 'Festungsbrecher',
    beschreibung: 'Eine Festung der Stufe 3 oder höher genommen.',
    pruefe: (s, id) => provincesOf(s, id).some((p) => p.fortification >= 3 && p.coreOf !== id),
  },
  {
    id: 'lehnsherr', name: 'Lehnsherr',
    beschreibung: 'Ein anderes Land zum Vasallen gemacht.',
    pruefe: (s, id) => vassalsOf(s, id).length > 0,
  },
  {
    id: 'reich_und_ruhig', name: 'Reich und ruhig',
    beschreibung: 'Mindestens 2000 Gold bei einer Stabilität über 80.',
    pruefe: (s, id) => s.countries[id].gold >= 2000 && s.countries[id].stability >= 80,
  },
  {
    id: 'gelehrtenstaat', name: 'Gelehrtenstaat',
    beschreibung: 'Zwei Forschungsbereiche auf Stufe 6 gebracht.',
    pruefe: (s, id) => Object.values(s.countries[id].tech).filter((v) => v >= 6).length >= 2,
  },
  {
    id: 'grossmacht', name: 'Großmacht',
    beschreibung: 'Die höchste Machtkennzahl aller Länder erreicht.',
    pruefe: (s, id) => {
      const rang = s.countryOrder.filter((x) => s.countries[x].alive)
        .map((x) => ({ x, p: powerScore(s, x) })).sort((a, b) => b.p - a.p);
      return rang.length > 1 && rang[0].x === id;
    },
  },
  {
    id: 'heeresmacht', name: 'Heeresmacht',
    beschreibung: 'Mehr als 150 Einheiten im Feld.',
    pruefe: (s, id) => countryArmy(s, id) > 150,
  },
  {
    id: 'handelsnation', name: 'Handelsnation',
    beschreibung: 'Mehr als 400 Gold Handelseinnahmen je Runde.',
    pruefe: (s, id) => computeFinances(s, id).tradeIncome > 400,
  },
  {
    id: 'ohne_unruhe', name: 'Innerer Friede',
    beschreibung: 'Mindestens 10 Gebiete, keines mit Unruhe über 20.',
    pruefe: (s, id) => {
      const g = provincesOf(s, id);
      return g.length >= 10 && g.every((p) => p.unrest <= 20);
    },
  },
  {
    id: 'ueberlebt', name: 'Standhaft',
    beschreibung: 'Fünfzig Runden überstanden, ohne die Hauptstadt zu verlieren.',
    pruefe: (s, id) => {
      const c = s.countries[id];
      const hp = s.provinces[c.capitalProvinceId];
      return s.turn >= 50 && hp?.ownerId === id;
    },
  },
  {
    id: 'davids_sieg', name: 'Davids Sieg',
    beschreibung: 'Einen Krieg gegen ein Land mit doppelter Macht gewonnen.',
    pruefe: (s, id) => s.battleReports.some((b) => {
      if (b.attackerId !== id || !b.captured || !b.defenderId) return false;
      return powerScore(s, b.defenderId) > powerScore(s, id) * 1.6;
    }),
  },
];

export function pruefeErfolge(
  state: GameState, melde: (name: string, text: string) => void,
): void {
  const id = state.playerCountryId;
  for (const def of ERFOLGE) {
    if (state.achievements.some((a) => a.id === def.id)) continue;
    let erreicht = false;
    try { erreicht = def.pruefe(state, id); } catch { erreicht = false; }
    if (!erreicht) continue;
    state.achievements.push({
      id: def.id, name: def.name, beschreibung: def.beschreibung, turn: state.turn,
    });
    melde(def.name, def.beschreibung);
  }
}

export function alleErfolge(): Array<{ id: string; name: string; beschreibung: string }> {
  return ERFOLGE.map((e) => ({ id: e.id, name: e.name, beschreibung: e.beschreibung }));
}

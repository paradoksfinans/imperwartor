/**
 * Der Rundenwechsel - hier läuft alles zusammen.
 *
 * Die Reihenfolge der Phasen ist bewusst gewaehlt: Erst handeln die Gegner,
 * dann werden Belagerungen und Aufstände abgearbeitet, dann rechnet die
 * Wirtschaft ab. So wirkt sich ein verlorenes Gebiet sofort auf die
 * Einnahmen der neuen Runde aus.
 */

import type { GameState, LogKind } from './types';
import {
  TERRAIN, areAtWar, countryArmy, getRelation, powerScore, provincesOf,
  regimentsTotal, vassalsOf,
} from './rules';
import { applyEconomyTurn, recalculateSupply } from './economy';
import { processSieges } from './combat';
import { runAiTurn } from './ai';
import { checkVassalRebellion, decayTreaties, driftRelations, endWar, updateWarScores } from './diplomacy';
import { rollEvent } from './events';
import { checkGameStatus, updateCountrySurvival } from './victory';
import { pruefeErfolge } from './achievements';
import { createRandom } from './rng';
import { pruefeMissionen } from './missions';
import { altereHerrscher } from './herrscher';

export function addLog(state: GameState, kind: LogKind, text: string): void {
  state.seq += 1;
  state.log.unshift({ id: `l${state.seq}`, turn: state.turn, year: state.year, kind, text });
  if (state.log.length > 220) state.log.length = 220;
}

/* ------------------------------------------------------------------ */
/* Aufstände                                                          */
/* ------------------------------------------------------------------ */

function verarbeiteAufstaende(state: GameState, rnd: ReturnType<typeof createRandom>): void {
  for (const pid of state.provinceOrder) {
    const p = state.provinces[pid];
    if (!p.ownerId || p.unrest < 58) continue;
    const besitzer = state.countries[p.ownerId];
    if (!besitzer) continue;

    const wahrscheinlichkeit = (p.unrest - 58) / 180;
    if (!rnd.chance(wahrscheinlichkeit)) continue;

    const besatzung = regimentsTotal(p.regiments);
    const aufstaendische = Math.max(2, Math.round(p.population / 90000));

    if (besatzung >= aufstaendische) {
      // Niedergeschlagen, aber mit Verlusten.
      const verlust = Math.max(1, Math.round(besatzung * 0.12));
      let rest = verlust;
      for (const u of Object.keys(p.regiments) as Array<keyof typeof p.regiments>) {
        if (rest <= 0) break;
        const n = p.regiments[u] ?? 0;
        const ab = Math.min(n, rest);
        if (n - ab > 0) p.regiments[u] = n - ab; else delete p.regiments[u];
        rest -= ab;
      }
      p.unrest = Math.max(0, p.unrest - 28);
      addLog(state, 'war', `Aufstand in ${p.name} niedergeschlagen. Die Ruhe ist erzwungen, nicht gewonnen.`);
    } else {
      // Das Gebiet fällt ab - zurueck an den urspruenglichen Besitzer oder herrenlos.
      const zurueck = p.coreOf && p.coreOf !== p.ownerId && state.countries[p.coreOf]?.alive
        ? p.coreOf : null;
      p.regiments = {};
      p.siege = null;
      p.ownerId = zurueck;
      p.unrest = 40;
      p.capturedTurn = state.turn;
      besitzer.stability = Math.max(0, besitzer.stability - 5);
      addLog(state, 'war',
        zurueck
          ? `${p.name} hat sich erhoben und ist zu ${state.countries[zurueck].name} zurückgekehrt.`
          : `${p.name} hat sich für unabhängig erklärt.`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Kriegsbuchfuehrung                                                  */
/* ------------------------------------------------------------------ */

/** Hält fest, welche Gebiete im laufenden Krieg besetzt wurden. */
function aktualisiereBesetzungen(state: GameState): void {
  for (const war of state.wars) {
    war.occupiedByA = [];
    war.occupiedByB = [];
    for (const pid of state.provinceOrder) {
      const p = state.provinces[pid];
      if (!p.ownerId || !p.coreOf || p.coreOf === p.ownerId) continue;
      const haeltA = war.sideA.includes(p.ownerId);
      const haeltB = war.sideB.includes(p.ownerId);
      const gehoertA = war.sideA.includes(p.coreOf);
      const gehoertB = war.sideB.includes(p.coreOf);
      if (haeltA && gehoertB) war.occupiedByA.push(pid);
      else if (haeltB && gehoertA) war.occupiedByB.push(pid);
    }
  }
  updateWarScores(state);
}

/** Kriege, in denen eine Seite ausgeloescht ist, enden von selbst. */
function beendeLeereKriege(state: GameState): void {
  for (const war of [...state.wars]) {
    const aLebt = war.sideA.some((id) => state.countries[id]?.alive);
    const bLebt = war.sideB.some((id) => state.countries[id]?.alive);
    if (!aLebt || !bLebt) {
      state.wars = state.wars.filter((w) => w.id !== war.id);
      continue;
    }
    // Sehr lange, voellig festgefahrene Kriege laufen aus.
    if (state.turn - war.startTurn > 45 && Math.abs(war.scoreA) < 10) {
      endWar(state, war, (t) => addLog(state, 'peace', t));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hauptablauf                                                         */
/* ------------------------------------------------------------------ */

export function endTurn(state: GameState): void {
  if (state.status !== 'playing') return;
  const rnd = createRandom(state.rngState);

  /* 1. Gegner handeln */
  for (const cid of state.countryOrder) {
    if (cid === state.playerCountryId) continue;
    const c = state.countries[cid];
    if (!c.alive) continue;
    // Vasallen folgen ihrem Lehnsherrn und handeln zurueckhaltender.
    runAiTurn(state, cid, rnd);
  }

  /* 2. Belagerungen */
  processSieges(state, (t) => addLog(state, 'war', t));

  /* 3. Aufstände */
  verarbeiteAufstaende(state, rnd);
  checkVassalRebellion(state, (t) => addLog(state, 'war', t));

  /* 4. Versorgung neu bestimmen */
  recalculateSupply(state);

  /* 5. Wirtschaft, Forschung, Bau */
  applyEconomyTurn(state);

  /* 6. Diplomatie pflegen */
  decayTreaties(state);
  driftRelations(state);
  aktualisiereBesetzungen(state);
  beendeLeereKriege(state);

  /* 7. Zeit weiterstellen.
        Das Jahr wird aus dem Startjahr abgeleitet statt fortgeschrieben -
        so summieren sich keine Rundungsfehler über hundert Runden. */
  state.turn += 1;
  state.year = state.startYear + Math.floor(((state.turn - 1) * state.monthsPerTurn) / 12);

  /* 7b. Herrscher altern - und gegebenenfalls sterben */
  for (const w of altereHerrscher(state, rnd, state.monthsPerTurn)) {
    const land = state.countries[w.countryId];
    addLog(state, w.countryId === state.playerCountryId ? 'event' : 'info',
      `${land.name}: ${w.alterHerrscher} ist gestorben. `
      + `${w.neuerHerrscher.name} übernimmt die Regierung`
      + (w.bruch > 4 ? ' - die Nachfolge ist umstritten.' : '.'));

    /* Der eigene Thronwechsel ist ein Einschnitt und bekommt deshalb ein
       eigenes Fenster mit einer echten Entscheidung. Er wird als Ereignis
       eingereiht, damit er dieselbe Darstellung und denselben Ablauf
       nutzt wie alle anderen Ereignisse. */
    if (w.countryId === state.playerCountryId && !state.pendingEvent) {
      const n = w.neuerHerrscher;
      state.pendingEvent = {
        definitionId: 'thronwechsel',
        name: 'Thronwechsel',
        icon: '♔',
        description: `${w.alterHerrscher} ist gestorben. `
          + `${n.name} tritt die Nachfolge an - Verwaltung ${n.verwaltung}, `
          + `Diplomatie ${n.diplomatie}, Kriegskunst ${n.kriegskunst}. `
          + 'Wie soll der Übergang gestaltet werden?',
        choices: [
          {
            text: 'Prunkvolle Krönung - das Volk soll den neuen Herrn sehen',
            effects: { gold: -320, stability: 7, politicalPower: 5 },
          },
          {
            text: 'Stille Amtsübernahme - die Geschäfte laufen weiter',
            effects: { stability: 2 },
          },
          {
            text: 'Die Gelegenheit nutzen und die Gegner im Rat ausschalten',
            effects: { stability: -4, unrest: 8, politicalPower: 22 },
          },
        ],
      };
    }
  }

  /* 8. Ereignis */
  rollEvent(state, rnd);

  /* 9. Verlauf aufzeichnen */
  for (const cid of state.countryOrder) {
    if (!state.countries[cid].alive) continue;
    state.history.push({
      turn: state.turn,
      countryId: cid,
      provinces: provincesOf(state, cid).length,
      army: countryArmy(state, cid),
      gold: Math.round(state.countries[cid].gold),
      power: powerScore(state, cid),
    });
  }
  // Verlauf begrenzen, damit Spielstände nicht endlos wachsen.
  const maxPunkte = state.countryOrder.length * 160;
  if (state.history.length > maxPunkte) {
    state.history.splice(0, state.history.length - maxPunkte);
  }

  /* 10. Abschluss */
  updateCountrySurvival(state, (t) => addLog(state, 'war', t));
  pruefeMissionen(state, rnd, (m) =>
    addLog(state, 'achievement', `Ziel erreicht - ${m.name}: ${m.beschreibung}`));
  pruefeErfolge(state, (name, text) => addLog(state, 'achievement', `${name}: ${text}`));
  checkGameStatus(state);
  state.rngState = rnd.state();
}

export function istImKrieg(state: GameState, countryId: string): boolean {
  return state.wars.some((w) => w.sideA.includes(countryId) || w.sideB.includes(countryId));
}

export function nachbarLaender(state: GameState, countryId: string): string[] {
  const out = new Set<string>();
  for (const p of provincesOf(state, countryId)) {
    for (const n of p.neighbors) {
      const q = state.provinces[n];
      if (q?.ownerId && q.ownerId !== countryId) out.add(q.ownerId);
    }
  }
  return [...out];
}

export function beziehungsUebersicht(state: GameState, countryId: string) {
  return state.countryOrder
    .filter((id) => id !== countryId && state.countries[id].alive)
    .map((id) => ({
      id,
      wert: getRelation(state, countryId, id),
      krieg: areAtWar(state, countryId, id),
      vasall: state.countries[id].overlordId === countryId,
      gelaende: TERRAIN,
      vasallen: vassalsOf(state, id).length,
    }));
}

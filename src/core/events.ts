/**
 * Ereignisse: Auswahl, Bedingungen und Wirkung der Entscheidungen.
 */

import type { EventEffects, GameEventDefinition, GameState, PendingEvent } from './types';
import { changeRelation, countryArmy, provincesOf, regimentsTotal, UNIT_ORDER } from './rules';
import { eventDefinitions } from '../data/index';
import type { Random } from './rng';

function bedingungenErfuellt(state: GameState, def: GameEventDefinition): boolean {
  const c = state.countries[state.playerCountryId];
  if (!c) return false;
  const b = def.conditions ?? {};

  if (b.minTurn !== undefined && state.turn < b.minTurn) return false;
  if (b.minYear !== undefined && state.year < b.minYear) return false;
  if (b.maxYear !== undefined && state.year > b.maxYear) return false;
  if (b.goldBelow !== undefined && c.gold >= b.goldBelow) return false;
  if (b.goldAbove !== undefined && c.gold <= b.goldAbove) return false;
  if (b.stabilityBelow !== undefined && c.stability >= b.stabilityBelow) return false;
  if (b.stabilityAbove !== undefined && c.stability <= b.stabilityAbove) return false;
  if (b.provincesAbove !== undefined && provincesOf(state, c.id).length <= b.provincesAbove) return false;
  if (b.armyAbove !== undefined && countryArmy(state, c.id) <= b.armyAbove) return false;
  if (b.atWar !== undefined) {
    const imKrieg = state.wars.some((w) => w.sideA.includes(c.id) || w.sideB.includes(c.id));
    if (imKrieg !== b.atWar) return false;
  }
  return true;
}

/** Waehlt höchstens ein Ereignis je Runde aus. */
export function rollEvent(state: GameState, rnd: Random): PendingEvent | null {
  if (state.pendingEvent) return state.pendingEvent;

  const moeglich = eventDefinitions.filter((def) => {
    if (!state.eventPool.includes(def.id)) return false;
    if (!def.repeatable && state.firedEvents.includes(def.id)) return false;
    return bedingungenErfuellt(state, def);
  });
  if (!moeglich.length) return null;

  // Jedes Ereignis wuerfelt einzeln; das erste, das fällt, kommt.
  const gemischt = [...moeglich].sort(() => rnd.next() - 0.5);
  for (const def of gemischt) {
    if (!rnd.chance(def.probability)) continue;
    state.firedEvents.push(def.id);
    const ev: PendingEvent = {
      definitionId: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon ?? '!',
      choices: def.choices,
    };
    state.pendingEvent = ev;
    return ev;
  }
  return null;
}

/** Wendet die Folgen einer Entscheidung auf das Spielerland an. */
export function applyEventEffects(state: GameState, effects: EventEffects): void {
  const c = state.countries[state.playerCountryId];
  if (!c) return;

  if (effects.gold) c.gold = Math.max(0, c.gold + effects.gold);
  if (effects.stability) c.stability = Math.max(0, Math.min(100, c.stability + effects.stability));
  if (effects.politicalPower) c.politicalPower = Math.max(0, c.politicalPower + effects.politicalPower);
  if (effects.warExhaustion) {
    c.warExhaustion = Math.max(0, Math.min(100, c.warExhaustion + effects.warExhaustion));
  }
  if (effects.manpower) c.manpower = Math.max(0, c.manpower + effects.manpower);

  const eigene = provincesOf(state, c.id);

  if (effects.unrest) {
    for (const p of eigene) p.unrest = Math.max(0, Math.min(100, p.unrest + effects.unrest));
  }
  if (effects.populationPct) {
    const f = 1 + effects.populationPct / 100;
    for (const p of eigene) p.population = Math.max(1000, Math.round(p.population * f));
  }
  if (effects.armyPct) {
    const f = 1 + effects.armyPct / 100;
    for (const p of eigene) {
      for (const u of UNIT_ORDER) {
        const n = p.regiments[u];
        if (!n) continue;
        const neu = Math.max(0, Math.round(n * f));
        if (neu > 0) p.regiments[u] = neu; else delete p.regiments[u];
      }
    }
    // Bei Zuwachs ohne vorhandene Truppen wenigstens Fußvolk stellen.
    if (effects.armyPct > 0) {
      const gesamt = eigene.reduce((s, p) => s + regimentsTotal(p.regiments), 0);
      if (gesamt === 0 && eigene.length) {
        eigene[0].regiments.infantry = Math.max(1, Math.round(effects.armyPct / 5));
      }
    }
  }
  if (effects.researchPoints && c.research) {
    c.research.progress += effects.researchPoints;
  }
  if (effects.relationsAll) {
    for (const id of state.countryOrder) {
      if (id !== c.id) changeRelation(state, c.id, id, effects.relationsAll);
    }
  }
}

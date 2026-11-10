/**
 * Ereignissystem: Auswahl passender Ereignisse, Ereignisketten und Folgen.
 */
import type { GameEventDefinition, GameState } from '../models/types';
import { getAllEvents, getEvent } from '../services/contentService';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import { RESOURCE_ORDER } from './army';
import { changeRelation, getCountryTerritories, isAtWarAtAll } from './rules';

function matchesConditions(
  state: GameState,
  countryId: string,
  definition: GameEventDefinition
): boolean {
  const country = state.countries[countryId];
  if (!country) return false;
  if (definition.chainOnly) return false;
  const conditions = definition.conditions;
  const territories = getCountryTerritories(state, countryId);

  if (conditions.minTurn !== undefined && state.turn < conditions.minTurn) return false;
  if (conditions.goldBelow !== undefined && country.gold >= conditions.goldBelow) return false;
  if (conditions.goldAbove !== undefined && country.gold <= conditions.goldAbove) return false;
  if (conditions.stabilityBelow !== undefined && country.stability >= conditions.stabilityBelow) return false;
  if (conditions.stabilityAbove !== undefined && country.stability <= conditions.stabilityAbove) return false;
  if (conditions.minTerritories !== undefined && territories.length < conditions.minTerritories) return false;
  if (conditions.hasVassal !== undefined && conditions.hasVassal !== country.vassals.length > 0) return false;
  if (conditions.unrestAbove !== undefined) {
    const maxUnrest = territories.reduce((max, t) => Math.max(max, t.unrest), 0);
    if (maxUnrest <= conditions.unrestAbove) return false;
  }
  if (conditions.atWar !== undefined && isAtWarAtAll(state, countryId) !== conditions.atWar) return false;
  if (definition.once && state.firedEvents.includes(`${countryId}:${definition.id}`)) return false;

  return true;
}

/**
 * Sucht ein passendes Ereignis für den Spieler und setzt es als ausstehend.
 * Pro Runde wird höchstens ein Ereignis erzeugt. Geplante Folgeereignisse
 * haben Vorrang.
 */
export function rollEventForPlayer(state: GameState, rng: Rng): void {
  if (state.pendingEvent) return;

  // 1. Fällige Folgeereignisse
  const dueIndex = state.scheduledEvents.findIndex(
    (entry) => entry.countryId === state.playerCountryId && entry.turn <= state.turn
  );
  if (dueIndex >= 0) {
    const scheduled = state.scheduledEvents[dueIndex];
    state.scheduledEvents.splice(dueIndex, 1);
    if (getEvent(scheduled.definitionId)) {
      state.pendingEvent = { definitionId: scheduled.definitionId, countryId: scheduled.countryId };
      return;
    }
  }

  // 2. Normale Ereignisse
  const candidates = getAllEvents().filter((definition) =>
    matchesConditions(state, state.playerCountryId, definition)
  );
  if (candidates.length === 0) return;

  const chosen = rng.pick(candidates);
  if (!chosen || !rng.chance(chosen.probability)) return;

  state.pendingEvent = { definitionId: chosen.id, countryId: state.playerCountryId };
  if (chosen.once) state.firedEvents.push(`${state.playerCountryId}:${chosen.id}`);
}

/** Wendet die gewählte Antwort eines Ereignisses an. */
export function resolveEventChoice(state: GameState, choiceIndex: number): string {
  const pending = state.pendingEvent;
  if (!pending) return '';
  const definition = getEvent(pending.definitionId);
  state.pendingEvent = null;
  if (!definition) return '';

  const choice = definition.choices[choiceIndex];
  if (!choice) return '';

  const country = state.countries[pending.countryId];
  if (!country) return choice.resultText;

  const effects = choice.effects;

  if (effects.gold) country.gold = Math.max(0, country.gold + effects.gold);
  if (effects.stability) country.stability = clamp(country.stability + effects.stability, 0, 100);
  if (effects.research) country.researchPoints = Math.max(0, country.researchPoints + effects.research);
  if (effects.warExhaustion) {
    country.warExhaustion = clamp(country.warExhaustion + effects.warExhaustion, 0, 100);
  }
  if (effects.politicalPower) {
    country.politicalPower = clamp(country.politicalPower + effects.politicalPower, 0, 400);
  }
  if (effects.prestige) country.prestige = clamp(country.prestige + effects.prestige, -60, 160);
  if (effects.resources) {
    for (const key of RESOURCE_ORDER) {
      const amount = effects.resources[key];
      if (amount) country.resources[key] = clamp(country.resources[key] + amount, 0, 999);
    }
  }

  const territories = getCountryTerritories(state, pending.countryId);

  if (effects.population && territories.length > 0) {
    const perTerritory = Math.round(effects.population / territories.length);
    for (const territory of territories) {
      territory.population = Math.max(120, territory.population + perTerritory);
    }
  }
  if (effects.unrest) {
    for (const territory of territories) {
      territory.unrest = clamp(territory.unrest + effects.unrest, 0, 100);
    }
  }
  if (effects.army) {
    const capital = state.territories[country.capitalId];
    const target = capital && capital.ownerId === country.id ? capital : territories[0];
    if (target) {
      if (effects.army > 0) {
        target.army.infantry += effects.army;
      } else {
        const loss = Math.min(target.army.infantry, Math.abs(effects.army));
        target.army.infantry -= loss;
      }
    }
  }
  if (effects.relations) {
    for (const otherId of state.countryOrder) {
      if (otherId === pending.countryId) continue;
      changeRelation(state, pending.countryId, otherId, effects.relations);
    }
  }

  if (choice.followUp && getEvent(choice.followUp)) {
    state.scheduledEvents.push({
      definitionId: choice.followUp,
      countryId: pending.countryId,
      turn: state.turn + 2
    });
  }

  state.log.unshift({
    turn: state.turn,
    type: 'event',
    text: `${definition.name}: ${choice.resultText}`,
    important: true
  });

  return choice.resultText;
}

/**
 * Einfache Ereignisse für KI-Länder: werden automatisch mit der
 * plausibelsten Option aufgelöst, damit die Welt lebendig bleibt.
 */
export function rollEventForAi(state: GameState, countryId: string, rng: Rng): void {
  const country = state.countries[countryId];
  if (!country || country.isPlayer) return;
  if (!rng.chance(0.12)) return;

  const candidates = getAllEvents().filter(
    (definition) => matchesConditions(state, countryId, definition) && definition.choices.length > 0
  );
  const chosen = rng.pick(candidates);
  if (!chosen) return;

  // Die KI wählt die Option mit dem besten Sofortnutzen.
  let bestIndex = 0;
  let bestValue = -Infinity;
  chosen.choices.forEach((choice, index) => {
    const effects = choice.effects;
    const value =
      (effects.gold ?? 0) * 0.01 +
      (effects.stability ?? 0) * 0.6 +
      (effects.research ?? 0) * 0.08 +
      (effects.army ?? 0) * 0.5 +
      (effects.politicalPower ?? 0) * 0.4 -
      (effects.unrest ?? 0) * 0.4;
    if (value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });

  const effects = chosen.choices[bestIndex].effects;
  if (effects.gold) country.gold = Math.max(0, country.gold + effects.gold);
  if (effects.stability) country.stability = clamp(country.stability + effects.stability, 0, 100);
  if (effects.research) country.researchPoints = Math.max(0, country.researchPoints + effects.research);
  if (effects.politicalPower) {
    country.politicalPower = clamp(country.politicalPower + effects.politicalPower, 0, 400);
  }
  if (effects.army) {
    const capital = state.territories[country.capitalId];
    if (capital && capital.ownerId === countryId) {
      capital.army.infantry = Math.max(0, capital.army.infantry + effects.army);
    }
  }
  if (chosen.once) state.firedEvents.push(`${countryId}:${chosen.id}`);
}

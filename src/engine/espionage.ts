/**
 * Spionage: Aufklärung, Sabotage, Aufwiegelung und Diebstahl.
 * Jede Mission kostet politische Macht und Gold und kann entdeckt werden.
 */
import type { ActionResult, GameState } from '../models/types';
import { getTerritoryDefinition } from '../services/contentService';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import { scaleArmy } from './army';
import { changeRelation, getCountryTerritories, getTechBonus } from './rules';

export type EspionageMissionId = 'recon' | 'sabotage' | 'incite' | 'steal' | 'counter';

export interface EspionageMission {
  id: EspionageMissionId;
  name: string;
  description: string;
  goldCost: number;
  powerCost: number;
  baseChance: number;
  needsTerritory: boolean;
}

export const ESPIONAGE_MISSIONS: EspionageMission[] = [
  {
    id: 'recon',
    name: 'Aufklärung',
    description: 'Deckt Armeen, Wirtschaft und Pläne des Ziels dauerhaft auf.',
    goldCost: 150,
    powerCost: 6,
    baseChance: 0.85,
    needsTerritory: false
  },
  {
    id: 'sabotage',
    name: 'Sabotage',
    description: 'Beschädigt Befestigungen und Vorräte eines feindlichen Gebietes.',
    goldCost: 260,
    powerCost: 12,
    baseChance: 0.55,
    needsTerritory: true
  },
  {
    id: 'incite',
    name: 'Aufwiegeln',
    description: 'Schürt Unruhe in einem Gebiet und kann Aufstände auslösen.',
    goldCost: 240,
    powerCost: 12,
    baseChance: 0.6,
    needsTerritory: true
  },
  {
    id: 'steal',
    name: 'Schatzraub',
    description: 'Entwendet Gold aus der feindlichen Staatskasse.',
    goldCost: 180,
    powerCost: 10,
    baseChance: 0.5,
    needsTerritory: false
  },
  {
    id: 'counter',
    name: 'Spionageabwehr',
    description: 'Verstärkt den eigenen Schutz und senkt fremde Erfolgschancen.',
    goldCost: 200,
    powerCost: 8,
    baseChance: 1,
    needsTerritory: false
  }
];

export function getMission(id: EspionageMissionId): EspionageMission {
  const found = ESPIONAGE_MISSIONS.find((mission) => mission.id === id);
  if (!found) throw new Error(`Unbekannte Mission: ${id}`);
  return found;
}

/** Erfolgswahrscheinlichkeit einer Mission. */
export function getMissionChance(
  state: GameState,
  actorId: string,
  targetId: string,
  missionId: EspionageMissionId
): number {
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  if (!actor || !target) return 0;
  const mission = getMission(missionId);
  const actorBonus = getTechBonus(actor).espionage;
  const targetBonus = getTechBonus(target).espionage;
  const intel = (actor.intel[targetId] ?? 0) * 0.05;
  const stabilityFactor = (60 - target.stability) / 300;
  return clamp(mission.baseChance + actorBonus - targetBonus + intel + stabilityFactor, 0.1, 0.95);
}

/** Aufklärungsstufe gegenüber einem anderen Land (0..3). */
export function getIntelLevel(state: GameState, viewerId: string, targetId: string): number {
  if (viewerId === targetId) return 3;
  if (!state.options.fogOfWar) return 3;
  const viewer = state.countries[viewerId];
  if (!viewer) return 0;
  let level = viewer.intel[targetId] ?? 0;
  // Nachbarschaft, Handel und Bündnisse geben Grundwissen
  const neighbourKnown = getCountryTerritories(state, viewerId).some((territory) =>
    getTerritoryDefinition(state.mapId, territory.id).neighbours.some(
      (id) => state.territories[id]?.ownerId === targetId
    )
  );
  if (neighbourKnown) level = Math.max(level, 1);
  if (state.trades.some((t) => (t.a === viewerId && t.b === targetId) || (t.b === viewerId && t.a === targetId))) {
    level = Math.max(level, 2);
  }
  if (state.alliances.some((a) => a.members.includes(viewerId) && a.members.includes(targetId))) {
    level = Math.max(level, 3);
  }
  if (state.wars.some(
    (war) =>
      (war.attackers.includes(viewerId) && war.defenders.includes(targetId)) ||
      (war.defenders.includes(viewerId) && war.attackers.includes(targetId))
  )) {
    level = Math.max(level, 2);
  }
  return clamp(level, 0, 3);
}

export function runEspionageMission(
  state: GameState,
  actorId: string,
  targetId: string,
  missionId: EspionageMissionId,
  territoryId?: string
): ActionResult {
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  if (!actor || !target) return { ok: false, message: 'Ungültiges Ziel.' };
  if (actorId === targetId && missionId !== 'counter') {
    return { ok: false, message: 'Das eigene Land kann nicht ausspioniert werden.' };
  }

  const mission = getMission(missionId);
  if (actor.gold < mission.goldCost) {
    return { ok: false, message: `Nicht genug Gold (benötigt: ${mission.goldCost}).` };
  }
  if (actor.politicalPower < mission.powerCost) {
    return { ok: false, message: `Nicht genug politische Macht (benötigt: ${mission.powerCost}).` };
  }
  if (actor.actionPoints < 1) {
    return { ok: false, message: 'Keine Aktionspunkte mehr in dieser Runde.' };
  }
  if (mission.needsTerritory) {
    const territory = territoryId ? state.territories[territoryId] : null;
    if (!territory || territory.ownerId !== targetId) {
      return { ok: false, message: 'Bitte ein Gebiet des Ziellandes auswählen.' };
    }
  }

  actor.gold -= mission.goldCost;
  actor.politicalPower -= mission.powerCost;
  actor.actionPoints -= 1;

  if (missionId === 'counter') {
    actor.intel[actorId] = 3;
    actor.stability = clamp(actor.stability + 3, 0, 100);
    return { ok: true, message: 'Die Spionageabwehr wurde verstärkt.' };
  }

  const rng = new Rng(state.rngSeed);
  const chance = getMissionChance(state, actorId, targetId, missionId);
  const success = rng.chance(chance);
  const detected = rng.chance(success ? 0.25 : 0.55);
  state.rngSeed = rng.seed;

  let message = '';

  if (success) {
    switch (missionId) {
      case 'recon': {
        actor.intel[targetId] = 3;
        message = `Aufklärung erfolgreich: ${target.name} liegt offen vor dir.`;
        break;
      }
      case 'sabotage': {
        const territory = state.territories[territoryId as string];
        if (territory) {
          territory.fortification = Math.max(0, territory.fortification - 1);
          territory.army = scaleArmy(territory.army, 0.92);
          territory.devastation = clamp(territory.devastation + 12, 0, 100);
          message = `Sabotage gelungen: Die Befestigungen von ${
            getTerritoryDefinition(state.mapId, territory.id).name
          } sind beschädigt.`;
        }
        break;
      }
      case 'incite': {
        const territory = state.territories[territoryId as string];
        if (territory) {
          territory.unrest = clamp(territory.unrest + 30, 0, 100);
          message = `Aufwiegelung gelungen: In ${
            getTerritoryDefinition(state.mapId, territory.id).name
          } wächst der Widerstand.`;
        }
        break;
      }
      case 'steal': {
        const amount = Math.round(Math.min(700, target.gold * 0.25));
        target.gold = Math.max(0, target.gold - amount);
        actor.gold += amount;
        message = `Schatzraub gelungen: ${amount} Gold erbeutet.`;
        break;
      }
      default:
        break;
    }
  } else {
    message = 'Die Mission ist fehlgeschlagen.';
  }

  if (detected) {
    changeRelation(state, actorId, targetId, -18);
    actor.prestige = clamp(actor.prestige - 4, -60, 160);
    message += ' Die Agenten wurden entdeckt - das belastet die Beziehungen.';
    state.log.unshift({
      turn: state.turn,
      type: 'espionage',
      text: `${target.name} entdeckt Agenten von ${actor.name}.`,
      important: targetId === state.playerCountryId
    });
  }

  return { ok: true, message };
}

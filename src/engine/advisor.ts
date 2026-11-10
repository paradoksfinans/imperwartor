/**
 * Ratgeber.
 *
 * Liest den Spielzustand und leitet daraus konkrete Hinweise ab: ungenutzte
 * Möglichkeiten, drohende Gefahren und fällige Entscheidungen. Der Ratgeber
 * trifft keine Entscheidungen und verändert nichts.
 */
import type { GameState } from '../models/types';
import { getAllProjects, getTerritoryDefinition } from '../services/contentService';
import { armySize, landSize } from './army';
import { calculateIncome, getResourceConsumption } from './economy';
import { getWarScoreFor } from './diplomacy';
import { getAvailableTechnologies } from './research';
import {
  GENERAL_COST_GOLD,
  GENERAL_COST_POWER,
  areAtWar,
  getCountryTerritories,
  getGeneralLimit,
  getNeighbourIds,
  getSupplyCapacity
} from './rules';

export type AdviceSeverity = 'urgent' | 'chance' | 'info';

export interface Advice {
  id: string;
  text: string;
  severity: AdviceSeverity;
  /** Gebiet, auf das der Hinweis zeigt. */
  territoryId?: string;
  /** Bereich des Dossiers, der den Hinweis beantwortet. */
  panel?: 'realm' | 'territory' | 'military' | 'diplomacy' | 'economy' | 'research' | 'intel';
}

/** Alle Hinweise, nach Dringlichkeit geordnet. */
export function getAdvice(state: GameState): Advice[] {
  const player = state.countries[state.playerCountryId];
  if (!player || state.status !== 'playing') return [];

  const advice: Advice[] = [];
  const territories = getCountryTerritories(state, player.id);
  const income = calculateIncome(state, player.id);

  /* --- Gefahren --- */

  if (income.net < 0) {
    advice.push({
      id: 'deficit',
      text: `Haushalt im Minus (${Math.round(income.net)} je Runde)`,
      severity: 'urgent',
      panel: 'economy'
    });
  }

  if (player.stability < 35) {
    advice.push({
      id: 'stability',
      text: `Zufriedenheit nur ${Math.round(player.stability)} - Aufstände drohen`,
      severity: 'urgent',
      panel: 'economy'
    });
  }

  const consumption = getResourceConsumption(state, player.id);
  for (const key of ['grain', 'iron', 'timber', 'horses', 'luxury'] as const) {
    if (consumption[key] > 0 && player.resources[key] < consumption[key]) {
      advice.push({
        id: `shortage_${key}`,
        text: `Vorräte reichen nicht: ${key === 'grain' ? 'Getreide' : key === 'iron' ? 'Eisen' : key === 'timber' ? 'Holz' : key === 'horses' ? 'Pferde' : 'Luxusgüter'}`,
        severity: 'urgent',
        panel: 'economy'
      });
      break;
    }
  }

  for (const territory of territories) {
    if (territory.unrest > 60) {
      advice.push({
        id: `unrest_${territory.id}`,
        text: `Unruhe in ${territoryName(state, territory.id)} (${Math.round(territory.unrest)})`,
        severity: 'urgent',
        territoryId: territory.id,
        panel: 'territory'
      });
    }
    const capacity = getSupplyCapacity(state, player, territory);
    if (armySize(territory.army) > capacity * 1.05) {
      advice.push({
        id: `supply_${territory.id}`,
        text: `${territoryName(state, territory.id)} kann die Truppen nicht versorgen`,
        severity: 'urgent',
        territoryId: territory.id,
        panel: 'territory'
      });
    }
    if (territory.blockaded) {
      advice.push({
        id: `blockade_${territory.id}`,
        text: `${territoryName(state, territory.id)} ist blockiert`,
        severity: 'urgent',
        territoryId: territory.id,
        panel: 'military'
      });
    }
  }

  // Ungeschützte Grenze zu einem Kriegsgegner
  for (const territory of territories) {
    if (landSize(territory.army) > 6) continue;
    const threatened = getNeighbourIds(state, territory.id).some((id) => {
      const neighbour = state.territories[id];
      if (!neighbour || !neighbour.ownerId || neighbour.ownerId === player.id) return false;
      return areAtWar(state, player.id, neighbour.ownerId) && landSize(neighbour.army) > 8;
    });
    if (threatened) {
      advice.push({
        id: `exposed_${territory.id}`,
        text: `${territoryName(state, territory.id)} liegt ungeschützt an der Front`,
        severity: 'urgent',
        territoryId: territory.id,
        panel: 'territory'
      });
    }
  }

  /* --- Gelegenheiten --- */

  for (const war of state.wars) {
    const involved = war.attackers.includes(player.id) || war.defenders.includes(player.id);
    if (!involved) continue;
    const score = getWarScoreFor(war, player.id);
    if (score >= 40) {
      const opponents = war.attackers.includes(player.id) ? war.defenders : war.attackers;
      const name = state.countries[opponents[0]]?.name ?? 'Gegner';
      advice.push({
        id: `peace_${war.id}`,
        text: `Günstiger Frieden mit ${name} möglich (Fortschritt ${Math.round(score)})`,
        severity: 'chance',
        panel: 'diplomacy'
      });
    } else if (score <= -40) {
      advice.push({
        id: `losing_${war.id}`,
        text: 'Der Krieg läuft schlecht - Frieden suchen',
        severity: 'urgent',
        panel: 'diplomacy'
      });
    }
  }

  if (!player.currentResearchId && getAvailableTechnologies(state, player.id).length > 0) {
    advice.push({
      id: 'research_idle',
      text: 'Keine Forschung gewählt',
      severity: 'chance',
      panel: 'research'
    });
  }

  const idle = territories.filter((territory) => territory.construction.length === 0);
  if (idle.length > 0 && player.gold > 400) {
    advice.push({
      id: 'build_idle',
      text: `${idle.length} Gebiete ohne Bauvorhaben`,
      severity: 'chance',
      territoryId: idle[0].id,
      panel: 'territory'
    });
  }

  if (
    player.generals.length < getGeneralLimit(state, player.id) &&
    player.gold >= GENERAL_COST_GOLD &&
    player.politicalPower >= GENERAL_COST_POWER
  ) {
    advice.push({
      id: 'hire_general',
      text: 'Ein Feldherr könnte angeworben werden',
      severity: 'chance',
      panel: 'military'
    });
  }

  const openProject = getAllProjects().find(
    (project) =>
      !player.completedProjects.includes(project.id) &&
      player.gold >= project.gold &&
      (!project.requiresTech || player.technologies.includes(project.requiresTech))
  );
  if (openProject && territories.some((territory) => territory.construction.length === 0)) {
    advice.push({
      id: 'project',
      text: `Großprojekt möglich: ${openProject.name}`,
      severity: 'chance',
      panel: 'territory'
    });
  }

  if (player.actionPoints >= Math.max(2, player.maxActionPoints - 1)) {
    advice.push({
      id: 'action_points',
      text: `${player.actionPoints} Aktionspunkte offen`,
      severity: 'info',
      panel: 'realm'
    });
  }

  const order: Record<AdviceSeverity, number> = { urgent: 0, chance: 1, info: 2 };
  return advice.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 12);
}

function territoryName(state: GameState, territoryId: string): string {
  try {
    return getTerritoryDefinition(state.mapId, territoryId).name;
  } catch {
    return territoryId;
  }
}

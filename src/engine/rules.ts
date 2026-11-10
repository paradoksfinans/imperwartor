/**
 * Zentrale Spielregeln, Balancing-Konstanten und abgeleitete Werte.
 * Alle Zahlen, die das Spielgefühl bestimmen, stehen hier an einer Stelle.
 */
import type {
  BuildingId,
  CountryState,
  Difficulty,
  GameState,
  GovernmentType,
  ProjectId,
  TechEffects,
  TerrainType,
  TerritoryState
} from '../models/types';
import { getBuilding, getTechnology, getTerritoryDefinition } from '../services/contentService';
import { clamp, relationKey } from '../utils/helpers';
import { armySize, armyUpkeep, landSize, supplyDemand } from './army';

/** Versionsnummer des Speicherformats. */
export const SAVE_VERSION = 3;

export const BASE_ACTION_POINTS = 6;
/** So viele Vorhaben kann ein Gebiet gleichzeitig vormerken. */
export const MAX_CONSTRUCTION_QUEUE = 3;
export const ADMIN_COST_PER_TERRITORY = 16;
export const MIN_TAX_RATE = 0.1;
export const MAX_TAX_RATE = 0.6;
export const VASSAL_TRIBUTE_SHARE = 0.25;
export const CLAIM_COST = 25;
export const GENERAL_COST_POWER = 30;
export const GENERAL_COST_GOLD = 320;

/* ------------------------------------------------------------------ */
/* Gelände                                                            */
/* ------------------------------------------------------------------ */

export interface TerrainInfo {
  name: string;
  defense: number;
  supply: number;
  economy: number;
  movementPenalty: number;
  color: string;
  /** Kurzbeschreibung für die Oberfläche. */
  hint: string;
}

export const TERRAIN_INFO: Record<TerrainType, TerrainInfo> = {
  plain: {
    name: 'Ebene', defense: 1.0, supply: 1.05, economy: 1.0, movementPenalty: 0,
    color: '#7f9c5c', hint: 'Offenes Land - ideal für Kavallerie.'
  },
  forest: {
    name: 'Wald', defense: 1.18, supply: 0.95, economy: 0.95, movementPenalty: 0,
    color: '#3f6b43', hint: 'Deckung für Infanterie, schlecht für Reiter.'
  },
  mountain: {
    name: 'Gebirge', defense: 1.45, supply: 0.78, economy: 0.85, movementPenalty: 1,
    color: '#848b95', hint: 'Starke Verteidigung, schwere Versorgung.'
  },
  desert: {
    name: 'Wüste', defense: 0.95, supply: 0.6, economy: 0.72, movementPenalty: 1,
    color: '#c7a85f', hint: 'Große Armeen verdursten hier.'
  },
  swamp: {
    name: 'Sumpf', defense: 1.22, supply: 0.68, economy: 0.75, movementPenalty: 1,
    color: '#5c6b4a', hint: 'Langsam, zäh, schwer zu nehmen.'
  },
  steppe: {
    name: 'Steppe', defense: 0.88, supply: 0.92, economy: 0.9, movementPenalty: 0,
    color: '#b0a05f', hint: 'Reiterland. Angriffe sind hier besonders stark.'
  },
  coast: {
    name: 'Küste', defense: 1.0, supply: 1.12, economy: 1.18, movementPenalty: 0,
    color: '#6ca68c', hint: 'Handel und Flotten - aber auch Blockaden.'
  },
  island: {
    name: 'Insel', defense: 1.12, supply: 0.9, economy: 1.08, movementPenalty: 1,
    color: '#549a8d', hint: 'Nur über See erreichbar.'
  },
  urban: {
    name: 'Stadtgebiet', defense: 1.28, supply: 1.18, economy: 1.4, movementPenalty: 0,
    color: '#9d98a8', hint: 'Wirtschaftszentrum und schwer zu stürmen.'
  }
};

/* ------------------------------------------------------------------ */
/* Regierungsformen                                                    */
/* ------------------------------------------------------------------ */

export interface GovernmentInfo {
  name: string;
  income: number;
  attack: number;
  defense: number;
  stability: number;
  diplomacy: number;
  politicalPower: number;
  description: string;
}

export const GOVERNMENT_INFO: Record<GovernmentType, GovernmentInfo> = {
  monarchy: {
    name: 'Monarchie', income: 1.0, attack: 1.02, defense: 1.05, stability: 5,
    diplomacy: 1.0, politicalPower: 4,
    description: 'Höhere Stabilität und Legitimität, träge Reformen.'
  },
  republic: {
    name: 'Republik', income: 1.12, attack: 0.95, defense: 1.0, stability: 0,
    diplomacy: 1.18, politicalPower: 3,
    description: 'Beste Wirtschaft und Diplomatie, abhängig von Zufriedenheit.'
  },
  military: {
    name: 'Militärregierung', income: 0.95, attack: 1.16, defense: 1.1, stability: -3,
    diplomacy: 0.78, politicalPower: 5,
    description: 'Starke Armee und günstiger Unterhalt, schwache Diplomatie.'
  },
  federation: {
    name: 'Föderation', income: 1.06, attack: 0.95, defense: 1.12, stability: 3,
    diplomacy: 1.12, politicalPower: 3,
    description: 'Verwaltet große Reiche günstig, entscheidet langsam.'
  },
  theocracy: {
    name: 'Theokratie', income: 0.95, attack: 1.05, defense: 1.06, stability: 9,
    diplomacy: 0.9, politicalPower: 5,
    description: 'Sehr hohe innere Geschlossenheit, schnelle Missionierung.'
  },
  tribal: {
    name: 'Stammesbund', income: 0.9, attack: 1.12, defense: 0.95, stability: -5,
    diplomacy: 0.9, politicalPower: 3,
    description: 'Viele billige Kämpfer, geringe Stabilität.'
  }
};

/* ------------------------------------------------------------------ */
/* Schwierigkeitsgrad                                                  */
/* ------------------------------------------------------------------ */

export interface DifficultyInfo {
  name: string;
  aiEfficiency: number;
  aiAggression: number;
  playerIncome: number;
  description: string;
}

export const DIFFICULTY_INFO: Record<Difficulty, DifficultyInfo> = {
  easy: {
    name: 'Leicht', aiEfficiency: 0.5, aiAggression: 0.6, playerIncome: 1.2,
    description: 'Die KI handelt vorsichtig und nutzt Chancen selten.'
  },
  normal: {
    name: 'Normal', aiEfficiency: 0.78, aiAggression: 0.9, playerIncome: 1.0,
    description: 'Ausgewogene Herausforderung ohne Vorteile für eine Seite.'
  },
  hard: {
    name: 'Schwer', aiEfficiency: 1.0, aiAggression: 1.1, playerIncome: 0.92,
    description: 'Die KI plant vorausschauend und greift entschlossen an.'
  },
  brutal: {
    name: 'Unerbittlich', aiEfficiency: 1.0, aiAggression: 1.35, playerIncome: 0.82,
    description: 'Die KI koordiniert Koalitionen und verzeiht keinen Fehler.'
  }
};

/* ------------------------------------------------------------------ */
/* Technologie- und Projektboni                                        */
/* ------------------------------------------------------------------ */

export type TechBonus = Required<TechEffects>;

const EMPTY_BONUS: TechBonus = {
  attack: 0, defense: 0, income: 0, research: 0, supply: 0, stability: 0,
  recruitCost: 0, politicalPower: 0, espionage: 0, naval: 0, siege: 0, actionPoints: 0
};

export function getTechBonus(country: CountryState): TechBonus {
  const bonus: TechBonus = { ...EMPTY_BONUS };
  for (const techId of country.technologies) {
    const tech = getTechnology(techId);
    if (!tech) continue;
    for (const key of Object.keys(bonus) as (keyof TechBonus)[]) {
      bonus[key] += tech.effects[key] ?? 0;
    }
  }
  return bonus;
}

export interface ProjectBonus {
  research: number;
  income: number;
  defense: number;
  stability: number;
  trade: number;
  navalUpkeep: number;
  transport: number;
  politicalPower: number;
  assimilation: number;
}

export function getProjectBonus(country: CountryState): ProjectBonus {
  const bonus: ProjectBonus = {
    research: 0, income: 0, defense: 0, stability: 0, trade: 0,
    navalUpkeep: 0, transport: 0, politicalPower: 0, assimilation: 1
  };
  for (const project of country.completedProjects as ProjectId[]) {
    switch (project) {
      case 'great_library': bonus.research += 0.3; break;
      case 'grand_exchange': bonus.income += 0.2; bonus.trade += 0.25; break;
      case 'citadel': bonus.defense += 0.18; break;
      case 'cathedral': bonus.stability += 12; bonus.assimilation = 2; bonus.politicalPower += 2; break;
      case 'great_harbour': bonus.trade += 0.25; bonus.navalUpkeep -= 0.25; bonus.transport += 4; break;
      default: break;
    }
  }
  return bonus;
}

/* ------------------------------------------------------------------ */
/* Abgeleitete Werte                                                   */
/* ------------------------------------------------------------------ */

export function getCountryTerritories(state: GameState, countryId: string): TerritoryState[] {
  return Object.values(state.territories).filter((territory) => territory.ownerId === countryId);
}

export function getCountryArmySize(state: GameState, countryId: string): number {
  return getCountryTerritories(state, countryId).reduce((total, t) => total + armySize(t.army), 0);
}

export function getCountryPopulation(state: GameState, countryId: string): number {
  return getCountryTerritories(state, countryId).reduce((total, t) => total + t.population, 0);
}

export function getBuildingCost(buildingId: BuildingId, currentLevel: number): number {
  const definition = getBuilding(buildingId);
  return Math.round(definition.baseCost * Math.pow(definition.costFactor, currentLevel));
}

/** Rabatt auf Rekrutierungskosten durch Technologien, Kasernen und Regierungsform. */
export function getRecruitDiscount(country: CountryState, territory: TerritoryState): number {
  const bonus = getTechBonus(country);
  const barracks = territory.buildings.barracks;
  const governmentFactor = country.government === 'tribal' ? -0.1 : 0;
  return clamp(1 + bonus.recruitCost - barracks * 0.07 + governmentFactor, 0.5, 1.4);
}

/** Maximale Truppenstärke, die ein Gebiet ohne Verluste versorgen kann. */
export function getSupplyCapacity(
  state: GameState,
  country: CountryState,
  territory: TerritoryState
): number {
  const definition = getTerritoryDefinition(state.mapId, territory.id);
  const terrain = TERRAIN_INFO[definition.terrain];
  const bonus = getTechBonus(country);
  const base =
    26 +
    territory.economy * 0.3 +
    territory.buildings.road * 10 +
    territory.buildings.granary * 22 +
    territory.buildings.harbour * 6;
  return Math.round(base * terrain.supply * (1 + bonus.supply));
}

/** Versorgungsfaktor 0.5 .. 1.1 für Kampf und Attrition. */
export function getSupplyFactor(
  state: GameState,
  country: CountryState,
  territory: TerritoryState
): number {
  const capacity = Math.max(1, getSupplyCapacity(state, country, territory));
  const demand = supplyDemand(territory.army);
  if (demand <= capacity) {
    return clamp(1 + (capacity - demand) / (capacity * 12), 1, 1.1);
  }
  const overload = demand / capacity;
  return clamp(1.1 - (overload - 1) * 0.55, 0.5, 1.0);
}

export function getFortificationFactor(territory: TerritoryState, siege = 0): number {
  const raw = 1 + territory.fortification * 0.13;
  return clamp(raw - siege, 1, 3);
}

export function getMoraleFactor(country: CountryState): number {
  const stabilityPart = 0.74 + (country.stability / 100) * 0.42;
  const exhaustionPart = 1 - clamp(country.warExhaustion, 0, 100) / 240;
  const prestigePart = 1 + clamp(country.prestige, -50, 100) / 600;
  return clamp(stabilityPart * exhaustionPart * prestigePart, 0.55, 1.3);
}

/* ------------------------------------------------------------------ */
/* Diplomatische Hilfsfunktionen                                       */
/* ------------------------------------------------------------------ */

export function getRelation(state: GameState, a: string, b: string): number {
  if (a === b) return 100;
  return state.relations[relationKey(a, b)] ?? 0;
}

export function setRelation(state: GameState, a: string, b: string, value: number): void {
  if (a === b) return;
  state.relations[relationKey(a, b)] = Math.round(clamp(value, -100, 100));
}

export function changeRelation(state: GameState, a: string, b: string, delta: number): void {
  setRelation(state, a, b, getRelation(state, a, b) + delta);
}

export function findWar(state: GameState, a: string, b: string) {
  return state.wars.find(
    (war) =>
      (war.attackers.includes(a) && war.defenders.includes(b)) ||
      (war.attackers.includes(b) && war.defenders.includes(a))
  );
}

export function areAtWar(state: GameState, a: string, b: string): boolean {
  return Boolean(findWar(state, a, b));
}

export function isAtWarAtAll(state: GameState, countryId: string): boolean {
  return state.wars.some(
    (war) => war.attackers.includes(countryId) || war.defenders.includes(countryId)
  );
}

export function areAllied(state: GameState, a: string, b: string): boolean {
  return state.alliances.some(
    (alliance) => alliance.members.includes(a) && alliance.members.includes(b)
  );
}

export function hasTrade(state: GameState, a: string, b: string): boolean {
  return state.trades.some(
    (trade) => (trade.a === a && trade.b === b) || (trade.a === b && trade.b === a)
  );
}

export function hasTruce(state: GameState, a: string, b: string): boolean {
  const until = state.truces[relationKey(a, b)];
  return typeof until === 'number' && until > state.turn;
}

/** Beziehung zwischen Oberherr und Vasall? */
export function isVassalOf(state: GameState, vassalId: string, overlordId: string): boolean {
  return state.countries[vassalId]?.overlordId === overlordId;
}

/** Länder, die durch Bündnis oder Vasallität mit einem Land verbunden sind. */
export function getSupporters(state: GameState, countryId: string): string[] {
  const result = new Set<string>();
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(countryId)) continue;
    for (const member of alliance.members) {
      if (member !== countryId) result.add(member);
    }
  }
  const country = state.countries[countryId];
  if (country) {
    for (const vassal of country.vassals) result.add(vassal);
    if (country.overlordId) result.add(country.overlordId);
  }
  return [...result].filter((id) => state.countries[id]?.isAlive);
}

/* ------------------------------------------------------------------ */
/* Karte und Nachbarschaft                                             */
/* ------------------------------------------------------------------ */

/** Alle Nachbargebiete inklusive nutzbarer Seeverbindungen. */
export function getNeighbourIds(state: GameState, territoryId: string): string[] {
  const definition = getTerritoryDefinition(state.mapId, territoryId);
  const seaLinks = definition.seaNeighbours.filter((otherId) => {
    const other = getTerritoryDefinition(state.mapId, otherId);
    return definition.hasPort && other.hasPort;
  });
  return [...definition.neighbours, ...seaLinks];
}

export function isSeaConnection(state: GameState, a: string, b: string): boolean {
  const definition = getTerritoryDefinition(state.mapId, a);
  return definition.seaNeighbours.includes(b) && !definition.neighbours.includes(b);
}

export function areNeighbours(state: GameState, a: string, b: string): boolean {
  return getNeighbourIds(state, a).includes(b);
}

/** Länder, deren Gebiete an das eigene Reich grenzen. */
export function getNeighbourCountries(state: GameState, countryId: string): string[] {
  const result = new Set<string>();
  for (const territory of getCountryTerritories(state, countryId)) {
    for (const neighbourId of getNeighbourIds(state, territory.id)) {
      const neighbour = state.territories[neighbourId];
      if (neighbour && neighbour.ownerId && neighbour.ownerId !== countryId) {
        result.add(neighbour.ownerId);
      }
    }
  }
  return [...result];
}

/* ------------------------------------------------------------------ */
/* Bewertung                                                           */
/* ------------------------------------------------------------------ */

export function getCountryScore(state: GameState, countryId: string): number {
  const country = state.countries[countryId];
  if (!country) return 0;
  const territories = getCountryTerritories(state, countryId);
  const economy = territories.reduce((total, t) => total + t.economy, 0);
  const population = territories.reduce((total, t) => total + t.population, 0);
  const army = territories.reduce((total, t) => total + armySize(t.army), 0);
  const vassalBonus = country.vassals.length * 90;
  return Math.round(
    territories.length * 110 +
      economy * 1.4 +
      population * 0.04 +
      army * 2.2 +
      country.technologies.length * 45 +
      country.completedProjects.length * 160 +
      country.prestige * 3 +
      country.stability * 1.5 +
      vassalBonus
  );
}

/** Wie bedrohlich wirkt ein Land auf die übrigen Mächte? */
export function computeThreat(state: GameState, countryId: string): number {
  const scores = state.countryOrder
    .filter((id) => state.countries[id]?.isAlive)
    .map((id) => getCountryScore(state, id));
  if (scores.length === 0) return 0;
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const own = getCountryScore(state, countryId);
  const relative = average > 0 ? own / average : 1;
  const country = state.countries[countryId];
  const aggression = country ? clamp(country.threat, 0, 60) : 0;
  return clamp((relative - 1) * 60 + aggression, 0, 100);
}

/** Gesamter Armeeunterhalt eines Landes inklusive Projektrabatt. */
export function getArmyUpkeep(state: GameState, country: CountryState): number {
  const projects = getProjectBonus(country);
  let total = 0;
  for (const territory of getCountryTerritories(state, country.id)) {
    const base = armyUpkeep(territory.army);
    const navalPart = territory.army.fleet * 2.9 * projects.navalUpkeep;
    total += base + navalPart;
  }
  const governmentFactor = country.government === 'military' ? 0.85 : 1;
  return total * governmentFactor;
}

/** Zahl der Landeinheiten eines Landes (für Statistiken). */
export function getCountryLandForces(state: GameState, countryId: string): number {
  return getCountryTerritories(state, countryId).reduce((total, t) => total + landSize(t.army), 0);
}

/** Maximale Zahl der Feldherren. */
export function getGeneralLimit(state: GameState, countryId: string): number {
  return 1 + Math.floor(getCountryTerritories(state, countryId).length / 4);
}

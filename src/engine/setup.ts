/**
 * Erzeugt den Startzustand eines Spiels aus Szenario- und Kartendefinition.
 */
import type {
  BuildingId,
  CountryState,
  Difficulty,
  GameOptions,
  GameState,
  ScenarioDefinition,
  TerritoryState
} from '../models/types';
import { getMap, getScenario } from '../services/contentService';
import { relationKey } from '../utils/helpers';
import { emptyArmy, emptyStock } from './army';
import { createGeneral } from './generals';
import { BASE_ACTION_POINTS, SAVE_VERSION, TERRAIN_INFO } from './rules';
import { Rng } from '../utils/rng';

function emptyBuildings(): Record<BuildingId, number> {
  return {
    farm: 0, market: 0, workshop: 0, road: 0, barracks: 0,
    fortress: 0, harbour: 0, academy: 0, temple: 0, granary: 0
  };
}

export interface NewGameOptions {
  scenarioId: string;
  playerCountryId: string;
  difficulty: Difficulty;
  options: GameOptions;
  seed?: number;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  sandbox: false,
  fogOfWar: true,
  rebellions: true,
  showTurnReport: true
};

export function createInitialState(setup: NewGameOptions): GameState {
  const scenario: ScenarioDefinition = getScenario(setup.scenarioId);
  const map = getMap(scenario.mapId);
  const startSeed = setup.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(startSeed);

  const territories: Record<string, TerritoryState> = {};
  const countries: Record<string, CountryState> = {};
  const countryOrder: string[] = [];

  // --- Gebiete anlegen ---
  for (const definition of map.territories) {
    const terrain = TERRAIN_INFO[definition.terrain];
    territories[definition.id] = {
      id: definition.id,
      ownerId: '',
      coreOwnerId: '',
      army: emptyArmy(),
      population: definition.basePopulation,
      economy: Math.round(definition.baseEconomy * terrain.economy),
      infrastructure: 1,
      stability: 60,
      unrest: 0,
      fortification: definition.terrain === 'mountain' ? 1 : 0,
      buildings: emptyBuildings(),
      construction: [],
      occupiedTurns: 0,
      culture: 'Freie Siedler',
      religion: 'Alter Glaube',
      generalId: null,
      blockaded: false,
      devastation: 0
    };
  }

  // --- Länder anlegen und Gebiete zuweisen ---
  for (const definition of scenario.countries) {
    countryOrder.push(definition.id);
    const country: CountryState = {
      id: definition.id,
      name: definition.name,
      color: definition.color,
      pattern: definition.pattern,
      ruler: definition.ruler,
      government: definition.government,
      capitalId: definition.capitalId,
      ai: definition.ai,
      traits: definition.traits,
      culture: definition.culture,
      religion: definition.religion,
      bonusText: definition.bonusText,
      description: definition.description,
      isPlayer: definition.id === setup.playerCountryId,
      isAlive: true,
      gold: definition.gold,
      resources: { grain: 40, iron: 25, timber: 30, horses: 12, luxury: 15 },
      taxRate: 0.25,
      stability: Math.round(60 * definition.traits.stability),
      warExhaustion: 0,
      prestige: 0,
      politicalPower: 20,
      researchPoints: 0,
      currentResearchId: null,
      technologies: [...definition.technologies],
      actionPoints: BASE_ACTION_POINTS,
      maxActionPoints: BASE_ACTION_POINTS,
      budget: { military: 34, economy: 33, research: 33 },
      generals: [],
      claims: [],
      completedProjects: [],
      threat: 0,
      intel: {},
      overlordId: null,
      vassals: [],
      vassalSince: 0
    };
    // Jedes Land startet mit einem Feldherrn in der Hauptstadt.
    const general = createGeneral(rng, definition.capitalId);
    country.generals.push(general);
    countries[definition.id] = country;

    for (const territoryId of definition.territories) {
      const territory = territories[territoryId];
      if (!territory) {
        console.warn(`Szenario verweist auf unbekanntes Gebiet: ${territoryId}`);
        continue;
      }
      territory.ownerId = definition.id;
      territory.coreOwnerId = definition.id;
      territory.culture = definition.culture;
      territory.religion = definition.religion;
      const base = definition.startArmyPerTerritory;
      territory.army = {
        infantry: base,
        cavalry: Math.round(base * 0.35),
        artillery: 0,
        fleet: 0
      };
      if (territoryId === definition.capitalId) {
        territory.fortification += 2;
        territory.economy = Math.round(territory.economy * 1.25);
        territory.buildings.market = 1;
        territory.buildings.barracks = 1;
        territory.generalId = general.id;
      }
    }
  }

  // --- Unabhängige Gebiete erhalten eine kleine Miliz ---
  for (const territory of Object.values(territories)) {
    if (territory.ownerId) continue;
    territory.culture = 'Freie Städte';
    territory.religion = 'Alter Glaube';
    territory.army = {
      infantry: 8 + Math.floor(territory.population / 220),
      cavalry: 2,
      artillery: 0,
      fleet: 0
    };
    territory.fortification += 1;
  }

  // --- Beziehungen ---
  const relations: Record<string, number> = {};
  for (let i = 0; i < countryOrder.length; i += 1) {
    for (let j = i + 1; j < countryOrder.length; j += 1) {
      relations[relationKey(countryOrder[i], countryOrder[j])] = 0;
    }
  }
  for (const seed of scenario.initialRelations) {
    if (countries[seed.a] && countries[seed.b]) {
      relations[relationKey(seed.a, seed.b)] = seed.value;
    }
  }

  const player = countries[setup.playerCountryId];

  const state: GameState = {
    version: SAVE_VERSION,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    mapId: scenario.mapId,
    era: scenario.era,
    turnLabel: scenario.turnLabel,
    turn: 1,
    year: scenario.startYear,
    yearsPerTurn: scenario.yearsPerTurn,
    difficulty: setup.difficulty,
    options: { ...setup.options },
    playerCountryId: setup.playerCountryId,
    countryOrder,
    countries,
    territories,
    relations,
    truces: {},
    wars: scenario.wars.map((warSeed, index) => ({
      id: `war_start_${index}`,
      attackers: [warSeed.attacker],
      defenders: [warSeed.defender],
      startTurn: 1,
      score: 0,
      captured: [],
      goal: { type: 'conquest', territoryId: null, label: 'Eroberung' },
      justified: true
    })),
    alliances: scenario.alliances.map((alliance) => ({
      id: alliance.id,
      name: alliance.name,
      members: [...alliance.members],
      leader: alliance.leader,
      foundedTurn: 1,
      againstId: null
    })),
    trades: [],
    log: [
      {
        turn: 1,
        type: 'system',
        text: `${scenario.name} beginnt. Du führst ${player?.name ?? 'ein Land'}.`,
        important: true
      }
    ],
    battleReports: [],
    pendingBattleReportId: null,
    pendingEvent: null,
    scheduledEvents: [],
    firedEvents: [],
    status: 'playing',
    statusMessage: '',
    rngSeed: rng.seed,
    startSeed,
    victory: scenario.victory,
    history: [],
    lastTurnReport: null,
    unlockedAchievements: [],
    stats: {
      battlesWon: 0,
      battlesLost: 0,
      territoriesConquered: 0,
      warsDeclared: 0,
      peaceDeals: 0,
      unitsLost: 0,
      goldEarned: 0
    }
  };

  return state;
}

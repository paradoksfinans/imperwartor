/**
 * Zentrale Typdefinitionen für Empire Tactics v0.2.
 *
 * Alle Strukturen sind JSON-serialisierbar, damit Spielstände ohne
 * Konvertierung gespeichert, exportiert und importiert werden können.
 */

/* ------------------------------------------------------------------ */
/* Basistypen                                                          */
/* ------------------------------------------------------------------ */

export type TerrainType =
  | 'plain'
  | 'forest'
  | 'mountain'
  | 'desert'
  | 'swamp'
  | 'steppe'
  | 'coast'
  | 'island'
  | 'urban';

export type BuildingId =
  | 'farm'
  | 'market'
  | 'workshop'
  | 'road'
  | 'barracks'
  | 'fortress'
  | 'harbour'
  | 'academy'
  | 'temple'
  | 'granary';

export type GovernmentType =
  | 'monarchy'
  | 'republic'
  | 'military'
  | 'federation'
  | 'theocracy'
  | 'tribal';

export type AiPersonality =
  | 'aggressive'
  | 'defensive'
  | 'economic'
  | 'diplomatic'
  | 'expansionist'
  | 'opportunistic'
  | 'isolationist';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export type PatternId = 'solid' | 'stripes' | 'dots' | 'grid' | 'diagonal' | 'cross';

export type MapFilter =
  | 'political'
  | 'diplomacy'
  | 'military'
  | 'economy'
  | 'population'
  | 'stability'
  | 'supply'
  | 'culture'
  | 'religion'
  | 'resources'
  | 'terrain';

/** Truppengattungen. */
export type UnitTypeId = 'infantry' | 'cavalry' | 'artillery' | 'fleet';

/** Eine Armee ist immer eine vollständige Aufstellung nach Gattungen. */
export type Army = Record<UnitTypeId, number>;

/** Strategische Rohstoffe. */
export type ResourceId = 'grain' | 'iron' | 'timber' | 'horses' | 'luxury';

export type ResourceStock = Record<ResourceId, number>;

/* ------------------------------------------------------------------ */
/* Kartendaten (statisch, aus JSON)                                    */
/* ------------------------------------------------------------------ */

export interface TerritoryDefinition {
  id: string;
  name: string;
  /** SVG-Polygonpunkte. */
  polygon: string;
  labelX: number;
  labelY: number;
  /** Normierte Höhe 0..1, wird für die Reliefschattierung genutzt. */
  elevation: number;
  terrain: TerrainType;
  neighbours: string[];
  /** Seewege; nur nutzbar, wenn beide Seiten einen Hafen besitzen. */
  seaNeighbours: string[];
  basePopulation: number;
  baseEconomy: number;
  hasPort: boolean;
  /** Anzeigenamen der Vorkommen, z. B. "Eisen". */
  resources: string[];
}

export interface OceanCell {
  points: string;
  /** 0 = flach, 1 = tief. Steuert die Farbe. */
  depth: number;
}

export interface GameMapDefinition {
  id: string;
  name: string;
  description: string;
  viewBox: string;
  seed: number;
  oceanCells: OceanCell[];
  coastlines: string[];
  rivers: string[];
  territories: TerritoryDefinition[];
}

/* ------------------------------------------------------------------ */
/* Szenariodaten                                                       */
/* ------------------------------------------------------------------ */

export interface CountryTraits {
  attack: number;
  defense: number;
  economy: number;
  research: number;
  stability: number;
}

export interface ScenarioCountry {
  id: string;
  name: string;
  color: string;
  pattern: PatternId;
  ruler: string;
  government: GovernmentType;
  capitalId: string;
  territories: string[];
  gold: number;
  startArmyPerTerritory: number;
  technologies: string[];
  ai: AiPersonality;
  traits: CountryTraits;
  culture: string;
  religion: string;
  bonusText: string;
  description: string;
}

export interface RelationSeed {
  a: string;
  b: string;
  value: number;
}

export interface AllianceSeed {
  id: string;
  name: string;
  members: string[];
  leader: string;
}

export interface WarSeed {
  attacker: string;
  defender: string;
}

export interface VictoryConditions {
  territoriesToControl: number;
  survivalTurns: number;
  description: string;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  mapId: string;
  startYear: number;
  yearsPerTurn: number;
  turnLabel: string;
  era: string;
  countries: ScenarioCountry[];
  initialRelations: RelationSeed[];
  alliances: AllianceSeed[];
  wars: WarSeed[];
  victory: VictoryConditions;
}

/* ------------------------------------------------------------------ */
/* Inhalte: Einheiten, Gebäude, Technologien, Projekte, Ereignisse    */
/* ------------------------------------------------------------------ */

export interface UnitDefinition {
  id: UnitTypeId;
  name: string;
  short: string;
  description: string;
  /** Grundwerte für Angriff und Verteidigung je Einheit. */
  attack: number;
  defense: number;
  /** Kosten pro Einheit. */
  gold: number;
  resources: Partial<ResourceStock>;
  population: number;
  upkeep: number;
  /** Belagerungswirkung: senkt den Befestigungsfaktor des Verteidigers. */
  siege: number;
  /** Anteil der Verluste, den diese Gattung übernimmt. */
  lossWeight: number;
  /** Geländemultiplikatoren (fehlende Einträge = 1.0). */
  terrain: Partial<Record<TerrainType, number>>;
  /** Transportkapazität an Landeinheiten (nur Flotte). */
  transport: number;
  requiresTech: string | null;
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  icon: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costFactor: number;
  resources: Partial<ResourceStock>;
  upkeep: number;
  buildTurns: number;
  /** Nur in Gebieten mit Hafen baubar. */
  requiresPort?: boolean;
  requiresTech?: string | null;
}

export type TechCategory =
  | 'military'
  | 'economy'
  | 'administration'
  | 'defense'
  | 'logistics'
  | 'education'
  | 'naval'
  | 'espionage';

export interface TechEffects {
  attack?: number;
  defense?: number;
  income?: number;
  research?: number;
  supply?: number;
  stability?: number;
  recruitCost?: number;
  politicalPower?: number;
  espionage?: number;
  naval?: number;
  siege?: number;
  actionPoints?: number;
}

export interface Technology {
  id: string;
  name: string;
  category: TechCategory;
  tier: number;
  description: string;
  cost: number;
  requires: string[];
  effects: TechEffects;
  /** Schaltet eine Einheit oder ein Gebäude frei. */
  unlocks?: string[];
}

export type ProjectId =
  | 'great_library'
  | 'grand_exchange'
  | 'citadel'
  | 'cathedral'
  | 'great_harbour';

export interface ProjectDefinition {
  id: ProjectId;
  name: string;
  icon: string;
  description: string;
  effectText: string;
  gold: number;
  resources: Partial<ResourceStock>;
  turns: number;
  requiresPort?: boolean;
  requiresTech?: string | null;
  prestige: number;
}

export interface EventEffects {
  gold?: number;
  stability?: number;
  population?: number;
  army?: number;
  research?: number;
  warExhaustion?: number;
  relations?: number;
  politicalPower?: number;
  unrest?: number;
  prestige?: number;
  resources?: Partial<ResourceStock>;
}

export interface GameEventChoice {
  text: string;
  effects: EventEffects;
  resultText: string;
  /** Folgeereignis, das in einigen Runden ausgelöst wird. */
  followUp?: string;
}

export interface EventConditions {
  minTurn?: number;
  goldBelow?: number;
  goldAbove?: number;
  stabilityBelow?: number;
  stabilityAbove?: number;
  atWar?: boolean;
  minTerritories?: number;
  hasVassal?: boolean;
  unrestAbove?: number;
}

export interface GameEventDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'economy' | 'military' | 'politics' | 'nature' | 'culture';
  probability: number;
  once: boolean;
  /** Nur als Folgeereignis auslösbar. */
  chainOnly?: boolean;
  conditions: EventConditions;
  choices: GameEventChoice[];
}

export interface PendingEvent {
  definitionId: string;
  countryId: string;
}

export interface ScheduledEvent {
  definitionId: string;
  countryId: string;
  turn: number;
}

/* ------------------------------------------------------------------ */
/* Laufzeitzustand                                                     */
/* ------------------------------------------------------------------ */

export interface ConstructionOrder {
  kind: 'building' | 'project';
  id: string;
  turnsLeft: number;
  /** Gesamtdauer des Vorhabens - Grundlage der Fortschrittsanzeige. */
  totalTurns: number;
}

export interface TerritoryState {
  id: string;
  ownerId: string;
  /** Ursprünglicher Besitzer - erzeugt Unruhe und Rückeroberungsanspruch. */
  coreOwnerId: string;
  army: Army;
  population: number;
  economy: number;
  infrastructure: number;
  stability: number;
  unrest: number;
  fortification: number;
  buildings: Record<BuildingId, number>;
  /**
   * Bauschlange des Gebietes. Es wird immer nur am ersten Eintrag gearbeitet;
   * die übrigen warten in der angegebenen Reihenfolge.
   */
  construction: ConstructionOrder[];
  occupiedTurns: number;
  culture: string;
  religion: string;
  /** Zugewiesener Feldherr. */
  generalId: string | null;
  /** Durch feindliche Flotten blockiert. */
  blockaded: boolean;
  /** Kriegsschäden 0..100, senken Wirtschaft und Bevölkerungswachstum. */
  devastation: number;
}

export interface General {
  id: string;
  name: string;
  title: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  siege: number;
  trait: string;
  assignedTerritoryId: string | null;
  battles: number;
  victories: number;
}

export interface BudgetSettings {
  military: number;
  economy: number;
  research: number;
}

export interface CountryState {
  id: string;
  name: string;
  color: string;
  pattern: PatternId;
  ruler: string;
  government: GovernmentType;
  capitalId: string;
  ai: AiPersonality;
  traits: CountryTraits;
  culture: string;
  religion: string;
  bonusText: string;
  description: string;
  isPlayer: boolean;
  isAlive: boolean;
  gold: number;
  resources: ResourceStock;
  taxRate: number;
  stability: number;
  warExhaustion: number;
  prestige: number;
  politicalPower: number;
  researchPoints: number;
  currentResearchId: string | null;
  technologies: string[];
  actionPoints: number;
  maxActionPoints: number;
  budget: BudgetSettings;
  generals: General[];
  /** Gebietsansprüche - erlauben gerechtfertigte Kriege. */
  claims: string[];
  completedProjects: ProjectId[];
  /** Bedrohungswert, den andere Länder wahrnehmen. */
  threat: number;
  /** Aufklärungsstufe gegenüber anderen Ländern (0..3). */
  intel: Record<string, number>;
  overlordId: string | null;
  vassals: string[];
  /** Runden seit Beginn der Vasallität. */
  vassalSince: number;
}

export interface CapturedTerritoryRecord {
  territoryId: string;
  previousOwnerId: string;
  newOwnerId: string;
}

export interface WarGoal {
  type: 'conquest' | 'claim' | 'subjugation' | 'plunder' | 'defense';
  territoryId: string | null;
  label: string;
}

export interface War {
  id: string;
  attackers: string[];
  defenders: string[];
  startTurn: number;
  /** Positiv = Angreifer im Vorteil. */
  score: number;
  captured: CapturedTerritoryRecord[];
  goal: WarGoal;
  /** Wurde der Krieg ohne Rechtfertigung begonnen? */
  justified: boolean;
}

export interface Alliance {
  id: string;
  name: string;
  members: string[];
  leader: string;
  foundedTurn: number;
  /** Koalitionen entstehen gegen eine übermächtige Macht. */
  againstId?: string | null;
}

export interface TradeAgreement {
  id: string;
  a: string;
  b: string;
  since: number;
}

export interface BattleRound {
  round: number;
  attackPower: number;
  defensePower: number;
  attackerLosses: number;
  defenderLosses: number;
}

export interface BattleModifier {
  label: string;
  value: string;
  positiveFor: 'attacker' | 'defender' | 'none';
}

export interface BattleReport {
  id: string;
  turn: number;
  attackerId: string;
  attackerName: string;
  defenderId: string;
  defenderName: string;
  territoryId: string;
  territoryName: string;
  terrain: TerrainType;
  attackingArmy: Army;
  defendingArmy: Army;
  attackerLosses: Army;
  defenderLosses: Army;
  remainingAttackers: Army;
  remainingDefenders: Army;
  attackPower: number;
  defensePower: number;
  rounds: BattleRound[];
  winner: 'attacker' | 'defender';
  captured: boolean;
  modifiers: BattleModifier[];
  generalName: string | null;
  generalLost: boolean;
}

export type LogType =
  | 'system'
  | 'war'
  | 'peace'
  | 'battle'
  | 'economy'
  | 'event'
  | 'diplomacy'
  | 'research'
  | 'espionage'
  | 'project'
  | 'rebellion';

export interface LogEntry {
  turn: number;
  type: LogType;
  text: string;
  /** Betrifft das Spielerland unmittelbar. */
  important?: boolean;
}

export interface HistorySnapshot {
  turn: number;
  entries: Record<string, { territories: number; army: number; gold: number; score: number }>;
}

export interface TurnReport {
  turn: number;
  year: number;
  goldChange: number;
  researchGained: number;
  politicalPowerGained: number;
  battlesWon: number;
  battlesLost: number;
  territoriesGained: number;
  territoriesLost: number;
  lines: LogEntry[];
  warnings: string[];
}

export type GameStatus = 'playing' | 'victory' | 'defeat';

export interface GameOptions {
  sandbox: boolean;
  fogOfWar: boolean;
  rebellions: boolean;
  showTurnReport: boolean;
}

export interface GameState {
  version: number;
  scenarioId: string;
  scenarioName: string;
  mapId: string;
  era: string;
  turnLabel: string;
  turn: number;
  year: number;
  yearsPerTurn: number;
  difficulty: Difficulty;
  options: GameOptions;
  playerCountryId: string;
  countryOrder: string[];
  countries: Record<string, CountryState>;
  territories: Record<string, TerritoryState>;
  relations: Record<string, number>;
  truces: Record<string, number>;
  wars: War[];
  alliances: Alliance[];
  trades: TradeAgreement[];
  log: LogEntry[];
  battleReports: BattleReport[];
  pendingBattleReportId: string | null;
  pendingEvent: PendingEvent | null;
  scheduledEvents: ScheduledEvent[];
  firedEvents: string[];
  status: GameStatus;
  statusMessage: string;
  rngSeed: number;
  startSeed: number;
  victory: VictoryConditions;
  history: HistorySnapshot[];
  lastTurnReport: TurnReport | null;
  unlockedAchievements: string[];
  /** Statistik für die Abschlusskarte. */
  stats: {
    battlesWon: number;
    battlesLost: number;
    territoriesConquered: number;
    warsDeclared: number;
    peaceDeals: number;
    unitsLost: number;
    goldEarned: number;
  };
}

/* ------------------------------------------------------------------ */
/* Oberflächenhilfen                                                  */
/* ------------------------------------------------------------------ */

export type MilitaryActionMode = 'none' | 'move' | 'attack';

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface IncomeBreakdown {
  taxes: number;
  trade: number;
  vassalTribute: number;
  buildingUpkeep: number;
  armyUpkeep: number;
  administration: number;
  blockadeLoss: number;
  net: number;
  researchPoints: number;
  politicalPower: number;
  resources: ResourceStock;
}

export interface PeaceDemandOption {
  id: string;
  label: string;
  description: string;
  cost: number;
  territoryId?: string;
}

/**
 * Alle Datentypen des Spiels an einem Ort.
 *
 * Grundsatz: Der Spielzustand ist reine Daten, die sich als JSON speichern
 * lassen. Keine Klassen, keine Funktionen, keine Verweise auf Oberflaechen-
 * elemente - dadurch funktionieren Speichern, Laden und das Zuruecknehmen
 * von Zuegen ohne Sonderbehandlung.
 */

/* ------------------------------------------------------------------ */
/* Karte                                                               */
/* ------------------------------------------------------------------ */

export type TerrainId =
  | 'plain' | 'forest' | 'mountain' | 'desert' | 'swamp'
  | 'steppe' | 'coast' | 'island' | 'urban';

export type ResourceId =
  | 'none' | 'grain' | 'iron' | 'timber' | 'stone'
  | 'gold' | 'fish' | 'oil' | 'horses';

/** Ein Gebiet, wie es in den Kartendateien steht. */
export interface MapProvince {
  id: string;
  name: string;
  /**
   * Umriss in alter Form: "x,y x,y ...".
   *
   * Nur noch bei der erfundenen Karte Aurelia und bei den wenigen Gebieten,
   * fuer die sich keine echte Verwaltungseinheit finden liess.
   */
  points?: string;
  /**
   * Umriss in kompakter Form - ein Eintrag je Ring (Festland, Inseln,
   * Binnenloecher). Siehe core/koordinaten.ts.
   */
  rings?: string[];
  center: [number, number];
  terrain: TerrainId;
  neighbors: string[];
  basePopulation: number;
  baseEconomy: number;
  isPort: boolean;
  resource: ResourceId;
  /** Herkunftsland bei Regionalkarten, z. B. "Germany" für Bayern. */
  land?: string;
}

export interface GameMap {
  id: string;
  name: string;
  description: string;
  viewBox: string;
  /** Gittereinheiten je Zeichenflaecheneinheit in "rings". */
  ringTeiler?: number;
  seaLinks: Array<[string, string]>;
  provinces: MapProvince[];
}

/* ------------------------------------------------------------------ */
/* Einheiten und Heere                                                 */
/* ------------------------------------------------------------------ */

export type UnitId =
  | 'infantry'    // Fußvolk - das Rückgrat jedes Heeres
  | 'cavalry'     // Reiterei - schnell, stark im offenen Gelände
  | 'archers'     // Fernkämpfer - wirken vor dem Zusammenstoß
  | 'siege'       // Belagerungsgerät - bricht Befestigungen
  | 'artillery'   // Geschütze - Nachfolger des Belagerungsgeraets
  | 'armor'       // Panzer - Durchbruch in der Ebene
  | 'navy';       // Kriegsschiffe - Seewege und Kuestenschutz

/** Zusammensetzung eines Heeres. Fehlende Gattungen gelten als 0. */
export type Regiments = Partial<Record<UnitId, number>>;

export interface UnitDefinition {
  id: UnitId;
  name: string;
  kurz: string;
  /** Grundkraft im Angriff und in der Verteidigung je Einheit. */
  attack: number;
  defense: number;
  /** Kosten je Einheit. */
  gold: number;
  population: number;
  /** Unterhalt je Einheit und Runde. */
  upkeep: number;
  /** Ab welcher Militärtechnik verfügbar. */
  techLevel: number;
  /** Gelände, in dem die Gattung besonders gut bzw. schlecht wirkt. */
  terrainBonus: Partial<Record<TerrainId, number>>;
  /** Wirkung gegen Befestigungen (1 = keine). */
  siegePower: number;
  /** Nur in Häfen aufstellbar, bewegt sich nur über Seewege. */
  naval?: boolean;
  beschreibung: string;
}

/* ------------------------------------------------------------------ */
/* Generäle                                                           */
/* ------------------------------------------------------------------ */

export type GeneralTraitId =
  | 'angriff' | 'verteidigung' | 'belagerung' | 'marsch'
  | 'ausbilder' | 'vorsichtig' | 'draufgaenger' | 'gelehrt';

export interface GeneralTrait {
  id: GeneralTraitId;
  name: string;
  beschreibung: string;
}

export interface General {
  id: string;
  name: string;
  countryId: string;
  /** Gebiet, in dem der General steht, oder null wenn ohne Kommando. */
  provinceId: string | null;
  /** 1 bis 5 Sterne. */
  skill: number;
  traits: GeneralTraitId[];
  /** Gewonnene und verlorene Schlachten. */
  wins: number;
  losses: number;
  /** Erfahrung steigt mit jeder Schlacht und hebt das Können. */
  xp: number;
  hired: number;
}

/* ------------------------------------------------------------------ */
/* Gebiete im Spiel                                                    */
/* ------------------------------------------------------------------ */

export type BuildingId =
  | 'economy' | 'infrastructure' | 'barracks' | 'fortress'
  | 'research' | 'port' | 'granary';

export interface Province {
  id: string;
  name: string;
  points?: string;
  rings?: string[];
  center: [number, number];
  terrain: TerrainId;
  neighbors: string[];
  resource: ResourceId;
  isPort: boolean;
  land?: string;

  ownerId: string | null;
  /** Urspruenglicher Besitzer - bestimmt Unruhe und Rueckeroberungsansprueche. */
  coreOf: string | null;
  isCapital: boolean;

  population: number;
  economy: number;
  infrastructure: number;
  fortification: number;
  /** 0-100, sinkt bei Abschneidung von der Hauptstadt. */
  supply: number;
  /** 0-100, hohe Werte führen zu Aufständen. */
  unrest: number;
  buildings: Record<BuildingId, number>;
  regiments: Regiments;
  /** Läuft eine Belagerung, steht hier ihr Fortschritt. */
  siege: SiegeState | null;
  /** Runde, in der das Gebiet zuletzt den Besitzer wechselte. */
  capturedTurn: number;
}

export interface SiegeState {
  attackerId: string;
  /** 0-100; bei 100 fällt die Festung. */
  progress: number;
  startedTurn: number;
}

/* ------------------------------------------------------------------ */
/* Länder                                                             */
/* ------------------------------------------------------------------ */

export type GovernmentId =
  | 'republic' | 'monarchy' | 'empire' | 'tribal' | 'feudal'
  | 'theocracy' | 'military' | 'democracy' | 'federation';

export type PersonalityId =
  | 'aggressive' | 'defensive' | 'economic' | 'diplomatic'
  | 'expansionist' | 'opportunistic' | 'isolationist' | 'erratic';

export type TechFieldId =
  | 'military' | 'economy' | 'administration' | 'logistics' | 'defense';

export interface CountryTraits {
  military: number;
  economy: number;
  defense: number;
  research: number;
  trade: number;
}

export interface ConstructionProject {
  id: string;
  provinceId: string;
  building: BuildingId;
  turnsLeft: number;
}

export interface ResearchProject {
  field: TechFieldId;
  progress: number;
  cost: number;
}

/* ------------------------------------------------------------------ */
/* Herrscher                                                           */
/* ------------------------------------------------------------------ */

export type RulerTraitId =
  | 'eroberer' | 'baumeister' | 'sparsam' | 'gelehrt' | 'gerecht'
  | 'gefuerchtet' | 'redegewandt' | 'kraenklich' | 'jaehzornig' | 'vorsichtig';

export interface Ruler {
  name: string;
  /** Lebensalter in Jahren - waechst mit jeder Runde. */
  alter: number;
  /** Jahr des Regierungsantritts. */
  regiertSeit: number;
  traits: RulerTraitId[];
  /** Je 1 bis 5. */
  verwaltung: number;
  diplomatie: number;
  kriegskunst: number;
}

export interface Country {
  id: string;
  name: string;
  color: string;
  emblem: string;
  /** Wappenkennung - steuert den prozeduralen Wappengenerator. */
  crest: number;
  ruler: string;
  government: GovernmentId;
  personality: PersonalityId;
  capitalProvinceId: string;
  traits: CountryTraits;
  description: string;

  gold: number;
  debt: number;
  stability: number;
  politicalPower: number;
  legitimacy: number;
  warExhaustion: number;
  manpower: number;

  taxRate: number;
  researchBudget: number;
  tech: Record<TechFieldId, number>;
  research: ResearchProject | null;
  construction: ConstructionProject[];

  actionPoints: number;
  maxActionPoints: number;

  alive: boolean;
  isPlayer: boolean;
  /** Lehnsherr, falls dieses Land Vasall ist. */
  overlordId: string | null;
  /** Wie viel Spionagewissen über andere Länder vorliegt (0-100). */
  intel: Record<string, number>;
  /** Der regierende Herrscher samt Faehigkeiten. */
  rulerData?: Ruler;
}

/* ------------------------------------------------------------------ */
/* Diplomatie und Krieg                                                */
/* ------------------------------------------------------------------ */

export type TreatyId = 'trade' | 'nonAggression' | 'truce' | 'passage' | 'defensive';

export interface Treaty {
  type: TreatyId;
  a: string;
  b: string;
  /** Runde, in der der Vertrag auslaeuft; 0 = unbefristet. */
  until: number;
}

export interface Alliance {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  founded: number;
}

export type WarGoalId =
  | 'conquest'     // Gebiete fordern
  | 'subjugation'  // Vasallisierung
  | 'humiliate'    // Reparationen und Ansehen
  | 'liberate'     // Kerngebiete zurückholen
  | 'hegemony';    // Vollständige Unterwerfung

export interface War {
  id: string;
  sideA: string[];
  sideB: string[];
  /** Positiv = Seite A liegt vorn. Reicht von -100 bis +100. */
  scoreA: number;
  startTurn: number;
  goalA: WarGoalId;
  goalB: WarGoalId;
  /** Gebiete, die im Krieg den Besitzer wechselten (für Friedensschluesse). */
  occupiedByA: string[];
  occupiedByB: string[];
}

export interface PeaceOffer {
  id: string;
  warId: string;
  fromId: string;
  toId: string;
  message: string;
  cededProvinces: string[];
  reparations: number;
  vassalize: boolean;
}

/* ------------------------------------------------------------------ */
/* Ereignisse                                                          */
/* ------------------------------------------------------------------ */

export interface EventConditions {
  goldBelow?: number;
  goldAbove?: number;
  stabilityBelow?: number;
  stabilityAbove?: number;
  atWar?: boolean;
  minTurn?: number;
  provincesAbove?: number;
  armyAbove?: number;
  minYear?: number;
  maxYear?: number;
}

export interface EventEffects {
  gold?: number;
  stability?: number;
  unrest?: number;
  politicalPower?: number;
  populationPct?: number;
  armyPct?: number;
  researchPoints?: number;
  relationsAll?: number;
  warExhaustion?: number;
  manpower?: number;
}

export interface EventChoice {
  text: string;
  effects: EventEffects;
}

export interface GameEventDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  probability: number;
  repeatable: boolean;
  conditions: EventConditions;
  choices: EventChoice[];
}

export interface PendingEvent {
  definitionId: string;
  name: string;
  description: string;
  icon: string;
  choices: EventChoice[];
}

/* ------------------------------------------------------------------ */
/* Berichte und Protokoll                                              */
/* ------------------------------------------------------------------ */

export interface BattleFactor {
  label: string;
  attacker: number;
  defender: number;
  /** Wird als Faktor (x1,25) statt als Zahl dargestellt. */
  istFaktor: boolean;
}

export interface BattleReport {
  id: string;
  turn: number;
  provinceId: string;
  provinceName: string;
  attackerId: string;
  attackerName: string;
  defenderId: string | null;
  defenderName: string;
  terrain: TerrainId;
  attackerRegiments: Regiments;
  defenderRegiments: Regiments;
  attackPower: number;
  defensePower: number;
  factors: BattleFactor[];
  attackerLosses: Regiments;
  defenderLosses: Regiments;
  attackerWon: boolean;
  captured: boolean;
  /** Angriff hat die Festung noch nicht gebrochen - Belagerung läuft. */
  siegeStarted: boolean;
  retreated: number;
  generalName: string | null;
  note: string;
}

export type LogKind = 'info' | 'war' | 'peace' | 'economy' | 'event' | 'battle' | 'achievement';

export interface LogEntry {
  id: string;
  turn: number;
  year: number;
  kind: LogKind;
  text: string;
}

export interface HistoryPoint {
  turn: number;
  countryId: string;
  provinces: number;
  army: number;
  gold: number;
  power: number;
}

export interface Achievement {
  id: string;
  name: string;
  beschreibung: string;
  turn: number;
}

/* ------------------------------------------------------------------ */
/* Siegbedingungen und Gesamtzustand                                   */
/* ------------------------------------------------------------------ */

export interface VictoryCondition {
  type: 'provinces' | 'capitals' | 'survive' | 'economy';
  value: number;
  targets?: string[];
  description: string;
}

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameStatus = 'playing' | 'victory' | 'defeat';

export interface MapFilterDef {
  id: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/* Zielvorgaben                                                        */
/* ------------------------------------------------------------------ */

export type MissionKind =
  | 'provinces' | 'army' | 'gold' | 'income' | 'tech' | 'vassals'
  | 'allies' | 'stability' | 'capture' | 'defeat' | 'fortify'
  | 'buildings' | 'navy' | 'power';

export interface MissionLohn {
  gold?: number;
  politicalPower?: number;
  stability?: number;
  manpower?: number;
  researchPoints?: number;
}

export interface Mission {
  id: string;
  kind: MissionKind;
  name: string;
  beschreibung: string;
  /** Zu erreichender Wert. */
  ziel: number;
  /** Nur bei kind 'tech': welches Feld. */
  feld?: TechFieldId;
  /** Nur bei kind 'capture': welches Gebiet. */
  zielProvinz?: string;
  /** Nur bei kind 'capture'/'defeat': welches Land. */
  zielLand?: string;
  lohn: MissionLohn;
  /** Schwierigkeitsstufe - steigt mit der Zahl erfüllter Vorgaben. */
  stufe: number;
  erledigt: boolean;
  rundeErledigt: number | null;
}

export interface GameState {
  version: number;
  scenarioId: string;
  scenarioName: string;
  mapId: string;
  viewBox: string;
  /** Gittereinheiten je Zeichenflaecheneinheit in "rings". */
  ringTeiler?: number;
  seaLinks: Array<[string, string]>;

  turn: number;
  year: number;
  /** Startjahr des Szenarios - das Jahr wird daraus berechnet, nicht fortgeschrieben. */
  startYear: number;
  monthsPerTurn: number;
  endYear: number;
  sandbox: boolean;
  difficulty: Difficulty;
  status: GameStatus;
  statusMessage: string;

  playerCountryId: string;
  countryOrder: string[];
  countries: Record<string, Country>;
  provinceOrder: string[];
  provinces: Record<string, Province>;
  generals: Record<string, General>;

  relations: Record<string, number>;
  treaties: Treaty[];
  alliances: Alliance[];
  wars: War[];
  pendingPeaceOffers: PeaceOffer[];

  eventPool: string[];
  firedEvents: string[];
  pendingEvent: PendingEvent | null;

  log: LogEntry[];
  battleReports: BattleReport[];
  history: HistoryPoint[];
  achievements: Achievement[];
  victoryConditions: VictoryCondition[];
  /** Laufende und erfüllte Zielvorgaben des Spielerlandes. */
  missions: Mission[];
  /** Fortlaufende Nummer für eindeutige Vorgabenkennungen. */
  missionZaehler: number;
  /**
   * Maßstab für alle Goldkosten, aus der Karte abgeleitet.
   *
   * Eine Karte mit Bundesländern hat je Gebiet ein Vielfaches der
   * Wirtschaftskraft einer Karte mit ganzen Staaten. Feste Baukosten wären
   * dort nach einer Runde bedeutungslos. Der Maßstab hebt Bau- und
   * Aushebungskosten auf das Niveau der jeweiligen Karte.
   */
  kostenFaktor: number;

  /** Zaehler für eindeutige Kennungen. */
  seq: number;
  /** Zustand des Zufallsgenerators, damit Spielstände reproduzierbar sind. */
  rngState: number;
  /** Ausgangswert des Zufallsgebers - erlaubt es, dieselbe Partie erneut zu spielen. */
  seed: number;
}

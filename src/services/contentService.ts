/**
 * Zentraler Zugriff auf alle statischen Spieldaten.
 *
 * Neue Karten, Szenarien, Einheiten, Gebäude, Technologien, Projekte oder
 * Ereignisse werden ausschließlich hier registriert. Der restliche Code
 * greift nur über diese Funktionen zu.
 */
import type {
  BuildingDefinition,
  BuildingId,
  GameEventDefinition,
  GameMapDefinition,
  ProjectDefinition,
  ProjectId,
  ScenarioDefinition,
  TerritoryDefinition,
  Technology,
  UnitDefinition,
  UnitTypeId
} from '../models/types';

import aureliaMap from '../data/maps/aurelia.json';
import thalassaMap from '../data/maps/thalassa.json';
import nordmarkMap from '../data/maps/nordmark.json';

import aureliaScenario from '../data/scenarios/aurelia_fuersten.json';
import thalassaScenario from '../data/scenarios/thalassa_seemaechte.json';
import nordmarkScenario from '../data/scenarios/nordmark_grenzkonflikte.json';

import unitData from '../data/units.json';
import buildingData from '../data/buildings.json';
import technologyData from '../data/technologies.json';
import projectData from '../data/projects.json';
import eventData from '../data/events.json';

/** Alle verfügbaren Karten. Neue Karten hier eintragen. */
const MAPS: GameMapDefinition[] = [
  nordmarkMap as unknown as GameMapDefinition,
  aureliaMap as unknown as GameMapDefinition,
  thalassaMap as unknown as GameMapDefinition
];

/** Alle verfügbaren Szenarien. Neue Szenarien hier eintragen. */
const SCENARIOS: ScenarioDefinition[] = [
  nordmarkScenario as unknown as ScenarioDefinition,
  aureliaScenario as unknown as ScenarioDefinition,
  thalassaScenario as unknown as ScenarioDefinition
];

const UNITS: UnitDefinition[] = unitData as unknown as UnitDefinition[];
const BUILDINGS: BuildingDefinition[] = buildingData as unknown as BuildingDefinition[];
const TECHNOLOGIES: Technology[] = technologyData as unknown as Technology[];
const PROJECTS: ProjectDefinition[] = projectData as unknown as ProjectDefinition[];
const EVENTS: GameEventDefinition[] = eventData as unknown as GameEventDefinition[];

/** Schneller Index für Gebietsdefinitionen je Karte. */
const territoryIndex = new Map<string, Map<string, TerritoryDefinition>>();
for (const map of MAPS) {
  const index = new Map<string, TerritoryDefinition>();
  for (const territory of map.territories) {
    index.set(territory.id, territory);
  }
  territoryIndex.set(map.id, index);
}

export function getAllMaps(): GameMapDefinition[] {
  return MAPS;
}

export function getMap(mapId: string): GameMapDefinition {
  const found = MAPS.find((entry) => entry.id === mapId);
  if (!found) throw new Error(`Karte "${mapId}" wurde nicht gefunden.`);
  return found;
}

export function getAllScenarios(): ScenarioDefinition[] {
  return SCENARIOS;
}

export function getScenario(scenarioId: string): ScenarioDefinition {
  const found = SCENARIOS.find((entry) => entry.id === scenarioId);
  if (!found) throw new Error(`Szenario "${scenarioId}" wurde nicht gefunden.`);
  return found;
}

export function getScenariosForMap(mapId: string): ScenarioDefinition[] {
  return SCENARIOS.filter((entry) => entry.mapId === mapId);
}

export function getTerritoryDefinition(mapId: string, territoryId: string): TerritoryDefinition {
  const found = territoryIndex.get(mapId)?.get(territoryId);
  if (!found) throw new Error(`Gebiet "${territoryId}" existiert nicht auf Karte "${mapId}".`);
  return found;
}

export function getAllUnits(): UnitDefinition[] {
  return UNITS;
}

export function getUnit(unitId: UnitTypeId): UnitDefinition {
  const found = UNITS.find((entry) => entry.id === unitId);
  if (!found) throw new Error(`Einheit "${unitId}" wurde nicht gefunden.`);
  return found;
}

export function getAllBuildings(): BuildingDefinition[] {
  return BUILDINGS;
}

export function getBuilding(buildingId: BuildingId): BuildingDefinition {
  const found = BUILDINGS.find((entry) => entry.id === buildingId);
  if (!found) throw new Error(`Gebäude "${buildingId}" wurde nicht gefunden.`);
  return found;
}

export function getAllTechnologies(): Technology[] {
  return TECHNOLOGIES;
}

export function getTechnology(techId: string): Technology | undefined {
  return TECHNOLOGIES.find((entry) => entry.id === techId);
}

export function getAllProjects(): ProjectDefinition[] {
  return PROJECTS;
}

export function getProject(projectId: ProjectId): ProjectDefinition {
  const found = PROJECTS.find((entry) => entry.id === projectId);
  if (!found) throw new Error(`Projekt "${projectId}" wurde nicht gefunden.`);
  return found;
}

export function getAllEvents(): GameEventDefinition[] {
  return EVENTS;
}

export function getEvent(eventId: string): GameEventDefinition | undefined {
  return EVENTS.find((entry) => entry.id === eventId);
}

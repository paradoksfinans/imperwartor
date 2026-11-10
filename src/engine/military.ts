/**
 * Militärische Aktionen, Gebietsausbau und Großprojekte.
 * Jede Funktion prüft die Voraussetzungen und liefert ein ActionResult zurück.
 */
import type {
  ActionResult,
  Army,
  BuildingId,
  GameState,
  ProjectId,
  TerritoryState
} from '../models/types';
import { getBuilding, getProject, getTerritoryDefinition } from '../services/contentService';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import {
  addArmies,
  addStock,
  armySize,
  canAfford,
  describeArmy,
  describeMissing,
  emptyArmy,
  getAvailableUnits,
  landSize,
  limitArmy,
  payStock,
  recruitmentCost,
  scaleCost,
  subtractArmies,
  transportCapacity
} from './army';
import { resolveBattle } from './combat';
import {
  MAX_CONSTRUCTION_QUEUE,
  TERRAIN_INFO,
  areAtWar,
  areNeighbours,
  getBuildingCost,
  getProjectBonus,
  getRecruitDiscount,
  getSupplyCapacity,
  isSeaConnection
} from './rules';

function spendActionPoints(state: GameState, countryId: string, amount: number): boolean {
  const country = state.countries[countryId];
  if (!country || country.actionPoints < amount) return false;
  country.actionPoints -= amount;
  return true;
}

/* ------------------------------------------------------------------ */
/* Rekrutierung                                                        */
/* ------------------------------------------------------------------ */

export function recruitTroops(
  state: GameState,
  countryId: string,
  territoryId: string,
  order: Army
): ActionResult {
  const country = state.countries[countryId];
  const territory = state.territories[territoryId];
  if (!country || !territory) return { ok: false, message: 'Ungültige Auswahl.' };
  if (territory.ownerId !== countryId) {
    return { ok: false, message: 'Nur in eigenen Gebieten kann rekrutiert werden.' };
  }
  if (armySize(order) <= 0) return { ok: false, message: 'Bitte zuerst Einheiten auswählen.' };

  const available = getAvailableUnits(country);
  for (const unitId of ['infantry', 'cavalry', 'artillery', 'fleet'] as const) {
    if (order[unitId] > 0 && !available.includes(unitId)) {
      return { ok: false, message: 'Für diese Einheit fehlt dir noch die Technologie.' };
    }
  }
  const definition = getTerritoryDefinition(state.mapId, territoryId);
  if (order.fleet > 0 && !definition.hasPort) {
    return { ok: false, message: 'Flotten können nur in Hafengebieten gebaut werden.' };
  }

  const discount = getRecruitDiscount(country, territory);
  const cost = recruitmentCost(order);
  const goldCost = Math.round(cost.gold * discount);
  const resourceCost = scaleCost(cost.resources, discount);

  if (country.gold < goldCost) {
    return { ok: false, message: `Nicht genug Gold (benötigt: ${goldCost}).` };
  }
  if (!canAfford(country.resources, resourceCost)) {
    return { ok: false, message: `Rohstoffe fehlen: ${describeMissing(country.resources, resourceCost)}.` };
  }
  if (territory.population - cost.population < 250) {
    return { ok: false, message: 'Die Bevölkerung des Gebietes reicht nicht aus.' };
  }
  if (country.actionPoints < 1) {
    return { ok: false, message: 'Keine Aktionspunkte mehr in dieser Runde.' };
  }

  spendActionPoints(state, countryId, 1);
  country.gold -= goldCost;
  country.resources = payStock(country.resources, resourceCost);
  territory.population -= cost.population;
  territory.army = addArmies(territory.army, order);
  territory.unrest = clamp(territory.unrest + armySize(order) * 0.08, 0, 100);

  return {
    ok: true,
    message: `${describeArmy(order)} in ${definition.name} ausgehoben (${goldCost} Gold).`
  };
}

/* ------------------------------------------------------------------ */
/* Bewegung und Angriff                                                */
/* ------------------------------------------------------------------ */

export function getMoveTargets(state: GameState, countryId: string, fromId: string): string[] {
  const from = state.territories[fromId];
  if (!from || from.ownerId !== countryId || armySize(from.army) <= 0) return [];
  return getNeighbourList(state, fromId).filter((id) => {
    const target = state.territories[id];
    if (!target) return false;
    if (target.ownerId === countryId) return true;
    // Durchmarsch durch Vasallengebiete ist erlaubt
    const owner = state.countries[target.ownerId];
    return Boolean(owner && owner.overlordId === countryId);
  });
}

export function getAttackTargets(state: GameState, countryId: string, fromId: string): string[] {
  const from = state.territories[fromId];
  if (!from || from.ownerId !== countryId || landSize(from.army) <= 0) return [];
  return getNeighbourList(state, fromId).filter((id) => {
    const target = state.territories[id];
    if (!target || target.ownerId === countryId) return false;
    if (target.ownerId === '') return true;
    const owner = state.countries[target.ownerId];
    if (owner && owner.overlordId === countryId) return false;
    return areAtWar(state, countryId, target.ownerId);
  });
}

function getNeighbourList(state: GameState, territoryId: string): string[] {
  const definition = getTerritoryDefinition(state.mapId, territoryId);
  const seaLinks = definition.seaNeighbours.filter((otherId) => {
    const other = getTerritoryDefinition(state.mapId, otherId);
    return definition.hasPort && other.hasPort;
  });
  return [...definition.neighbours, ...seaLinks];
}

/** Prüft, ob eine Aufstellung über eine Seeverbindung transportiert werden kann. */
function checkTransport(
  state: GameState,
  countryId: string,
  fromId: string,
  toId: string,
  order: Army
): ActionResult {
  if (!isSeaConnection(state, fromId, toId)) return { ok: true, message: '' };
  const country = state.countries[countryId];
  const projects = country ? getProjectBonus(country) : { transport: 0 };
  const capacity = transportCapacity(order, projects.transport ?? 0);
  const land = landSize(order);
  if (order.fleet <= 0) {
    return { ok: false, message: 'Für eine Seeverbindung wird mindestens eine Flotte benötigt.' };
  }
  if (land > capacity) {
    return {
      ok: false,
      message: `Die Flotte kann nur ${capacity} Landeinheiten transportieren (gewählt: ${land}).`
    };
  }
  return { ok: true, message: '' };
}

export function moveTroops(
  state: GameState,
  countryId: string,
  fromId: string,
  toId: string,
  order: Army
): ActionResult {
  const country = state.countries[countryId];
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!country || !from || !to) return { ok: false, message: 'Ungültige Auswahl.' };
  if (from.ownerId !== countryId) return { ok: false, message: 'Das Ausgangsgebiet gehört dir nicht.' };
  if (!areNeighbours(state, fromId, toId)) {
    return { ok: false, message: 'Die Gebiete sind nicht verbunden.' };
  }
  if (!getMoveTargets(state, countryId, fromId).includes(toId)) {
    return { ok: false, message: 'In dieses Gebiet darfst du nicht einmarschieren.' };
  }

  const troops = limitArmy(order, from.army);
  if (armySize(troops) <= 0) return { ok: false, message: 'Keine Truppen ausgewählt.' };

  const transport = checkTransport(state, countryId, fromId, toId, troops);
  if (!transport.ok) return transport;

  const targetDefinition = getTerritoryDefinition(state.mapId, toId);
  const cost = 1 + TERRAIN_INFO[targetDefinition.terrain].movementPenalty;
  if (country.actionPoints < cost) {
    return { ok: false, message: `Nicht genug Aktionspunkte (benötigt: ${cost}).` };
  }
  if (troops.fleet > 0 && !targetDefinition.hasPort && !isSeaConnection(state, fromId, toId)) {
    return { ok: false, message: 'Flotten können nur zwischen Hafengebieten verlegt werden.' };
  }

  spendActionPoints(state, countryId, cost);
  from.army = subtractArmies(from.army, troops);
  to.army = addArmies(to.army, troops);

  const capacity = getSupplyCapacity(state, country, to);
  const warning = landSize(to.army) > capacity ? ' Achtung: Versorgungsgrenze überschritten.' : '';

  return {
    ok: true,
    message: `${describeArmy(troops)} nach ${targetDefinition.name} verlegt.${warning}`
  };
}

export function attackTerritory(
  state: GameState,
  countryId: string,
  fromId: string,
  toId: string,
  order: Army
): ActionResult {
  const country = state.countries[countryId];
  const from = state.territories[fromId];
  const to = state.territories[toId];
  if (!country || !from || !to) return { ok: false, message: 'Ungültige Auswahl.' };
  if (from.ownerId !== countryId) return { ok: false, message: 'Das Ausgangsgebiet gehört dir nicht.' };
  if (to.ownerId === countryId) return { ok: false, message: 'Eigene Gebiete können nicht angegriffen werden.' };
  if (!areNeighbours(state, fromId, toId)) {
    return { ok: false, message: 'Das Zielgebiet ist nicht benachbart.' };
  }
  if (to.ownerId !== '' && !areAtWar(state, countryId, to.ownerId)) {
    return { ok: false, message: 'Ohne Kriegserklärung ist kein Angriff möglich.' };
  }

  const troops = limitArmy(order, from.army);
  if (landSize(troops) <= 0) {
    return { ok: false, message: 'Für einen Angriff werden Landeinheiten benötigt.' };
  }

  const transport = checkTransport(state, countryId, fromId, toId, troops);
  if (!transport.ok) return transport;

  const targetDefinition = getTerritoryDefinition(state.mapId, toId);
  const cost = 1 + TERRAIN_INFO[targetDefinition.terrain].movementPenalty;
  if (country.actionPoints < cost) {
    return { ok: false, message: `Nicht genug Aktionspunkte (benötigt: ${cost}).` };
  }

  spendActionPoints(state, countryId, cost);

  const rng = new Rng(state.rngSeed);
  const report = resolveBattle({
    state,
    attackerId: countryId,
    defenderId: to.ownerId,
    fromTerritoryId: fromId,
    targetTerritoryId: toId,
    attackingArmy: troops,
    rng
  });
  state.rngSeed = rng.seed;
  if (countryId === state.playerCountryId || to.ownerId === state.playerCountryId) {
    state.pendingBattleReportId = report.id;
  }

  state.log.unshift({
    turn: state.turn,
    type: 'battle',
    text: `${report.attackerName} greift ${report.territoryName} an: ${
      report.captured ? 'Gebiet erobert' : 'Angriff abgewehrt'
    }.`,
    important: countryId === state.playerCountryId || to.ownerId === state.playerCountryId
  });

  return {
    ok: true,
    message: report.captured
      ? `${report.territoryName} wurde erobert.`
      : `Der Angriff auf ${report.territoryName} wurde abgewehrt.`
  };
}

/* ------------------------------------------------------------------ */
/* Gebietsausbau                                                       */
/* ------------------------------------------------------------------ */

/**
 * Stufe, die ein Gebäude nach Abarbeitung der Bauschlange erreicht hat.
 * Dadurch lassen sich mehrere Stufen desselben Gebäudes vormerken, ohne dass
 * Kosten oder Höchststufe durcheinandergeraten.
 */
export function getPlannedLevel(territory: TerritoryState, buildingId: BuildingId): number {
  const queued = territory.construction.filter(
    (order) => order.kind === 'building' && order.id === buildingId
  ).length;
  return territory.buildings[buildingId] + queued;
}

/** Ist in diesem Reich bereits ein Großprojekt begonnen oder vorgemerkt? */
export function hasProjectInProgress(state: GameState, countryId: string): boolean {
  return Object.values(state.territories).some(
    (territory) =>
      territory.ownerId === countryId &&
      territory.construction.some((order) => order.kind === 'project')
  );
}

export function constructBuilding(
  state: GameState,
  countryId: string,
  territoryId: string,
  buildingId: BuildingId
): ActionResult {
  const country = state.countries[countryId];
  const territory = state.territories[territoryId];
  if (!country || !territory) return { ok: false, message: 'Ungültige Auswahl.' };
  if (territory.ownerId !== countryId) {
    return { ok: false, message: 'Nur eigene Gebiete können ausgebaut werden.' };
  }
  if (territory.construction.length >= MAX_CONSTRUCTION_QUEUE) {
    return {
      ok: false,
      message: `Die Bauschlange ist voll (${MAX_CONSTRUCTION_QUEUE} Vorhaben).`
    };
  }

  const definition = getBuilding(buildingId);
  if (definition.requiresTech && !country.technologies.includes(definition.requiresTech)) {
    return { ok: false, message: 'Dafür fehlt dir noch die passende Technologie.' };
  }
  const mapDefinition = getTerritoryDefinition(state.mapId, territoryId);
  if (definition.requiresPort && !mapDefinition.hasPort) {
    return { ok: false, message: 'Dieses Gebäude benötigt einen Hafen.' };
  }

  // Die geplante Stufe berücksichtigt bereits vorgemerkte Ausbauten.
  const level = getPlannedLevel(territory, buildingId);
  if (level >= definition.maxLevel) {
    return { ok: false, message: `${definition.name} erreicht damit bereits die Maximalstufe.` };
  }

  const cost = getBuildingCost(buildingId, level);
  if (country.gold < cost) return { ok: false, message: `Nicht genug Gold (benötigt: ${cost}).` };
  if (!canAfford(country.resources, definition.resources)) {
    return {
      ok: false,
      message: `Rohstoffe fehlen: ${describeMissing(country.resources, definition.resources)}.`
    };
  }
  if (country.actionPoints < 1) return { ok: false, message: 'Keine Aktionspunkte mehr in dieser Runde.' };

  spendActionPoints(state, countryId, 1);
  country.gold -= cost;
  country.resources = payStock(country.resources, definition.resources);
  territory.construction.push({
    kind: 'building',
    id: buildingId,
    turnsLeft: definition.buildTurns,
    totalTurns: definition.buildTurns
  });

  const position = territory.construction.length;
  return {
    ok: true,
    message:
      position === 1
        ? `${definition.name} in ${mapDefinition.name} begonnen (${definition.buildTurns} ${definition.buildTurns === 1 ? 'Runde' : 'Runden'}).`
        : `${definition.name} in ${mapDefinition.name} vorgemerkt (Platz ${position} der Bauschlange).`
  };
}

/** Beschleunigt das laufende Vorhaben mit politischer Macht. */
export function rushConstruction(
  state: GameState,
  countryId: string,
  territoryId: string
): ActionResult {
  const country = state.countries[countryId];
  const territory = state.territories[territoryId];
  const active = territory?.construction[0];
  if (!country || !territory || !active) {
    return { ok: false, message: 'Hier wird derzeit nicht gebaut.' };
  }
  const cost = active.turnsLeft * 12;
  if (country.politicalPower < cost) {
    return { ok: false, message: `Nicht genug politische Macht (${cost} nötig).` };
  }
  country.politicalPower -= cost;
  active.turnsLeft = 0;
  return { ok: true, message: 'Das Vorhaben wird noch in dieser Runde abgeschlossen.' };
}

/**
 * Nimmt ein Vorhaben aus der Bauschlange.
 * Noch nicht begonnene Vorhaben werden voll erstattet, das laufende zur
 * Hälfte - Material und Löhne sind dort bereits geflossen.
 */
export function cancelConstruction(
  state: GameState,
  countryId: string,
  territoryId: string,
  index: number
): ActionResult {
  const country = state.countries[countryId];
  const territory = state.territories[territoryId];
  if (!country || !territory || territory.ownerId !== countryId) {
    return { ok: false, message: 'Ungültige Auswahl.' };
  }
  const order = territory.construction[index];
  if (!order) return { ok: false, message: 'Dieses Vorhaben gibt es nicht mehr.' };

  const started = index === 0 && order.turnsLeft < order.totalTurns;
  const share = started ? 0.5 : 1;

  let name = order.id;
  if (order.kind === 'building') {
    const definition = getBuilding(order.id as BuildingId);
    name = definition.name;
    country.gold += Math.round(getBuildingCost(order.id as BuildingId, getPlannedLevel(territory, order.id as BuildingId) - 1) * share);
    if (!started) {
      country.resources = addStock(country.resources, definition.resources);
    }
  } else {
    const project = getProject(order.id as ProjectId);
    name = project.name;
    country.gold += Math.round(project.gold * share);
    if (!started) {
      country.resources = addStock(country.resources, project.resources);
    }
  }

  territory.construction.splice(index, 1);
  return {
    ok: true,
    message: started
      ? `${name} abgebrochen - die Hälfte der Kosten wurde erstattet.`
      : `${name} aus der Bauschlange genommen, Kosten vollständig erstattet.`
  };
}

export function startProject(
  state: GameState,
  countryId: string,
  territoryId: string,
  projectId: ProjectId
): ActionResult {
  const country = state.countries[countryId];
  const territory = state.territories[territoryId];
  if (!country || !territory) return { ok: false, message: 'Ungültige Auswahl.' };
  if (territory.ownerId !== countryId) {
    return { ok: false, message: 'Großprojekte entstehen nur in eigenen Gebieten.' };
  }
  if (territory.construction.length >= MAX_CONSTRUCTION_QUEUE) {
    return {
      ok: false,
      message: `Die Bauschlange ist voll (${MAX_CONSTRUCTION_QUEUE} Vorhaben).`
    };
  }
  if (country.completedProjects.includes(projectId)) {
    return { ok: false, message: 'Dieses Bauwerk besitzt dein Reich bereits.' };
  }
  if (hasProjectInProgress(state, countryId)) {
    return { ok: false, message: 'Dein Reich kann nur ein Großprojekt gleichzeitig errichten.' };
  }

  const definition = getProject(projectId);
  if (definition.requiresTech && !country.technologies.includes(definition.requiresTech)) {
    return { ok: false, message: 'Dafür fehlt dir noch die passende Technologie.' };
  }
  const mapDefinition = getTerritoryDefinition(state.mapId, territoryId);
  if (definition.requiresPort && !mapDefinition.hasPort) {
    return { ok: false, message: 'Dieses Bauwerk benötigt einen Hafen.' };
  }
  if (country.gold < definition.gold) {
    return { ok: false, message: `Nicht genug Gold (benötigt: ${definition.gold}).` };
  }
  if (!canAfford(country.resources, definition.resources)) {
    return {
      ok: false,
      message: `Rohstoffe fehlen: ${describeMissing(country.resources, definition.resources)}.`
    };
  }
  if (country.actionPoints < 2) {
    return { ok: false, message: 'Ein Großprojekt kostet 2 Aktionspunkte.' };
  }

  spendActionPoints(state, countryId, 2);
  country.gold -= definition.gold;
  country.resources = payStock(country.resources, definition.resources);
  territory.construction.push({
    kind: 'project',
    id: projectId,
    turnsLeft: definition.turns,
    totalTurns: definition.turns
  });

  state.log.unshift({
    turn: state.turn,
    type: 'project',
    text: `${country.name} beginnt den Bau: ${definition.name} in ${mapDefinition.name}.`,
    important: country.isPlayer
  });

  return { ok: true, message: `${definition.name} wird errichtet (${definition.turns} Runden).` };
}

/** Schließt fällige Bauvorhaben ab. Wird vom Rundenablauf aufgerufen. */
export function processConstruction(state: GameState, countryId: string): string[] {
  const messages: string[] = [];
  const country = state.countries[countryId];
  if (!country) return messages;

  for (const territory of Object.values(state.territories)) {
    if (territory.ownerId !== countryId || territory.construction.length === 0) continue;

    // Gearbeitet wird immer nur am vordersten Vorhaben.
    const active = territory.construction[0];
    active.turnsLeft -= 1;
    if (active.turnsLeft > 0) continue;

    const mapDefinition = getTerritoryDefinition(state.mapId, territory.id);
    if (active.kind === 'building') {
      const buildingId = active.id as BuildingId;
      territory.buildings[buildingId] += 1;
      if (buildingId === 'fortress') territory.fortification += 1;
      if (buildingId === 'road') territory.infrastructure += 1;
      if (buildingId === 'market') territory.economy = Math.round(territory.economy * 1.08);
      messages.push(`${getBuilding(buildingId).name} in ${mapDefinition.name} fertiggestellt.`);
    } else {
      const projectId = active.id as ProjectId;
      const project = getProject(projectId);
      country.completedProjects.push(projectId);
      country.prestige = clamp(country.prestige + project.prestige, -60, 160);
      if (projectId === 'citadel') territory.fortification += 2;
      messages.push(`Großprojekt vollendet: ${project.name} in ${mapDefinition.name}.`);
      state.log.unshift({
        turn: state.turn,
        type: 'project',
        text: `${country.name} vollendet ${project.name}.`,
        important: true
      });
    }

    // Fertiges Vorhaben entfernen, das nächste rückt auf.
    territory.construction.shift();
    const next = territory.construction[0];
    if (next && country.isPlayer) {
      const nextName =
        next.kind === 'building'
          ? getBuilding(next.id as BuildingId).name
          : getProject(next.id as ProjectId).name;
      messages.push(`In ${mapDefinition.name} beginnt nun: ${nextName}.`);
    }
  }
  return messages;
}

/** Teilt eine Armee in zwei Teile (Oberflächenhilfe). */
export function splitArmy(army: Army, ratio: number): { taken: Army; left: Army } {
  const taken: Army = {
    infantry: Math.floor(army.infantry * ratio),
    cavalry: Math.floor(army.cavalry * ratio),
    artillery: Math.floor(army.artillery * ratio),
    fleet: Math.floor(army.fleet * ratio)
  };
  return { taken, left: subtractArmies(army, taken) };
}

export { emptyArmy };

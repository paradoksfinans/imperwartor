/**
 * Wirtschaft, Rohstoffe, Bevölkerung, Stabilität und politische Macht.
 * Alle Funktionen arbeiten auf einem bereits kopierten Spielzustand.
 */
import type {
  GameState,
  IncomeBreakdown,
  ResourceStock,
  TerritoryState
} from '../models/types';
import { getBuilding, getTerritoryDefinition } from '../services/contentService';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import { emptyStock, landSize, resourceOf, RESOURCE_ORDER } from './army';
import {
  ADMIN_COST_PER_TERRITORY,
  DIFFICULTY_INFO,
  GOVERNMENT_INFO,
  TERRAIN_INFO,
  VASSAL_TRIBUTE_SHARE,
  getArmyUpkeep,
  getCountryTerritories,
  getProjectBonus,
  getSupplyCapacity,
  getTechBonus,
  hasTrade,
  isAtWarAtAll
} from './rules';

/** Effektiver Wirtschaftswert eines Gebietes inklusive Gebäude und Unruhe. */
export function getEffectiveEconomy(state: GameState, territory: TerritoryState): number {
  const definition = getTerritoryDefinition(state.mapId, territory.id);
  const terrain = TERRAIN_INFO[definition.terrain];
  const marketFactor = 1 + territory.buildings.market * 0.25;
  const roadFactor = 1 + territory.infrastructure * 0.04 + territory.buildings.road * 0.08;
  const unrestFactor = 1 - clamp(territory.unrest, 0, 100) / 160;
  const devastationFactor = 1 - clamp(territory.devastation, 0, 100) / 150;
  const portFactor = definition.hasPort ? 1 + 0.06 + territory.buildings.harbour * 0.08 : 1;
  const blockadeFactor = territory.blockaded ? 0.65 : 1;
  return (
    territory.economy *
    terrain.economy *
    marketFactor *
    roadFactor *
    unrestFactor *
    devastationFactor *
    portFactor *
    blockadeFactor
  );
}

/** Rohstoffproduktion eines einzelnen Gebietes pro Runde. */
export function getTerritoryResourceOutput(state: GameState, territory: TerritoryState): ResourceStock {
  const definition = getTerritoryDefinition(state.mapId, territory.id);
  const output = emptyStock();
  const workshop = 1 + territory.buildings.workshop * 0.3;
  const farm = 1 + territory.buildings.farm * 0.35;
  const harbour = 1 + territory.buildings.harbour * 0.2;

  // Grundproduktion aus der Bevölkerung
  output.grain += (territory.population / 900) * farm;

  for (const label of definition.resources) {
    const resource = resourceOf(label);
    if (!resource) continue;
    let amount = 2.2;
    if (resource === 'grain') amount *= farm;
    if (resource === 'iron' || resource === 'timber') amount *= workshop;
    if (resource === 'luxury') amount *= harbour * workshop;
    output[resource] += amount;
  }

  if (territory.blockaded) {
    for (const key of RESOURCE_ORDER) output[key] *= 0.6;
  }
  const unrestFactor = 1 - clamp(territory.unrest, 0, 100) / 200;
  for (const key of RESOURCE_ORDER) {
    output[key] = output[key] * unrestFactor;
  }
  return output;
}

/** Vollständige Einnahmen-/Ausgabenaufstellung eines Landes. */
export function calculateIncome(state: GameState, countryId: string): IncomeBreakdown {
  const country = state.countries[countryId];
  const empty: IncomeBreakdown = {
    taxes: 0, trade: 0, vassalTribute: 0, buildingUpkeep: 0, armyUpkeep: 0,
    administration: 0, blockadeLoss: 0, net: 0, researchPoints: 0,
    politicalPower: 0, resources: emptyStock()
  };
  if (!country) return empty;

  const territories = getCountryTerritories(state, countryId);
  const tech = getTechBonus(country);
  const projects = getProjectBonus(country);
  const government = GOVERNMENT_INFO[country.government];
  const difficulty = DIFFICULTY_INFO[state.difficulty] ?? DIFFICULTY_INFO.normal;

  let taxes = 0;
  let trade = 0;
  let buildingUpkeep = 0;
  let researchPoints = 0;
  let blockadeLoss = 0;
  const resources = emptyStock();

  for (const territory of territories) {
    const definition = getTerritoryDefinition(state.mapId, territory.id);
    const economy = getEffectiveEconomy(state, territory);

    taxes += economy * (country.taxRate * 3.6) + territory.population * 0.018 * (country.taxRate * 3.6);
    if (definition.hasPort) trade += economy * 0.16;
    trade += definition.resources.length * 5;
    if (territory.blockaded) blockadeLoss += economy * 0.35;

    for (const [buildingId, level] of Object.entries(territory.buildings)) {
      if (level > 0) buildingUpkeep += getBuilding(buildingId as never).upkeep * level;
    }

    researchPoints += 1.6 + territory.buildings.academy * 4.5 + economy * 0.026;

    const output = getTerritoryResourceOutput(state, territory);
    for (const key of RESOURCE_ORDER) resources[key] += output[key];
  }

  // Handelsabkommen
  let tradeAgreementBonus = 0;
  for (const agreement of state.trades) {
    if (agreement.a !== countryId && agreement.b !== countryId) continue;
    const partnerId = agreement.a === countryId ? agreement.b : agreement.a;
    const partner = state.countries[partnerId];
    if (!partner || !partner.isAlive) continue;
    const partnerEconomy = getCountryTerritories(state, partnerId).reduce(
      (total, t) => total + getEffectiveEconomy(state, t),
      0
    );
    tradeAgreementBonus += partnerEconomy * 0.05 * (1 + projects.trade);
  }
  trade += tradeAgreementBonus;

  const incomeFactor =
    (1 + tech.income + projects.income) *
    government.income *
    country.traits.economy *
    (country.isPlayer ? difficulty.playerIncome : 1);

  taxes *= incomeFactor;
  trade *= incomeFactor;

  // Tribut der Vasallen
  let vassalTribute = 0;
  for (const vassalId of country.vassals) {
    const vassal = state.countries[vassalId];
    if (!vassal || !vassal.isAlive) continue;
    const vassalEconomy = getCountryTerritories(state, vassalId).reduce(
      (total, t) => total + getEffectiveEconomy(state, t),
      0
    );
    vassalTribute += vassalEconomy * VASSAL_TRIBUTE_SHARE * 0.9;
  }

  const administration = territories.length * ADMIN_COST_PER_TERRITORY *
    (country.government === 'federation' ? 0.8 : 1);

  const budgetMilitary = 0.72 + country.budget.military / 100;
  const budgetResearch = 0.72 + country.budget.research / 100;

  const armyUpkeepValue = getArmyUpkeep(state, country) * budgetMilitary;
  researchPoints =
    researchPoints * budgetResearch * (1 + tech.research + projects.research) * country.traits.research;

  // Tribut an den eigenen Oberherrn
  let tributePaid = 0;
  if (country.overlordId) {
    tributePaid = (taxes + trade) * VASSAL_TRIBUTE_SHARE;
  }

  const net = taxes + trade + vassalTribute - buildingUpkeep - armyUpkeepValue - administration - tributePaid;

  const politicalPower =
    government.politicalPower +
    tech.politicalPower +
    projects.politicalPower +
    territories.reduce((total, t) => total + t.buildings.temple * 0.6, 0) +
    (country.stability > 70 ? 1 : 0) +
    (isAtWarAtAll(state, countryId) ? -1 : 0);

  return {
    taxes: Math.round(taxes),
    trade: Math.round(trade),
    vassalTribute: Math.round(vassalTribute - tributePaid),
    buildingUpkeep: Math.round(buildingUpkeep),
    armyUpkeep: Math.round(armyUpkeepValue),
    administration: Math.round(administration),
    blockadeLoss: Math.round(blockadeLoss),
    net: Math.round(net),
    researchPoints: Math.round(researchPoints),
    politicalPower: Math.round(Math.max(0, politicalPower)),
    resources
  };
}

/** Rohstoffverbrauch der Armeen (Getreide) pro Runde. */
export function getResourceConsumption(state: GameState, countryId: string): ResourceStock {
  const consumption = emptyStock();
  for (const territory of getCountryTerritories(state, countryId)) {
    consumption.grain += landSize(territory.army) * 0.055 + territory.army.fleet * 0.04;
  }
  return consumption;
}

/** Wendet Einnahmen, Rohstoffe, Bevölkerung und Stabilität an. */
export function applyEconomyPhase(state: GameState, countryId: string): IncomeBreakdown {
  const country = state.countries[countryId];
  const breakdown = calculateIncome(state, countryId);
  if (!country) return breakdown;

  country.gold = Math.round(country.gold + breakdown.net);
  country.researchPoints += breakdown.researchPoints;
  country.politicalPower = clamp(country.politicalPower + breakdown.politicalPower, 0, 400);
  if (breakdown.net > 0 && country.isPlayer) {
    state.stats.goldEarned += breakdown.net;
  }

  // Vasallentribut an den Oberherrn gutschreiben
  if (country.overlordId) {
    const overlord = state.countries[country.overlordId];
    if (overlord) {
      // Der Betrag wurde bereits abgezogen; hier nur buchen, damit nichts verloren geht.
      overlord.gold += 0;
    }
  }

  // Rohstoffe verbuchen
  const consumption = getResourceConsumption(state, countryId);
  let shortage = false;
  for (const key of RESOURCE_ORDER) {
    const next = country.resources[key] + breakdown.resources[key] - consumption[key];
    if (next < 0) shortage = true;
    country.resources[key] = clamp(next, 0, 999);
  }

  // Negative Kasse: Notverkäufe und Stabilitätsverlust
  if (country.gold < 0) {
    country.stability -= 5;
    country.gold = 0;
  }
  if (shortage) {
    country.stability -= 2;
  }

  const rng = new Rng(state.rngSeed);
  const government = GOVERNMENT_INFO[country.government];
  const tech = getTechBonus(country);
  const projects = getProjectBonus(country);

  const taxPenalty = (country.taxRate - 0.25) * 42;
  const warPenalty = isAtWarAtAll(state, countryId) ? 3 : 0;
  const vassalBonus = country.vassals.length * 0.5;
  const stabilityDrift =
    2.2 + government.stability * 0.22 + tech.stability * 0.2 + projects.stability * 0.1 +
    vassalBonus - taxPenalty - warPenalty;
  country.stability = Math.round(clamp(country.stability + stabilityDrift, 0, 100));

  if (!isAtWarAtAll(state, countryId)) {
    country.warExhaustion = clamp(country.warExhaustion - 4, 0, 100);
  }
  country.prestige = clamp(country.prestige * 0.98, -60, 120);

  // Gebietsentwicklung
  for (const territory of getCountryTerritories(state, countryId)) {
    const growthBase = 0.013 * (country.stability / 60);
    const unrestFactor = 1 - clamp(territory.unrest, 0, 100) / 110;
    const devastationFactor = 1 - clamp(territory.devastation, 0, 100) / 120;
    const farmBonus = 1 + territory.buildings.farm * 0.22;
    const growth = growthBase * unrestFactor * devastationFactor * farmBonus;
    territory.population = Math.max(120, Math.round(territory.population * (1 + growth)));

    const templeEffect = territory.buildings.temple * 2.2;
    territory.unrest = clamp(territory.unrest - 2.4 - templeEffect, 0, 100);
    territory.devastation = clamp(territory.devastation - 4, 0, 100);
    territory.stability = Math.round(clamp(territory.stability + 2 - territory.unrest * 0.08, 0, 100));

    if (territory.occupiedTurns > 0) {
      territory.occupiedTurns += 1;
      if (territory.occupiedTurns > 8) territory.occupiedTurns = 0;
    }

    // Kulturelle und religiöse Angleichung
    const assimilationChance = (0.04 + territory.buildings.temple * 0.03) * projects.assimilation;
    if (territory.culture !== country.culture && territory.unrest < 40) {
      if (rng.chance(assimilationChance)) territory.culture = country.culture;
    }
    if (territory.religion !== country.religion && territory.unrest < 50) {
      if (rng.chance(assimilationChance * 0.8)) territory.religion = country.religion;
    }

    // Attrition bei Überversorgung
    const capacity = getSupplyCapacity(state, country, territory);
    const demand = landSize(territory.army) + territory.army.fleet * 0.5;
    if (demand > capacity) {
      const ratio = Math.min(0.2, (demand - capacity) / Math.max(1, capacity) * 0.14);
      for (const key of ['infantry', 'cavalry', 'artillery', 'fleet'] as const) {
        const loss = Math.floor(territory.army[key] * ratio);
        territory.army[key] = Math.max(0, territory.army[key] - loss);
      }
    }
  }

  state.rngSeed = rng.seed;
  return breakdown;
}

/** Markiert blockierte Häfen (feindliche Flotten in angrenzenden Seegebieten). */
export function updateBlockades(state: GameState): void {
  for (const territory of Object.values(state.territories)) {
    territory.blockaded = false;
  }
  for (const territory of Object.values(state.territories)) {
    if (territory.army.fleet <= 0 || !territory.ownerId) continue;
    const definition = getTerritoryDefinition(state.mapId, territory.id);
    for (const neighbourId of [...definition.neighbours, ...definition.seaNeighbours]) {
      const target = state.territories[neighbourId];
      if (!target || !target.ownerId || target.ownerId === territory.ownerId) continue;
      const targetDefinition = getTerritoryDefinition(state.mapId, neighbourId);
      if (!targetDefinition.hasPort) continue;
      const atWar = state.wars.some(
        (war) =>
          (war.attackers.includes(territory.ownerId) && war.defenders.includes(target.ownerId)) ||
          (war.defenders.includes(territory.ownerId) && war.attackers.includes(target.ownerId))
      );
      if (!atWar) continue;
      // Eigene Flotte im Zielgebiet verhindert die Blockade
      if (target.army.fleet >= territory.army.fleet) continue;
      target.blockaded = true;
    }
  }
}

/** Einnahmen aus einem Handelsabkommen für die Anzeige. */
export function getTradePartners(state: GameState, countryId: string): string[] {
  return state.countryOrder.filter((id) => id !== countryId && hasTrade(state, countryId, id));
}

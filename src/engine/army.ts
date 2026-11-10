/**
 * Hilfsfunktionen für Armeen (Aufstellungen nach Truppengattungen)
 * und Rohstoffbestände.
 */
import type {
  Army,
  CountryState,
  ResourceId,
  ResourceStock,
  TerrainType,
  UnitTypeId
} from '../models/types';
import { getAllUnits, getUnit } from '../services/contentService';

export const UNIT_ORDER: UnitTypeId[] = ['infantry', 'cavalry', 'artillery', 'fleet'];
export const RESOURCE_ORDER: ResourceId[] = ['grain', 'iron', 'timber', 'horses', 'luxury'];

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  grain: 'Getreide',
  iron: 'Eisen',
  timber: 'Holz',
  horses: 'Pferde',
  luxury: 'Luxusgüter'
};

/** Ordnet die Anzeigenamen der Kartenvorkommen den Rohstofftypen zu. */
const RESOURCE_MAPPING: Record<string, ResourceId> = {
  Getreide: 'grain',
  Vieh: 'grain',
  Fisch: 'grain',
  Eisen: 'iron',
  Stein: 'iron',
  Holz: 'timber',
  Torf: 'timber',
  Pferde: 'horses',
  Salz: 'luxury',
  Gold: 'luxury',
  Gewürze: 'luxury',
  Pelze: 'luxury',
  Handelsgut: 'luxury',
  Werkstoffe: 'luxury',
  Kräuter: 'luxury'
};

export function resourceOf(label: string): ResourceId | null {
  return RESOURCE_MAPPING[label] ?? null;
}

export function emptyArmy(): Army {
  return { infantry: 0, cavalry: 0, artillery: 0, fleet: 0 };
}

export function emptyStock(): ResourceStock {
  return { grain: 0, iron: 0, timber: 0, horses: 0, luxury: 0 };
}

export function cloneArmy(army: Army): Army {
  return { ...army };
}

/** Gesamtzahl aller Einheiten. */
export function armySize(army: Army): number {
  return army.infantry + army.cavalry + army.artillery + army.fleet;
}

/** Zahl der Landeinheiten (ohne Flotte). */
export function landSize(army: Army): number {
  return army.infantry + army.cavalry + army.artillery;
}

export function isArmyEmpty(army: Army): boolean {
  return armySize(army) <= 0;
}

export function addArmies(a: Army, b: Army): Army {
  return {
    infantry: a.infantry + b.infantry,
    cavalry: a.cavalry + b.cavalry,
    artillery: a.artillery + b.artillery,
    fleet: a.fleet + b.fleet
  };
}

export function subtractArmies(a: Army, b: Army): Army {
  return {
    infantry: Math.max(0, a.infantry - b.infantry),
    cavalry: Math.max(0, a.cavalry - b.cavalry),
    artillery: Math.max(0, a.artillery - b.artillery),
    fleet: Math.max(0, a.fleet - b.fleet)
  };
}

/** Begrenzt eine Auswahl auf den tatsächlich vorhandenen Bestand. */
export function limitArmy(selection: Army, available: Army): Army {
  return {
    infantry: Math.max(0, Math.min(Math.floor(selection.infantry), available.infantry)),
    cavalry: Math.max(0, Math.min(Math.floor(selection.cavalry), available.cavalry)),
    artillery: Math.max(0, Math.min(Math.floor(selection.artillery), available.artillery)),
    fleet: Math.max(0, Math.min(Math.floor(selection.fleet), available.fleet))
  };
}

/** Anteiliger Teil einer Armee (z. B. 50 %). */
export function scaleArmy(army: Army, ratio: number): Army {
  return {
    infantry: Math.floor(army.infantry * ratio),
    cavalry: Math.floor(army.cavalry * ratio),
    artillery: Math.floor(army.artillery * ratio),
    fleet: Math.floor(army.fleet * ratio)
  };
}

/**
 * Rohe Kampfkraft einer Aufstellung.
 * role = 'attack' oder 'defense'; das Gelände wirkt auf beide Seiten.
 */
export function armyPower(army: Army, role: 'attack' | 'defense', terrain: TerrainType): number {
  let total = 0;
  for (const unitId of UNIT_ORDER) {
    const count = army[unitId];
    if (count <= 0) continue;
    const unit = getUnit(unitId);
    const base = role === 'attack' ? unit.attack : unit.defense;
    const terrainFactor = unit.terrain[terrain] ?? 1;
    total += count * base * terrainFactor;
  }
  return total;
}

/** Gesamte Belagerungswirkung (senkt den Befestigungsfaktor). */
export function siegePower(army: Army): number {
  let total = 0;
  for (const unitId of UNIT_ORDER) {
    const unit = getUnit(unitId);
    total += army[unitId] * unit.siege;
  }
  return total;
}

/** Transportkapazität der enthaltenen Flotten in Landeinheiten. */
export function transportCapacity(army: Army, bonus = 0): number {
  return army.fleet * (getUnit('fleet').transport + bonus);
}

/** Unterhaltskosten pro Runde. */
export function armyUpkeep(army: Army): number {
  let total = 0;
  for (const unitId of UNIT_ORDER) {
    total += army[unitId] * getUnit(unitId).upkeep;
  }
  return total;
}

/** Versorgungsbedarf (Flotten zählen weniger). */
export function supplyDemand(army: Army): number {
  return landSize(army) + army.fleet * 0.5;
}

/**
 * Verteilt Verluste auf die Gattungen. Infanterie trägt den grössten Teil,
 * Artillerie und Flotte sind besser geschützt.
 */
export function distributeLosses(army: Army, totalLosses: number): Army {
  const losses = emptyArmy();
  if (totalLosses <= 0) return losses;

  const weights: Record<UnitTypeId, number> = {
    infantry: 0,
    cavalry: 0,
    artillery: 0,
    fleet: 0
  };
  let weightSum = 0;
  for (const unitId of UNIT_ORDER) {
    const count = army[unitId];
    if (count <= 0) continue;
    const weight = count * getUnit(unitId).lossWeight;
    weights[unitId] = weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return losses;

  let assigned = 0;
  for (const unitId of UNIT_ORDER) {
    if (weights[unitId] <= 0) continue;
    const share = Math.min(army[unitId], Math.round((weights[unitId] / weightSum) * totalLosses));
    losses[unitId] = share;
    assigned += share;
  }

  // Rundungsrest verteilen
  let rest = Math.min(totalLosses - assigned, armySize(army) - assigned);
  for (const unitId of UNIT_ORDER) {
    if (rest <= 0) break;
    const free = army[unitId] - losses[unitId];
    if (free <= 0) continue;
    const take = Math.min(free, rest);
    losses[unitId] += take;
    rest -= take;
  }
  return losses;
}

/** Welche Einheiten darf dieses Land derzeit bauen? */
export function getAvailableUnits(country: CountryState): UnitTypeId[] {
  return getAllUnits()
    .filter((unit) => !unit.requiresTech || country.technologies.includes(unit.requiresTech))
    .map((unit) => unit.id);
}

/** Lesbare Kurzform einer Aufstellung, z. B. "12 INF, 4 KAV". */
export function describeArmy(army: Army): string {
  const parts: string[] = [];
  for (const unitId of UNIT_ORDER) {
    if (army[unitId] > 0) parts.push(`${army[unitId]} ${getUnit(unitId).short}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'keine Truppen';
}

/* ------------------------------------------------------------------ */
/* Rohstoffe                                                           */
/* ------------------------------------------------------------------ */

export function addStock(a: ResourceStock, b: Partial<ResourceStock>): ResourceStock {
  const result = { ...a };
  for (const key of RESOURCE_ORDER) {
    result[key] = result[key] + (b[key] ?? 0);
  }
  return result;
}

/** Prüft, ob ein Bestand ausreicht. */
export function canAfford(stock: ResourceStock, cost: Partial<ResourceStock>): boolean {
  return RESOURCE_ORDER.every((key) => stock[key] >= (cost[key] ?? 0));
}

export function payStock(stock: ResourceStock, cost: Partial<ResourceStock>): ResourceStock {
  const result = { ...stock };
  for (const key of RESOURCE_ORDER) {
    result[key] = Math.max(0, result[key] - (cost[key] ?? 0));
  }
  return result;
}

export function scaleCost(cost: Partial<ResourceStock>, factor: number): Partial<ResourceStock> {
  const result: Partial<ResourceStock> = {};
  for (const key of RESOURCE_ORDER) {
    if (cost[key]) result[key] = Math.ceil((cost[key] as number) * factor);
  }
  return result;
}

/** Fehlende Rohstoffe als lesbarer Text. */
export function describeMissing(stock: ResourceStock, cost: Partial<ResourceStock>): string {
  const missing = RESOURCE_ORDER.filter((key) => stock[key] < (cost[key] ?? 0)).map(
    (key) => `${RESOURCE_LABELS[key]} (${Math.ceil((cost[key] ?? 0) - stock[key])})`
  );
  return missing.join(', ');
}

/** Gesamtkosten einer Rekrutierungsbestellung. */
export function recruitmentCost(order: Army): {
  gold: number;
  population: number;
  resources: Partial<ResourceStock>;
} {
  let gold = 0;
  let population = 0;
  const resources: Partial<ResourceStock> = {};
  for (const unitId of UNIT_ORDER) {
    const count = order[unitId];
    if (count <= 0) continue;
    const unit = getUnit(unitId);
    gold += unit.gold * count;
    population += unit.population * count;
    for (const key of RESOURCE_ORDER) {
      const amount = unit.resources[key];
      if (amount) resources[key] = (resources[key] ?? 0) + amount * count;
    }
  }
  return { gold, population, resources };
}

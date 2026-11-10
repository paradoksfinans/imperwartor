/**
 * Feldherren: Anwerbung, Zuweisung, Erfahrung und Aufstieg.
 */
import type { ActionResult, CountryState, GameState, General } from '../models/types';
import { clamp, createId } from '../utils/helpers';
import { Rng } from '../utils/rng';
import { GENERAL_COST_GOLD, GENERAL_COST_POWER, getGeneralLimit } from './rules';

const FIRST_NAMES = [
  'Aldric', 'Mera', 'Torvek', 'Hedra', 'Oren', 'Ilva', 'Vask', 'Sera', 'Belo',
  'Maral', 'Hald', 'Venn', 'Rogan', 'Thyra', 'Kael', 'Nessa', 'Dorn', 'Lysa',
  'Brom', 'Ivara', 'Selk', 'Orla', 'Garen', 'Rhena'
];

const FAMILY_NAMES = [
  'von Eisfels', 'Dorn', 'Vale', 'Korr', 'Marenti', 'Stahl', 'Brandt', 'Quell',
  'Ravenn', 'Sturm', 'Hallt', 'Weiß', 'Morgen', 'Falk', 'Reiter', 'Schatten'
];

const TITLES = ['Hauptmann', 'Oberst', 'Marschall', 'Heerführer', 'Kommandant', 'Feldherr'];

export interface GeneralTrait {
  name: string;
  attack: number;
  defense: number;
  siege: number;
  description: string;
}

export const GENERAL_TRAITS: GeneralTrait[] = [
  { name: 'Draufgänger', attack: 0.16, defense: -0.04, siege: 0, description: 'Sucht die Entscheidung im Angriff.' },
  { name: 'Festungsbrecher', attack: 0.06, defense: 0, siege: 0.12, description: 'Versteht sich auf Belagerungen.' },
  { name: 'Schildwall', attack: -0.02, defense: 0.18, siege: 0, description: 'Hält jede Stellung.' },
  { name: 'Taktiker', attack: 0.09, defense: 0.09, siege: 0.03, description: 'Ausgewogen und verlässlich.' },
  { name: 'Reiterführer', attack: 0.14, defense: 0.02, siege: 0, description: 'Führt Kavallerie meisterhaft.' },
  { name: 'Versorger', attack: 0.03, defense: 0.1, siege: 0.04, description: 'Hält die Truppe auch im Feindesland bei Kräften.' },
  { name: 'Vorsichtig', attack: 0.0, defense: 0.14, siege: 0.02, description: 'Vermeidet unnötige Verluste.' }
];

export function createGeneral(rng: Rng, territoryId: string | null): General {
  const trait = rng.pick(GENERAL_TRAITS) ?? GENERAL_TRAITS[0];
  const first = rng.pick(FIRST_NAMES) ?? 'Aldric';
  const family = rng.pick(FAMILY_NAMES) ?? 'Dorn';
  const title = rng.pick(TITLES) ?? 'Hauptmann';
  return {
    id: createId('gen'),
    name: `${first} ${family}`,
    title,
    level: 1,
    experience: 0,
    attack: trait.attack,
    defense: trait.defense,
    siege: trait.siege,
    trait: trait.name,
    assignedTerritoryId: territoryId,
    battles: 0,
    victories: 0
  };
}

export function getGeneral(country: CountryState, generalId: string | null): General | null {
  if (!generalId) return null;
  return country.generals.find((general) => general.id === generalId) ?? null;
}

/** Feldherr, der in einem bestimmten Gebiet steht. */
export function getGeneralInTerritory(country: CountryState, territoryId: string): General | null {
  return country.generals.find((general) => general.assignedTerritoryId === territoryId) ?? null;
}

export function hireGeneral(state: GameState, countryId: string): ActionResult {
  const country = state.countries[countryId];
  if (!country) return { ok: false, message: 'Ungültiges Land.' };
  const limit = getGeneralLimit(state, countryId);
  if (country.generals.length >= limit) {
    return { ok: false, message: `Dein Reich kann derzeit höchstens ${limit} Feldherren unterhalten.` };
  }
  if (country.politicalPower < GENERAL_COST_POWER) {
    return { ok: false, message: `Nicht genug politische Macht (${GENERAL_COST_POWER} nötig).` };
  }
  if (country.gold < GENERAL_COST_GOLD) {
    return { ok: false, message: `Nicht genug Gold (${GENERAL_COST_GOLD} nötig).` };
  }
  const rng = new Rng(state.rngSeed);
  const general = createGeneral(rng, country.capitalId);
  state.rngSeed = rng.seed;
  country.politicalPower -= GENERAL_COST_POWER;
  country.gold -= GENERAL_COST_GOLD;
  country.generals.push(general);
  const capital = state.territories[country.capitalId];
  if (capital && capital.ownerId === countryId) {
    capital.generalId = general.id;
  } else {
    general.assignedTerritoryId = null;
  }
  state.log.unshift({
    turn: state.turn,
    type: 'system',
    text: `${general.title} ${general.name} (${general.trait}) tritt in den Dienst.`,
    important: country.isPlayer
  });
  return { ok: true, message: `${general.title} ${general.name} angeworben - Eigenschaft: ${general.trait}.` };
}

/** Versetzt einen Feldherrn in ein eigenes Gebiet. */
export function assignGeneral(
  state: GameState,
  countryId: string,
  generalId: string,
  territoryId: string | null
): ActionResult {
  const country = state.countries[countryId];
  const general = getGeneral(country ?? ({} as CountryState), generalId);
  if (!country || !general) return { ok: false, message: 'Feldherr nicht gefunden.' };

  if (territoryId) {
    const territory = state.territories[territoryId];
    if (!territory || territory.ownerId !== countryId) {
      return { ok: false, message: 'Nur eigene Gebiete können besetzt werden.' };
    }
    // Vorherige Zuweisung lösen
    for (const other of country.generals) {
      if (other.assignedTerritoryId === territoryId && other.id !== generalId) {
        other.assignedTerritoryId = null;
      }
    }
    if (general.assignedTerritoryId) {
      const old = state.territories[general.assignedTerritoryId];
      if (old && old.generalId === generalId) old.generalId = null;
    }
    general.assignedTerritoryId = territoryId;
    territory.generalId = generalId;
    return { ok: true, message: `${general.name} übernimmt das Kommando.` };
  }

  if (general.assignedTerritoryId) {
    const old = state.territories[general.assignedTerritoryId];
    if (old && old.generalId === generalId) old.generalId = null;
  }
  general.assignedTerritoryId = null;
  return { ok: true, message: `${general.name} wurde abberufen.` };
}

/** Gibt einem Feldherrn Erfahrung und lässt ihn gegebenenfalls aufsteigen. */
export function awardExperience(general: General, amount: number, won: boolean): string | null {
  general.experience += amount;
  general.battles += 1;
  if (won) general.victories += 1;
  const needed = general.level * 100;
  if (general.experience >= needed && general.level < 5) {
    general.experience -= needed;
    general.level += 1;
    general.attack += 0.04;
    general.defense += 0.04;
    general.siege += 0.02;
    return `${general.title} ${general.name} steigt auf Stufe ${general.level} auf.`;
  }
  return null;
}

/** Gesamtbonus eines Feldherrn (inklusive Stufe). */
export function generalBonus(general: General | null) {
  if (!general) return { attack: 0, defense: 0, siege: 0 };
  return {
    attack: clamp(general.attack, -0.2, 0.6),
    defense: clamp(general.defense, -0.2, 0.6),
    siege: clamp(general.siege, 0, 0.4)
  };
}

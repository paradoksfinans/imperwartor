/**
 * Alle Zahlentabellen und Nachschlagefunktionen des Spiels.
 *
 * Hier steht, was Gelände bewirkt, was Einheiten kosten, wie Gebäude
 * wirken und wie Technik zählt. Wer das Spiel ausbalancieren will, aendert
 * diese Datei und sonst nichts.
 */

import type {
  BuildingId, Country, GameState, GeneralTrait, GeneralTraitId, GovernmentId,
  Province, Regiments, TechFieldId, TerrainId, UnitDefinition, UnitId,
} from './types';

/* ------------------------------------------------------------------ */
/* Grundwerte                                                          */
/* ------------------------------------------------------------------ */

export const BASIS_AKTIONSPUNKTE = 4;
export const ARMEE_UNTERHALT_BASIS = 1.0;
export const VERWALTUNG_JE_GEBIET = 12;

/**
 * Bezugsgroesse fuer den Kostenmassstab: die gesamte Wirtschaftsleistung
 * eines mittleren Landes. Alle Goldkosten sind darauf geeicht, sodass ein
 * Ausbau ungefaehr gleich schwer zu bezahlen ist - unabhaengig davon, ob
 * die Karte ganze Staaten oder einzelne Provinzen zeigt.
 */
export const KOSTEN_BEZUG = 620;
export const SCHULDZINS = 0.04;
/** Wehrfähige Bevölkerung, die je Runde nachwaechst (Anteil). */
export const MANPOWER_NACHWUCHS = 0.012;

/* ------------------------------------------------------------------ */
/* Gelände                                                            */
/* ------------------------------------------------------------------ */

export interface TerrainDefinition {
  name: string;
  /** Faktor auf die Verteidigung. */
  defense: number;
  /** Grundversorgung in Prozent. */
  supply: number;
  /** Faktor auf die Wirtschaftsleistung. */
  economy: number;
  /** Farbton für die Gelaendeansicht. */
  farbe: string;
  /** Höhenwirkung für die Schattierung der Karte (0 flach, 1 hoch). */
  relief: number;
}

export const TERRAIN: Record<TerrainId, TerrainDefinition> = {
  plain:    { name: 'Ebene',       defense: 1.00, supply: 88, economy: 1.00, farbe: '#7d9b5e', relief: 0.10 },
  forest:   { name: 'Wald',        defense: 1.25, supply: 78, economy: 0.95, farbe: '#4f7049', relief: 0.30 },
  mountain: { name: 'Gebirge',     defense: 1.60, supply: 55, economy: 0.85, farbe: '#8a8174', relief: 0.95 },
  desert:   { name: 'Wüste',      defense: 0.95, supply: 42, economy: 0.60, farbe: '#c9ac70', relief: 0.18 },
  swamp:    { name: 'Sumpf',       defense: 1.30, supply: 52, economy: 0.70, farbe: '#5f7360', relief: 0.08 },
  steppe:   { name: 'Steppe',      defense: 0.90, supply: 70, economy: 0.80, farbe: '#a8a263', relief: 0.12 },
  coast:    { name: 'Küste',      defense: 1.05, supply: 92, economy: 1.15, farbe: '#6f9b94', relief: 0.08 },
  island:   { name: 'Insel',       defense: 1.35, supply: 80, economy: 1.05, farbe: '#67958c', relief: 0.22 },
  urban:    { name: 'Stadtgebiet', defense: 1.45, supply: 96, economy: 1.55, farbe: '#9a8f86', relief: 0.14 },
};

/* ------------------------------------------------------------------ */
/* Rohstoffe                                                           */
/* ------------------------------------------------------------------ */

export const RESOURCES: Record<string, { name: string; zeichen: string; wirkung: string }> = {
  none:   { name: 'keine',     zeichen: '',  wirkung: '' },
  grain:  { name: 'Getreide',  zeichen: '⁂', wirkung: '+8 % Bevölkerungswachstum' },
  iron:   { name: 'Eisen',     zeichen: '⚒', wirkung: '-10 % Rekrutierungskosten' },
  timber: { name: 'Holz',      zeichen: '⑃', wirkung: '-15 % Baukosten' },
  stone:  { name: 'Stein',     zeichen: '▣', wirkung: '+1 Festungswirkung' },
  gold:   { name: 'Gold',      zeichen: '◆', wirkung: '+25 Gold je Runde' },
  fish:   { name: 'Fisch',     zeichen: '〰', wirkung: '+5 % Bevölkerungswachstum' },
  oil:    { name: 'Erdöl',    zeichen: '▚', wirkung: 'Panzer und Marine billiger' },
  horses: { name: 'Pferde',    zeichen: '♞', wirkung: '-20 % Kosten für Reiterei' },
};

/* ------------------------------------------------------------------ */
/* Truppengattungen                                                    */
/* ------------------------------------------------------------------ */

export const UNITS: Record<UnitId, UnitDefinition> = {
  infantry: {
    id: 'infantry', name: 'Fußvolk', kurz: 'Fuß',
    attack: 1.0, defense: 1.2, gold: 22, population: 900, upkeep: 1.0, techLevel: 0,
    terrainBonus: { urban: 1.2, forest: 1.1, mountain: 1.1, swamp: 1.1 },
    siegePower: 1.0,
    beschreibung: 'Das Rückgrat jedes Heeres. Günstig, zäh in der Verteidigung, stark in Städten und schwerem Gelände.',
  },
  archers: {
    id: 'archers', name: 'Fernkämpfer', kurz: 'Fern',
    attack: 1.25, defense: 0.85, gold: 28, population: 700, upkeep: 1.1, techLevel: 0,
    terrainBonus: { mountain: 1.25, forest: 1.15, plain: 0.95 },
    siegePower: 1.1,
    beschreibung: 'Wirkt vor dem Zusammenstoß. Stark aus erhöhter Stellung, schwach wenn der Gegner heran ist.',
  },
  cavalry: {
    id: 'cavalry', name: 'Reiterei', kurz: 'Reit',
    attack: 1.75, defense: 0.9, gold: 48, population: 800, upkeep: 2.0, techLevel: 1,
    terrainBonus: { plain: 1.35, steppe: 1.45, desert: 1.15, mountain: 0.6, swamp: 0.55, forest: 0.7, urban: 0.75 },
    siegePower: 0.6,
    beschreibung: 'Schnell und durchschlagend im offenen Gelände. In Bergen, Sumpf und Stadt nahezu nutzlos.',
  },
  siege: {
    id: 'siege', name: 'Belagerungsgerät', kurz: 'Belag',
    attack: 0.8, defense: 0.5, gold: 60, population: 400, upkeep: 2.2, techLevel: 2,
    terrainBonus: { urban: 1.2 },
    siegePower: 3.2,
    beschreibung: 'Bricht Mauern. Im Feldkampf schwach, vor einer Festung unverzichtbar.',
  },
  artillery: {
    id: 'artillery', name: 'Artillerie', kurz: 'Art',
    attack: 1.9, defense: 1.0, gold: 85, population: 500, upkeep: 3.0, techLevel: 4,
    terrainBonus: { plain: 1.15, urban: 1.1, mountain: 0.85 },
    siegePower: 3.8,
    beschreibung: 'Entscheidet moderne Schlachten aus der Ferne und zerlegt Befestigungen.',
  },
  armor: {
    id: 'armor', name: 'Panzer', kurz: 'Pz',
    attack: 2.6, defense: 1.6, gold: 150, population: 450, upkeep: 4.5, techLevel: 6,
    terrainBonus: { plain: 1.4, steppe: 1.3, desert: 1.1, mountain: 0.5, swamp: 0.45, forest: 0.7 },
    siegePower: 2.0,
    beschreibung: 'Durchbruchswaffe der Ebene. Teuer im Unterhalt, hilflos im Gebirge.',
  },
  navy: {
    id: 'navy', name: 'Kriegsschiffe', kurz: 'Flotte',
    attack: 1.4, defense: 1.4, gold: 110, population: 600, upkeep: 3.2, techLevel: 2,
    terrainBonus: {},
    siegePower: 1.4, naval: true,
    beschreibung: 'Sichert Seewege und schützt Küsten. Nur in Häfen aufzustellen.',
  },
};

export const UNIT_ORDER: UnitId[] = ['infantry', 'archers', 'cavalry', 'siege', 'artillery', 'armor', 'navy'];

/** Welche Gattungen stehen einem Land mit seinem Technikstand offen? */
export function verfuegbareEinheiten(country: Country): UnitId[] {
  return UNIT_ORDER.filter((id) => {
    const u = UNITS[id];
    if (u.id === 'siege' && country.tech.military >= 5) return false; // von Artillerie abgeloest
    return country.tech.military >= u.techLevel;
  });
}

/** Summe aller Einheiten eines Heeres. */
export function regimentsTotal(r: Regiments | undefined): number {
  if (!r) return 0;
  let s = 0;
  for (const k of UNIT_ORDER) s += r[k] ?? 0;
  return s;
}

export function regimentsAdd(ziel: Regiments, quelle: Regiments): void {
  for (const k of UNIT_ORDER) {
    const v = quelle[k] ?? 0;
    if (v) ziel[k] = (ziel[k] ?? 0) + v;
  }
}

export function regimentsSub(ziel: Regiments, quelle: Regiments): void {
  for (const k of UNIT_ORDER) {
    const v = quelle[k] ?? 0;
    if (!v) continue;
    const neu = (ziel[k] ?? 0) - v;
    if (neu > 0) ziel[k] = neu; else delete ziel[k];
  }
}

export function regimentsCopy(r: Regiments): Regiments {
  const out: Regiments = {};
  for (const k of UNIT_ORDER) if (r[k]) out[k] = r[k];
  return out;
}

/** Anteiligen Teil eines Heeres abzweigen (z. B. 60 % für einen Angriff). */
export function regimentsScale(r: Regiments, anteil: number): Regiments {
  const out: Regiments = {};
  for (const k of UNIT_ORDER) {
    const v = Math.round((r[k] ?? 0) * anteil);
    if (v > 0) out[k] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Gebäude                                                            */
/* ------------------------------------------------------------------ */

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  beschreibung: string;
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  buildTurns: number;
  upkeep: number;
  /** Benoetigt einen Hafen. */
  needsPort?: boolean;
}

export const BUILDINGS: Record<BuildingId, BuildingDefinition> = {
  economy: {
    id: 'economy', name: 'Markt', beschreibung: 'Erhöht die Wirtschaftsleistung des Gebiets um 12 % je Stufe.',
    maxLevel: 4, baseCost: 220, costGrowth: 1.6, buildTurns: 2, upkeep: 6,
  },
  infrastructure: {
    id: 'infrastructure', name: 'Straßen', beschreibung: 'Verbessert Wirtschaft und Versorgung, beschleunigt Nachschub.',
    maxLevel: 4, baseCost: 260, costGrowth: 1.6, buildTurns: 3, upkeep: 5,
  },
  barracks: {
    id: 'barracks', name: 'Kaserne', beschreibung: 'Erhöht die Aushebungsgrenze und senkt Rekrutierungskosten.',
    maxLevel: 3, baseCost: 300, costGrowth: 1.7, buildTurns: 3, upkeep: 8,
  },
  fortress: {
    id: 'fortress', name: 'Festung', beschreibung: 'Hebt die Befestigungsstufe. Angreifer brauchen Belagerungsgerät.',
    maxLevel: 4, baseCost: 340, costGrowth: 1.8, buildTurns: 4, upkeep: 11,
  },
  research: {
    id: 'research', name: 'Akademie', beschreibung: 'Liefert zusätzliche Forschungspunkte je Runde.',
    maxLevel: 3, baseCost: 380, costGrowth: 1.8, buildTurns: 4, upkeep: 9,
  },
  port: {
    id: 'port', name: 'Werft', beschreibung: 'Erlaubt den Bau von Kriegsschiffen und steigert den Handel.',
    maxLevel: 3, baseCost: 320, costGrowth: 1.7, buildTurns: 3, upkeep: 8, needsPort: true,
  },
  granary: {
    id: 'granary', name: 'Speicher', beschreibung: 'Dämpft Hungersnöte, senkt Unruhe und hält die Versorgung hoch.',
    maxLevel: 3, baseCost: 240, costGrowth: 1.6, buildTurns: 2, upkeep: 5,
  },
};

export const BUILDING_ORDER: BuildingId[] = [
  'economy', 'infrastructure', 'barracks', 'fortress', 'research', 'port', 'granary',
];

export function buildingCost(
  id: BuildingId, level: number, province?: Province, faktor = 1,
): number {
  const d = BUILDINGS[id];
  let kosten = d.baseCost * Math.pow(d.costGrowth, level) * faktor;
  if (province?.resource === 'timber') kosten *= 0.85;
  return Math.max(20, Math.round(kosten));
}

/* ------------------------------------------------------------------ */
/* Forschung                                                           */
/* ------------------------------------------------------------------ */

export const MAX_TECH_LEVEL = 8;

export interface TechFieldDefinition {
  id: TechFieldId;
  name: string;
  beschreibung: string;
  /** Benennung der Stufen - macht Fortschritt greifbar. */
  stufen: string[];
}

export const TECH_FIELDS: Record<TechFieldId, TechFieldDefinition> = {
  military: {
    id: 'military', name: 'Kriegswesen',
    beschreibung: 'Stärkere Heere und neue Truppengattungen.',
    stufen: ['Aufgebot', 'Stehendes Heer', 'Berufsheer', 'Drill und Taktik', 'Feuerwaffen',
             'Massenheer', 'Motorisierung', 'Verbundene Waffen', 'Moderne Streitkraft'],
  },
  economy: {
    id: 'economy', name: 'Wirtschaft',
    beschreibung: 'Höhere Erträge aus Gebieten und Handel.',
    stufen: ['Tauschhandel', 'Münzwesen', 'Zünfte', 'Bankwesen', 'Manufaktur',
             'Fabrik', 'Industrie', 'Massenproduktion', 'Weltwirtschaft'],
  },
  administration: {
    id: 'administration', name: 'Verwaltung',
    beschreibung: 'Mehr Stabilität, günstigere Verwaltung, mehr Aktionspunkte.',
    stufen: ['Häuptlingsrat', 'Schreiberstube', 'Kanzlei', 'Beamtenschaft', 'Ministerien',
             'Bürokratie', 'Staatsapparat', 'Moderne Verwaltung', 'Datenverwaltung'],
  },
  logistics: {
    id: 'logistics', name: 'Logistik',
    beschreibung: 'Bessere Versorgung und weitreichendere Bewegungen.',
    stufen: ['Trossweg', 'Heerstraße', 'Magazine', 'Kanäle', 'Postwesen',
             'Eisenbahn', 'Motortransport', 'Luftbrücke', 'Globale Logistik'],
  },
  defense: {
    id: 'defense', name: 'Befestigung',
    beschreibung: 'Stärkere Festungen und zähere Verteidigung.',
    stufen: ['Palisade', 'Steinmauer', 'Burg', 'Bastion', 'Sternschanze',
             'Betonwerk', 'Bunkerlinie', 'Tiefe Verteidigung', 'Abwehrsystem'],
  },
};

export const TECH_ORDER: TechFieldId[] = ['military', 'economy', 'administration', 'logistics', 'defense'];

export function techCost(level: number): number {
  return Math.round(300 * Math.pow(1.7, level));
}

export function techLevelName(field: TechFieldId, level: number): string {
  const s = TECH_FIELDS[field].stufen;
  return s[Math.max(0, Math.min(s.length - 1, level))];
}

export function militaryTechFactor(c: Country): number { return 1 + 0.09 * c.tech.military; }
export function defenseTechFactor(c: Country): number { return 1 + 0.08 * c.tech.defense; }
export function economyTechFactor(c: Country): number { return 1 + 0.055 * c.tech.economy; }
export function supplyTechBonus(c: Country): number { return c.tech.logistics * 3; }

/* ------------------------------------------------------------------ */
/* Regierungsformen                                                    */
/* ------------------------------------------------------------------ */

export interface GovernmentDefinition {
  id: GovernmentId;
  name: string;
  note: string;
  stabilityPerTurn: number;
  economyMod: number;
  militaryMod: number;
  diplomacyMod: number;
  /** Zusätzliche Aktionspunkte. */
  actionBonus: number;
}

export const GOVERNMENTS: Record<GovernmentId, GovernmentDefinition> = {
  republic:   { id: 'republic',   name: 'Republik',        note: 'Handel bluehet, doch jede Maßnahme braucht Mehrheiten.', stabilityPerTurn: 0.9, economyMod: 1.15, militaryMod: 0.95, diplomacyMod: 1.10, actionBonus: 0 },
  monarchy:   { id: 'monarchy',   name: 'Monarchie',       note: 'Verlässliche Ordnung, träge Reformen.',                 stabilityPerTurn: 1.2, economyMod: 1.00, militaryMod: 1.05, diplomacyMod: 1.05, actionBonus: 0 },
  empire:     { id: 'empire',     name: 'Kaiserreich',     note: 'Große Reichweite, schwer zusammenzuhalten.',             stabilityPerTurn: 0.8, economyMod: 1.05, militaryMod: 1.15, diplomacyMod: 0.95, actionBonus: 1 },
  tribal:     { id: 'tribal',     name: 'Stammesbund',     note: 'Kriegerisch und beweglich, verwaltungsschwach.',          stabilityPerTurn: 0.6, economyMod: 0.80, militaryMod: 1.25, diplomacyMod: 0.85, actionBonus: 1 },
  feudal:     { id: 'feudal',     name: 'Feudalstaat',     note: 'Die Großen stellen die Truppen und ihre Forderungen.',   stabilityPerTurn: 0.9, economyMod: 0.95, militaryMod: 1.10, diplomacyMod: 1.00, actionBonus: 0 },
  theocracy:  { id: 'theocracy',  name: 'Theokratie',      note: 'Glaube trägt die Ordnung - solange er trägt.',          stabilityPerTurn: 1.4, economyMod: 0.95, militaryMod: 1.00, diplomacyMod: 0.95, actionBonus: 0 },
  military:   { id: 'military',   name: 'Militärregierung', note: 'Schlagkräftig, diplomatisch isoliert.',                stabilityPerTurn: 0.7, economyMod: 0.90, militaryMod: 1.30, diplomacyMod: 0.75, actionBonus: 1 },
  democracy:  { id: 'democracy',  name: 'Demokratie',      note: 'Wohlstand und Forschung, empfindlich gegen Kriegsmüdigkeit.', stabilityPerTurn: 1.0, economyMod: 1.20, militaryMod: 0.90, diplomacyMod: 1.20, actionBonus: 0 },
  federation: { id: 'federation', name: 'Föderation',     note: 'Verwaltet große Räume gut, entscheidet langsam.',       stabilityPerTurn: 1.1, economyMod: 1.10, militaryMod: 0.95, diplomacyMod: 1.15, actionBonus: 1 },
};

export function governmentOf(c: Country): GovernmentDefinition {
  return GOVERNMENTS[c.government] ?? GOVERNMENTS.monarchy;
}

/* ------------------------------------------------------------------ */
/* Generäle                                                           */
/* ------------------------------------------------------------------ */

export const GENERAL_TRAITS: Record<GeneralTraitId, GeneralTrait> = {
  angriff:      { id: 'angriff',      name: 'Angriffsgeist',   beschreibung: '+15 % Kampfkraft im Angriff' },
  verteidigung: { id: 'verteidigung', name: 'Festungsbauer',   beschreibung: '+15 % Kampfkraft in der Verteidigung' },
  belagerung:   { id: 'belagerung',   name: 'Belagerungsmeister', beschreibung: '+40 % Belagerungsfortschritt' },
  marsch:       { id: 'marsch',       name: 'Schnellmarsch',   beschreibung: 'Bewegungen kosten einen halben Aktionspunkt' },
  ausbilder:    { id: 'ausbilder',    name: 'Ausbilder',       beschreibung: '-15 % eigene Verluste' },
  vorsichtig:   { id: 'vorsichtig',   name: 'Vorsichtig',      beschreibung: 'Geringere Verluste, etwas weniger Durchschlag' },
  draufgaenger: { id: 'draufgaenger', name: 'Draufgänger',    beschreibung: 'Mehr Durchschlag, höhere eigene Verluste' },
  gelehrt:      { id: 'gelehrt',      name: 'Gelehrter Offizier', beschreibung: '+20 Forschungspunkte je Runde' },
};

export const GENERAL_VORNAMEN = [
  'Alexius', 'Bertram', 'Konrad', 'Dietrich', 'Eberhard', 'Friedrich', 'Gustav',
  'Hartmut', 'Ismail', 'Jarosch', 'Kasimir', 'Lothar', 'Magnus', 'Nikolaus',
  'Ottokar', 'Philipp', 'Rainald', 'Sigismund', 'Theoderich', 'Ulrich', 'Valerian',
  'Wendelin', 'Arslan', 'Barkuk', 'Timur', 'Sabahattin', 'Orhan', 'Mahir',
];
export const GENERAL_NACHNAMEN = [
  'von Falkenstein', 'Aschenbach', 'vom Hohenfels', 'Rabenhorst', 'Sturmbrecht',
  'von Dorn', 'Eisenhauer', 'Wolfram', 'zu Lindau', 'Markgraf', 'Hohenau',
  'Steinbach', 'von der Mark', 'Kaltenbrunn', 'Bey', 'Pascha', 'Khan', 'Agha',
];

/** Kampfwirkung eines Generals: 1,0 ohne General. */
export function generalFactor(g: General | null, rolle: 'attack' | 'defense'): number {
  if (!g) return 1;
  let f = 1 + g.skill * 0.05;
  if (rolle === 'attack' && g.traits.includes('angriff')) f *= 1.15;
  if (rolle === 'defense' && g.traits.includes('verteidigung')) f *= 1.15;
  if (g.traits.includes('draufgaenger')) f *= 1.08;
  if (g.traits.includes('vorsichtig')) f *= 0.96;
  return f;
}

import type { General } from './types';

/* ------------------------------------------------------------------ */
/* Nachschlagen im Spielzustand                                        */
/* ------------------------------------------------------------------ */

export function provincesOf(state: GameState, countryId: string): Province[] {
  return state.provinceOrder
    .map((id) => state.provinces[id])
    .filter((p) => p && p.ownerId === countryId);
}

export function countryArmy(state: GameState, countryId: string): number {
  let s = 0;
  for (const id of state.provinceOrder) {
    const p = state.provinces[id];
    if (p.ownerId === countryId) s += regimentsTotal(p.regiments);
  }
  return s;
}

export function countryPopulation(state: GameState, countryId: string): number {
  let s = 0;
  for (const id of state.provinceOrder) {
    const p = state.provinces[id];
    if (p.ownerId === countryId) s += p.population;
  }
  return s;
}

export function powerScore(state: GameState, countryId: string): number {
  const c = state.countries[countryId];
  if (!c) return 0;
  const geb = provincesOf(state, countryId);
  const wirtschaft = geb.reduce((s, p) => s + p.economy, 0);
  const technik = TECH_ORDER.reduce((s, f) => s + c.tech[f], 0);
  return Math.round(
    geb.length * 9 + countryArmy(state, countryId) * 1.6 + wirtschaft * 1.3
    + technik * 7 + c.gold / 90,
  );
}

export function relationKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function getRelation(state: GameState, a: string, b: string): number {
  if (a === b) return 100;
  return state.relations[relationKey(a, b)] ?? 0;
}

export function setRelation(state: GameState, a: string, b: string, wert: number): void {
  if (a === b) return;
  state.relations[relationKey(a, b)] = Math.max(-100, Math.min(100, Math.round(wert)));
}

export function changeRelation(state: GameState, a: string, b: string, delta: number): void {
  setRelation(state, a, b, getRelation(state, a, b) + delta);
}

export function relationLabel(wert: number): string {
  if (wert >= 70) return 'Enge Freundschaft';
  if (wert >= 40) return 'Freundlich';
  if (wert >= 15) return 'Wohlwollend';
  if (wert > -15) return 'Neutral';
  if (wert > -40) return 'Kühl';
  if (wert > -70) return 'Feindselig';
  return 'Verfeindet';
}

export function warBetween(state: GameState, a: string, b: string) {
  return state.wars.find(
    (w) => (w.sideA.includes(a) && w.sideB.includes(b)) || (w.sideA.includes(b) && w.sideB.includes(a)),
  );
}

export function areAtWar(state: GameState, a: string, b: string): boolean {
  return !!warBetween(state, a, b);
}

export function allianceOf(state: GameState, countryId: string) {
  return state.alliances.find((al) => al.memberIds.includes(countryId));
}

export function areAllied(state: GameState, a: string, b: string): boolean {
  if (a === b) return true;
  const al = allianceOf(state, a);
  if (al && al.memberIds.includes(b)) return true;
  return state.treaties.some(
    (t) => t.type === 'defensive'
      && ((t.a === a && t.b === b) || (t.a === b && t.b === a)),
  );
}

export function hasTreaty(state: GameState, a: string, b: string, type: Treaty['type']): boolean {
  return state.treaties.some(
    (t) => t.type === type
      && ((t.a === a && t.b === b) || (t.a === b && t.b === a))
      && (t.until === 0 || t.until > state.turn),
  );
}

import type { Treaty } from './types';

export function isVassalOf(state: GameState, vasall: string, herr: string): boolean {
  return state.countries[vasall]?.overlordId === herr;
}

export function vassalsOf(state: GameState, herr: string): string[] {
  return state.countryOrder.filter((id) => state.countries[id].overlordId === herr);
}

/** Gebiete, die über Land oder einen Seeweg erreichbar sind. */
export function connectedProvinceIds(state: GameState, provinceId: string): string[] {
  const p = state.provinces[provinceId];
  if (!p) return [];
  const out = [...p.neighbors];
  for (const [a, b] of state.seaLinks) {
    if (a === provinceId && !out.includes(b)) out.push(b);
    if (b === provinceId && !out.includes(a)) out.push(a);
  }
  return out.filter((id) => state.provinces[id]);
}

export function sharesBorder(state: GameState, a: string, b: string): boolean {
  for (const id of state.provinceOrder) {
    const p = state.provinces[id];
    if (p.ownerId !== a) continue;
    for (const n of connectedProvinceIds(state, id)) {
      if (state.provinces[n]?.ownerId === b) return true;
    }
  }
  return false;
}

/**
 * Tragfaehige Heeresgroesse eines Landes.
 *
 * Ohne eine solche Grenze wächst jedes Heer ins Unermessliche, weil
 * Nachschub nur Gold kostet. Oberhalb der Grenze steigt der Unterhalt steil
 * an - ein Riesenheer ist möglich, ruiniert aber den Haushalt.
 */
export function armeeKapazitaet(state: GameState, countryId: string): number {
  let k = 0;
  for (const p of provincesOf(state, countryId)) {
    k += 3 + p.buildings.barracks * 2.5 + p.economy * 0.25;
  }
  const c = state.countries[countryId];
  if (c) k *= 1 + c.tech.logistics * 0.06;
  return Math.max(6, Math.round(k));
}

/** Hoechstzahl an Einheiten, die ein Gebiet je Runde ausheben kann. */
export function maxRecruitment(p: Province): number {
  const basis = Math.floor(p.population / 55000) + 1;
  return Math.max(1, basis + p.buildings.barracks * 3);
}

export function fortificationFactor(p: Province): number {
  return 1 + 0.2 * p.fortification + (p.isCapital ? 0.25 : 0);
}

export function maxActionPoints(c: Country): number {
  return BASIS_AKTIONSPUNKTE + governmentOf(c).actionBonus + Math.floor(c.tech.administration / 3);
}

export function formatIdSeq(state: GameState, prefix: string): string {
  state.seq += 1;
  return `${prefix}${state.seq}`;
}

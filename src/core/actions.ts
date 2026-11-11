/**
 * Alles, was der Spieler aktiv tut: ausheben, bauen, forschen, bewegen.
 *
 * Jede Funktion prueft ihre Voraussetzungen selbst und gibt eine lesbare
 * Begruendung zurueck, wenn etwas nicht geht. Die Oberflaeche muss keine
 * Regeln kennen.
 */

import type { BuildingId, GameState, Regiments, TechFieldId, UnitId } from './types';
import {
  BUILDINGS, GENERAL_NACHNAMEN, GENERAL_TRAITS, GENERAL_VORNAMEN, UNITS, buildingCost,
  connectedProvinceIds, maxRecruitment, provincesOf, regimentsTotal, techCost,
  verfuegbareEinheiten,
} from './rules';
import { moveRegiments } from './combat';
import type { GeneralTraitId } from './types';

export interface ActionResult {
  ok: boolean;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Rekrutierung                                                        */
/* ------------------------------------------------------------------ */

/** Was kostet eine Einheit dieser Gattung in diesem Gebiet? */
export function einheitenPreis(
  state: GameState, provinceId: string, unit: UnitId,
): number {
  const p = state.provinces[provinceId];
  const def = UNITS[unit];
  if (!p) return def.gold;
  let preis = def.gold;
  if (p.resource === 'iron') preis *= 0.9;
  if (unit === 'cavalry' && p.resource === 'horses') preis *= 0.8;
  if ((unit === 'armor' || unit === 'navy') && p.resource === 'oil') preis *= 0.85;
  preis *= 1 - p.buildings.barracks * 0.07;
  // Derselbe Massstab wie beim Bauen: auf einer Karte mit grossen,
  // wirtschaftsstarken Gebieten kostet ein Regiment entsprechend mehr.
  preis *= state.kostenFaktor;
  return Math.max(5, Math.round(preis));
}

/** Wie viele Einheiten dieser Gattung sind hier bezahlbar und zulaessig? */
export function maxAushebung(
  state: GameState, countryId: string, provinceId: string, unit: UnitId,
): number {
  const c = state.countries[countryId];
  const p = state.provinces[provinceId];
  if (!c || !p || p.ownerId !== countryId) return 0;
  const def = UNITS[unit];
  if (def.naval && !p.isPort) return 0;
  if (!verfuegbareEinheiten(c).includes(unit)) return 0;

  const preis = einheitenPreis(state, provinceId, unit);
  const nachGold = Math.floor(c.gold / preis);
  const nachLeuten = Math.floor(c.manpower / def.population);
  const nachPlatz = maxRecruitment(p);
  return Math.max(0, Math.min(nachGold, nachLeuten, nachPlatz));
}

export function recruit(
  state: GameState, countryId: string, provinceId: string, unit: UnitId, menge: number,
): ActionResult {
  const c = state.countries[countryId];
  const p = state.provinces[provinceId];
  if (!c || !p) return { ok: false, message: 'Gebiet nicht gefunden.' };
  if (p.ownerId !== countryId) return { ok: false, message: 'Das Gebiet gehört dir nicht.' };
  if (c.actionPoints < 1) return { ok: false, message: 'Keine Aktionspunkte mehr.' };
  if (menge < 1) return { ok: false, message: 'Keine Menge gewaehlt.' };

  const def = UNITS[unit];
  if (def.naval && !p.isPort) return { ok: false, message: 'Kriegsschiffe brauchen einen Hafen.' };
  if (!verfuegbareEinheiten(c).includes(unit)) {
    return { ok: false, message: `${def.name} erfordert eine höhere Militärtechnik.` };
  }
  const grenze = maxAushebung(state, countryId, provinceId, unit);
  if (menge > grenze) {
    return { ok: false, message: `Höchstens ${grenze} Einheiten - begrenzt durch Gold, Wehrfähige oder Platz.` };
  }

  const preis = einheitenPreis(state, provinceId, unit) * menge;
  c.gold -= preis;
  c.manpower -= def.population * menge;
  p.regiments[unit] = (p.regiments[unit] ?? 0) + menge;
  p.population = Math.max(5000, p.population - def.population * menge * 0.25);
  c.actionPoints -= 1;

  return { ok: true, message: `${menge} ${def.name} in ${p.name} ausgehoben (${Math.round(preis)} Gold).` };
}

/** Truppen auflösen - gibt einen Teil der Kosten zurueck und senkt den Unterhalt. */
export function disband(
  state: GameState, countryId: string, provinceId: string, unit: UnitId, menge: number,
): ActionResult {
  const c = state.countries[countryId];
  const p = state.provinces[provinceId];
  if (!c || !p || p.ownerId !== countryId) return { ok: false, message: 'Das Gebiet gehört dir nicht.' };
  const da = p.regiments[unit] ?? 0;
  if (menge < 1 || menge > da) return { ok: false, message: 'So viele stehen dort nicht.' };
  const rest = da - menge;
  if (rest > 0) p.regiments[unit] = rest; else delete p.regiments[unit];
  c.gold += Math.round(UNITS[unit].gold * menge * 0.3);
  c.manpower += UNITS[unit].population * menge * 0.5;
  return { ok: true, message: `${menge} ${UNITS[unit].name} entlassen.` };
}

/* ------------------------------------------------------------------ */
/* Bauen                                                               */
/* ------------------------------------------------------------------ */

export function build(
  state: GameState, countryId: string, provinceId: string, building: BuildingId,
): ActionResult {
  const c = state.countries[countryId];
  const p = state.provinces[provinceId];
  if (!c || !p) return { ok: false, message: 'Gebiet nicht gefunden.' };
  if (p.ownerId !== countryId) return { ok: false, message: 'Das Gebiet gehört dir nicht.' };

  const def = BUILDINGS[building];
  if (def.needsPort && !p.isPort) return { ok: false, message: `${def.name} braucht einen Hafen.` };
  if (p.buildings[building] >= def.maxLevel) {
    return { ok: false, message: `${def.name} ist bereits auf der höchsten Stufe.` };
  }
  if (c.construction.some((x) => x.provinceId === provinceId && x.building === building)) {
    return { ok: false, message: 'Dieses Projekt läuft hier bereits.' };
  }
  const kosten = buildingCost(building, p.buildings[building], p, state.kostenFaktor);
  if (c.gold < kosten) return { ok: false, message: `Dafür fehlen ${Math.ceil(kosten - c.gold)} Gold.` };

  c.gold -= kosten;
  state.seq += 1;
  c.construction.push({
    id: `bau${state.seq}`, provinceId, building, turnsLeft: def.buildTurns,
  });
  return { ok: true, message: `${def.name} in ${p.name} begonnen (${def.buildTurns} Runden).` };
}

/* ------------------------------------------------------------------ */
/* Forschung                                                           */
/* ------------------------------------------------------------------ */

export function startResearch(
  state: GameState, countryId: string, field: TechFieldId,
): ActionResult {
  const c = state.countries[countryId];
  if (!c) return { ok: false, message: 'Land nicht gefunden.' };
  if (c.tech[field] >= 8) return { ok: false, message: 'Dieser Bereich ist vollständig erforscht.' };
  if (c.research?.field === field) return { ok: false, message: 'Daran wird bereits geforscht.' };
  c.research = { field, progress: 0, cost: techCost(c.tech[field]) };
  return { ok: true, message: 'Forschungsvorhaben begonnen.' };
}

/* ------------------------------------------------------------------ */
/* Haushalt                                                            */
/* ------------------------------------------------------------------ */

export function setTaxRate(state: GameState, countryId: string, wert: number): void {
  const c = state.countries[countryId];
  if (c) c.taxRate = Math.max(0.2, Math.min(0.9, wert));
}

export function setResearchBudget(state: GameState, countryId: string, wert: number): void {
  const c = state.countries[countryId];
  if (c) c.researchBudget = Math.max(0, Math.min(0.5, wert));
}

/* ------------------------------------------------------------------ */
/* Generäle                                                           */
/* ------------------------------------------------------------------ */

export function assignGeneral(
  state: GameState, generalId: string, provinceId: string | null,
): ActionResult {
  const g = state.generals[generalId];
  if (!g) return { ok: false, message: 'General nicht gefunden.' };
  if (provinceId) {
    const p = state.provinces[provinceId];
    if (!p || p.ownerId !== g.countryId) {
      return { ok: false, message: 'Dorthin kann der General nicht versetzt werden.' };
    }
  }
  g.provinceId = provinceId;
  return { ok: true, message: provinceId
    ? `${g.name} übernimmt das Kommando in ${state.provinces[provinceId].name}.`
    : `${g.name} wird abberufen.` };
}

/** Einen neuen General anwerben - kostet Gold und politische Macht. */
export function hireGeneral(
  state: GameState, countryId: string, rnd: { pick<T>(a: readonly T[]): T; int(a: number, b: number): number; chance(p: number): boolean },
): ActionResult {
  const c = state.countries[countryId];
  if (!c) return { ok: false, message: 'Land nicht gefunden.' };
  const vorhanden = Object.values(state.generals).filter((g) => g.countryId === countryId).length;
  const grenze = Math.max(2, Math.ceil(provincesOf(state, countryId).length / 4));
  if (vorhanden >= grenze) {
    return { ok: false, message: `Dein Reich trägt höchstens ${grenze} Generäle.` };
  }
  const kosten = 300 + vorhanden * 150;
  if (c.gold < kosten) return { ok: false, message: `Dafür fehlen ${Math.ceil(kosten - c.gold)} Gold.` };
  if (c.politicalPower < 20) return { ok: false, message: 'Dafür fehlt politische Macht.' };

  c.gold -= kosten;
  c.politicalPower -= 20;
  state.seq += 1;

  const traitKeys = Object.keys(GENERAL_TRAITS) as GeneralTraitId[];
  const traits: GeneralTraitId[] = [rnd.pick(traitKeys)];
  if (rnd.chance(0.35)) {
    const zweiter = rnd.pick(traitKeys);
    if (!traits.includes(zweiter)) traits.push(zweiter);
  }
  const hauptstadt = state.provinces[c.capitalProvinceId];
  const g = {
    id: `gen${state.seq}`,
    name: `${rnd.pick(GENERAL_VORNAMEN)} ${rnd.pick(GENERAL_NACHNAMEN)}`,
    countryId,
    provinceId: hauptstadt?.ownerId === countryId ? hauptstadt.id : null,
    skill: rnd.int(1, 3),
    traits,
    wins: 0, losses: 0, xp: 0,
    hired: state.turn,
  };
  state.generals[g.id] = g;
  return { ok: true, message: `${g.name} tritt in deine Dienste.` };
}

/* ------------------------------------------------------------------ */
/* Sammelbefehle                                                       */
/* ------------------------------------------------------------------ */

/**
 * Schickt aus allen eigenen Gebieten ohne Feindkontakt Truppen an eine Front.
 * Auf den großen Karten spart das sehr viele Einzelbefehle.
 */
export function sammelVerlegung(
  state: GameState, countryId: string, zielId: string, anteil: number,
): ActionResult {
  const c = state.countries[countryId];
  const ziel = state.provinces[zielId];
  if (!c || !ziel || ziel.ownerId !== countryId) {
    return { ok: false, message: 'Das Ziel muss ein eigenes Gebiet sein.' };
  }
  if (c.actionPoints < 1) return { ok: false, message: 'Keine Aktionspunkte mehr.' };

  const quellen = connectedProvinceIds(state, zielId)
    .map((id) => state.provinces[id])
    .filter((p) => p && p.ownerId === countryId && regimentsTotal(p.regiments) > 1);

  if (!quellen.length) return { ok: false, message: 'Aus der Nachbarschaft kann nichts abgegeben werden.' };

  let bewegt = 0;
  for (const q of quellen) {
    const teil: Regiments = {};
    for (const [u, n] of Object.entries(q.regiments) as Array<[UnitId, number]>) {
      const v = Math.floor(n * anteil);
      if (v > 0) teil[u] = v;
    }
    if (regimentsTotal(teil) < 1) continue;
    const r = moveRegiments(state, q.id, zielId, teil);
    if (r.ok) bewegt += regimentsTotal(teil);
  }
  if (bewegt === 0) return { ok: false, message: 'Es konnte nichts verlegt werden.' };
  c.actionPoints -= 1;
  return { ok: true, message: `${bewegt} Einheiten nach ${ziel.name} zusammengezogen.` };
}

/**
 * Haushalt, Bevölkerung, Versorgung und Stabilität.
 */

import type { Country, GameState, Province } from './types';
import {
  ARMEE_UNTERHALT_BASIS, BUILDINGS, BUILDING_ORDER, MANPOWER_NACHWUCHS, SCHULDZINS,
  TERRAIN, UNITS, UNIT_ORDER, armeeKapazitaet, connectedProvinceIds,
  countryArmy, economyTechFactor, governmentOf, hasTreaty, provincesOf, regimentsTotal,
  supplyTechBonus, vassalsOf,
} from './rules';
import { diplomatieZuschlag, verwaltungsFaktor } from './herrscher';

export interface Finances {
  taxIncome: number;
  tradeIncome: number;
  vassalIncome: number;
  resourceIncome: number;
  armyUpkeep: number;
  adminCost: number;
  buildingUpkeep: number;
  researchSpending: number;
  interest: number;
  net: number;
  researchPoints: number;
}

/** Wirtschaftsleistung eines einzelnen Gebiets. */
export function provinceOutput(p: Province): number {
  const t = TERRAIN[p.terrain] ?? TERRAIN.plain;
  const basis = p.economy * 5 + (p.population / 95000) * 4;
  const markt = 1 + 0.12 * p.buildings.economy;
  const wege = 1 + 0.06 * (p.infrastructure + p.buildings.infrastructure);
  const versorgung = 0.55 + 0.45 * (p.supply / 100);
  const unruhe = 1 - (p.unrest / 100) * 0.55;
  return Math.max(0, basis * t.economy * markt * wege * versorgung * unruhe);
}

export function computeFinances(state: GameState, countryId: string): Finances {
  const c = state.countries[countryId];
  const leer: Finances = {
    taxIncome: 0, tradeIncome: 0, vassalIncome: 0, resourceIncome: 0,
    armyUpkeep: 0, adminCost: 0, buildingUpkeep: 0, researchSpending: 0,
    interest: 0, net: 0, researchPoints: 0,
  };
  if (!c) return leer;

  const gebiete = provincesOf(state, countryId);
  const gov = governmentOf(c);

  let leistung = 0;
  let gebaeudeUnterhalt = 0;
  let rohstoffe = 0;
  let haefen = 0;
  for (const p of gebiete) {
    leistung += provinceOutput(p);
    for (const b of BUILDING_ORDER) {
      const stufe = p.buildings[b];
      if (stufe > 0) gebaeudeUnterhalt += BUILDINGS[b].upkeep * stufe;
    }
    if (p.resource === 'gold') rohstoffe += 25;
    if (p.isPort) haefen += 1 + p.buildings.port;
  }

  // Die Verwaltungsgabe des Herrschers schlaegt auf die Steuern durch -
  // der sichtbarste Ort, an dem sich eine gute Regierung auszahlt.
  const steuern = leistung * c.taxRate * c.traits.economy * gov.economyMod
    * economyTechFactor(c) * verwaltungsFaktor(c);

  const handelsVertraege = state.treaties.filter(
    (t) => t.type === 'trade' && (t.a === countryId || t.b === countryId),
  ).length;
  const handel = (haefen * 22 + handelsVertraege * 38) * c.traits.trade;

  // Vasallen zahlen einen Teil ihrer Steuern an den Lehnsherrn.
  let vasallen = 0;
  for (const vid of vassalsOf(state, countryId)) {
    const v = state.countries[vid];
    if (!v?.alive) continue;
    let vl = 0;
    for (const p of provincesOf(state, vid)) vl += provinceOutput(p);
    vasallen += vl * 0.22;
  }

  let armee = 0;
  for (const p of gebiete) {
    for (const u of UNIT_ORDER) {
      const n = p.regiments[u] ?? 0;
      if (n) armee += n * UNITS[u].upkeep;
    }
  }
  armee *= ARMEE_UNTERHALT_BASIS;
  // Krieg treibt den Unterhalt, Frieden senkt ihn.
  const imKrieg = state.wars.some((w) => w.sideA.includes(countryId) || w.sideB.includes(countryId));
  armee *= imKrieg ? 1.25 : 0.85;

  // Über der tragfaehigen Größe wird jede weitere Einheit teuer.
  const kapazitaet = armeeKapazitaet(state, countryId);
  const staerke = countryArmy(state, countryId);
  if (staerke > kapazitaet) {
    const ueberhang = (staerke - kapazitaet) / kapazitaet;
    armee *= 1 + ueberhang * 1.8;
  }

  /* Verwaltung.
     Fruehere Fassung: eine feste Summe je Gebiet. Das war auf grossen Karten
     bedeutungslos - 32 Bundeslaender kosteten weniger als ein einziger Bau,
     waehrend sie das Zwanzigfache einbrachten. Jetzt haengt der Aufwand an
     der verwalteten Wirtschaftskraft und steigt zusaetzlich mit der Zahl der
     Gebiete: Ein weit auseinandergezogenes Reich traegt schwerer an sich
     selbst als ein geschlossenes. Das macht Ausdehnung zu einer Entscheidung
     statt zu einem Selbstlaeufer. */
  const breitenZuschlag = Math.min(0.26, Math.max(0, gebiete.length - 5) * 0.0055);
  const verwaltung = (leistung * (0.11 + breitenZuschlag) + gebiete.length * 4)
    * Math.max(0.62, 1 - c.tech.administration * 0.05);

  const einnahmen = steuern + handel + vasallen + rohstoffe;
  const forschungsausgaben = Math.max(0, einnahmen * c.researchBudget);
  const zinsen = c.debt * SCHULDZINS;

  let punkte = forschungsausgaben * 0.65 * c.traits.research;
  for (const p of gebiete) punkte += p.buildings.research * 22;
  for (const g of Object.values(state.generals)) {
    if (g.countryId === countryId && g.traits.includes('gelehrt')) punkte += 20;
  }

  const netto = einnahmen - armee - verwaltung - gebaeudeUnterhalt - forschungsausgaben - zinsen;

  return {
    taxIncome: steuern,
    tradeIncome: handel,
    vassalIncome: vasallen,
    resourceIncome: rohstoffe,
    armyUpkeep: armee,
    adminCost: verwaltung,
    buildingUpkeep: gebaeudeUnterhalt,
    researchSpending: forschungsausgaben,
    interest: zinsen,
    net: netto,
    researchPoints: punkte,
  };
}

/* ------------------------------------------------------------------ */
/* Versorgung                                                          */
/* ------------------------------------------------------------------ */

/**
 * Versorgung hängt daran, ob ein Gebiet noch mit der Hauptstadt verbunden
 * ist. Abgeschnittene Gebiete verlieren rasch an Kampfkraft - das macht
 * Umfassungen und Durchbrueche strategisch wertvoll.
 */
export function recalculateSupply(state: GameState): void {
  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    if (!c.alive) continue;

    const eigene = new Set(provincesOf(state, cid).map((p) => p.id));
    const start = state.provinces[c.capitalProvinceId];
    const erreicht = new Set<string>();

    if (start && start.ownerId === cid) {
      const queue = [start.id];
      erreicht.add(start.id);
      while (queue.length) {
        const akt = queue.shift()!;
        for (const n of connectedProvinceIds(state, akt)) {
          if (!erreicht.has(n) && eigene.has(n)) { erreicht.add(n); queue.push(n); }
        }
      }
    }

    const bonus = supplyTechBonus(c);
    for (const pid of eigene) {
      const p = state.provinces[pid];
      const t = TERRAIN[p.terrain] ?? TERRAIN.plain;
      let ziel = t.supply + bonus + p.infrastructure * 3 + p.buildings.infrastructure * 4
        + p.buildings.granary * 5;
      if (!erreicht.has(pid)) ziel -= 45;          // abgeschnitten
      if (p.siege) ziel -= 25;                      // belagert
      ziel = Math.max(5, Math.min(100, ziel));
      // Versorgung bewegt sich träge, damit Einbrueche spuerbar bleiben.
      p.supply = Math.round(p.supply + (ziel - p.supply) * 0.5);
    }
  }
  // Herrenlose Gebiete laufen auf ihren Gelaendewert zu.
  for (const pid of state.provinceOrder) {
    const p = state.provinces[pid];
    if (p.ownerId) continue;
    const t = TERRAIN[p.terrain] ?? TERRAIN.plain;
    p.supply = Math.round(p.supply + (t.supply - p.supply) * 0.5);
  }
}

/* ------------------------------------------------------------------ */
/* Rundenwirkung                                                       */
/* ------------------------------------------------------------------ */

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function applyEconomyTurn(state: GameState): void {
  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    if (!c.alive) continue;

    const f = computeFinances(state, cid);
    c.gold += f.net;

    // Schulden statt negativem Gold: nachvollziehbarer und spielbarer.
    if (c.gold < 0) {
      c.debt += -c.gold;
      c.gold = 0;
      c.stability -= 1.5;
    } else if (c.debt > 0) {
      const tilgung = Math.min(c.debt, c.gold * 0.25);
      c.debt -= tilgung;
      c.gold -= tilgung;
    }

    // Forschung
    if (c.research) {
      c.research.progress += f.researchPoints;
      if (c.research.progress >= c.research.cost) {
        c.tech[c.research.field] += 1;
        c.research = null;
      }
    }

    // Spionagewissen veraltet. Ohne diesen Verfall waere ein einmal
    // entsandter Spion fuer den Rest der Partie genug und verdeckte Mittel
    // haetten keine laufenden Kosten mehr.
    for (const fremd of Object.keys(c.intel)) {
      const wert = c.intel[fremd] - 3;
      if (wert <= 0) delete c.intel[fremd];
      else c.intel[fremd] = wert;
    }

    // Politische Macht
    const gov = governmentOf(c);
    c.politicalPower = clamp(
      c.politicalPower + 3 + c.tech.administration * 0.5 + (c.stability - 50) * 0.04
      + diplomatieZuschlag(c),
      0, 200,
    );

    // Stabilität
    let delta = gov.stabilityPerTurn + c.tech.administration * 0.22;
    delta += ((c.rulerData?.verwaltung ?? 3) - 3) * 0.25;
    if (c.taxRate > 0.55) delta -= (c.taxRate - 0.55) * 11;
    delta -= c.warExhaustion * 0.05;
    if (c.debt > 1200) delta -= 1.2;
    const gedaempft = delta > 0 ? delta * (1 - c.stability / 100) * 1.7 : delta;
    c.stability = clamp(c.stability + gedaempft, 0, 100);

    // Kriegsmüdigkeit
    const imKrieg = state.wars.some((w) => w.sideA.includes(cid) || w.sideB.includes(cid));
    c.warExhaustion = clamp(
      c.warExhaustion + (imKrieg ? 1.4 : -2.2) * (gov.id === 'democracy' ? 1.3 : 1),
      0, 100,
    );

    c.legitimacy = clamp(c.legitimacy + (c.stability > 55 ? 0.6 : -0.5), 0, 100);

    // Wehrfähige Reserve
    let bev = 0;
    for (const p of provincesOf(state, cid)) bev += p.population;
    const nachwuchs = bev * MANPOWER_NACHWUCHS * (1 - c.warExhaustion / 250);
    c.manpower = Math.min(bev * 0.02, c.manpower + nachwuchs);

    // Bauprojekte
    for (const projekt of [...c.construction]) {
      projekt.turnsLeft -= 1;
      if (projekt.turnsLeft <= 0) {
        const p = state.provinces[projekt.provinceId];
        if (p && p.ownerId === cid) {
          p.buildings[projekt.building] += 1;
          if (projekt.building === 'fortress') p.fortification += 1;
          if (projekt.building === 'infrastructure') p.infrastructure += 1;
        }
        c.construction = c.construction.filter((x) => x.id !== projekt.id);
      }
    }

    c.maxActionPoints = 4 + gov.actionBonus + Math.floor(c.tech.administration / 3);
    c.actionPoints = c.maxActionPoints;
  }

  /* Gebiete: Bevölkerung und Unruhe */
  for (const pid of state.provinceOrder) {
    const p = state.provinces[pid];
    const besitzer = p.ownerId ? state.countries[p.ownerId] : null;

    let wachstum = 0.006;
    if (p.resource === 'grain') wachstum += 0.004;
    if (p.resource === 'fish') wachstum += 0.002;
    wachstum *= 0.4 + 0.6 * (p.supply / 100);
    wachstum *= 1 - (p.unrest / 100) * 0.7;
    if (p.siege) wachstum -= 0.01;
    p.population = Math.max(1000, Math.round(p.population * (1 + wachstum)));

    if (!besitzer) { p.unrest = Math.max(0, p.unrest - 1); continue; }

    /* Eingliederung: Ein lange gehaltenes, ruhiges Gebiet wird mit der Zeit
       zum eigenen Kernland. Ohne diesen Weg waere jede Eroberung eine
       dauerhafte Last und jedes große Reich zerfiele zwangslaeufig. */
    if (p.coreOf !== besitzer.id && p.capturedTurn > 0
        && state.turn - p.capturedTurn >= 25 && p.unrest < 25) {
      p.coreOf = besitzer.id;
    }

    let unruhe = 0;
    if (p.coreOf !== besitzer.id) unruhe += 1.6;                 // fremdes Kerngebiet
    if (state.turn - p.capturedTurn < 8 && p.capturedTurn > 0) unruhe += 1.4;
    if (besitzer.taxRate > 0.55) unruhe += (besitzer.taxRate - 0.55) * 14;
    unruhe += besitzer.warExhaustion * 0.03;
    unruhe -= besitzer.stability * 0.05;
    unruhe -= p.buildings.granary * 1.2;
    unruhe -= p.buildings.fortress * 0.6;
    // Besatzung hält die Ordnung - mit abnehmender Wirkung.
    unruhe -= Math.min(4, Math.sqrt(regimentsTotal(p.regiments)) * 0.9);
    if (p.supply < 40) unruhe += 1.2;
    p.unrest = clamp(p.unrest + unruhe * 0.5, 0, 100);
  }
}

/** Anteil der Versorgung als Kampffaktor. */
export function supplyFactor(p: Province): number {
  return 0.55 + 0.45 * (p.supply / 100);
}

export function tradePartnerCount(state: GameState, countryId: string): number {
  return state.countryOrder.filter((id) => id !== countryId && hasTreaty(state, countryId, id, 'trade')).length;
}

export function countryIncomeShort(state: GameState, c: Country): number {
  return computeFinances(state, c.id).net;
}

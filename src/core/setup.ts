/**
 * Baut aus einer Szenariodatei einen vollstaendigen Spielzustand.
 *
 * Die Szenariodateien stammen aus der Geodaten-Pipeline und nennen je Gebiet
 * nur eine Armeestaerke. Hier wird daraus eine Heereszusammensetzung aus
 * Truppengattungen abgeleitet, passend zum Technikstand des Landes - ein
 * antikes Heer besteht aus Fußvolk und Fernkaempfern, ein modernes aus
 * Artillerie und Panzern.
 */

import type {
  Country, Difficulty, GameMap, GameState, General, Province, Regiments, TechFieldId, UnitId,
} from './types';
import {
  BUILDING_ORDER, GENERAL_NACHNAMEN, GENERAL_VORNAMEN, GENERAL_TRAITS, TECH_ORDER, TERRAIN,
  maxActionPoints, regimentsTotal, setRelation,
  KOSTEN_BEZUG,
} from './rules';
import { provinceOutput } from './economy';
import { createRandom } from './rng';
import { erzeugeMissionen } from './missions';
import { erzeugeHerrscher } from './herrscher';
import { maps, scenarios, eventDefinitions } from '../data/index';

export interface NewGameOptions {
  scenarioId: string;
  playerCountryId: string;
  difficulty: Difficulty;
  seed?: number;
}

/** Verteilt eine Gesamtstaerke auf Truppengattungen passend zur Epoche. */
export function heeresMischung(
  gesamt: number,
  militaryTech: number,
  istHafen: boolean,
): Regiments {
  if (gesamt <= 0) return {};

  // Anteile je Technikstufe. Summe jeweils 1.
  let anteile: Partial<Record<UnitId, number>>;
  if (militaryTech <= 1) {
    anteile = { infantry: 0.68, archers: 0.24, cavalry: 0.08 };
  } else if (militaryTech <= 3) {
    anteile = { infantry: 0.55, archers: 0.20, cavalry: 0.17, siege: 0.08 };
  } else if (militaryTech <= 5) {
    anteile = { infantry: 0.58, cavalry: 0.18, artillery: 0.18, archers: 0.06 };
  } else {
    anteile = { infantry: 0.52, artillery: 0.22, armor: 0.20, cavalry: 0.06 };
  }

  const out: Regiments = {};
  let vergeben = 0;
  const keys = Object.keys(anteile) as UnitId[];
  for (const k of keys) {
    const v = Math.floor(gesamt * (anteile[k] ?? 0));
    if (v > 0) { out[k] = v; vergeben += v; }
  }
  // Rest ins Fußvolk, damit die Summe exakt stimmt.
  const rest = gesamt - vergeben;
  if (rest > 0) out.infantry = (out.infantry ?? 0) + rest;

  // Häfen erhalten einen kleinen Flottenanteil, der vom Fußvolk abgezogen wird.
  if (istHafen && militaryTech >= 2 && gesamt >= 6) {
    const flotte = Math.max(1, Math.round(gesamt * 0.12));
    if ((out.infantry ?? 0) > flotte) {
      out.infantry = (out.infantry ?? 0) - flotte;
      out.navy = flotte;
    }
  }
  for (const k of Object.keys(out) as UnitId[]) if (!out[k]) delete out[k];
  return out;
}

function leereGebaeude(): Record<string, number> {
  const o: Record<string, number> = {};
  for (const b of BUILDING_ORDER) o[b] = 0;
  return o;
}

function erzeugeGeneral(
  state: GameState, countryId: string, provinceId: string | null,
  rnd: ReturnType<typeof createRandom>, mindestKoennen = 1,
): General {
  state.seq += 1;
  const traitKeys = Object.keys(GENERAL_TRAITS) as Array<keyof typeof GENERAL_TRAITS>;
  const anzahl = rnd.chance(0.35) ? 2 : 1;
  const traits: General['traits'] = [];
  for (let i = 0; i < anzahl; i++) {
    const t = rnd.pick(traitKeys);
    if (!traits.includes(t)) traits.push(t);
  }
  return {
    id: `gen${state.seq}`,
    name: `${rnd.pick(GENERAL_VORNAMEN)} ${rnd.pick(GENERAL_NACHNAMEN)}`,
    countryId,
    provinceId,
    skill: Math.max(mindestKoennen, rnd.int(1, 4)),
    traits,
    wins: 0, losses: 0, xp: 0,
    hired: state.turn,
  };
}

function provincesOfIds(state: GameState, countryId: string): string[] {
  return state.provinceOrder.filter((id) => state.provinces[id].ownerId === countryId);
}

export function createNewGame(opts: NewGameOptions): GameState {
  const scenario = scenarios.find((s) => s.id === opts.scenarioId);
  if (!scenario) throw new Error(`Unbekanntes Szenario: ${opts.scenarioId}`);
  const karte = maps.find((m) => m.id === scenario.mapId) as GameMap | undefined;
  if (!karte) throw new Error(`Unbekannte Karte: ${scenario.mapId}`);
  if (!scenario.countries.some((c: any) => c.id === opts.playerCountryId)) {
    throw new Error(`Land ${opts.playerCountryId} gibt es in diesem Szenario nicht.`);
  }

  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const rnd = createRandom(seed);

  const state: GameState = {
    version: 2,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    mapId: karte.id,
    viewBox: karte.viewBox,
    seaLinks: (karte.seaLinks ?? []) as Array<[string, string]>,

    turn: 1,
    year: scenario.startYear,
    startYear: scenario.startYear,
    monthsPerTurn: scenario.monthsPerTurn,
    endYear: scenario.endYear,
    sandbox: !!scenario.sandbox,
    difficulty: opts.difficulty,
    status: 'playing',
    statusMessage: '',

    playerCountryId: opts.playerCountryId,
    countryOrder: [],
    countries: {},
    provinceOrder: [],
    provinces: {},
    generals: {},

    relations: {},
    treaties: [],
    alliances: [],
    wars: [],
    pendingPeaceOffers: [],

    eventPool: (scenario.events && scenario.events.length > 0)
      ? [...scenario.events]
      : eventDefinitions.map((e) => e.id),
    firedEvents: [],
    pendingEvent: null,

    log: [],
    battleReports: [],
    history: [],
    achievements: [],
    victoryConditions: scenario.victoryConditions ?? [],
    missions: [],
    missionZaehler: 0,
    kostenFaktor: 1,

    seq: 0,
    rngState: seed,
    seed,
  };

  /* ---------------- Gebiete ---------------- */
  const overrides = scenario.provinceOverrides ?? {};
  for (const mp of karte.provinces) {
    const ov = overrides[mp.id] ?? {};
    const t = TERRAIN[mp.terrain] ?? TERRAIN.plain;
    const p: Province = {
      id: mp.id,
      name: mp.name,
      points: mp.points,
      center: mp.center,
      terrain: mp.terrain,
      neighbors: mp.neighbors.filter((n) => karte.provinces.some((q) => q.id === n)),
      resource: mp.resource,
      isPort: mp.isPort,
      land: mp.land,
      ownerId: null,
      coreOf: null,
      isCapital: false,
      population: ov.population ?? mp.basePopulation,
      economy: ov.economy ?? Math.round(mp.baseEconomy * t.economy),
      infrastructure: ov.infrastructure ?? 0,
      fortification: ov.fortification ?? 0,
      supply: 100,
      unrest: ov.unrest ?? 0,
      buildings: leereGebaeude() as Province['buildings'],
      regiments: {},
      siege: null,
      capturedTurn: 0,
    };
    state.provinces[p.id] = p;
    state.provinceOrder.push(p.id);
  }

  /* ---------------- Länder ---------------- */
  const schwierigkeit = opts.difficulty;
  for (const sc of scenario.countries as any[]) {
    const tech: Record<TechFieldId, number> = { military: 0, economy: 0, administration: 0, logistics: 0, defense: 0 };
    for (const f of TECH_ORDER) tech[f] = sc.tech?.[f] ?? 1;

    const c: Country = {
      id: sc.id,
      name: sc.name,
      color: sc.color,
      emblem: sc.emblem ?? sc.name.slice(0, 1),
      crest: 0, // wird unten gesetzt
      ruler: sc.ruler ?? 'Unbekannt',
      government: sc.government ?? 'monarchy',
      personality: sc.personality ?? 'opportunistic',
      capitalProvinceId: sc.capital,
      traits: {
        military: sc.traits?.military ?? 1,
        economy: sc.traits?.economy ?? 1,
        defense: sc.traits?.defense ?? 1,
        research: sc.traits?.research ?? 1,
        trade: sc.traits?.trade ?? 1,
      },
      description: sc.description ?? '',
      gold: sc.gold ?? 400,
      debt: 0,
      stability: sc.stability ?? 55,
      politicalPower: sc.politicalPower ?? 25,
      legitimacy: 70,
      warExhaustion: 0,
      manpower: 0,
      taxRate: 0.45,
      researchBudget: 0.18,
      tech,
      research: null,
      construction: [],
      actionPoints: 0,
      maxActionPoints: 0,
      alive: true,
      isPlayer: sc.id === opts.playerCountryId,
      overlordId: null,
      intel: {},
    };
    // Wappenkennung stabil aus dem Namen ableiten.
    let h = 0;
    for (let i = 0; i < c.name.length; i++) h = (h * 31 + c.name.charCodeAt(i)) >>> 0;
    c.crest = h;

    c.maxActionPoints = maxActionPoints(c);
    c.actionPoints = c.maxActionPoints;

    state.countries[c.id] = c;
    state.countryOrder.push(c.id);

    /* Gebiete zuweisen */
    for (const pid of sc.provinces ?? []) {
      const p = state.provinces[pid];
      if (!p) continue;
      p.ownerId = c.id;
      p.coreOf = c.id;
    }
    const hp = state.provinces[c.capitalProvinceId];
    if (hp) {
      hp.isCapital = true;
      hp.fortification = Math.max(hp.fortification, 2);
    }

    /* Heere aus den Armeezahlen aufbauen */
    for (const [pid, menge] of Object.entries(sc.armies ?? {})) {
      const p = state.provinces[pid];
      if (!p) continue;
      p.regiments = heeresMischung(Number(menge), tech.military, p.isPort);
    }

    /* Wehrfähige Reserve */
    let bev = 0;
    for (const pid of sc.provinces ?? []) bev += state.provinces[pid]?.population ?? 0;
    c.manpower = Math.round(bev * 0.012);
  }

  /* ---------------- Generäle ---------------- */
  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    const eigene = state.provinceOrder.filter((id) => state.provinces[id].ownerId === cid);
    const anzahl = Math.min(3, Math.max(1, Math.round(eigene.length / 6)));
    for (let i = 0; i < anzahl; i++) {
      // Der erste General steht in der Hauptstadt, weitere im staerksten Gebiet.
      const kandidaten = eigene
        .map((id) => state.provinces[id])
        .sort((a, b) => regimentsTotal(b.regiments) - regimentsTotal(a.regiments));
      const ziel = i === 0 ? state.provinces[c.capitalProvinceId] : kandidaten[i];
      const g = erzeugeGeneral(state, cid, ziel ? ziel.id : null, rnd, i === 0 ? 2 : 1);
      state.generals[g.id] = g;
    }
  }

  /* ---------------- Diplomatie ---------------- */
  for (const r of scenario.relations ?? []) setRelation(state, r.a, r.b, r.value);

  for (const al of scenario.alliances ?? []) {
    state.alliances.push({
      id: al.id, name: al.name, leaderId: al.leaderId,
      memberIds: [...al.memberIds], founded: state.turn,
    });
    for (const a of al.memberIds) {
      for (const b of al.memberIds) {
        if (a !== b && (state.relations[`${a}|${b}`] ?? 0) === 0) setRelation(state, a, b, 55);
      }
    }
  }

  for (const w of scenario.wars ?? []) {
    state.seq += 1;
    state.wars.push({
      id: `war${state.seq}`,
      sideA: [...w.sideA], sideB: [...w.sideB],
      scoreA: 0, startTurn: 1,
      goalA: 'conquest', goalB: 'conquest',
      occupiedByA: [], occupiedByB: [],
    });
  }

  /* ---------------- Schwierigkeitsgrad ----------------
     Die KI erhält keine Zusatzmittel. Stattdessen startet der Spieler
     je nach Grad etwas besser oder schlechter - das ist nachvollziehbar
     und lässt die KI mit denselben Regeln spielen. */
  const spieler = state.countries[opts.playerCountryId];
  if (schwierigkeit === 'easy') {
    spieler.gold = Math.round(spieler.gold * 1.5);
    spieler.stability = Math.min(100, spieler.stability + 12);
  } else if (schwierigkeit === 'hard') {
    spieler.gold = Math.round(spieler.gold * 0.8);
    spieler.stability = Math.max(10, spieler.stability - 8);
  }

  /* ---------------- Siegbedingungen prüfen ----------------
     Eine feste Schwelle kann unter dem Startbesitz der groessten Macht
     liegen - dann waere die Partie in der ersten Runde entschieden.
     Die Schwelle wird darum immer über den groessten Start gehoben. */
  const groessterStart = Math.max(
    ...state.countryOrder.map((id) => provincesOfIds(state, id).length), 1,
  );
  const gesamtGebiete = state.provinceOrder.length;
  state.victoryConditions = state.victoryConditions.map((b) => {
    if (b.type === 'provinces') {
      const mindest = Math.min(
        gesamtGebiete - 1,
        Math.max(Math.round(groessterStart * 2.2), Math.round(gesamtGebiete * 0.3)),
      );
      if (b.value >= mindest) return b;
      return { ...b, value: mindest, description: `Beherrsche ${mindest} der ${gesamtGebiete} Gebiete.` };
    }
    if (b.type === 'capitals' && b.value < 4) {
      return { ...b, value: 4, description: 'Erobere vier fremde Hauptstädte.' };
    }
    return b;
  });

  // Zielvorgaben zuletzt: sie leiten ihre Zielwerte aus dem fertigen
  // Startzustand ab und muessen deshalb alles Uebrige kennen.
  /* Kostenmassstab.

     Geeicht wird auf die Wirtschaftskraft eines typischen Landes, nicht
     eines typischen Gebiets. Der Unterschied ist entscheidend: Auf der
     Weltkarte ist ein Gebiet ein ganzer Staat, auf der Europakarte ein
     Bundesland. Waere der Massstab am Gebiet ausgerichtet, kostete ein Bau
     auf der Weltkarte das Achtfache - obwohl der Spieler dort nur ein
     Sechstel so viele Gebiete besitzt.

     Genommen wird der Median ueber die Laender, damit eine einzelne
     Grossmacht den Massstab nicht verzieht. */
  {
    const summen: number[] = [];
    for (const cid of state.countryOrder) {
      let summe = 0;
      for (const pid of state.provinceOrder) {
        if (state.provinces[pid].ownerId === cid) {
          summe += provinceOutput(state.provinces[pid]);
        }
      }
      if (summe > 0) summen.push(summe);
    }
    summen.sort((a, b) => a - b);
    /* Nicht der Median allein, sondern die Mitte zwischen Median und
       Durchschnitt. Der Median beschreibt das typische Land, der
       Durchschnitt beruecksichtigt die Grossmaechte. Nur auf den Median
       geeicht waeren Bauten fuer eine Grossmacht fast umsonst; nur auf den
       Durchschnitt geeicht fuer Kleinstaaten unbezahlbar. */
    const median = summen.length ? summen[Math.floor(summen.length / 2)] : KOSTEN_BEZUG;
    const schnitt = summen.length
      ? summen.reduce((a, b) => a + b, 0) / summen.length
      : KOSTEN_BEZUG;
    const bezug = (median + schnitt) / 2;
    state.kostenFaktor = Math.min(6, Math.max(0.6, bezug / KOSTEN_BEZUG));
  }

  // Jedes Land bekommt einen Herrscher. Der im Szenario genannte Name
  // bleibt erhalten - historische Figuren sollen nicht verschwinden.
  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    c.rulerData = erzeugeHerrscher(rnd, state.startYear, c.ruler);
  }

  erzeugeMissionen(state, rnd);

  state.rngState = rnd.state();
  return state;
}

/**
 * Kampf, Belagerung und Truppenbewegung.
 *
 * Leitgedanke: Jeder Kampf ist eine offengelegte Rechnung. Der Spieler sieht
 * vorher eine Abschaetzung und hinterher jeden einzelnen Faktor. Der Zufall
 * wirkt spuerbar, entscheidet aber nicht allein.
 *
 * Neu gegenüber der einfachen Fassung: Truppengattungen mit Gelaendewirkung,
 * Generäle, und Festungen, die nicht im ersten Sturm fallen, sondern belagert
 * werden muessen.
 */

import type {
  BattleFactor, BattleReport, GameState, General, Province, Regiments,
} from './types';
import {
  TERRAIN, UNITS, UNIT_ORDER, areAllied, areAtWar, changeRelation, connectedProvinceIds,
  defenseTechFactor, fortificationFactor, generalFactor, militaryTechFactor,
  regimentsAdd, regimentsScale, regimentsSub, regimentsTotal,
} from './rules';
import { kriegsFaktor } from './herrscher';
import { supplyFactor } from './economy';
import { createRandom } from './rng';

/* ------------------------------------------------------------------ */
/* Bewegung                                                            */
/* ------------------------------------------------------------------ */

export function movableTargets(state: GameState, countryId: string, from: string): string[] {
  const p = state.provinces[from];
  if (!p || p.ownerId !== countryId) return [];
  return connectedProvinceIds(state, from).filter((id) => {
    const q = state.provinces[id];
    if (!q) return false;
    if (q.ownerId === countryId) return true;
    // Durchmarsch bei Verbündeten und mit Durchmarschrecht
    if (q.ownerId && areAllied(state, countryId, q.ownerId)) return true;
    return false;
  });
}

export function attackableTargets(state: GameState, countryId: string, from: string): string[] {
  const p = state.provinces[from];
  if (!p || p.ownerId !== countryId) return [];
  return connectedProvinceIds(state, from).filter((id) => {
    const q = state.provinces[id];
    if (!q) return false;
    if (q.ownerId === countryId) return false;
    if (!q.ownerId) return true;                                   // herrenlos
    if (areAllied(state, countryId, q.ownerId)) return false;
    return areAtWar(state, countryId, q.ownerId);
  });
}

/** Bewegt Truppen; der General zieht mit, wenn er im Ausgangsgebiet steht. */
export function moveRegiments(
  state: GameState, from: string, to: string, truppen: Regiments,
): { ok: boolean; message: string } {
  const a = state.provinces[from];
  const b = state.provinces[to];
  if (!a || !b) return { ok: false, message: 'Gebiet nicht gefunden.' };
  const menge = regimentsTotal(truppen);
  if (menge <= 0) return { ok: false, message: 'Keine Truppen ausgewählt.' };
  if (regimentsTotal(a.regiments) < menge) return { ok: false, message: 'So viele Truppen stehen dort nicht.' };

  // Flotten brauchen Häfen auf beiden Seiten.
  if ((truppen.navy ?? 0) > 0 && (!a.isPort || !b.isPort)) {
    return { ok: false, message: 'Kriegsschiffe können nur zwischen Häfen verlegt werden.' };
  }
  // Landtruppen können einen Seeweg nur nutzen, wenn beide Seiten Häfen sind.
  const landweg = a.neighbors.includes(to);
  if (!landweg && !(a.isPort && b.isPort)) {
    return { ok: false, message: 'Dorthin führt kein Weg.' };
  }

  regimentsSub(a.regiments, truppen);
  regimentsAdd(b.regiments, truppen);

  // Zieht das gesamte Heer um, folgt der General.
  if (regimentsTotal(a.regiments) === 0) {
    for (const g of Object.values(state.generals)) {
      if (g.provinceId === from && g.countryId === b.ownerId) g.provinceId = to;
    }
  }
  return { ok: true, message: `${menge} Einheiten nach ${b.name} verlegt.` };
}

export function generalInProvince(state: GameState, provinceId: string, countryId: string): General | null {
  for (const g of Object.values(state.generals)) {
    if (g.provinceId === provinceId && g.countryId === countryId) return g;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Kampfkraft                                                          */
/* ------------------------------------------------------------------ */

/**
 * Zuschlag für verbundene Waffen.
 *
 * Ein Heer aus lauter Fußvolk ist berechenbar; erst das Zusammenspiel
 * mehrerer Gattungen macht es gefaehrlich. Ohne diesen Zuschlag waere es
 * immer am guenstigsten, nur die billigste Gattung aufzustellen - und die
 * Truppengattungen waeren eine Zierde ohne Wirkung.
 */
export function verbundeneWaffen(truppen: Regiments): number {
  const gesamt = regimentsTotal(truppen);
  if (gesamt < 4) return 1;
  let vertreten = 0;
  let groesster = 0;
  for (const u of UNIT_ORDER) {
    const n = truppen[u] ?? 0;
    if (n / gesamt >= 0.08) vertreten += 1;   // zählt ab 8 % Anteil
    if (n > groesster) groesster = n;
  }
  const einseitig = groesster / gesamt;       // 1 = nur eine Gattung
  // Bis zu +24 % für drei und mehr Gattungen, Abzug für reine Haufen.
  const vielfalt = Math.min(3, Math.max(0, vertreten - 1)) * 0.08;
  const malus = einseitig > 0.85 ? -0.12 : 0;
  return 1 + vielfalt + malus;
}

/** Kampfkraft eines Heeres, aufgeschluesselt nach Gattung und Gelände. */
export function heeresKraft(
  truppen: Regiments, terrain: Province['terrain'], rolle: 'attack' | 'defense',
): number {
  let kraft = 0;
  for (const u of UNIT_ORDER) {
    const n = truppen[u] ?? 0;
    if (!n) continue;
    const def = UNITS[u];
    const grund = rolle === 'attack' ? def.attack : def.defense;
    const gelaende = def.terrainBonus[terrain] ?? 1;
    kraft += n * grund * gelaende;
  }
  return kraft * verbundeneWaffen(truppen);
}

/** Belagerungswirkung eines Heeres. */
export function belagerungsKraft(truppen: Regiments): number {
  let k = 0;
  for (const u of UNIT_ORDER) {
    const n = truppen[u] ?? 0;
    if (n) k += n * UNITS[u].siegePower;
  }
  return k;
}

export interface Vorschau {
  attack: number;
  defense: number;
  chance: number;
  brauchtBelagerung: boolean;
}

/** Abschaetzung ohne Zufall - für die Anzeige vor dem Angriff. */
export function estimatePower(
  state: GameState, attackerId: string, from: Province, to: Province, truppen: Regiments,
): Vorschau {
  const angreifer = state.countries[attackerId];
  const verteidigerId = to.ownerId;
  const verteidiger = verteidigerId ? state.countries[verteidigerId] : null;
  const genA = generalInProvince(state, from.id, attackerId);
  const genB = verteidigerId ? generalInProvince(state, to.id, verteidigerId) : null;

  const t = TERRAIN[to.terrain] ?? TERRAIN.plain;

  const a = heeresKraft(truppen, to.terrain, 'attack')
    * militaryTechFactor(angreifer)
    * angreifer.traits.military
    * supplyFactor(from)
    * generalFactor(genA, 'attack')
    * (1 - angreifer.warExhaustion / 300);

  let d = heeresKraft(to.regiments, to.terrain, 'defense') * t.defense * fortificationFactor(to);
  if (verteidiger) {
    d *= defenseTechFactor(verteidiger) * verteidiger.traits.defense
      * supplyFactor(to) * generalFactor(genB, 'defense')
      * (1 - verteidiger.warExhaustion / 300);
  } else {
    d *= 0.9; // herrenlose Gebiete wehren sich schwächer
  }
  // Leeres Gebiet: trotzdem ein Mindestwiderstand durch die Bevölkerung
  if (regimentsTotal(to.regiments) === 0) d = Math.max(d, to.population / 160000 + to.fortification);

  const gesamt = a + d;
  return {
    attack: a,
    defense: d,
    chance: gesamt > 0 ? a / gesamt : 0.5,
    brauchtBelagerung: to.fortification >= 2 && belagerungsKraft(truppen) < to.fortification * 14,
  };
}

/* ------------------------------------------------------------------ */
/* Verluste                                                            */
/* ------------------------------------------------------------------ */

/** Verteilt Verluste anteilig auf die Gattungen; schwere Waffen halten länger. */
function verteileVerluste(truppen: Regiments, anteil: number): Regiments {
  const verlust: Regiments = {};
  for (const u of UNIT_ORDER) {
    const n = truppen[u] ?? 0;
    if (!n) continue;
    // Zaehigkeit: Panzer und Artillerie verlieren seltener Einheiten als Fußvolk.
    const zaeh = u === 'armor' ? 0.65 : u === 'artillery' ? 0.75 : u === 'siege' ? 0.8 : 1;
    const v = Math.min(n, Math.round(n * anteil * zaeh));
    if (v > 0) verlust[u] = v;
  }
  return verlust;
}

/* ------------------------------------------------------------------ */
/* Kampf                                                               */
/* ------------------------------------------------------------------ */

export interface BattleResult {
  report: BattleReport;
  captured: boolean;
}

export function resolveBattle(
  state: GameState, attackerId: string, fromId: string, toId: string, truppen: Regiments,
): BattleResult | null {
  const from = state.provinces[fromId];
  const to = state.provinces[toId];
  if (!from || !to) return null;

  const angreifer = state.countries[attackerId];
  const verteidigerId = to.ownerId;
  const verteidiger = verteidigerId ? state.countries[verteidigerId] : null;

  const rnd = createRandom(state.rngState);
  const t = TERRAIN[to.terrain] ?? TERRAIN.plain;
  const genA = generalInProvince(state, fromId, attackerId);
  const genB = verteidigerId ? generalInProvince(state, toId, verteidigerId) : null;

  // Truppen verlassen das Ausgangsgebiet
  regimentsSub(from.regiments, truppen);

  const verteidigendeTruppen = { ...to.regiments };

  /* ---- Faktoren ---- */
  const kraftA = heeresKraft(truppen, to.terrain, 'attack');
  const kraftD = heeresKraft(verteidigendeTruppen, to.terrain, 'defense');

  const techA = militaryTechFactor(angreifer);
  const techD = verteidiger ? defenseTechFactor(verteidiger) : 1;
  const landA = angreifer.traits.military;
  const landD = verteidiger ? verteidiger.traits.defense : 1;
  const versA = supplyFactor(from);
  const versD = supplyFactor(to);
  const gelD = t.defense;
  const festD = fortificationFactor(to);
  const genFA = generalFactor(genA, 'attack');
  const genFD = generalFactor(genB, 'defense');
  const muedA = 1 - angreifer.warExhaustion / 300;
  const muedD = verteidiger ? 1 - verteidiger.warExhaustion / 300 : 1;
  // Die Kriegskunst des Herrschers wirkt auf das ganze Heer - anders als
  // der General, der nur fuer sein eigenes Gebiet steht.
  const herrA = kriegsFaktor(angreifer, true);
  const herrD = kriegsFaktor(verteidiger ?? undefined, false);
  const zufallA = rnd.spread(0.18);
  const zufallD = rnd.spread(0.18);

  const angriffskraft = kraftA * techA * landA * versA * genFA * muedA * herrA * zufallA;
  let verteidigungskraft = kraftD * techD * landD * versD * gelD * festD * genFD * muedD
    * herrD * zufallD;
  if (!verteidiger) verteidigungskraft *= 0.9;
  if (regimentsTotal(verteidigendeTruppen) === 0) {
    verteidigungskraft = Math.max(verteidigungskraft, (to.population / 160000 + to.fortification) * zufallD);
  }

  const faktoren: BattleFactor[] = [
    { label: 'Truppenstärke', attacker: regimentsTotal(truppen), defender: regimentsTotal(verteidigendeTruppen), istFaktor: false },
    { label: 'Gattungen im Gelände', attacker: kraftA / Math.max(1, regimentsTotal(truppen)), defender: kraftD / Math.max(1, regimentsTotal(verteidigendeTruppen)), istFaktor: true },
    { label: 'Verbundene Waffen', attacker: verbundeneWaffen(truppen), defender: verbundeneWaffen(verteidigendeTruppen), istFaktor: true },
    { label: 'Technik', attacker: techA, defender: techD, istFaktor: true },
    { label: 'Landesbonus', attacker: landA, defender: landD, istFaktor: true },
    { label: 'Versorgung', attacker: versA, defender: versD, istFaktor: true },
    { label: 'Gelände', attacker: 1, defender: gelD, istFaktor: true },
    { label: 'Befestigung', attacker: 1, defender: festD, istFaktor: true },
    { label: 'Führung', attacker: genFA, defender: genFD, istFaktor: true },
    { label: 'Herrscher', attacker: herrA, defender: herrD, istFaktor: true },
    { label: 'Kriegsmüdigkeit', attacker: muedA, defender: muedD, istFaktor: true },
    { label: 'Zufall', attacker: zufallA, defender: zufallD, istFaktor: true },
  ];

  const summe = angriffskraft + verteidigungskraft;
  const anteilA = summe > 0 ? angriffskraft / summe : 0.5;
  const angreiferGewinnt = angriffskraft > verteidigungskraft;

  /* ---- Verluste ---- */
  let verlustAnteilA = (1 - anteilA) * 0.55;
  let verlustAnteilD = anteilA * 0.6;
  if (genA?.traits.includes('ausbilder')) verlustAnteilA *= 0.85;
  if (genA?.traits.includes('vorsichtig')) verlustAnteilA *= 0.85;
  if (genA?.traits.includes('draufgaenger')) verlustAnteilA *= 1.2;
  if (genB?.traits.includes('ausbilder')) verlustAnteilD *= 0.85;

  const verlusteA = verteileVerluste(truppen, Math.min(0.9, verlustAnteilA));
  const verlusteD = verteileVerluste(verteidigendeTruppen, Math.min(0.95, verlustAnteilD));

  const ueberlebendeA = { ...truppen };
  regimentsSub(ueberlebendeA, verlusteA);
  const ueberlebendeD = { ...verteidigendeTruppen };
  regimentsSub(ueberlebendeD, verlusteD);

  /* ---- Ausgang ---- */
  let erobert = false;
  let belagerungBegonnen = false;
  let zurueckgezogen = 0;

  if (angreiferGewinnt) {
    const belagerung = belagerungsKraft(ueberlebendeA);
    const mauerWert = to.fortification * 14;
    const festungHaelt = to.fortification >= 2 && belagerung < mauerWert && regimentsTotal(ueberlebendeD) > 0;

    if (festungHaelt) {
      // Das Feld ist gewonnen, die Festung nicht: Belagerung beginnt.
      to.regiments = ueberlebendeD;
      regimentsAdd(from.regiments, ueberlebendeA); // Angreifer bleibt im Umland
      to.siege = to.siege ?? { attackerId, progress: 0, startedTurn: state.turn };
      belagerungBegonnen = true;
    } else {
      // Geschlagene Verteidiger setzen sich in ein Nachbargebiet ab.
      if (verteidigerId && regimentsTotal(ueberlebendeD) > 0) {
        const zuflucht = connectedProvinceIds(state, toId)
          .map((id) => state.provinces[id])
          .filter((p) => p && p.ownerId === verteidigerId)
          .sort((a, b) => regimentsTotal(b.regiments) - regimentsTotal(a.regiments))[0];
        if (zuflucht) {
          const teil = regimentsScale(ueberlebendeD, 0.6);
          zurueckgezogen = regimentsTotal(teil);
          regimentsAdd(zuflucht.regiments, teil);
          // Der verteidigende General zieht mit.
          if (genB) genB.provinceId = zuflucht.id;
        }
      }
      to.regiments = ueberlebendeA;
      to.siege = null;
      if (verteidigerId) {
        to.ownerId = attackerId;
        to.capturedTurn = state.turn;
        to.unrest = Math.min(100, to.unrest + 30);
      } else {
        to.ownerId = attackerId;
        to.capturedTurn = state.turn;
        to.unrest = Math.min(100, to.unrest + 12);
      }
      erobert = true;
      if (genA) genA.provinceId = toId;
    }
  } else {
    // Angriff abgewehrt - Reste kehren zurueck.
    to.regiments = ueberlebendeD;
    regimentsAdd(from.regiments, ueberlebendeA);
  }

  /* ---- Generäle lernen ---- */
  if (genA) {
    genA.xp += 10;
    if (angreiferGewinnt) genA.wins += 1; else genA.losses += 1;
    if (genA.xp >= 40 && genA.skill < 5) { genA.skill += 1; genA.xp = 0; }
  }
  if (genB) {
    genB.xp += 10;
    if (angreiferGewinnt) genB.losses += 1; else genB.wins += 1;
    if (genB.xp >= 40 && genB.skill < 5) { genB.skill += 1; genB.xp = 0; }
  }

  /* ---- Nachwirkungen ---- */
  angreifer.warExhaustion = Math.min(100, angreifer.warExhaustion + 1.6);
  if (verteidiger) {
    verteidiger.warExhaustion = Math.min(100, verteidiger.warExhaustion + 1.2);
    if (erobert) verteidiger.stability = Math.max(0, verteidiger.stability - 3);
    else angreifer.stability = Math.max(0, angreifer.stability - 1.5);
    changeRelation(state, attackerId, verteidigerId!, -6);
  }

  state.seq += 1;
  const bericht: BattleReport = {
    id: `b${state.seq}`,
    turn: state.turn,
    provinceId: toId,
    provinceName: to.name,
    attackerId,
    attackerName: angreifer.name,
    defenderId: verteidigerId,
    defenderName: verteidiger ? verteidiger.name : 'Ortsverteidigung',
    terrain: to.terrain,
    attackerRegiments: truppen,
    defenderRegiments: verteidigendeTruppen,
    attackPower: angriffskraft,
    defensePower: verteidigungskraft,
    factors: faktoren,
    attackerLosses: verlusteA,
    defenderLosses: verlusteD,
    attackerWon: angreiferGewinnt,
    captured: erobert,
    siegeStarted: belagerungBegonnen,
    retreated: zurueckgezogen,
    generalName: genA ? genA.name : null,
    note: belagerungBegonnen
      ? 'Das Feld ist gewonnen, die Festung hält. Die Belagerung hat begonnen - schweres Gerät beschleunigt sie.'
      : angreiferGewinnt
        ? `Der Verteidiger räumt das Gebiet${zurueckgezogen > 0 ? `; ${zurueckgezogen} Einheiten setzen sich ab` : ''}.`
        : 'Der Angriff ist abgewehrt. Die Reste kehren in die Ausgangsstellung zurueck.',
  };

  state.battleReports.unshift(bericht);
  if (state.battleReports.length > 60) state.battleReports.length = 60;
  state.rngState = rnd.state();

  return { report: bericht, captured: erobert };
}

/* ------------------------------------------------------------------ */
/* Belagerungen abarbeiten                                             */
/* ------------------------------------------------------------------ */

/** Läuft am Rundenende: Belagerungen schreiten fort oder brechen ab. */
export function processSieges(state: GameState, melde: (text: string) => void): void {
  for (const pid of state.provinceOrder) {
    const p = state.provinces[pid];
    if (!p.siege) continue;
    const belagerer = state.countries[p.siege.attackerId];
    if (!belagerer?.alive) { p.siege = null; continue; }

    // Steht noch Belagerungsvolk im Umland?
    const umland = connectedProvinceIds(state, pid)
      .map((id) => state.provinces[id])
      .filter((q) => q && q.ownerId === p.siege!.attackerId);
    const kraft = umland.reduce((s, q) => s + belagerungsKraft(q.regiments), 0);

    if (kraft <= 0) {
      p.siege = null;
      melde(`Die Belagerung von ${p.name} ist aufgehoben - der Belagerungsring ist leer.`);
      continue;
    }

    const general = umland
      .map((q) => generalInProvince(state, q.id, p.siege!.attackerId))
      .find((g) => g);
    let fortschritt = Math.min(45, 8 + kraft / Math.max(1, p.fortification * 2.5));
    if (general?.traits.includes('belagerung')) fortschritt *= 1.4;
    // Gut versorgte Festungen halten länger.
    fortschritt *= 1.3 - (p.supply / 100) * 0.6;

    p.siege.progress += fortschritt;
    p.supply = Math.max(5, p.supply - 8);

    if (p.siege.progress >= 100) {
      const verteidigerId = p.ownerId;
      p.regiments = {};
      p.ownerId = p.siege.attackerId;
      p.capturedTurn = state.turn;
      p.unrest = Math.min(100, p.unrest + 25);
      p.fortification = Math.max(0, p.fortification - 1);
      p.siege = null;
      melde(`${p.name} hat nach langer Belagerung kapituliert.`);
      if (verteidigerId) {
        const v = state.countries[verteidigerId];
        if (v) v.stability = Math.max(0, v.stability - 4);
      }
    }
  }
}

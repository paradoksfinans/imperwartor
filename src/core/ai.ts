/**
 * Die Gegner.
 *
 * Die KI erhält keine Sondermittel - sie spielt mit denselben Regeln wie der
 * Spieler. Ihre Staerke kommt aus der Reihenfolge, in der sie denkt:
 *
 *   1. Was ist bedroht?        -> Verteidigung sichern
 *   2. Was kann ich halten?    -> Nachschub an die Front, nicht ins Hinterland
 *   3. Wo ist der Gegner schwach? -> Angriff nur mit echtem Vorteil
 *   4. Wer wird zu stark?      -> Koalition bilden
 *
 * Die Persoenlichkeit verschiebt Gewichte, ersetzt aber nie das Urteil.
 */

import type { Country, GameState, Province, Regiments, TechFieldId, UnitId } from './types';
import {
  BUILDING_ORDER, BUILDINGS, TECH_ORDER, UNITS, allianceOf, areAllied, areAtWar,
  armeeKapazitaet, buildingCost, connectedProvinceIds, countryArmy, getRelation, hasTreaty, maxRecruitment,
  powerScore, provincesOf, regimentsScale, regimentsTotal, sharesBorder, techCost,
  verfuegbareEinheiten,
} from './rules';
import { computeFinances } from './economy';
import { attackableTargets, estimatePower, moveRegiments, resolveBattle } from './combat';
import { declareWar, friedensSpielraum, applyPeace, endWar } from './diplomacy';
import type { Random } from './rng';

/* ------------------------------------------------------------------ */
/* Persoenlichkeiten                                                   */
/* ------------------------------------------------------------------ */

interface Profil {
  aggression: number;    // Neigung zum Krieg
  ausbau: number;        // Neigung zu Gebaeuden
  heer: number;          // Zielgroesse des Heeres
  diplomatie: number;    // Neigung zu Vertraegen
  vorsicht: number;      // Noetiger Vorteil vor einem Angriff
}

const PROFILE: Record<Country['personality'], Profil> = {
  aggressive:    { aggression: 1.35, ausbau: 0.75, heer: 1.30, diplomatie: 0.7, vorsicht: 1.02 },
  defensive:     { aggression: 0.55, ausbau: 1.10, heer: 1.10, diplomatie: 1.0, vorsicht: 1.45 },
  economic:      { aggression: 0.55, ausbau: 1.40, heer: 0.85, diplomatie: 1.2, vorsicht: 1.35 },
  diplomatic:    { aggression: 0.60, ausbau: 1.10, heer: 0.90, diplomatie: 1.5, vorsicht: 1.30 },
  expansionist:  { aggression: 1.25, ausbau: 0.90, heer: 1.25, diplomatie: 0.9, vorsicht: 1.10 },
  opportunistic: { aggression: 1.00, ausbau: 1.00, heer: 1.00, diplomatie: 1.1, vorsicht: 1.18 },
  isolationist:  { aggression: 0.30, ausbau: 1.25, heer: 0.95, diplomatie: 0.6, vorsicht: 1.60 },
  erratic:       { aggression: 1.15, ausbau: 0.95, heer: 1.05, diplomatie: 0.9, vorsicht: 1.05 },
};

/** Schwierigkeitsgrad wirkt auf die Guete der Entscheidungen, nicht auf Mittel. */
function koennen(state: GameState): number {
  return state.difficulty === 'easy' ? 0.68 : state.difficulty === 'hard' ? 1.0 : 0.87;
}

/* ------------------------------------------------------------------ */
/* Lagebeurteilung                                                     */
/* ------------------------------------------------------------------ */

interface Lage {
  eigene: Province[];
  front: Province[];            // eigene Gebiete mit feindlichem Nachbarn
  bedroht: Array<{ p: Province; gefahr: number }>;
  imKrieg: boolean;
  feinde: string[];
}

function beurteileLage(state: GameState, cid: string): Lage {
  const eigene = provincesOf(state, cid);
  const kriege = state.wars.filter((w) => w.sideA.includes(cid) || w.sideB.includes(cid));
  const feinde = new Set<string>();
  for (const w of kriege) {
    const gegen = w.sideA.includes(cid) ? w.sideB : w.sideA;
    for (const g of gegen) feinde.add(g);
  }

  const front: Province[] = [];
  const bedroht: Array<{ p: Province; gefahr: number }> = [];

  for (const p of eigene) {
    let feindkraft = 0;
    let hatFeind = false;
    for (const nid of connectedProvinceIds(state, p.id)) {
      const n = state.provinces[nid];
      if (!n || !n.ownerId || n.ownerId === cid) continue;
      if (areAllied(state, cid, n.ownerId)) continue;
      const feindlich = feinde.has(n.ownerId);
      if (feindlich) {
        hatFeind = true;
        feindkraft += regimentsTotal(n.regiments);
      } else if (getRelation(state, cid, n.ownerId) < -20) {
        feindkraft += regimentsTotal(n.regiments) * 0.3;
      }
    }
    if (hatFeind) front.push(p);
    const eigen = regimentsTotal(p.regiments) * (1 + p.fortification * 0.2);
    const gefahr = feindkraft - eigen;
    if (gefahr > 0) bedroht.push({ p, gefahr });
  }
  bedroht.sort((a, b) => b.gefahr - a.gefahr);

  return { eigene, front, bedroht, imKrieg: kriege.length > 0, feinde: [...feinde] };
}

/* ------------------------------------------------------------------ */
/* Wirtschaft und Ausbau                                               */
/* ------------------------------------------------------------------ */

function steuerUndForschung(state: GameState, c: Country, profil: Profil): void {
  const f = computeFinances(state, c.id);
  // Steuern nachjustieren: bei Defizit anheben, bei Unruhe senken.
  if (f.net < 0 && c.taxRate < 0.75) c.taxRate = Math.min(0.75, c.taxRate + 0.05);
  else if (f.net > 250 && c.stability < 60 && c.taxRate > 0.3) c.taxRate = Math.max(0.3, c.taxRate - 0.05);

  c.researchBudget = Math.max(0.05, Math.min(0.35, 0.2 * profil.ausbau));

  if (!c.research) {
    // Forschungsfeld nach aktueller Not wählen.
    const gewichte: Record<TechFieldId, number> = {
      military: 1.0 * (state.wars.some((w) => w.sideA.includes(c.id) || w.sideB.includes(c.id)) ? 1.8 : 1),
      economy: 1.2 * profil.ausbau,
      administration: 0.9,
      logistics: 0.8,
      defense: 0.9 * profil.vorsicht,
    };
    let bestes: TechFieldId = 'economy';
    let bester = -Infinity;
    for (const feld of TECH_ORDER) {
      if (c.tech[feld] >= 8) continue;
      const wert = gewichte[feld] / (1 + c.tech[feld] * 0.35);
      if (wert > bester) { bester = wert; bestes = feld; }
    }
    if (c.tech[bestes] < 8) {
      c.research = { field: bestes, progress: 0, cost: techCost(c.tech[bestes]) };
    }
  }
}

function baue(state: GameState, c: Country, profil: Profil, rnd: Random, kann: number): void {
  if (c.construction.length >= 2) return;
  if (c.gold < 400) return;
  if (!rnd.chance(0.7 * profil.ausbau * kann)) return;

  const eigene = provincesOf(state, c.id);
  if (!eigene.length) return;

  // Was fehlt am dringendsten?
  const lage = beurteileLage(state, c.id);
  let bestes: { p: Province; b: typeof BUILDING_ORDER[number]; wert: number } | null = null;

  for (const p of eigene) {
    const anFront = lage.front.some((q) => q.id === p.id);
    for (const b of BUILDING_ORDER) {
      const def = BUILDINGS[b];
      if (p.buildings[b] >= def.maxLevel) continue;
      if (def.needsPort && !p.isPort) continue;
      if (c.construction.some((x) => x.provinceId === p.id && x.building === b)) continue;
      const kosten = buildingCost(b, p.buildings[b], p, state.kostenFaktor);
      if (kosten > c.gold * 0.6) continue;

      let wert = 0;
      if (b === 'economy') wert = p.economy * 1.4 * profil.ausbau;
      else if (b === 'infrastructure') wert = p.economy * 0.9;
      else if (b === 'fortress') wert = (anFront ? 26 : 4) * profil.vorsicht;
      else if (b === 'barracks') wert = (anFront ? 16 : 8) * profil.heer;
      else if (b === 'research') wert = 13 * profil.ausbau;
      else if (b === 'port') wert = p.isPort ? 14 : 0;
      else if (b === 'granary') wert = p.unrest > 30 ? 18 : 6;
      wert = wert / (1 + p.buildings[b]) - kosten / 110;
      if (!bestes || wert > bestes.wert) bestes = { p, b, wert };
    }
  }

  if (bestes && bestes.wert > 0) {
    const kosten = buildingCost(bestes.b, bestes.p.buildings[bestes.b], bestes.p, state.kostenFaktor);
    c.gold -= kosten;
    state.seq += 1;
    c.construction.push({
      id: `bau${state.seq}`,
      provinceId: bestes.p.id,
      building: bestes.b,
      turnsLeft: BUILDINGS[bestes.b].buildTurns,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Heer                                                                */
/* ------------------------------------------------------------------ */

/**
 * Zielmischung eines Heeres je Technikstand.
 * Die KI hält sich daran, statt nur das billigste zu kaufen - sonst
 * bestuenden alle Heere aus Fußvolk und die Gattungen waeren wertlos.
 */
function zielMischung(c: Country): Partial<Record<UnitId, number>> {
  const t = c.tech.military;
  if (t <= 1) return { infantry: 0.62, archers: 0.30, cavalry: 0.08 };
  if (t <= 3) return { infantry: 0.48, archers: 0.22, cavalry: 0.20, siege: 0.10 };
  if (t <= 5) return { infantry: 0.46, cavalry: 0.18, artillery: 0.26, archers: 0.10 };
  return { infantry: 0.42, artillery: 0.24, armor: 0.26, cavalry: 0.08 };
}

/** Welche Gattung fehlt dem Heer am meisten - und passt ins Gelände? */
function waehleGattung(
  state: GameState, c: Country, p: Province, imKrieg: boolean, rnd: Random,
): UnitId {
  const moeglich = verfuegbareEinheiten(c).filter((u) => !UNITS[u].naval || p.isPort);
  if (!moeglich.length) return 'infantry';

  // Ist-Mischung im ganzen Reich bestimmen
  const ist: Partial<Record<UnitId, number>> = {};
  let gesamt = 0;
  for (const q of provincesOf(state, c.id)) {
    for (const u of moeglich) {
      const n = q.regiments[u] ?? 0;
      if (n) { ist[u] = (ist[u] ?? 0) + n; gesamt += n; }
    }
  }
  const ziel = zielMischung(c);

  let bestes: UnitId = 'infantry';
  let bester = -Infinity;
  for (const u of moeglich) {
    const def = UNITS[u];
    const sollAnteil = ziel[u] ?? 0.02;
    const istAnteil = gesamt > 0 ? (ist[u] ?? 0) / gesamt : 0;
    // Je größer die Luecke zur Zielmischung, desto dringender.
    let wert = (sollAnteil - istAnteil) * 100;
    // Gelände und Lage verschieben die Gewichte.
    wert *= def.terrainBonus[p.terrain] ?? 1;
    if ((u === 'siege' || u === 'artillery') && imKrieg) wert *= 1.4;
    if (u === 'navy') wert *= p.isPort ? 0.7 : 0;
    if (u === 'cavalry' && p.resource === 'horses') wert *= 1.3;
    // Teures nicht kaufen, wenn die Kasse knapp ist.
    if (def.gold > c.gold * 0.25) wert *= 0.3;
    wert *= rnd.spread(0.2);
    if (wert > bester) { bester = wert; bestes = u; }
  }
  return bestes;
}

function rekrutiere(state: GameState, c: Country, profil: Profil, rnd: Random): void {
  const lage = beurteileLage(state, c.id);
  // Die tragfaehige Größe ist die Richtschnur; im Krieg darf sie
  // ueberschritten werden, im Frieden lohnt sich das nicht.
  const kapazitaet = armeeKapazitaet(state, c.id);
  const ziel = kapazitaet * (lage.imKrieg ? 1.25 : 0.85) * c.traits.military * profil.heer;
  const vorhanden = countryArmy(state, c.id);
  if (vorhanden >= ziel) return;

  const reserve = lage.imKrieg ? 120 : 320;
  let budget = Math.max(0, c.gold - reserve);
  if (budget < 60) return;

  // Zuerst dort ausheben, wo es brennt; sonst wo am meisten Platz ist.
  const kandidaten = [...lage.eigene].sort((a, b) => {
    const aFront = lage.front.some((q) => q.id === a.id) ? 1 : 0;
    const bFront = lage.front.some((q) => q.id === b.id) ? 1 : 0;
    if (aFront !== bFront) return bFront - aFront;
    return maxRecruitment(b) - maxRecruitment(a);
  });

  for (const p of kandidaten) {
    if (budget < 60) break;
    const gattung = waehleGattung(state, c, p, lage.imKrieg, rnd);
    const def = UNITS[gattung];
    let preis = def.gold;
    if (p.resource === 'iron') preis *= 0.9;
    if (gattung === 'cavalry' && p.resource === 'horses') preis *= 0.8;
    preis *= 1 - p.buildings.barracks * 0.07;

    const platz = maxRecruitment(p);
    const bezahlbar = Math.floor(budget / preis);
    const menge = Math.min(platz, bezahlbar, 6);
    if (menge < 1) continue;
    if (c.manpower < menge * def.population) continue;

    p.regiments[gattung] = (p.regiments[gattung] ?? 0) + menge;
    const gesamtpreis = Math.round(preis * menge);
    c.gold -= gesamtpreis;
    budget -= gesamtpreis;
    c.manpower -= menge * def.population;
    p.population = Math.max(5000, p.population - menge * def.population * 0.25);
  }
}

/* ------------------------------------------------------------------ */
/* Bewegung: Nachschub an die Front                                    */
/* ------------------------------------------------------------------ */

function verlegeTruppen(state: GameState, c: Country, rnd: Random): void {
  const lage = beurteileLage(state, c.id);
  if (!lage.front.length) return;

  // Gebiete ohne Feindkontakt geben Truppen ab.
  const hinterland = lage.eigene.filter(
    (p) => !lage.front.some((f) => f.id === p.id) && regimentsTotal(p.regiments) > 2,
  );
  if (!hinterland.length) return;

  // Bedrohtestes Frontgebiet zuerst versorgen.
  const ziele = lage.bedroht.length
    ? lage.bedroht.map((b) => b.p)
    : [rnd.pick(lage.front)];

  for (const ziel of ziele.slice(0, 2)) {
    if (c.actionPoints < 1) return;
    // Nachbarn im Hinterland, die abgeben können
    const quellen = hinterland.filter((h) => connectedProvinceIds(state, h.id).includes(ziel.id));
    if (!quellen.length) continue;
    const quelle = quellen.sort((a, b) => regimentsTotal(b.regiments) - regimentsTotal(a.regiments))[0];
    const abgabe = regimentsScale(quelle.regiments, 0.7);
    if (regimentsTotal(abgabe) < 1) continue;
    const r = moveRegiments(state, quelle.id, ziel.id, abgabe);
    if (r.ok) c.actionPoints -= 1;
  }
}

/* ------------------------------------------------------------------ */
/* Angriff                                                             */
/* ------------------------------------------------------------------ */

function greifeAn(state: GameState, c: Country, profil: Profil, rnd: Random, kann: number): void {
  let versuche = 0;
  while (c.actionPoints >= 1 && versuche < 2) {
    versuche += 1;

    interface Zug { von: Province; nach: Province; truppen: Regiments; wert: number; }
    let bester: Zug | null = null;

    for (const p of provincesOf(state, c.id)) {
      const gesamt = regimentsTotal(p.regiments);
      if (gesamt < 2) continue;
      for (const zielId of attackableTargets(state, c.id, p.id)) {
        const ziel = state.provinces[zielId];
        if (!ziel) continue;

        // Wie viel schicken? Genug für den Sieg, aber nicht das Gebiet entbloessen.
        const anteil = ziel.ownerId ? 0.7 : 0.55;
        const truppen = regimentsScale(p.regiments, anteil);
        if (regimentsTotal(truppen) < 1) continue;

        const v = estimatePower(state, c.id, p, ziel, truppen);
        const vorteil = v.defense > 0 ? v.attack / v.defense : 99;
        if (vorteil < profil.vorsicht) continue;

        let wert = (vorteil - 1) * 10;
        wert += ziel.economy * 0.5;
        if (ziel.isCapital) wert += 20;
        if (!ziel.ownerId) wert += 8;                   // herrenlos ist billig
        if (ziel.coreOf === c.id) wert += 14;           // eigenes Kernland zurueck
        if (v.brauchtBelagerung) wert -= 12;            // dauert und bindet Truppen
        wert *= rnd.spread(0.12);

        if (!bester || wert > bester.wert) bester = { von: p, nach: ziel, truppen, wert };
      }
    }

    if (!bester || bester.wert <= 0 || !rnd.chance(kann)) return;
    resolveBattle(state, c.id, bester.von.id, bester.nach.id, bester.truppen);
    c.actionPoints -= 1;
  }
}

/* ------------------------------------------------------------------ */
/* Diplomatie der KI                                                   */
/* ------------------------------------------------------------------ */

/** Wer ist auf dem Weg, alle zu ueberrollen? */
function marktfuehrer(state: GameState): { id: string; vorsprung: number } | null {
  const werte = state.countryOrder
    .filter((id) => state.countries[id].alive)
    .map((id) => ({ id, p: powerScore(state, id) }))
    .sort((a, b) => b.p - a.p);
  if (werte.length < 3) return null;
  const schnitt = werte.slice(1).reduce((s, x) => s + x.p, 0) / (werte.length - 1);
  return { id: werte[0].id, vorsprung: werte[0].p / Math.max(1, schnitt) };
}

function diplomatie(state: GameState, c: Country, profil: Profil, rnd: Random, kann: number): void {
  if (state.turn < 6) return;

  const lage = beurteileLage(state, c.id);

  /* Frieden suchen, wenn der Krieg nicht läuft */
  for (const w of state.wars) {
    const aufA = w.sideA.includes(c.id);
    if (!aufA && !w.sideB.includes(c.id)) continue;
    const stand = aufA ? w.scoreA : -w.scoreA;
    const dauer = state.turn - w.startTurn;
    const willFrieden = stand < -20 || c.warExhaustion > 60 || (dauer > 20 && Math.abs(stand) < 15);
    if (!willFrieden || !rnd.chance(0.4)) continue;

    const gegner = (aufA ? w.sideB : w.sideA)[0];
    if (!gegner || !state.countries[gegner]?.alive) continue;

    if (stand > 20) {
      // Gewinner diktiert. Bei einem Unterwerfungskrieg und klarem Vorsprung
      // wird der Gegner Vasall statt nur Land abzutreten.
      const spielraum = friedensSpielraum(stand);
      const besetzt = (aufA ? w.occupiedByA : w.occupiedByB).slice(0, spielraum.gebiete);
      const eigenesZiel = aufA ? w.goalA : w.goalB;
      const unterwerfen = spielraum.vasall
        && (eigenesZiel === 'subjugation' || eigenesZiel === 'hegemony')
        && !state.countries[gegner].overlordId;
      state.seq += 1;
      applyPeace(state, {
        id: `p${state.seq}`, warId: w.id, fromId: c.id, toId: gegner,
        message: '', cededProvinces: unterwerfen ? [] : besetzt,
        reparations: spielraum.reparationen, vassalize: unterwerfen,
      }, () => {});
    } else if (state.countries[gegner].isPlayer) {
      // Dem Spieler wird ein Angebot vorgelegt, das er annehmen oder ablehnen kann.
      state.seq += 1;
      const spielraum = friedensSpielraum(-stand);
      const abzugeben = (aufA ? w.occupiedByB : w.occupiedByA).slice(0, spielraum.gebiete);
      state.pendingPeaceOffers.push({
        id: `p${state.seq}`, warId: w.id, fromId: gegner, toId: c.id,
        message: `${c.name} bietet Frieden an${abzugeben.length ? ` und tritt ${abzugeben.length} Gebiete ab` : ''}.`,
        cededProvinces: abzugeben, reparations: 0, vassalize: false,
      });
    } else {
      endWar(state, w, () => {});
    }
    return;
  }

  /* Verträge schließen */
  if (rnd.chance(0.3 * profil.diplomatie * kann)) {
    const nachbarn = state.countryOrder.filter(
      (id) => id !== c.id && state.countries[id].alive && !areAtWar(state, c.id, id)
        && sharesBorder(state, c.id, id),
    );
    const kandidat = nachbarn.find((id) => getRelation(state, c.id, id) > 20 && !hasTreaty(state, c.id, id, 'trade'));
    if (kandidat && c.politicalPower >= 15) {
      c.politicalPower -= 15;
      state.treaties.push({ type: 'trade', a: c.id, b: kandidat, until: 0 });
    }
  }

  /* Koalition gegen den Marktfuehrer */
  const fuehrer = marktfuehrer(state);
  if (fuehrer && fuehrer.id !== c.id && fuehrer.vorsprung > 2.2 && c.politicalPower >= 30
      && rnd.chance(0.25 * kann)) {
    const mitstreiter = state.countryOrder.find(
      (id) => id !== c.id && id !== fuehrer.id && state.countries[id].alive
        && !areAllied(state, c.id, id) && getRelation(state, c.id, id) > 10
        && getRelation(state, id, fuehrer.id) < 10,
    );
    if (mitstreiter) {
      c.politicalPower -= 30;
      const meins = allianceOf(state, c.id);
      if (meins) {
        if (!meins.memberIds.includes(mitstreiter)) meins.memberIds.push(mitstreiter);
      } else {
        state.seq += 1;
        state.alliances.push({
          id: `al${state.seq}`, name: `Bund gegen ${state.countries[fuehrer.id].name}`,
          leaderId: c.id, memberIds: [c.id, mitstreiter], founded: state.turn,
        });
      }
    }
  }

  /* Schwache Nachbarn friedlich unterwerfen - der zweite Weg zu Vasallen
     neben dem Diktatfrieden. */
  if (c.politicalPower >= 50 && rnd.chance(0.3 * kann)) {
    const meine = powerScore(state, c.id);
    const schwach = state.countryOrder.find((id) => {
      if (id === c.id || !state.countries[id].alive) return false;
      if (state.countries[id].overlordId) return false;
      if (areAtWar(state, c.id, id) || !sharesBorder(state, c.id, id)) return false;
      if (meine / Math.max(1, powerScore(state, id)) < 2.8) return false;
      return getRelation(state, c.id, id) > 10 || state.countries[id].stability < 40;
    });
    if (schwach) {
      c.politicalPower -= 50;
      state.countries[schwach].overlordId = c.id;
      return;
    }
  }

  /* Krieg erklären */
  if (lage.imKrieg || c.politicalPower < 25 || c.stability < 35) return;
  if (!rnd.chance(0.45 * profil.aggression * kann)) return;

  const meineMacht = powerScore(state, c.id);
  const ziele = state.countryOrder
    .filter((id) => {
      if (id === c.id || !state.countries[id].alive) return false;
      if (areAllied(state, c.id, id) || areAtWar(state, c.id, id)) return false;
      if (hasTreaty(state, c.id, id, 'truce') || hasTreaty(state, c.id, id, 'nonAggression')) return false;
      if (state.countries[id].overlordId === c.id) return false;
      if (!sharesBorder(state, c.id, id)) return false;
      // Nicht auf ein ohnehin bedraengtes Land eindreschen.
      const angreifer = state.wars.filter((w) => w.sideA.includes(id) || w.sideB.includes(id)).length;
      if (angreifer >= 2) return false;
      return getRelation(state, c.id, id) < 25;
    })
    .map((id) => ({ id, verhaeltnis: meineMacht / Math.max(1, powerScore(state, id)) }))
    .filter((e) => e.verhaeltnis > (c.personality === 'aggressive' ? 1.05 : 1.25))
    .sort((a, b) => b.verhaeltnis - a.verhaeltnis);

  if (!ziele.length) return;
  const opfer = ziele[0];
  c.politicalPower -= 25;
  // Kriegsziel passend zur Lage
  const hatKerngebiete = provincesOf(state, opfer.id).some((p) => p.coreOf === c.id);
  const ziel = hatKerngebiete ? 'liberate' : opfer.verhaeltnis > 3 ? 'subjugation' : 'conquest';
  declareWar(state, c.id, opfer.id, ziel);
}

/* ------------------------------------------------------------------ */
/* Generäle einsetzen                                                 */
/* ------------------------------------------------------------------ */

function ordneGeneraele(state: GameState, c: Country): void {
  const lage = beurteileLage(state, c.id);
  const eigeneGeneraele = Object.values(state.generals).filter((g) => g.countryId === c.id);
  if (!eigeneGeneraele.length) return;

  // Die staerksten Heere bekommen die besten Generäle.
  const wichtig = [...lage.eigene]
    .sort((a, b) => regimentsTotal(b.regiments) - regimentsTotal(a.regiments))
    .slice(0, eigeneGeneraele.length);
  const sortiert = [...eigeneGeneraele].sort((a, b) => b.skill - a.skill);

  for (let i = 0; i < sortiert.length; i++) {
    const g = sortiert[i];
    const ziel = wichtig[i];
    if (!ziel) continue;
    // Nur umsetzen, wenn der General nicht schon sinnvoll steht.
    const steht = g.provinceId ? state.provinces[g.provinceId] : null;
    if (steht && steht.ownerId === c.id && regimentsTotal(steht.regiments) > 0) continue;
    g.provinceId = ziel.id;
  }
}

/* ------------------------------------------------------------------ */
/* Ein KI-Zug                                                          */
/* ------------------------------------------------------------------ */

export function runAiTurn(state: GameState, countryId: string, rnd: Random): void {
  const c = state.countries[countryId];
  if (!c || !c.alive || c.isPlayer) return;

  const profil = PROFILE[c.personality] ?? PROFILE.opportunistic;
  const kann = koennen(state);

  steuerUndForschung(state, c, profil);
  baue(state, c, profil, rnd, kann);
  rekrutiere(state, c, profil, rnd);
  ordneGeneraele(state, c);
  verlegeTruppen(state, c, rnd);
  greifeAn(state, c, profil, rnd, kann);
  diplomatie(state, c, profil, rnd, kann);
}

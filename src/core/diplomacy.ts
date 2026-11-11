/**
 * Diplomatie: Beziehungen, Verträge, Bündnisse, Krieg und Frieden.
 *
 * Ein Krieg beginnt hier nie nebenbei, sondern immer durch eine Erklaerung.
 * Frieden kostet etwas, das zum Kriegserfolg passt: Wer kaum vorankommt, kann
 * keine Gebiete fordern.
 */

import type { GameState, PeaceOffer, War, WarGoalId } from './types';
import {
  allianceOf, areAllied, areAtWar, changeRelation, countryArmy, getRelation,
  hasTreaty, isVassalOf, powerScore, provincesOf, setRelation, vassalsOf, warBetween,
} from './rules';
import { createRandom } from './rng';

/* ------------------------------------------------------------------ */
/* Diplomatische Aktionen                                              */
/* ------------------------------------------------------------------ */

export type DiplomacyActionId =
  | 'improve' | 'insult' | 'trade' | 'nonAggression' | 'defensive' | 'passage'
  | 'alliance' | 'joinWar' | 'declareWar' | 'offerPeace' | 'gift'
  | 'demandTribute' | 'vassalize' | 'releaseVassal' | 'guarantee' | 'spy'
  | 'sabotage' | 'aufwiegeln' | 'technikDiebstahl' | 'gegenspionage';

export interface DiplomacyOption {
  id: DiplomacyActionId;
  label: string;
  hint: string;
  politicalPower: number;
  gold: number;
  /** Gruppierung in der Oberflaeche. */
  gruppe: 'beziehung' | 'vertrag' | 'krieg' | 'macht' | 'verdeckt';
  /** Mindestmass an Spionagewissen, das die Aktion voraussetzt. */
  wissen?: number;
}

export const DIPLOMACY_OPTIONS: DiplomacyOption[] = [
  { id: 'improve',       label: 'Beziehungen verbessern', hint: 'Gesandte und Geschenke heben das Verhältnis.', politicalPower: 10, gold: 120, gruppe: 'beziehung' },
  { id: 'insult',        label: 'Zurechtweisen',          hint: 'Senkt das Verhältnis, schafft aber Ansehen im Inneren.', politicalPower: 5, gold: 0, gruppe: 'beziehung' },
  { id: 'gift',          label: 'Geld senden',            hint: '250 Gold als Geschenk - wirkt stark auf das Verhältnis.', politicalPower: 0, gold: 250, gruppe: 'beziehung' },
  { id: 'spy',           label: 'Spione entsenden',       hint: 'Deckt Heeresstärke und Absichten auf.', politicalPower: 12, gold: 180, gruppe: 'macht' },

  { id: 'trade',         label: 'Handelsabkommen',        hint: 'Beide Seiten gewinnen Handelseinnahmen.', politicalPower: 15, gold: 0, gruppe: 'vertrag' },
  { id: 'nonAggression', label: 'Nichtangriffspakt',      hint: 'Beide verzichten für 20 Runden auf Angriffe.', politicalPower: 20, gold: 0, gruppe: 'vertrag' },
  { id: 'passage',       label: 'Durchmarschrecht',       hint: 'Erlaubt das Durchqueren fremder Gebiete.', politicalPower: 18, gold: 100, gruppe: 'vertrag' },
  { id: 'defensive',     label: 'Verteidigungsbündnis',  hint: 'Beistand, wenn einer angegriffen wird.', politicalPower: 28, gold: 0, gruppe: 'vertrag' },
  { id: 'alliance',      label: 'Bündnis gründen',      hint: 'Gemeinsames Bündnis mit Beistandspflicht.', politicalPower: 35, gold: 0, gruppe: 'vertrag' },
  { id: 'guarantee',     label: 'Unabhängigkeit garantieren', hint: 'Wer dieses Land angreift, bekommt es mit dir zu tun.', politicalPower: 22, gold: 0, gruppe: 'vertrag' },

  { id: 'declareWar',    label: 'Krieg erklären',        hint: 'Beginnt offiziell einen Krieg. Kriegsziel wählbar.', politicalPower: 25, gold: 0, gruppe: 'krieg' },
  { id: 'joinWar',       label: 'Bündnis zum Krieg rufen', hint: 'Ruft Verbündete in einen laufenden Krieg.', politicalPower: 30, gold: 0, gruppe: 'krieg' },
  { id: 'offerPeace',    label: 'Frieden anbieten',       hint: 'Beendet den Krieg zu Bedingungen nach Kriegserfolg.', politicalPower: 15, gold: 0, gruppe: 'krieg' },

  { id: 'demandTribute', label: 'Tribut fordern',         hint: 'Verlangt Gold - gelingt nur gegen Schwächere.', politicalPower: 25, gold: 0, gruppe: 'macht' },
  { id: 'vassalize',     label: 'Vasallisierung fordern', hint: 'Unterwirft ein deutlich schwächeres Land.', politicalPower: 50, gold: 0, gruppe: 'macht' },
  { id: 'releaseVassal', label: 'Vasall freilassen',      hint: 'Entlässt einen Vasallen in die Unabhängigkeit.', politicalPower: 10, gold: 0, gruppe: 'macht' },

  /* Verdeckte Mittel. Sie wirken ohne Kriegserklärung, setzen aber
     Spionagewissen voraus und können auffliegen. Wer erwischt wird, zahlt
     mit dem Verhältnis - zu allen, nicht nur zum Ziel. */
  { id: 'gegenspionage',    label: 'Gegenspionage',        hint: 'Enttarnt fremde Agenten im eigenen Land und senkt deren Wissen.', politicalPower: 14, gold: 150, gruppe: 'verdeckt' },
  { id: 'sabotage',         label: 'Sabotage',             hint: 'Beschädigt Befestigung und Vorräte in einem Grenzgebiet.', politicalPower: 22, gold: 260, gruppe: 'verdeckt', wissen: 35 },
  { id: 'aufwiegeln',       label: 'Unruhe schüren',       hint: 'Treibt die Unzufriedenheit im Zielland nach oben.', politicalPower: 26, gold: 320, gruppe: 'verdeckt', wissen: 45 },
  { id: 'technikDiebstahl', label: 'Baupläne stehlen',     hint: 'Bringt Forschungsfortschritt - wenn der Gegner weiter ist.', politicalPower: 30, gold: 380, gruppe: 'verdeckt', wissen: 60 },
];

export const WAR_GOALS: Array<{ id: WarGoalId; name: string; hint: string }> = [
  { id: 'conquest',    name: 'Eroberung',     hint: 'Gebiete fordern. Der Normalfall.' },
  { id: 'liberate',    name: 'Rückeroberung', hint: 'Eigene Kerngebiete zurückholen - kostet weniger Ansehen.' },
  { id: 'subjugation', name: 'Unterwerfung',  hint: 'Den Gegner zum Vasallen machen.' },
  { id: 'humiliate',   name: 'Demütigung',   hint: 'Reparationen und Ansehen statt Land.' },
  { id: 'hegemony',    name: 'Vorherrschaft', hint: 'Vollständige Unterwerfung - teuer und riskant.' },
];

export interface DiplomacyResult {
  ok: boolean;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

function kosten(state: GameState, countryId: string, opt: DiplomacyOption): boolean {
  const c = state.countries[countryId];
  return c.politicalPower >= opt.politicalPower && c.gold >= opt.gold;
}

function bezahle(state: GameState, countryId: string, opt: DiplomacyOption): void {
  const c = state.countries[countryId];
  c.politicalPower -= opt.politicalPower;
  c.gold -= opt.gold;
}

/** Wie bereit ist die KI, ein Angebot anzunehmen? */
function annahmeWert(state: GameState, von: string, an: string): number {
  const beziehung = getRelation(state, von, an);
  const machtVon = powerScore(state, von);
  const machtAn = powerScore(state, an);
  const verhaeltnis = machtVon / Math.max(1, machtAn);
  return beziehung + (verhaeltnis - 1) * 30;
}

export function addTreaty(state: GameState, a: string, b: string, type: any, dauer: number): void {
  state.treaties = state.treaties.filter(
    (t) => !(t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a))),
  );
  state.treaties.push({ type, a, b, until: dauer > 0 ? state.turn + dauer : 0 });
}

/* ------------------------------------------------------------------ */
/* Krieg                                                               */
/* ------------------------------------------------------------------ */

export function declareWar(
  state: GameState, angreifer: string, verteidiger: string, ziel: WarGoalId = 'conquest',
): War | null {
  if (areAtWar(state, angreifer, verteidiger)) return null;

  // Bündnispartner werden mit hineingezogen.
  const seiteA = new Set<string>([angreifer, ...vassalsOf(state, angreifer)]);
  const seiteB = new Set<string>([verteidiger, ...vassalsOf(state, verteidiger)]);

  const alA = allianceOf(state, angreifer);
  if (alA) for (const m of alA.memberIds) if (state.countries[m]?.alive) seiteA.add(m);
  const alB = allianceOf(state, verteidiger);
  if (alB) for (const m of alB.memberIds) if (state.countries[m]?.alive) seiteB.add(m);

  // Verteidigungsbuendnisse des Verteidigers
  for (const t of state.treaties) {
    if (t.type !== 'defensive') continue;
    if (t.a === verteidiger && state.countries[t.b]?.alive) seiteB.add(t.b);
    if (t.b === verteidiger && state.countries[t.a]?.alive) seiteB.add(t.a);
  }

  // Niemand kann auf beiden Seiten stehen - die eigene Seite hat Vorrang.
  for (const id of seiteA) seiteB.delete(id);

  state.seq += 1;
  const war: War = {
    id: `war${state.seq}`,
    sideA: [...seiteA],
    sideB: [...seiteB],
    scoreA: 0,
    startTurn: state.turn,
    goalA: ziel,
    goalB: 'liberate',
    occupiedByA: [],
    occupiedByB: [],
  };
  state.wars.push(war);

  changeRelation(state, angreifer, verteidiger, -45);
  // Der Rest der Welt nimmt Anstoss - ausser bei Rückeroberung.
  const ansehenskosten = ziel === 'liberate' ? -2 : ziel === 'hegemony' ? -12 : -6;
  for (const id of state.countryOrder) {
    if (id === angreifer || seiteA.has(id)) continue;
    changeRelation(state, angreifer, id, ansehenskosten);
  }
  // Nichtangriffspakte brechen
  state.treaties = state.treaties.filter(
    (t) => !(['nonAggression', 'trade', 'passage'].includes(t.type)
      && ((t.a === angreifer && t.b === verteidiger) || (t.a === verteidiger && t.b === angreifer))),
  );
  return war;
}

/** Berechnet den Kriegsfortschritt neu. */
export function updateWarScores(state: GameState): void {
  for (const war of state.wars) {
    let punkte = 0;
    for (const pid of war.occupiedByA) {
      const p = state.provinces[pid];
      punkte += p?.isCapital ? 14 : 5;
    }
    for (const pid of war.occupiedByB) {
      const p = state.provinces[pid];
      punkte -= p?.isCapital ? 14 : 5;
    }
    // Lange Kriege zehren beide Seiten aus und naehern das Ergebnis an.
    const dauer = state.turn - war.startTurn;
    if (dauer > 25) punkte *= 0.95;
    war.scoreA = Math.max(-100, Math.min(100, punkte));
  }
}

/** Was darf der Sieger fordern? Hängt am Kriegsfortschritt. */
export function friedensSpielraum(score: number): {
  gebiete: number; reparationen: number; vasall: boolean;
} {
  const s = Math.abs(score);
  return {
    gebiete: s >= 70 ? 5 : s >= 45 ? 3 : s >= 20 ? 1 : 0,
    reparationen: Math.round(s * 14),
    vasall: s >= 60,
  };
}

export function endWar(state: GameState, war: War, melde: (t: string) => void): void {
  state.wars = state.wars.filter((w) => w.id !== war.id);
  for (const a of war.sideA) {
    for (const b of war.sideB) {
      addTreaty(state, a, b, 'truce', 12);
      changeRelation(state, a, b, 20);
    }
  }
  melde('Der Krieg ist beendet. Ein Waffenstillstand gilt für 12 Runden.');
}

/** Setzt ein Friedensangebot um. */
export function applyPeace(
  state: GameState, offer: PeaceOffer, melde: (t: string) => void,
): void {
  const war = state.wars.find((w) => w.id === offer.warId);
  if (!war) return;
  const empfaenger = state.countries[offer.toId];
  const sender = state.countries[offer.fromId];
  if (!empfaenger || !sender) return;

  for (const pid of offer.cededProvinces) {
    const p = state.provinces[pid];
    if (!p) continue;
    p.ownerId = offer.fromId;
    p.capturedTurn = state.turn;
    p.unrest = Math.min(100, p.unrest + 25);
    p.siege = null;
  }
  if (offer.reparations > 0) {
    const betrag = Math.min(empfaenger.gold, offer.reparations);
    empfaenger.gold -= betrag;
    sender.gold += betrag;
  }
  if (offer.vassalize) {
    empfaenger.overlordId = offer.fromId;
    melde(`${empfaenger.name} ist nun Vasall von ${sender.name}.`);
  }
  endWar(state, war, melde);
}

/* ------------------------------------------------------------------ */
/* Ausfuehrung einer diplomatischen Aktion                             */
/* ------------------------------------------------------------------ */

export function performDiplomacy(
  state: GameState,
  akteurId: string,
  zielId: string,
  aktion: DiplomacyActionId,
  melde: (t: string) => void,
  kriegsziel: WarGoalId = 'conquest',
): DiplomacyResult {
  const opt = DIPLOMACY_OPTIONS.find((o) => o.id === aktion);
  if (!opt) return { ok: false, message: 'Unbekannte Aktion.' };
  const akteur = state.countries[akteurId];
  const ziel = state.countries[zielId];
  if (!akteur || !ziel || !ziel.alive) return { ok: false, message: 'Dieses Land gibt es nicht mehr.' };
  if (!kosten(state, akteurId, opt)) {
    return { ok: false, message: 'Dafür fehlen politische Macht oder Gold.' };
  }

  const bereitschaft = annahmeWert(state, akteurId, zielId);

  switch (aktion) {
    case 'improve':
      bezahle(state, akteurId, opt);
      changeRelation(state, akteurId, zielId, 12);
      return { ok: true, message: `Das Verhältnis zu ${ziel.name} hat sich verbessert.` };

    case 'insult':
      bezahle(state, akteurId, opt);
      changeRelation(state, akteurId, zielId, -18);
      akteur.stability = Math.min(100, akteur.stability + 2);
      return { ok: true, message: `${ziel.name} wurde zurechtgewiesen.` };

    case 'gift':
      bezahle(state, akteurId, opt);
      ziel.gold += 250;
      changeRelation(state, akteurId, zielId, 20);
      return { ok: true, message: `${ziel.name} nimmt das Geschenk an.` };

    case 'spy': {
      bezahle(state, akteurId, opt);
      akteur.intel[zielId] = Math.min(100, (akteur.intel[zielId] ?? 0) + 45);
      changeRelation(state, akteurId, zielId, -4);
      return { ok: true, message: `Spione berichten aus ${ziel.name}. Heeresstärke und Absichten sind nun einsehbar.` };
    }

    /* ---- Verdeckte Mittel ----
       Alle vier teilen dieselbe Logik: Spionagewissen ist Voraussetzung und
       zugleich Erfolgsaussicht. Gelingt der Schlag, wirkt er sofort; fliegt
       er auf, kostet er Ansehen bei allen Laendern. Dadurch bleibt Spionage
       eine Abwaegung und wird nicht zum Selbstlaeufer. */
    case 'gegenspionage': {
      bezahle(state, akteurId, opt);
      const rnd = createRandom(state.rngState);
      let enttarnt = 0;
      for (const fremd of state.countryOrder) {
        if (fremd === akteurId) continue;
        const wissen = state.countries[fremd]?.intel?.[akteurId] ?? 0;
        if (wissen <= 0) continue;
        state.countries[fremd].intel[akteurId] = Math.max(0, wissen - rnd.int(25, 45));
        enttarnt++;
      }
      state.rngState = rnd.state();
      return {
        ok: true,
        message: enttarnt
          ? `Gegenspionage erfolgreich - in ${enttarnt} Ländern wurden Agenten enttarnt.`
          : 'Keine fremden Agenten gefunden. Die Mittel waren gut angelegt.',
      };
    }

    case 'sabotage': {
      const wissen = akteur.intel[zielId] ?? 0;
      if (wissen < (opt.wissen ?? 0)) {
        return { ok: false, message: `Zu wenig Spionagewissen über ${ziel.name}. Entsende zuerst Spione.` };
      }
      const rnd = createRandom(state.rngState);
      bezahle(state, akteurId, opt);
      // Ein Grenzgebiet treffen: dort nuetzt der Schaden am meisten.
      const eigene = new Set(provincesOf(state, akteurId).map((p) => p.id));
      const grenzgebiete = provincesOf(state, zielId).filter(
        (p) => p.neighbors.some((n) => eigene.has(n)),
      );
      const auswahl = (grenzgebiete.length ? grenzgebiete : provincesOf(state, zielId))
        .sort((a, b) => (b.fortification + b.supply / 50) - (a.fortification + a.supply / 50))[0];
      if (!auswahl) {
        state.rngState = rnd.state();
        return { ok: false, message: `${ziel.name} hat kein erreichbares Gebiet.` };
      }
      const gelungen = rnd.chance(0.45 + wissen / 220);
      state.rngState = rnd.state();
      if (!gelungen) {
        changeRelation(state, akteurId, zielId, -18);
        for (const o of state.countryOrder) {
          if (o !== akteurId && o !== zielId) changeRelation(state, akteurId, o, -4);
        }
        akteur.intel[zielId] = Math.max(0, wissen - 25);
        return { ok: false, message: `Die Sabotage in ${auswahl.name} ist aufgeflogen. Der Ruf leidet.` };
      }
      const vorher = auswahl.fortification;
      auswahl.fortification = Math.max(0, auswahl.fortification - 1);
      auswahl.supply = Math.max(10, auswahl.supply - 25);
      auswahl.unrest = Math.min(100, auswahl.unrest + 6);
      changeRelation(state, akteurId, zielId, -6);
      return {
        ok: true,
        message: `Sabotage in ${auswahl.name}: Versorgung gestört`
          + (vorher > 0 ? ', Befestigung beschädigt.' : '.'),
      };
    }

    case 'aufwiegeln': {
      const wissen = akteur.intel[zielId] ?? 0;
      if (wissen < (opt.wissen ?? 0)) {
        return { ok: false, message: `Zu wenig Spionagewissen über ${ziel.name}.` };
      }
      const rnd = createRandom(state.rngState);
      bezahle(state, akteurId, opt);
      const gelungen = rnd.chance(0.4 + wissen / 250);
      state.rngState = rnd.state();
      if (!gelungen) {
        changeRelation(state, akteurId, zielId, -20);
        for (const o of state.countryOrder) {
          if (o !== akteurId && o !== zielId) changeRelation(state, akteurId, o, -5);
        }
        return { ok: false, message: `Die Aufwiegler in ${ziel.name} wurden gefasst. Ein Skandal.` };
      }
      // Unzufriedene Gebiete zuerst: dort zuendet die Saat am ehesten.
      const gebiete = provincesOf(state, zielId).sort((a, b) => b.unrest - a.unrest);
      for (const p of gebiete.slice(0, 3)) p.unrest = Math.min(100, p.unrest + 14);
      ziel.stability = Math.max(0, ziel.stability - 5);
      changeRelation(state, akteurId, zielId, -8);
      return {
        ok: true,
        message: `In ${ziel.name} gärt es: Unruhe in ${Math.min(3, gebiete.length)} Gebieten gestiegen.`,
      };
    }

    case 'technikDiebstahl': {
      const wissen = akteur.intel[zielId] ?? 0;
      if (wissen < (opt.wissen ?? 0)) {
        return { ok: false, message: `Zu wenig Spionagewissen über ${ziel.name}.` };
      }
      // Nur lohnend, wo der Gegner tatsaechlich voraus ist.
      const felder = (Object.keys(ziel.tech) as Array<keyof typeof ziel.tech>)
        .filter((f) => ziel.tech[f] > akteur.tech[f]);
      if (!felder.length) {
        return { ok: false, message: `${ziel.name} ist nirgends weiter als du. Es gibt nichts zu holen.` };
      }
      const rnd = createRandom(state.rngState);
      bezahle(state, akteurId, opt);
      const gelungen = rnd.chance(0.35 + wissen / 230);
      const feld = felder[rnd.int(0, felder.length - 1)];
      state.rngState = rnd.state();
      if (!gelungen) {
        changeRelation(state, akteurId, zielId, -22);
        akteur.intel[zielId] = Math.max(0, wissen - 35);
        return { ok: false, message: `Der Diebstahl in ${ziel.name} schlug fehl. Die Agenten sind verloren.` };
      }
      if (akteur.research && akteur.research.field === feld) {
        akteur.research.progress += akteur.research.cost * 0.4;
      } else {
        akteur.tech[feld] += 1;
      }
      changeRelation(state, akteurId, zielId, -12);
      return { ok: true, message: `Baupläne aus ${ziel.name} erbeutet - Fortschritt im Bereich ${feld}.` };
    }

    case 'trade':
      if (areAtWar(state, akteurId, zielId)) return { ok: false, message: 'Im Krieg wird nicht gehandelt.' };
      if (bereitschaft < -10) return { ok: false, message: `${ziel.name} lehnt ein Handelsabkommen ab.` };
      bezahle(state, akteurId, opt);
      addTreaty(state, akteurId, zielId, 'trade', 0);
      changeRelation(state, akteurId, zielId, 10);
      return { ok: true, message: `Handelsabkommen mit ${ziel.name} geschlossen.` };

    case 'nonAggression':
      if (areAtWar(state, akteurId, zielId)) return { ok: false, message: 'Erst muss der Krieg enden.' };
      if (bereitschaft < 5) return { ok: false, message: `${ziel.name} sieht keinen Anlass für einen Pakt.` };
      bezahle(state, akteurId, opt);
      addTreaty(state, akteurId, zielId, 'nonAggression', 20);
      changeRelation(state, akteurId, zielId, 8);
      return { ok: true, message: `Nichtangriffspakt mit ${ziel.name} für 20 Runden.` };

    case 'passage':
      if (bereitschaft < 10) return { ok: false, message: `${ziel.name} verweigert den Durchmarsch.` };
      bezahle(state, akteurId, opt);
      addTreaty(state, akteurId, zielId, 'passage', 25);
      return { ok: true, message: `${ziel.name} gewährt Durchmarschrecht.` };

    case 'defensive':
      if (bereitschaft < 25) return { ok: false, message: `${ziel.name} will sich nicht binden.` };
      bezahle(state, akteurId, opt);
      addTreaty(state, akteurId, zielId, 'defensive', 0);
      changeRelation(state, akteurId, zielId, 15);
      return { ok: true, message: `Verteidigungsbündnis mit ${ziel.name}.` };

    case 'guarantee':
      bezahle(state, akteurId, opt);
      addTreaty(state, akteurId, zielId, 'defensive', 0);
      changeRelation(state, akteurId, zielId, 18);
      return { ok: true, message: `Du garantierst die Unabhängigkeit von ${ziel.name}.` };

    case 'alliance': {
      if (bereitschaft < 35) return { ok: false, message: `${ziel.name} lehnt ein Bündnis ab.` };
      bezahle(state, akteurId, opt);
      const meins = allianceOf(state, akteurId);
      if (meins) {
        if (!meins.memberIds.includes(zielId)) meins.memberIds.push(zielId);
      } else {
        state.seq += 1;
        state.alliances.push({
          id: `al${state.seq}`,
          name: `Bund von ${akteur.name}`,
          leaderId: akteurId,
          memberIds: [akteurId, zielId],
          founded: state.turn,
        });
      }
      changeRelation(state, akteurId, zielId, 25);
      return { ok: true, message: `${ziel.name} tritt dem Bündnis bei.` };
    }

    case 'joinWar': {
      const krieg = state.wars.find((w) => w.sideA.includes(akteurId) || w.sideB.includes(akteurId));
      if (!krieg) return { ok: false, message: 'Du führst derzeit keinen Krieg.' };
      if (!areAllied(state, akteurId, zielId)) return { ok: false, message: `${ziel.name} ist nicht verbündet.` };
      if (bereitschaft < 20) return { ok: false, message: `${ziel.name} folgt dem Ruf nicht.` };
      bezahle(state, akteurId, opt);
      const seite = krieg.sideA.includes(akteurId) ? krieg.sideA : krieg.sideB;
      if (!seite.includes(zielId)) seite.push(zielId);
      return { ok: true, message: `${ziel.name} tritt dem Krieg bei.` };
    }

    case 'declareWar': {
      if (hasTreaty(state, akteurId, zielId, 'truce')) {
        return { ok: false, message: 'Ein Waffenstillstand verbietet das noch.' };
      }
      if (hasTreaty(state, akteurId, zielId, 'nonAggression')) {
        return { ok: false, message: 'Ein Nichtangriffspakt steht dem entgegen. Erst kündigen.' };
      }
      if (isVassalOf(state, akteurId, zielId)) {
        return { ok: false, message: 'Ein Vasall kann seinem Lehnsherrn nicht einfach den Krieg erklären.' };
      }
      bezahle(state, akteurId, opt);
      const krieg = declareWar(state, akteurId, zielId, kriegsziel);
      if (!krieg) return { ok: false, message: 'Ihr befindet euch bereits im Krieg.' };
      const gegner = krieg.sideB.map((id) => state.countries[id]?.name).filter(Boolean).join(', ');
      melde(`Krieg erklärt: ${akteur.name} gegen ${gegner}.`);
      return { ok: true, message: `Krieg gegen ${ziel.name} erklärt.` };
    }

    case 'offerPeace': {
      const krieg = warBetween(state, akteurId, zielId);
      if (!krieg) return { ok: false, message: 'Ihr führt keinen Krieg.' };
      bezahle(state, akteurId, opt);

      const aufSeiteA = krieg.sideA.includes(akteurId);
      const eigenerStand = aufSeiteA ? krieg.scoreA : -krieg.scoreA;
      const spielraum = friedensSpielraum(eigenerStand);

      // Der Gegner nimmt an, wenn er deutlich hinten liegt oder muede ist.
      const gegnerMuede = ziel.warExhaustion > 55;
      const annehmen = eigenerStand > 25 || gegnerMuede || (eigenerStand > -10 && bereitschaft > 20);

      if (!annehmen) {
        return { ok: false, message: `${ziel.name} lehnt ab und will weiterkämpfen.` };
      }

      if (eigenerStand > 20) {
        // Fordern: besetzte Gebiete des Gegners behalten
        const besetzt = (aufSeiteA ? krieg.occupiedByA : krieg.occupiedByB)
          .filter((pid) => state.provinces[pid])
          .slice(0, spielraum.gebiete);
        state.seq += 1;
        applyPeace(state, {
          id: `peace${state.seq}`, warId: krieg.id, fromId: akteurId, toId: zielId,
          message: '', cededProvinces: besetzt, reparations: spielraum.reparationen,
          vassalize: false,
        }, melde);
        return { ok: true, message: `Frieden zu deinen Bedingungen: ${besetzt.length} Gebiete und ${spielraum.reparationen} Gold.` };
      }

      endWar(state, krieg, melde);
      return { ok: true, message: `Frieden ohne Gebietsveränderung mit ${ziel.name}.` };
    }

    case 'demandTribute': {
      const verhaeltnis = powerScore(state, akteurId) / Math.max(1, powerScore(state, zielId));
      if (verhaeltnis < 1.6) return { ok: false, message: `${ziel.name} ist zu stark für solche Forderungen.` };
      bezahle(state, akteurId, opt);
      const betrag = Math.round(Math.min(ziel.gold * 0.3, 600));
      ziel.gold -= betrag;
      akteur.gold += betrag;
      changeRelation(state, akteurId, zielId, -25);
      return { ok: true, message: `${ziel.name} zahlt ${betrag} Gold Tribut.` };
    }

    case 'vassalize': {
      const verhaeltnis = powerScore(state, akteurId) / Math.max(1, powerScore(state, zielId));
      if (verhaeltnis < 2.5) return { ok: false, message: `${ziel.name} ist dafür viel zu stark.` };
      if (getRelation(state, akteurId, zielId) < 20 && ziel.stability > 40) {
        return { ok: false, message: `${ziel.name} weigert sich - zu wenig Vertrauen.` };
      }
      bezahle(state, akteurId, opt);
      ziel.overlordId = akteurId;
      changeRelation(state, akteurId, zielId, 20);
      melde(`${ziel.name} unterwirft sich und wird Vasall.`);
      return { ok: true, message: `${ziel.name} ist nun dein Vasall.` };
    }

    case 'releaseVassal': {
      if (ziel.overlordId !== akteurId) return { ok: false, message: `${ziel.name} ist nicht dein Vasall.` };
      bezahle(state, akteurId, opt);
      ziel.overlordId = null;
      changeRelation(state, akteurId, zielId, 30);
      for (const id of state.countryOrder) changeRelation(state, akteurId, id, 3);
      return { ok: true, message: `${ziel.name} ist wieder unabhängig.` };
    }

    default:
      return { ok: false, message: 'Diese Aktion ist noch nicht umgesetzt.' };
  }
}

/* ------------------------------------------------------------------ */
/* Pflege am Rundenende                                                */
/* ------------------------------------------------------------------ */

export function decayTreaties(state: GameState): void {
  state.treaties = state.treaties.filter((t) => t.until === 0 || t.until > state.turn);
}

/** Beziehungen bewegen sich langsam auf einen Grundwert zu. */
export function driftRelations(state: GameState): void {
  for (const key of Object.keys(state.relations)) {
    const [a, b] = key.split('|');
    if (!state.countries[a]?.alive || !state.countries[b]?.alive) continue;
    if (areAtWar(state, a, b)) continue;
    const wert = state.relations[key];
    let ziel = 0;
    if (areAllied(state, a, b)) ziel = 60;
    else if (hasTreaty(state, a, b, 'trade')) ziel = 25;
    if (Math.abs(wert - ziel) > 1) {
      state.relations[key] = Math.round(wert + (ziel - wert) * 0.05);
    }
  }
}

/** Vasallen, die stark und unzufrieden sind, sagen sich los. */
export function checkVassalRebellion(state: GameState, melde: (t: string) => void): void {
  for (const id of state.countryOrder) {
    const v = state.countries[id];
    if (!v.alive || !v.overlordId) continue;
    const herr = state.countries[v.overlordId];
    if (!herr?.alive) { v.overlordId = null; continue; }
    const verhaeltnis = powerScore(state, id) / Math.max(1, powerScore(state, v.overlordId));
    const beziehung = getRelation(state, id, v.overlordId);
    if (verhaeltnis > 0.8 && beziehung < 0 && v.stability > 50) {
      v.overlordId = null;
      declareWar(state, id, herr.id, 'liberate');
      melde(`${v.name} sagt sich von ${herr.name} los und greift zu den Waffen.`);
    }
  }
}

export function militaryStrengthVisible(state: GameState, betrachter: string, ziel: string): boolean {
  if (betrachter === ziel) return true;
  const c = state.countries[betrachter];
  if (!c) return false;
  if ((c.intel[ziel] ?? 0) >= 40) return true;
  return areAllied(state, betrachter, ziel) || countryArmy(state, ziel) === 0
    || provincesOf(state, ziel).length === 0;
}

export function setRelationDirect(state: GameState, a: string, b: string, v: number): void {
  setRelation(state, a, b, v);
}

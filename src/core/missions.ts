/**
 * Zielvorgaben.
 *
 * Das Spiel hat viele Stellschrauben - Haushalt, Forschung, Diplomatie,
 * Heer. Gerade dadurch fehlt am Anfang die Richtung: Man kann alles tun und
 * weiss nicht, was sich lohnt. Zielvorgaben geben jeder Partie einen Faden,
 * ohne den Spieler zu gaengeln. Drei laufen gleichzeitig; ist eine erfuellt,
 * rueckt die naechste nach.
 *
 * Wichtig fuer Spielstaende: eine Vorgabe speichert nur ihre Kennung und
 * Zahlenwerte, nie eine Funktion. Geprueft wird ueber die Tabelle unten.
 */

import type { GameState, Mission, MissionKind, TechFieldId } from './types';
import {
  countryArmy, powerScore, provincesOf, vassalsOf, areAllied, regimentsTotal,
} from './rules';
import { computeFinances } from './economy';
import type { Random } from './rng';

/* ------------------------------------------------------------------ */
/* Bewertung                                                           */
/* ------------------------------------------------------------------ */

/** Liefert den aktuellen Stand einer Vorgabe. */
export function missionStand(state: GameState, m: Mission): number {
  const id = state.playerCountryId;
  const c = state.countries[id];
  if (!c) return 0;

  switch (m.kind) {
    case 'provinces':
      return provincesOf(state, id).length;
    case 'army':
      return countryArmy(state, id);
    case 'gold':
      return Math.max(0, Math.round(c.gold));
    case 'income':
      return Math.max(0, Math.round(computeFinances(state, id).net));
    case 'tech':
      return c.tech[(m.feld ?? 'military') as TechFieldId] ?? 0;
    case 'vassals':
      return vassalsOf(state, id).length;
    case 'allies':
      return state.countryOrder.filter(
        (o) => o !== id && state.countries[o].alive && areAllied(state, id, o),
      ).length;
    case 'stability':
      return Math.round(c.stability);
    case 'capture':
      return m.zielProvinz && state.provinces[m.zielProvinz]?.ownerId === id ? 1 : 0;
    case 'defeat':
      return m.zielLand && provincesOf(state, m.zielLand).length === 0 ? 1 : 0;
    case 'fortify': {
      return provincesOf(state, id).filter((p) => p.fortification >= 2).length;
    }
    case 'buildings': {
      return provincesOf(state, id)
        .reduce((n, p) => n + Object.values(p.buildings).reduce((a, b) => a + (b ?? 0), 0), 0);
    }
    case 'navy': {
      return provincesOf(state, id).reduce((n, p) => n + (p.regiments.navy ?? 0), 0);
    }
    case 'power':
      return powerScore(state, id);
    default:
      return 0;
  }
}

export function missionErfuellt(state: GameState, m: Mission): boolean {
  return missionStand(state, m) >= m.ziel;
}

/* ------------------------------------------------------------------ */
/* Vorrat an Vorgaben                                                  */
/* ------------------------------------------------------------------ */

interface Bauplan {
  kind: MissionKind;
  name: string;
  /** %z% wird durch den Zielwert ersetzt, %n% durch einen Namen. */
  beschreibung: string;
  /** Zielwert aus dem Spielstand ableiten - macht Vorgaben szenariogerecht. */
  ziel: (state: GameState, stufe: number) => number;
  /** Belohnung, skaliert mit der Stufe. */
  lohn: (stufe: number) => Mission['lohn'];
  /** Trifft nur zu, wenn erfuellbar. */
  passt?: (state: GameState) => boolean;
  feld?: TechFieldId;
}

/** Die Vorlagen für Zielvorgaben. Nach außen gegeben, damit das Handbuch
    sie auflisten kann, statt sie abzuschreiben. */
export const PLAENE: Bauplan[] = [
  {
    kind: 'provinces', name: 'Das Reich mehren',
    beschreibung: 'Beherrsche %z% Gebiete.',
    ziel: (s, stufe) => provincesOf(s, s.playerCountryId).length + 2 + stufe * 2,
    lohn: (stufe) => ({ gold: 300 + stufe * 150, politicalPower: 10 + stufe * 4 }),
  },
  {
    kind: 'army', name: 'Stehendes Heer',
    beschreibung: 'Bringe %z% Einheiten unter Waffen.',
    ziel: (s, stufe) => Math.max(20, Math.round(countryArmy(s, s.playerCountryId) * 1.4) + stufe * 12),
    lohn: (stufe) => ({ manpower: 2000 + stufe * 1500, gold: 150 + stufe * 100 }),
  },
  {
    kind: 'gold', name: 'Volle Kassen',
    beschreibung: 'Halte %z% Gold im Schatz.',
    ziel: (_s, stufe) => 800 + stufe * 900,
    lohn: (stufe) => ({ politicalPower: 15 + stufe * 6, stability: 4 }),
  },
  {
    kind: 'income', name: 'Gesunder Haushalt',
    beschreibung: 'Erwirtschafte %z% Gold Überschuss je Runde.',
    ziel: (_s, stufe) => 120 + stufe * 120,
    lohn: (stufe) => ({ gold: 250 + stufe * 200, stability: 3 }),
  },
  {
    kind: 'tech', name: 'Kriegskunst', feld: 'military',
    beschreibung: 'Bringe die Militärtechnik auf Stufe %z%.',
    ziel: (s, stufe) => (s.countries[s.playerCountryId].tech.military ?? 0) + 1 + stufe,
    lohn: (stufe) => ({ gold: 200 + stufe * 150, manpower: 1500 }),
  },
  {
    kind: 'tech', name: 'Gelehrte Verwaltung', feld: 'administration',
    beschreibung: 'Bringe die Verwaltung auf Stufe %z%.',
    ziel: (s, stufe) => (s.countries[s.playerCountryId].tech.administration ?? 0) + 1 + stufe,
    lohn: (stufe) => ({ politicalPower: 20 + stufe * 8, stability: 5 }),
  },
  {
    kind: 'vassals', name: 'Lehnsherr',
    beschreibung: 'Halte %z% Vasallen.',
    ziel: (_s, stufe) => 1 + stufe,
    lohn: (stufe) => ({ politicalPower: 25 + stufe * 10, gold: 300 }),
  },
  {
    kind: 'allies', name: 'Ein Netz von Freunden',
    beschreibung: 'Schließe Bündnisse mit %z% Ländern.',
    ziel: (_s, stufe) => 1 + stufe,
    lohn: (stufe) => ({ politicalPower: 20 + stufe * 8, stability: 4 }),
  },
  {
    kind: 'stability', name: 'Innerer Friede',
    beschreibung: 'Halte die Stabilität bei %z%.',
    ziel: (_s, stufe) => Math.min(92, 70 + stufe * 7),
    lohn: (stufe) => ({ politicalPower: 12 + stufe * 5, gold: 200 }),
  },
  {
    kind: 'buildings', name: 'Bauherr',
    beschreibung: 'Errichte insgesamt %z% Ausbaustufen im Reich.',
    ziel: (s, stufe) => {
      const jetzt = provincesOf(s, s.playerCountryId)
        .reduce((n, p) => n + Object.values(p.buildings).reduce((a, b) => a + (b ?? 0), 0), 0);
      return jetzt + 3 + stufe * 3;
    },
    lohn: (stufe) => ({ gold: 350 + stufe * 200 }),
  },
  {
    kind: 'fortify', name: 'Feste Grenzen',
    beschreibung: 'Befestige %z% Gebiete auf Stufe 2 oder höher.',
    ziel: (_s, stufe) => 1 + stufe,
    lohn: (stufe) => ({ stability: 5, gold: 250 + stufe * 150 }),
  },
  {
    kind: 'navy', name: 'Herr der Küsten',
    beschreibung: 'Unterhalte %z% Kriegsschiffe.',
    ziel: (_s, stufe) => 3 + stufe * 3,
    lohn: (stufe) => ({ gold: 300 + stufe * 200, politicalPower: 10 }),
    passt: (s) => provincesOf(s, s.playerCountryId).some((p) => p.isPort),
  },
  {
    kind: 'power', name: 'Großmacht',
    beschreibung: 'Erreiche eine Machtkennzahl von %z%.',
    ziel: (s, stufe) => Math.round(powerScore(s, s.playerCountryId) * (1.5 + stufe * 0.4)) + 50,
    lohn: (stufe) => ({ politicalPower: 30 + stufe * 10, gold: 400 + stufe * 250 }),
  },
];

/* ------------------------------------------------------------------ */
/* Erzeugen                                                            */
/* ------------------------------------------------------------------ */

function baue(state: GameState, plan: Bauplan, stufe: number, lfd: number): Mission {
  const ziel = Math.max(1, Math.round(plan.ziel(state, stufe)));
  return {
    id: `m${lfd}`,
    kind: plan.kind,
    name: plan.name,
    beschreibung: plan.beschreibung.replace('%z%', String(ziel)),
    ziel,
    feld: plan.feld,
    lohn: plan.lohn(stufe),
    stufe,
    erledigt: false,
    rundeErledigt: null,
  };
}

/**
 * Eine gezielte Vorgabe aus der Lage: die Hauptstadt des unfreundlichsten
 * Nachbarn. Sie gibt der Partie einen Gegenspieler statt nur Zahlenwerte.
 */
function rivalenVorgabe(state: GameState, lfd: number): Mission | null {
  const id = state.playerCountryId;
  const eigene = new Set(provincesOf(state, id).map((p) => p.id));
  const nachbarn = new Map<string, number>();
  for (const p of provincesOf(state, id)) {
    for (const n of p.neighbors) {
      const q = state.provinces[n];
      if (!q?.ownerId || eigene.has(n) || q.ownerId === id) continue;
      nachbarn.set(q.ownerId, (nachbarn.get(q.ownerId) ?? 0) + 1);
    }
  }
  if (!nachbarn.size) return null;

  let rival: string | null = null;
  let schlechteste = 999;
  for (const [cid] of nachbarn) {
    const c = state.countries[cid];
    if (!c?.alive) continue;
    const wert = state.relations[[id, cid].sort().join('|')] ?? 0;
    if (wert < schlechteste) { schlechteste = wert; rival = cid; }
  }
  if (!rival) return null;

  const hauptstadt = state.countries[rival].capitalProvinceId;
  if (!hauptstadt || !state.provinces[hauptstadt]) return null;

  return {
    id: `m${lfd}`,
    kind: 'capture',
    name: 'Der Rivale',
    beschreibung: `Nimm ${state.provinces[hauptstadt].name} ein, die Hauptstadt von ${state.countries[rival].name}.`,
    ziel: 1,
    zielProvinz: hauptstadt,
    zielLand: rival,
    lohn: { gold: 600, politicalPower: 35, stability: 6 },
    stufe: 1,
    erledigt: false,
    rundeErledigt: null,
  };
}

/** Legt die Startvorgaben an. */
export function erzeugeMissionen(state: GameState, rnd: Random): void {
  state.missions = [];
  state.missionZaehler = 0;

  const rival = rivalenVorgabe(state, ++state.missionZaehler);
  if (rival) state.missions.push(rival);

  while (state.missions.length < 3) {
    const naechste = naechsteMission(state, rnd);
    if (!naechste) break;
    state.missions.push(naechste);
  }
}

/** Sucht eine neue Vorgabe, die noch nicht läuft und erfüllbar ist. */
export function naechsteMission(state: GameState, rnd: Random): Mission | null {
  const laufend = new Set(state.missions.filter((m) => !m.erledigt).map((m) => m.name));
  const erledigt = state.missions.filter((m) => m.erledigt);

  const moeglich = PLAENE.filter((p) => {
    if (laufend.has(p.name)) return false;
    if (p.passt && !p.passt(state)) return false;
    return true;
  });
  if (!moeglich.length) return null;

  const plan = moeglich[rnd.int(0, moeglich.length - 1)];
  // Je mehr schon geschafft ist, desto anspruchsvoller die naechste Vorgabe.
  const stufe = Math.min(4, Math.floor(erledigt.length / 2));
  const m = baue(state, plan, stufe, ++state.missionZaehler);
  // Schon beim Anlegen erfuellt? Dann eine Stufe hoeher ansetzen.
  if (missionErfuellt(state, m)) {
    return baue(state, plan, Math.min(5, stufe + 2), state.missionZaehler);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Rundenprüfung                                                       */
/* ------------------------------------------------------------------ */

/**
 * Prüft die laufenden Vorgaben, zahlt Belohnungen aus und lässt neue
 * nachrücken. Gibt die frisch erfüllten zurück, damit die Oberfläche sie
 * melden kann.
 */
export function pruefeMissionen(
  state: GameState,
  rnd: Random,
  melde: (m: Mission) => void,
): void {
  if (!state.missions) return;
  const c = state.countries[state.playerCountryId];
  if (!c?.alive) return;

  let frisch = 0;
  for (const m of state.missions) {
    if (m.erledigt) continue;
    if (!missionErfuellt(state, m)) continue;

    m.erledigt = true;
    m.rundeErledigt = state.turn;
    frisch++;

    const l = m.lohn;
    if (l.gold) c.gold += l.gold;
    if (l.politicalPower) c.politicalPower += l.politicalPower;
    if (l.stability) c.stability = Math.min(100, c.stability + l.stability);
    if (l.manpower) c.manpower += l.manpower;
    if (l.researchPoints && c.research) c.research.progress += l.researchPoints;
    melde(m);
  }

  // Fuer jede erfuellte Vorgabe rueckt eine neue nach.
  for (let i = 0; i < frisch; i++) {
    const neu = naechsteMission(state, rnd);
    if (neu) state.missions.push(neu);
  }

  // Erledigte nicht endlos mitschleppen: nur die letzten zehn bleiben.
  const fertig = state.missions.filter((m) => m.erledigt);
  if (fertig.length > 10) {
    const weg = new Set(fertig.slice(0, fertig.length - 10).map((m) => m.id));
    state.missions = state.missions.filter((m) => !weg.has(m.id));
  }
}

/** Die drei aktuell laufenden Vorgaben. */
export function offeneMissionen(state: GameState): Mission[] {
  return (state.missions ?? []).filter((m) => !m.erledigt).slice(0, 3);
}

export function erledigteMissionen(state: GameState): Mission[] {
  return (state.missions ?? []).filter((m) => m.erledigt).reverse();
}

/** Nur fuer die Anzeige: Fortschritt zwischen 0 und 1. */
export function missionFortschritt(state: GameState, m: Mission): number {
  if (m.erledigt) return 1;
  if (m.ziel <= 0) return 0;
  return Math.max(0, Math.min(1, missionStand(state, m) / m.ziel));
}

/** Wird fuer die Truppenanzeige in Vorgaben gebraucht. */
export { regimentsTotal };

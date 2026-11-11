/**
 * Herrscher.
 *
 * Bis hierher war ein Land eine Ansammlung von Zahlen mit einem Namen oben
 * drueber. Ein Herrscher gibt ihm ein Gesicht: Er kann etwas - oder eben
 * nicht -, er altert, er stirbt, und die Nachfolge ist ein Bruch, den man
 * vorbereiten muss. Das macht aus einer langen Partie eine Abfolge von
 * Regierungen statt einer gleichfoermigen Kurve.
 *
 * Die drei Faehigkeiten wirken an genau einer Stelle, damit sie
 * nachvollziehbar bleiben:
 *   Verwaltung  - Steuereinnahmen und Stabilitaet
 *   Diplomatie  - Zuwachs an politischem Einfluss
 *   Kriegskunst - Kampfkraft der eigenen Heere
 */

import type { Country, GameState, Ruler, RulerTraitId } from './types';
import type { Random } from './rng';

/* ------------------------------------------------------------------ */
/* Eigenschaften                                                       */
/* ------------------------------------------------------------------ */

export const HERRSCHER_EIGENSCHAFTEN: Record<RulerTraitId, {
  name: string; beschreibung: string;
}> = {
  eroberer:    { name: 'Eroberer',    beschreibung: 'Angriffe gelingen besser, Frieden fällt schwerer.' },
  baumeister:  { name: 'Baumeister',  beschreibung: 'Ausbauten kosten ein Fünftel weniger.' },
  sparsam:     { name: 'Sparsam',     beschreibung: 'Der Hof kostet weniger, die Kasse wächst schneller.' },
  gelehrt:     { name: 'Gelehrt',     beschreibung: 'Forschung kommt schneller voran.' },
  gerecht:     { name: 'Gerecht',     beschreibung: 'Die Unruhe in den Gebieten sinkt schneller.' },
  gefuerchtet: { name: 'Gefürchtet',  beschreibung: 'Hält Aufstände nieder, kostet aber Ansehen im Ausland.' },
  redegewandt: { name: 'Redegewandt', beschreibung: 'Diplomatische Schritte kosten weniger Einfluss.' },
  kraenklich:  { name: 'Kränklich',   beschreibung: 'Stirbt früher als andere.' },
  jaehzornig:  { name: 'Jähzornig',   beschreibung: 'Beziehungen verschlechtern sich von allein.' },
  vorsichtig:  { name: 'Vorsichtig',  beschreibung: 'Die eigene Verteidigung steht fester.' },
};

const EIGENSCHAFT_IDS = Object.keys(HERRSCHER_EIGENSCHAFTEN) as RulerTraitId[];

/* ------------------------------------------------------------------ */
/* Namen                                                               */
/* ------------------------------------------------------------------ */

const VORNAMEN = [
  'Alexander', 'Anna', 'Arnulf', 'Bernhard', 'Blanka', 'Caspar', 'Clara',
  'Dietrich', 'Eleonore', 'Emmerich', 'Friedrich', 'Gisela', 'Gottfried',
  'Hedwig', 'Heinrich', 'Hermann', 'Ida', 'Irmgard', 'Jakob', 'Johanna',
  'Konrad', 'Leopold', 'Lothar', 'Margarete', 'Mathilde', 'Nikolaus',
  'Otto', 'Philipp', 'Richenza', 'Rudolf', 'Sibylle', 'Sigismund',
  'Theoderich', 'Ulrich', 'Valerian', 'Wilhelmine', 'Wolfram',
];

const BEINAMEN = [
  'der Kühne', 'der Stille', 'der Gerechte', 'der Jüngere', 'der Ältere',
  'der Lahme', 'der Weise', 'der Rote', 'der Strenge', 'der Milde',
  'der Zauderer', 'der Große', 'der Fromme', 'der Eiserne', 'der Schweigsame',
];

const ORDNUNGSZAHLEN = ['I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.', 'VIII.'];

/* ------------------------------------------------------------------ */
/* Erzeugen                                                            */
/* ------------------------------------------------------------------ */

function wuerfleFaehigkeit(rnd: Random): number {
  // Drei Wuerfe, mittlerer zaehlt: mittelmaessige Herrscher sind haeufig,
  // sehr gute und sehr schlechte selten. Das macht einen Ausnahmekoenig
  // zu einem Ereignis statt zur Regel.
  const w = [rnd.int(1, 5), rnd.int(1, 5), rnd.int(1, 5)].sort((a, b) => a - b);
  return w[1];
}

function wuerfleEigenschaften(rnd: Random): RulerTraitId[] {
  const anzahl = rnd.chance(0.45) ? 2 : 1;
  const raus: RulerTraitId[] = [];
  let schutz = 0;
  while (raus.length < anzahl && schutz++ < 20) {
    const e = EIGENSCHAFT_IDS[rnd.int(0, EIGENSCHAFT_IDS.length - 1)];
    if (!raus.includes(e)) raus.push(e);
  }
  return raus;
}

/**
 * Erzeugt einen Herrscher. Beim ersten Herrscher eines Landes wird der im
 * Szenario hinterlegte Name uebernommen - die historischen Figuren sollen
 * nicht durch Zufallsnamen ersetzt werden.
 */
export function erzeugeHerrscher(
  rnd: Random,
  jahr: number,
  vorgabeName?: string,
  haus?: string,
): Ruler {
  const alter = rnd.int(24, 48);
  let name = vorgabeName;
  if (!name) {
    const vor = VORNAMEN[rnd.int(0, VORNAMEN.length - 1)];
    if (haus && rnd.chance(0.55)) {
      name = `${vor} ${ORDNUNGSZAHLEN[rnd.int(0, ORDNUNGSZAHLEN.length - 1)]}`;
    } else if (rnd.chance(0.4)) {
      name = `${vor} ${BEINAMEN[rnd.int(0, BEINAMEN.length - 1)]}`;
    } else {
      name = vor;
    }
  }
  return {
    name,
    alter,
    regiertSeit: jahr,
    traits: wuerfleEigenschaften(rnd),
    verwaltung: wuerfleFaehigkeit(rnd),
    diplomatie: wuerfleFaehigkeit(rnd),
    kriegskunst: wuerfleFaehigkeit(rnd),
  };
}

/* ------------------------------------------------------------------ */
/* Wirkungen                                                           */
/* ------------------------------------------------------------------ */

export function hatEigenschaft(c: Country, e: RulerTraitId): boolean {
  return !!c.rulerData?.traits.includes(e);
}

/** Faktor auf die Steuereinnahmen: 0,90 bis 1,10. */
export function verwaltungsFaktor(c: Country): number {
  const w = c.rulerData?.verwaltung ?? 3;
  return 1 + (w - 3) * 0.05;
}

/** Zuschlag auf den Zuwachs an politischem Einfluss je Runde. */
export function diplomatieZuschlag(c: Country): number {
  const w = c.rulerData?.diplomatie ?? 3;
  return (w - 3) * 0.6;
}

/** Faktor auf die Kampfkraft eigener Heere: 0,94 bis 1,06. */
export function kriegsFaktor(c: Country | undefined, angriff: boolean): number {
  if (!c?.rulerData) return 1;
  let f = 1 + (c.rulerData.kriegskunst - 3) * 0.03;
  if (angriff && hatEigenschaft(c, 'eroberer')) f *= 1.05;
  if (!angriff && hatEigenschaft(c, 'vorsichtig')) f *= 1.05;
  return f;
}

/** Faktor auf Baukosten. */
export function baukostenFaktor(c: Country): number {
  return hatEigenschaft(c, 'baumeister') ? 0.8 : 1;
}

/** Nachlass auf die Kosten diplomatischer Schritte. */
export function diplomatieKostenFaktor(c: Country): number {
  return hatEigenschaft(c, 'redegewandt') ? 0.75 : 1;
}

/* ------------------------------------------------------------------ */
/* Altern und Nachfolge                                                */
/* ------------------------------------------------------------------ */

/** Sterbewahrscheinlichkeit je Runde, abhängig vom Alter. */
function sterbeRisiko(r: Ruler, monateJeRunde: number): number {
  const jahre = monateJeRunde / 12;
  // Vor dem 50. Lebensjahr sehr gering, danach steil steigend.
  const grund = r.alter < 45 ? 0.004 : 0.004 + Math.pow((r.alter - 45) / 30, 2.4) * 0.16;
  const krank = r.traits.includes('kraenklich') ? 2.1 : 1;
  return Math.min(0.75, grund * krank * jahre);
}

export interface Thronwechsel {
  countryId: string;
  alterHerrscher: string;
  neuerHerrscher: Ruler;
  /** Stabilitätsverlust durch den Wechsel. */
  bruch: number;
}

/**
 * Lässt alle Herrscher altern und ersetzt die Verstorbenen.
 *
 * Der Bruch beim Wechsel hängt von der Regierungsform ab: Eine Monarchie
 * wackelt, wenn die Nachfolge ungeklärt ist; eine Republik wechselt die
 * Spitze ohnehin regelmäßig und merkt es kaum.
 */
export function altereHerrscher(
  state: GameState,
  rnd: Random,
  monateJeRunde: number,
): Thronwechsel[] {
  const wechsel: Thronwechsel[] = [];
  const jahre = monateJeRunde / 12;

  for (const cid of state.countryOrder) {
    const c = state.countries[cid];
    if (!c.alive) continue;
    if (!c.rulerData) {
      c.rulerData = erzeugeHerrscher(rnd, state.year, c.ruler);
      continue;
    }

    c.rulerData.alter += jahre;
    if (!rnd.chance(sterbeRisiko(c.rulerData, monateJeRunde))) continue;

    const alt = c.rulerData.name;
    const neu = erzeugeHerrscher(rnd, state.year);
    // Ein Nachfolger beginnt jünger als ein zufälliger Herrscher.
    neu.alter = rnd.int(16, 40);
    c.rulerData = neu;
    c.ruler = neu.name;

    const erblich = c.government === 'monarchy' || c.government === 'empire'
      || c.government === 'feudal' || c.government === 'theocracy';
    const bruch = erblich ? rnd.int(4, 11) : rnd.int(0, 3);
    c.stability = Math.max(0, c.stability - bruch);
    c.legitimacy = erblich
      ? Math.max(15, c.legitimacy - rnd.int(8, 18))
      : Math.max(30, c.legitimacy - 3);

    wechsel.push({ countryId: cid, alterHerrscher: alt, neuerHerrscher: neu, bruch });
  }
  return wechsel;
}

/** Kurzbeschreibung für die Oberfläche. */
export function herrscherKurz(r: Ruler): string {
  return `Verwaltung ${r.verwaltung} · Diplomatie ${r.diplomatie} · Kriegskunst ${r.kriegskunst}`;
}

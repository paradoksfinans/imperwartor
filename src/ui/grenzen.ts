/**
 * Staatsgrenzen und Küstenlinie als echte Linien.
 *
 * Bisher entstanden beide über einen Bildfilter: Die Flächen eines Landes
 * wurden gemeinsam verdickt und das Original wieder ausgestanzt, sodass ein
 * Ring übrig blieb. Das war ein Behelf, weil die alten Umrisse sich keine
 * Kanten teilten - und es war teuer, denn feMorphology rechnet bei jeder
 * Bewegung die gesamte Fläche neu durch.
 *
 * Mit den neuen Karten teilen sich Nachbarn ihre Kanten wieder. Damit lässt
 * sich sagen, welche Kante zwischen welchen beiden Gebieten liegt - und eine
 * Staatsgrenze ist schlicht die Menge der Kanten, deren beide Seiten
 * verschiedenen Ländern gehören. Das ist in jeder Zoomstufe scharf und
 * kostet fast nichts.
 *
 * Gebaut wird das einmal beim Laden einer Karte; danach wird nur noch
 * ausgewählt, welche Linien gerade zu zeichnen sind.
 */

import type { GameState } from '../core/types';
import { dekodiereRing, umrissPunkte } from '../core/koordinaten';

export interface Grenzlinie {
  /** Das eine angrenzende Gebiet. */
  a: string;
  /** Das andere - fehlt an der Küste und am Kartenrand. */
  b: string | null;
  /** Fertige Pfadangabe, damit zur Zeichenzeit nichts mehr zu rechnen ist. */
  d: string;
}

interface Kante {
  von: number;
  nach: number;
  a: string;
  b: string | null;
}

/**
 * Zerlegt alle Umrisse in Kanten und verkettet sie zu Linienzügen.
 *
 * Die Punkte werden über eine Zahl statt über Zeichenketten verglichen: Bei
 * fünfzigtausend Kanten je Karte macht das den Unterschied zwischen einem
 * spürbaren Hänger beim Start und einem Wimpernschlag.
 */
export function baueGrenzlinien(state: GameState): Grenzlinie[] {
  const teiler = state.ringTeiler ?? 8;

  /* Punkte nummerieren. */
  const nummer = new Map<string, number>();
  const punkte: number[] = [];
  const nimm = (x: number, y: number): number => {
    const k = `${x},${y}`;
    const vorhanden = nummer.get(k);
    if (vorhanden !== undefined) return vorhanden;
    const n = punkte.length / 2;
    punkte.push(x, y);
    nummer.set(k, n);
    return n;
  };

  /* Kanten sammeln. Ein Schlüssel aus beiden Punktnummern, kleinere zuerst. */
  const kanten = new Map<string, Kante>();
  for (const pid of state.provinceOrder) {
    const p = state.provinces[pid];
    if (!p) continue;
    for (const ring of ringeVon(p, teiler)) {
      const n = ring.length / 2;
      if (n < 3) continue;
      let vorher = nimm(ring[0], ring[1]);
      const erster = vorher;
      for (let i = 1; i <= n; i++) {
        const j = i % n;
        const jetzt = j === 0 ? erster : nimm(ring[j * 2], ring[j * 2 + 1]);
        if (jetzt !== vorher) {
          const k = vorher < jetzt ? `${vorher}_${jetzt}` : `${jetzt}_${vorher}`;
          const e = kanten.get(k);
          if (e) {
            // Dritter Anlieger kommt nicht vor; zweiter schon.
            if (e.a !== pid && e.b === null) e.b = pid;
          } else {
            kanten.set(k, {
              von: Math.min(vorher, jetzt), nach: Math.max(vorher, jetzt), a: pid, b: null,
            });
          }
        }
        vorher = jetzt;
      }
    }
  }

  /* Nach Nachbarschaft gruppieren und verketten. */
  const gruppen = new Map<string, Kante[]>();
  for (const e of kanten.values()) {
    const k = e.b === null ? e.a : [e.a, e.b].sort().join('|');
    const liste = gruppen.get(k);
    if (liste) liste.push(e); else gruppen.set(k, [e]);
  }

  const linien: Grenzlinie[] = [];
  for (const liste of gruppen.values()) {
    const anPunkt = new Map<number, Kante[]>();
    for (const e of liste) {
      for (const q of [e.von, e.nach]) {
        const l = anPunkt.get(q);
        if (l) l.push(e); else anPunkt.set(q, [e]);
      }
    }
    const benutzt = new Set<Kante>();

    /* Erst an freien Enden beginnen, damit offene Züge ganz durchlaufen
       werden; was dann noch übrig ist, sind geschlossene Ringe. */
    const starts = [...anPunkt.entries()].filter(([, v]) => v.length === 1).map(([q]) => q)
      .concat([...anPunkt.keys()]);

    for (const start of starts) {
      for (;;) {
        const erste = (anPunkt.get(start) ?? []).find((e) => !benutzt.has(e));
        if (!erste) break;
        let hier = start;
        let kante = erste;
        let d = `M${punkte[hier * 2]} ${punkte[hier * 2 + 1]}`;
        for (;;) {
          benutzt.add(kante);
          const weiter = kante.von === hier ? kante.nach : kante.von;
          d += `L${punkte[weiter * 2]} ${punkte[weiter * 2 + 1]}`;
          hier = weiter;
          const naechste = (anPunkt.get(hier) ?? []).filter((e) => !benutzt.has(e));
          if (naechste.length !== 1) break;
          [kante] = naechste;
        }
        linien.push({ a: erste.a, b: erste.b, d });
      }
    }
  }
  return linien;
}

/** Ringe eines Gebiets als flache Zahlenfolgen. */
function ringeVon(p: { rings?: string[]; points?: string }, teiler: number): number[][] {
  if (!p.rings?.length) {
    const z = umrissPunkte(p, teiler);
    return z.length >= 6 ? [z] : [];
  }
  // umrissPunkte wirft alle Ringe zusammen; hier werden sie einzeln gebraucht.
  const raus: number[][] = [];
  for (const r of p.rings) {
    const z = dekodiereRing(r, teiler);
    if (z.length >= 6) raus.push(z);
  }
  return raus;
}

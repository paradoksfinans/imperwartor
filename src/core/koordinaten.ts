/**
 * Kompakte Ablage von Umrissen.
 *
 * Die feinen Karten bestehen aus zehntausenden Punkten. Als Text mit Komma
 * und Dezimalstelle ("693.6,603.2 ") kostet ein Punkt rund zwölf Zeichen -
 * bei 36.000 Punkten allein für Europa fast ein halbes Megabyte.
 *
 * Hier werden stattdessen drei Dinge ausgenutzt:
 *
 *   1. Alle Punkte liegen auf einem festen Gitter, lassen sich also als
 *      ganze Zahlen führen.
 *   2. Aufeinanderfolgende Punkte eines Umrisses liegen dicht beieinander.
 *      Gespeichert wird deshalb nur der Unterschied zum Vorgänger.
 *   3. Diese Unterschiede sind meist winzig und passen in ein einziges
 *      Zeichen.
 *
 * Das ergibt etwa zwei Zeichen je Punkt statt zwölf. Entscheidend ist, dass
 * Kodierer (im Werkzeug) und Dekodierer (hier) dieselbe Vorschrift benutzen;
 * dafür gibt es eine Prüfung, die beide gegeneinander laufen lässt.
 *
 * Aufbau einer Zahl: Jedes Zeichen trägt fünf Nutzbits; ist das sechste Bit
 * gesetzt, folgt ein weiteres Zeichen. Vorzeichen über Zickzack, damit kleine
 * negative Werte genauso kurz bleiben wie kleine positive.
 */

const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Umkehrtabelle, einmal gebaut. */
const WERT = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < ZEICHEN.length; i++) t[ZEICHEN.charCodeAt(i)] = i;
  return t;
})();

export function kodiereZahl(n: number): string {
  // Zickzack: 0,-1,1,-2,2 ... -> 0,1,2,3,4
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let raus = '';
  for (;;) {
    const teil = v & 31;
    v = Math.floor(v / 32);
    raus += ZEICHEN[v > 0 ? teil | 32 : teil];
    if (v === 0) return raus;
  }
}

/**
 * Kodiert einen Umriss. Die Zahlen sind bereits ganzzahlige Gittereinheiten.
 */
export function kodiereRing(punkte: Array<[number, number]>): string {
  let raus = '';
  let lx = 0; let ly = 0;
  for (const [x, y] of punkte) {
    raus += kodiereZahl(x - lx) + kodiereZahl(y - ly);
    lx = x; ly = y;
  }
  return raus;
}

/**
 * Liest einen Umriss zurück und rechnet ihn auf die Zeichenfläche um.
 *
 * @param text    das kodierte Wort
 * @param teiler  wie viele Gittereinheiten auf eine Zeichenflächen-Einheit
 *                gehen; steht im Kopf der Karte
 */
export function dekodiereRing(text: string, teiler: number): number[] {
  const raus: number[] = [];
  let i = 0;
  let x = 0; let y = 0;
  const n = text.length;

  const naechste = (): number => {
    let v = 0;
    let schub = 1;
    for (;;) {
      const z = WERT[text.charCodeAt(i++)];
      if (z < 0) return 0;              // kaputtes Zeichen: still abbrechen
      v += (z & 31) * schub;
      if ((z & 32) === 0) break;
      schub *= 32;
    }
    // Zickzack zurück
    return (v & 1) === 1 ? -(v + 1) / 2 : v / 2;
  };

  while (i < n) {
    x += naechste();
    y += naechste();
    raus.push(x / teiler, y / teiler);
  }
  return raus;
}

/** Punktfolge als "x,y x,y" - für alles, was Text erwartet. */
export function ringAlsText(text: string, teiler: number): string {
  const z = dekodiereRing(text, teiler);
  const teile: string[] = [];
  for (let i = 0; i < z.length; i += 2) teile.push(`${z[i]},${z[i + 1]}`);
  return teile.join(' ');
}

/** Pfadangabe für ein <path>-Element: M … L … Z je Ring. */
export function ringeAlsPfad(ringe: string[], teiler: number): string {
  let d = '';
  for (const r of ringe) {
    const z = dekodiereRing(r, teiler);
    if (z.length < 6) continue;
    d += `M${z[0]} ${z[1]}`;
    for (let i = 2; i < z.length; i += 2) d += `L${z[i]} ${z[i + 1]}`;
    d += 'Z';
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Bequemer Zugriff                                                    */
/* ------------------------------------------------------------------ */

/**
 * Etwas, das einen Umriss hat - in neuer oder alter Form.
 *
 * Die meisten Gebiete liegen als kodierte Ringe vor. Ein paar wenige, für
 * die sich keine echte Verwaltungseinheit finden ließ, und die ganze
 * erfundene Karte Aurelia tragen noch die alte Punktliste. Beide Formen
 * laufen hier zusammen, damit der Rest des Spiels den Unterschied nicht
 * kennen muss.
 */
export interface MitUmriss {
  points?: string;
  rings?: string[];
}

const pfadSpeicher = new WeakMap<object, string>();
const punktSpeicher = new WeakMap<object, number[]>();

/** Pfadangabe für ein <path>-Element. Wird je Gebiet einmal gebaut. */
export function umrissPfad(p: MitUmriss, teiler: number): string {
  const fertig = pfadSpeicher.get(p);
  if (fertig !== undefined) return fertig;
  let d = '';
  if (p.rings?.length) {
    d = ringeAlsPfad(p.rings, teiler);
  } else if (p.points) {
    d = 'M' + p.points.replace(/ /g, 'L') + 'Z';
  }
  pfadSpeicher.set(p, d);
  return d;
}

/** Alle Punkte flach: x0, y0, x1, y1 ... - für Ausmaße und Schwerpunkte. */
export function umrissPunkte(p: MitUmriss, teiler: number): number[] {
  const fertig = punktSpeicher.get(p);
  if (fertig !== undefined) return fertig;
  let z: number[] = [];
  if (p.rings?.length) {
    for (const r of p.rings) z = z.concat(dekodiereRing(r, teiler));
  } else if (p.points) {
    for (const paar of p.points.split(' ')) {
      const i = paar.indexOf(',');
      if (i < 0) continue;
      const x = +paar.slice(0, i); const y = +paar.slice(i + 1);
      if (Number.isFinite(x) && Number.isFinite(y)) z.push(x, y);
    }
  }
  punktSpeicher.set(p, z);
  return z;
}

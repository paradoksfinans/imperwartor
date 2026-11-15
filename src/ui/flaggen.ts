/**
 * Flaggen der Länder.
 *
 * Bisher bekam jedes Land ein erzeugtes Wappen - hübsch, aber austauschbar.
 * Hier stehen stattdessen die echten Flaggen, und wo es noch keine gab, die
 * tatsächlich geführten Feldzeichen: das schwarze Banner der Abbasiden, das
 * weiße der Fatimiden, der Bogen der Seldschuken, der Rossschweif der
 * Mongolen, die Árpád-Streifen Ungarns.
 *
 * Zwei Dinge sind dabei wichtig:
 *
 *   - **Die Zeit zählt.** Frankreich führt 1500 die Lilien und 1914 die
 *     Trikolore. Deshalb steht die Flagge beim Land im Szenario, nicht bei
 *     der Länderkennung.
 *   - **Wo kein Wappen bekannt ist, wird keines erfunden.** Für die Antike
 *     und für Stammesverbände stehen hier Sinnbilder, die überliefert sind -
 *     der gallische Eber, der Anker der Seleukiden -, bewusst einfach
 *     gehalten statt als falsche Genauigkeit.
 *
 * Gezeichnet wird aus wenigen Bausteinen (Streifen, Kreuze, Scheiben,
 * Monde, Sterne, Adler, Lilien). Das hält sechzig Flaggen in einer Datei
 * und sorgt dafür, dass sie als Satz zusammenpassen.
 */

/* Die Flagge wird immer in diesem Feld gezeichnet und danach skaliert. */
import { ECHTE_FLAGGEN, ECHT_SKALIERUNG } from './flaggen-echt';

const B = 60;
const H = 40;

type Teil =
  | { art: 'feld'; farbe: string }
  | { art: 'streifen'; senkrecht?: boolean; farben: string[]; anteile?: number[] }
  | { art: 'kreuz'; farbe: string; dicke?: number; links?: number }
  | { art: 'schraegkreuz'; farbe: string; dicke?: number }
  | { art: 'rand'; farbe: string; dicke?: number }
  | { art: 'kanton'; farbe: string; breite?: number; hoehe?: number }
  | { art: 'scheibe'; farbe: string; r?: number; x?: number; y?: number }
  | { art: 'mond'; farbe: string; r?: number; x?: number; y?: number }
  | { art: 'stern'; farbe: string; zacken?: number; r?: number; x?: number; y?: number }
  | { art: 'sonne'; farbe: string; strahlen?: number; r?: number; x?: number; y?: number }
  | { art: 'adler'; farbe: string; doppelt?: boolean; groesse?: number; x?: number; y?: number }
  | { art: 'lilie'; farbe: string; groesse?: number; x?: number; y?: number }
  | { art: 'loewe'; farbe: string; groesse?: number; x?: number; y?: number }
  | { art: 'rauten'; farben: string[] }
  | { art: 'schluessel'; farbe: string; farben?: string[]; x?: number; y?: number }
  | { art: 'hammer_sichel'; farbe: string; groesse?: number; x?: number; y?: number }
  | { art: 'anker'; farbe: string; x?: number; y?: number }
  | { art: 'bogen'; farbe: string; x?: number; y?: number }
  | { art: 'rossschweif'; farbe: string; x?: number; y?: number }
  | { art: 'eber'; farbe: string; x?: number; y?: number }
  | { art: 'schwert'; farbe: string; x?: number; y?: number }
  | { art: 'ringe'; farbe: string }
  | { art: 'berg'; farbe: string }
  | { art: 'schrift'; text: string; farbe: string; groesse?: number };

interface Flagge {
  /** Wie die Flagge heißt - erscheint als Kurzinfo. */
  name: string;
  teile: Teil[];
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

function sternPfad(x: number, y: number, r: number, zacken: number): string {
  const innen = r * (zacken <= 5 ? 0.4 : 0.5);
  let d = '';
  for (let i = 0; i < zacken * 2; i++) {
    const w = (Math.PI * i) / zacken - Math.PI / 2;
    const rr = i % 2 === 0 ? r : innen;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(w) * rr).toFixed(2)} ${(y + Math.sin(w) * rr).toFixed(2)}`;
  }
  return d + 'Z';
}

/**
 * Doppeladler - stark vereinfacht.
 *
 * Ein heraldisch sauberer Adler braucht hundert Kurven und wird bei 30
 * Pixeln Breite doch zum Fleck. Diese Form behält, was ihn erkennbar macht:
 * zwei Köpfe, ausgebreitete Schwingen, gefächerter Stoß.
 */
/**
 * Der heraldische Adler, mit ausgebreiteten Schwingen.
 *
 * Gezeichnet als Vieleck, nicht mit Kurven: Bei zwanzig bis vierzig Pixeln
 * Hoehe verschluckt die Darstellung jede Feinheit, und weiche Kurven
 * liefen zu einem Fleck zusammen. Was ein Adler sein soll, muss an dieser
 * Groesse ueber die Silhouette erkennbar sein - weit ausgestellte
 * Schwingen, schmaler Rumpf, gefaecherter Stoss.
 *
 * "g" ist die Gesamthoehe des Zeichens.
 */
/**
 * Der heraldische Adler, mit ausgebreiteten Schwingen.
 *
 * Gezeichnet als Vieleck, nicht mit Kurven: Bei zwanzig bis vierzig Pixeln
 * Hoehe verschluckt die Darstellung jede Feinheit, und weiche Kurven
 * liefen zu einem Fleck zusammen. Was ein Adler sein soll, muss an dieser
 * Groesse ueber die Silhouette erkennbar sein - weit ausgestellte
 * Schwingen, schmaler Rumpf, gefaecherter Stoss.
 *
 * Liefert fertiges SVG und nicht nur eine Pfadangabe, weil die Koepfe
 * Kreise sind: Ein Pfad kann keinen Kreis enthalten.
 *
 * "g" ist die Gesamthoehe des Zeichens.
 */
function adlerSvg(x: number, y: number, g: number, doppelt: boolean, farbe: string): string {
  const s = g / 20;
  const P = (dx: number, dy: number) => `${(x + dx * s).toFixed(2)} ${(y + dy * s).toFixed(2)}`;

  /* Rumpf, Schwingen und Stoss in einem Zug - erst die linke Seite von
     oben nach unten, dann die rechte zurueck. */
  let d = `M${P(0, -4.6)}`
    + `L${P(-2.1, -3.8)}L${P(-9.8, -7.4)}L${P(-9.4, -3.6)}L${P(-6.2, -1.6)}`
    + `L${P(-8.4, 2.2)}L${P(-4.2, 1.4)}L${P(-2.5, 4.2)}`
    + `L${P(-3.3, 8.6)}L${P(0, 6.4)}L${P(3.3, 8.6)}`
    + `L${P(2.5, 4.2)}L${P(4.2, 1.4)}L${P(8.4, 2.2)}`
    + `L${P(6.2, -1.6)}L${P(9.4, -3.6)}L${P(9.8, -7.4)}L${P(2.1, -3.8)}Z`;

  const mitten = doppelt ? [[-3.4, -1], [3.4, 1]] : [[0, 1]];
  let kreise = '';
  for (const [mx, richtung] of mitten) {
    kreise += `<circle cx="${(x + mx * s).toFixed(2)}" cy="${(y - 6.4 * s).toFixed(2)}"`
      + ` r="${(2 * s).toFixed(2)}" fill="${farbe}"/>`;
    // Schnabel, nach aussen gerichtet
    d += `M${P(mx + richtung * 1.5, -7.2)}L${P(mx + richtung * 4.3, -6.3)}`
      + `L${P(mx + richtung * 1.5, -5.2)}Z`;
    // Hals zum Rumpf
    d += `M${P(mx - 1.5, -6)}L${P(mx + 1.5, -6)}L${P(mx * 0.3 + 1.4, -3.4)}`
      + `L${P(mx * 0.3 - 1.4, -3.4)}Z`;
  }
  return kreise + `<path d="${d}" fill="${farbe}"/>`;
}

function liliePfad(x: number, y: number, g: number): string {
  const s = g / 10;
  return `M${x} ${y - 5 * s}C${x + 1.1 * s} ${y - 3 * s} ${x + 1.1 * s} ${y - 1.6 * s} `
    + `${x + 0.5 * s} ${y - 0.6 * s}`
    + `C${x + 1.6 * s} ${y - 1.9 * s} ${x + 3.6 * s} ${y - 1.9 * s} ${x + 3.6 * s} ${y + 0.3 * s}`
    + `C${x + 3.6 * s} ${y + 2.1 * s} ${x + 1.8 * s} ${y + 2.6 * s} ${x + 0.9 * s} ${y + 1.5 * s}`
    + `L${x + 0.9 * s} ${y + 2.6 * s}L${x + 2 * s} ${y + 3.4 * s}L${x - 2 * s} ${y + 3.4 * s}`
    + `L${x - 0.9 * s} ${y + 2.6 * s}L${x - 0.9 * s} ${y + 1.5 * s}`
    + `C${x - 1.8 * s} ${y + 2.6 * s} ${x - 3.6 * s} ${y + 2.1 * s} ${x - 3.6 * s} ${y + 0.3 * s}`
    + `C${x - 3.6 * s} ${y - 1.9 * s} ${x - 1.6 * s} ${y - 1.9 * s} ${x - 0.5 * s} ${y - 0.6 * s}`
    + `C${x - 1.1 * s} ${y - 1.6 * s} ${x - 1.1 * s} ${y - 3 * s} ${x} ${y - 5 * s}Z`;
}

/**
 * Zeichnet einen Baustein.
 *
 * "praefix" ist die Kennung der Flagge, zu der dieser Baustein gehoert.
 * Sie wird allen Kennungen vorangestellt, die der Baustein selbst anlegt -
 * etwa der Maske des Halbmonds. Ohne das leiteten sich solche Kennungen
 * allein aus der Lage ab, und zwei Flaggen mit einem Mond an derselben
 * Stelle bekamen dieselbe: Auf einer Seite mit mehreren Flaggen gewinnt
 * dann die erste Maske, und die uebrigen Monde werden falsch gezeichnet.
 */
function teilSvg(t: Teil, praefix = 'f'): string {
  switch (t.art) {
    case 'feld':
      return `<rect width="${B}" height="${H}" fill="${t.farbe}"/>`;

    case 'streifen': {
      const n = t.farben.length;
      const anteile = t.anteile ?? Array.from({ length: n }, () => 1);
      const summe = anteile.reduce((a, b) => a + b, 0);
      let laufend = 0;
      return t.farben.map((f, i) => {
        const laenge = ((t.senkrecht ? B : H) * anteile[i]) / summe;
        const v = laufend;
        laufend += laenge;
        return t.senkrecht
          ? `<rect x="${v.toFixed(2)}" y="0" width="${laenge.toFixed(2)}" height="${H}" fill="${f}"/>`
          : `<rect x="0" y="${v.toFixed(2)}" width="${B}" height="${laenge.toFixed(2)}" fill="${f}"/>`;
      }).join('');
    }

    case 'kreuz': {
      const d = t.dicke ?? 8;
      // links < 0.5 ergibt das skandinavische Kreuz, 0.5 das mittige.
      const mx = B * (t.links ?? 0.5);
      return `<rect x="0" y="${(H - d) / 2}" width="${B}" height="${d}" fill="${t.farbe}"/>`
        + `<rect x="${mx - d / 2}" y="0" width="${d}" height="${H}" fill="${t.farbe}"/>`;
    }

    case 'schraegkreuz': {
      const d = t.dicke ?? 7;
      return `<g stroke="${t.farbe}" stroke-width="${d}">`
        + `<line x1="0" y1="0" x2="${B}" y2="${H}"/>`
        + `<line x1="${B}" y1="0" x2="0" y2="${H}"/></g>`;
    }

    case 'rand': {
      const d = t.dicke ?? 3;
      return `<rect x="${d / 2}" y="${d / 2}" width="${B - d}" height="${H - d}"`
        + ` fill="none" stroke="${t.farbe}" stroke-width="${d}"/>`;
    }

    case 'kanton':
      return `<rect width="${t.breite ?? B * 0.4}" height="${t.hoehe ?? H * 0.55}" fill="${t.farbe}"/>`;

    case 'scheibe':
      return `<circle cx="${t.x ?? B / 2}" cy="${t.y ?? H / 2}" r="${t.r ?? 9}" fill="${t.farbe}"/>`;

    case 'mond': {
      /* Der Halbmond entsteht aus zwei Kreisen: einem vollen und einem
         versetzten, der ihn ausstanzt. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2; const r = t.r ?? 9;
      const id = `${praefix}-m${Math.round(x * 7 + y * 13 + r * 3)}`;
      return `<mask id="${id}"><rect width="${B}" height="${H}" fill="#000"/>`
        + `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`
        + `<circle cx="${x + r * 0.34}" cy="${y}" r="${r * 0.82}" fill="#000"/></mask>`
        + `<rect width="${B}" height="${H}" fill="${t.farbe}" mask="url(#${id})"/>`;
    }

    case 'stern':
      return `<path d="${sternPfad(t.x ?? B / 2, t.y ?? H / 2, t.r ?? 6, t.zacken ?? 5)}"`
        + ` fill="${t.farbe}"/>`;

    case 'sonne': {
      const x = t.x ?? B / 2; const y = t.y ?? H / 2; const r = t.r ?? 10;
      const n = t.strahlen ?? 12;
      let strahlen = '';
      for (let i = 0; i < n; i++) {
        const w = (Math.PI * 2 * i) / n;
        strahlen += `<line x1="${(x + Math.cos(w) * r * 0.45).toFixed(2)}"`
          + ` y1="${(y + Math.sin(w) * r * 0.45).toFixed(2)}"`
          + ` x2="${(x + Math.cos(w) * r).toFixed(2)}"`
          + ` y2="${(y + Math.sin(w) * r).toFixed(2)}"/>`;
      }
      return `<g stroke="${t.farbe}" stroke-width="${r * 0.17}" stroke-linecap="round">`
        + `${strahlen}</g><circle cx="${x}" cy="${y}" r="${r * 0.36}" fill="${t.farbe}"/>`;
    }

    case 'adler':
      return adlerSvg(t.x ?? B / 2, t.y ?? H / 2, t.groesse ?? 26,
        t.doppelt ?? true, t.farbe);

    case 'lilie':
      return `<path d="${liliePfad(t.x ?? B / 2, t.y ?? H / 2, t.groesse ?? 14)}" fill="${t.farbe}"/>`;

    case 'loewe': {
      /* Der Loewenkopf.
         Hier stand vier Anlaeufe lang ein steigender Loewe, und er wurde
         jedes Mal als Affe gelesen - laengerer Leib, duennere Laeufe,
         staerkere Schraege, nichts half. Der Grund ist nicht die
         Zeichnung, sondern die Groesse: Eine vierbeinige Gestalt braucht
         Platz fuer Rumpf, vier Laeufe, Schweif und Kopf. Auf zwanzig bis
         vierzig Pixeln bleibt davon ein Fleck mit Fortsaetzen, und das
         Auge raet "Mensch", weil zwei Beine unten und zwei Arme oben nun
         einmal so aussehen.
         Ein Loewenkopf dagegen braucht nur drei Dinge, die auch klein
         bleiben: einen Kranz aus Maehne, zwei Ohren und eine Schnauze.
         Er ist in der Heraldik ueblich (als Leopardenkopf), und er ist
         auf den ersten Blick zu erkennen.
         Gezeichnet als ein Pfad mit Loechern: Die Maehne ist ein
         Zackenkranz, Augen und Nase sind Aussparungen - deshalb fill-rule
         "evenodd". So bleibt die Figur einfarbig und traegt trotzdem
         Gesichtszuege. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      const g = (t.groesse ?? 22) / 2;
      const r = (v: number) => (v * g).toFixed(2);
      const px = (dx: number) => (x + dx * g).toFixed(2);
      const py = (dy: number) => (y + dy * g).toFixed(2);

      /* Maehne: ein Kranz aus 18 Spitzen. Die Laengen wechseln nicht
         streng ab, sondern in drei Stufen - ein gleichmaessiger Stern
         liest sich als Sonne, erst die ungleichen Spitzen werden als Fell
         gesehen. */
      const zacken = 18;
      const laengen = [1.0, 0.92, 0.97, 0.9];
      let kranz = '';
      for (let i = 0; i < zacken * 2; i++) {
        const w = (Math.PI * i) / zacken - Math.PI / 2;
        const rad = i % 2 === 0 ? laengen[(i / 2) % laengen.length] : 0.84;
        kranz += `${i ? 'L' : 'M'}${(x + Math.cos(w) * rad * g).toFixed(2)}`
          + ` ${(y + Math.sin(w) * rad * g).toFixed(2)}`;
      }
      kranz += 'Z';

      /* Ohren: zwei runde Ohren, die im Kranz sitzen und nur knapp
         darueber hinausschauen. Weiter aussen standen sie wie Antennen
         neben dem Kopf. */
      const ohren = `M${px(-0.52)} ${py(-0.68)}a${r(0.17)} ${r(0.17)} 0 1 1 0.01 0Z`
        + `M${px(0.52)} ${py(-0.68)}a${r(0.17)} ${r(0.17)} 0 1 1 0.01 0Z`;

      /* Aussparungen: zwei Augen und eine Schnauze. Gegenlaeufig
         gezeichnet, damit evenodd sie als Loecher nimmt. */
      const auge = (dx: number) =>
        `M${(x + dx * g).toFixed(2)} ${py(-0.18)}`
        + `a${r(0.13)} ${r(0.17)} 0 1 0 0.01 0Z`;
      /* Nur die Nase, kein Mund: Ein geschwungener Mund wurde zum
         Laecheln, und damit aus dem Wappentier ein Comicgesicht. */
      const schnauze = `M${px(0)} ${py(0.4)}`
        + `L${px(0.17)} ${py(0.14)}`
        + `L${px(-0.17)} ${py(0.14)}Z`;

      return `<path d="${kranz}${ohren}${auge(-0.3)}${auge(0.3)}${schnauze}"`
        + ` fill="${t.farbe}" fill-rule="evenodd"/>`;
    }

    case 'rauten': {
      /* Das bayerische Rautenmuster: schräg gestellte Karos in zwei
         Farben. Gezeichnet als Streifenfolge in einem gedrehten Raster. */
      const a = t.farben[0]; const b = t.farben[1];
      const reihen: string[] = [];
      const breite = 11;
      for (let i = -4; i < 10; i++) {
        reihen.push(`<rect x="${i * breite}" y="-20" width="${breite}" height="${H + 40}"`
          + ` fill="${i % 2 ? b : a}" transform="rotate(28 ${B / 2} ${H / 2})"/>`);
      }
      return `<rect width="${B}" height="${H}" fill="${a}"/>` + reihen.join('');
    }

    case 'schluessel': {
      /* Zwei gekreuzte Schlüssel - das Zeichen des Petrusamtes. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      const schluessel = (winkel: number, farbe: string) =>
        `<g transform="rotate(${winkel} ${x} ${y})" stroke="${farbe}" fill="none"`
        + ` stroke-width="2.1" stroke-linecap="round">`
        + `<line x1="${x}" y1="${y - 9}" x2="${x}" y2="${y + 8}"/>`
        + `<circle cx="${x}" cy="${y - 11}" r="2.6"/>`
        + `<line x1="${x}" y1="${y + 4}" x2="${x + 4}" y2="${y + 4}"/>`
        + `<line x1="${x}" y1="${y + 8}" x2="${x + 3}" y2="${y + 8}"/></g>`;
      return schluessel(-24, t.farben?.[0] ?? t.farbe)
        + schluessel(24, t.farben?.[1] ?? t.farbe);
    }

    case 'hammer_sichel': {
      /* Hammer und Sichel. Die Sichel ist ein Kreisring, aus dem gut zwei
         Drittel fehlen - als blosser Bogenstrich las sie sich wie ein
         Haken. Der Hammer liegt schraeg darueber, Stiel und Kopf getrennt,
         damit beides auch klein auseinanderzuhalten ist. */
      const x = t.x ?? 21; const y = t.y ?? 20;
      const s0 = (t.groesse ?? 22) / 22;
      const r = 8 * s0;
      const d = 2.4 * s0;
      // Offener Ring: aussen im Uhrzeigersinn, innen zurueck.
      const sichel = `M${(x - r).toFixed(2)} ${y.toFixed(2)}`
        + `A${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ${(x + r * 0.72).toFixed(2)} ${(y + r * 0.69).toFixed(2)}`
        + `L${(x + (r - d) * 0.72).toFixed(2)} ${(y + (r - d) * 0.69).toFixed(2)}`
        + `A${(r - d).toFixed(2)} ${(r - d).toFixed(2)} 0 1 0 ${(x - r + d).toFixed(2)} ${y.toFixed(2)}Z`;
      return `<path d="${sichel}" fill="${t.farbe}"/>`
        + `<rect x="${(x - 0.9 * s0).toFixed(2)}" y="${(y - 7 * s0).toFixed(2)}"`
        + ` width="${(1.8 * s0).toFixed(2)}" height="${(13 * s0).toFixed(2)}"`
        + ` fill="${t.farbe}" transform="rotate(-42 ${x} ${y})" rx="${(0.6 * s0).toFixed(2)}"/>`
        + `<rect x="${(x - 4.6 * s0).toFixed(2)}" y="${(y - 8.4 * s0).toFixed(2)}"`
        + ` width="${(9.2 * s0).toFixed(2)}" height="${(3.4 * s0).toFixed(2)}"`
        + ` fill="${t.farbe}" transform="rotate(-42 ${x} ${y})" rx="${(0.8 * s0).toFixed(2)}"/>`;
    }

    case 'anker': {
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      return `<g stroke="${t.farbe}" stroke-width="2.2" fill="none" stroke-linecap="round">`
        + `<line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y + 9}"/>`
        + `<line x1="${x - 5}" y1="${y - 6}" x2="${x + 5}" y2="${y - 6}"/>`
        + `<path d="M${x - 8} ${y + 3}q8 10 16 0"/></g>`
        + `<circle cx="${x}" cy="${y - 11}" r="2.4" fill="none"`
        + ` stroke="${t.farbe}" stroke-width="2"/>`;
    }

    case 'bogen': {
      /* Bogen und Pfeil - das Zeichen des Oghusenstammes Kinik, aus dem
         die Seldschuken kamen. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      return `<g stroke="${t.farbe}" fill="none" stroke-linecap="round">`
        + `<path d="M${x - 9} ${y - 10}q13 10 0 20" stroke-width="2.6"/>`
        + `<line x1="${x - 9}" y1="${y - 10}" x2="${x - 9}" y2="${y + 10}" stroke-width="1.3"/>`
        + `<line x1="${x - 9}" y1="${y}" x2="${x + 11}" y2="${y}" stroke-width="2"/>`
        + `<path d="M${x + 11} ${y}l-4 -3m4 3l-4 3" stroke-width="2"/></g>`;
    }

    case 'rossschweif': {
      /* Der Tug: eine Stange mit Rossschweifen - das Feldzeichen der
         Steppenreiche. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      let haare = '';
      for (let i = -4; i <= 4; i++) {
        haare += `<path d="M${x + i * 1.6} ${y - 4}q${i * 1.1} 7 ${i * 2.2} 12"/>`;
      }
      return `<g stroke="${t.farbe}" fill="none" stroke-width="1.5" stroke-linecap="round">`
        + `<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y - 4}" stroke-width="2.4"/>`
        + `<circle cx="${x}" cy="${y - 15}" r="1.8" fill="${t.farbe}"/>`
        + `${haare}</g>`;
    }

    case 'eber': {
      /* Der Eber war das Feldzeichen gallischer Stämme - auf Münzen und
         als Aufsatz des Carnyx überliefert. */
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      return `<path d="M${x - 13} ${y + 2}q2 -7 8 -8q4 -4 9 -1l4 -3l0 4l3 2l-3 3`
        + `q1 5 -3 7l1 4l-3 0l-1 -3l-7 0l-1 3l-3 0l0 -4q-3 -2 -4 -8Z"`
        + ` fill="${t.farbe}"/>`
        + `<g stroke="${t.farbe}" stroke-width="1.3" stroke-linecap="round">`
        + `<path d="M${x - 13} ${y - 1}l-3 -4M${x - 10} ${y - 3}l-2 -5M${x - 6} ${y - 5}l-1 -5"/></g>`;
    }

    case 'schwert': {
      const x = t.x ?? B / 2; const y = t.y ?? H / 2;
      return `<g stroke="${t.farbe}" stroke-linecap="round" fill="none">`
        + `<line x1="${x}" y1="${y - 12}" x2="${x}" y2="${y + 8}" stroke-width="2.6"/>`
        + `<line x1="${x - 6}" y1="${y + 6}" x2="${x + 6}" y2="${y + 6}" stroke-width="2.2"/>`
        + `<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 12}" stroke-width="1.6"/></g>`;
    }

    case 'ringe': {
      /* Drei Ringe - das Zeichen Timurs, auf seinen Bauten überliefert. */
      const r = 5.5;
      return `<g fill="none" stroke="${t.farbe}" stroke-width="2">`
        + `<circle cx="${B / 2}" cy="${H / 2 - 5}" r="${r}"/>`
        + `<circle cx="${B / 2 - 7}" cy="${H / 2 + 6}" r="${r}"/>`
        + `<circle cx="${B / 2 + 7}" cy="${H / 2 + 6}" r="${r}"/></g>`;
    }

    case 'berg':
      return `<path d="M${B / 2 - 16} ${H - 8}L${B / 2 - 5} ${H - 24}L${B / 2 + 1} ${H - 16}`
        + `L${B / 2 + 8} ${H - 27}L${B / 2 + 17} ${H - 8}Z" fill="${t.farbe}"/>`;

    case 'schrift':
      return `<text x="${B / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="central"`
        + ` font-family="Georgia, 'Times New Roman', serif" font-weight="700"`
        + ` font-size="${t.groesse ?? 15}" letter-spacing="0.8" fill="${t.farbe}">${t.text}</text>`;

    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Die Flaggen                                                         */
/* ------------------------------------------------------------------ */

const f = (name: string, ...teile: Teil[]): Flagge => ({ name, teile });
/* Die beiden Abkuerzungen hiessen einmal "quer" und "laengs" - und zwar
   genau andersherum, als man es liest: "quer" erzeugte senkrechte
   Streifen. Daran sind sieben Flaggen falsch herum gelandet. Jetzt heissen
   sie, was sie tun. */
const senkrecht = (name: string, ...farben: string[]): Flagge =>
  f(name, { art: 'streifen', senkrecht: true, farben });
const waagerecht = (name: string, ...farben: string[]): Flagge =>
  f(name, { art: 'streifen', farben });

/** Union Jack - so weit vereinfacht, dass er bei 30 Pixeln noch stimmt. */
const unionJack: Flagge = f('Union Jack',
  { art: 'feld', farbe: '#012169' },
  { art: 'schraegkreuz', farbe: '#fff', dicke: 10 },
  { art: 'schraegkreuz', farbe: '#c8102e', dicke: 4 },
  { art: 'kreuz', farbe: '#fff', dicke: 14 },
  { art: 'kreuz', farbe: '#c8102e', dicke: 8 });

const doppeladlerGold: Teil[] = [
  { art: 'feld', farbe: '#e9bf4a' },
  { art: 'adler', farbe: '#15181c', doppelt: true, groesse: 30 },
];

export const FLAGGEN: Record<string, Flagge> = {
  /* --- 1914 ----------------------------------------------------- */
  de_kaiserreich: waagerecht('Deutsches Reich', '#000', '#fff', '#d6202a'),
  at_ungarn: waagerecht('Österreich-Ungarn', '#c8102e', '#fff', '#c8102e'),
  ru_kaiserreich: waagerecht('Russisches Reich', '#fff', '#0039a6', '#d52b1e'),
  fr_trikolore: senkrecht('Frankreich', '#002395', '#fff', '#ed2939'),
  gb_union: unionJack,
  it_trikolore: senkrecht('Italien', '#009246', '#fff', '#ce2b37'),
  tr_osmanen: f('Osmanisches Reich',
    { art: 'feld', farbe: '#d82b2b' },
    { art: 'mond', farbe: '#fff', r: 10, x: 24, y: 20 },
    { art: 'stern', farbe: '#fff', r: 5.5, x: 38, y: 20 }),
  rs_serbien: waagerecht('Serbien', '#c6363c', '#0c4076', '#fff'),
  ro_rumaenien: senkrecht('Rumänien', '#002b7f', '#fcd116', '#ce1126'),
  bg_bulgarien: waagerecht('Bulgarien', '#fff', '#00966e', '#d62612'),
  gr_griechenland: f('Griechenland',
    {
      art: 'streifen',
      farben: ['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'],
    },
    { art: 'kanton', farbe: '#0d5eaf', breite: 22.2, hoehe: 22.2 },
    { art: 'kreuz', farbe: '#fff', dicke: 4.4, links: 0.185 }),
  es_spanien: f('Spanien',
    { art: 'streifen', farben: ['#aa151b', '#f1bf00', '#aa151b'], anteile: [1, 2, 1] }),
  se_schweden: f('Schweden-Norwegen',
    { art: 'feld', farbe: '#2b6fb0' },
    { art: 'kreuz', farbe: '#fecc00', dicke: 7, links: 0.37 }),
  dk_daenemark: f('Dänemark',
    { art: 'feld', farbe: '#c8102e' },
    { art: 'kreuz', farbe: '#fff', dicke: 7, links: 0.37 }),
  nl_niederlande: waagerecht('Niederlande', '#ae1c28', '#fff', '#21468b'),
  be_belgien: senkrecht('Belgien', '#141414', '#fae042', '#ed2939'),
  ch_schweiz: f('Schweiz',
    { art: 'feld', farbe: '#d52b1e' },
    { art: 'kreuz', farbe: '#fff', dicke: 9 }),
  us_sternenbanner: f('Vereinigte Staaten',
    {
      art: 'streifen',
      farben: ['#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234'],
    },
    { art: 'kanton', farbe: '#3c3b6e', breite: 25, hoehe: 22.9 },
    ...[0, 1, 2].flatMap((zeile) => [0, 1, 2, 3].map((spalte): Teil => ({
      art: 'stern', farbe: '#fff', r: 2.4,
      x: 4 + spalte * 6 + (zeile % 2) * 3, y: 5 + zeile * 6.5,
    })))),
  jp_japan: f('Japan',
    { art: 'feld', farbe: '#fff' },
    { art: 'scheibe', farbe: '#bc002d', r: 11 }),
  cn_fuenffarben: waagerecht('China', '#de2910', '#ffde00', '#1e4c9a', '#fff', '#2b2b2b'),

  /* --- Antike --------------------------------------------------- */
  rom_spqr: f('Römische Republik',
    { art: 'feld', farbe: '#8c1c1c' },
    { art: 'rand', farbe: '#e4c05a', dicke: 2.5 },
    { art: 'schrift', text: 'SPQR', farbe: '#e4c05a', groesse: 15 }),
  karthago_tanit: f('Karthago',
    { art: 'feld', farbe: '#f0e6d2' },
    { art: 'streifen', senkrecht: true, farben: ['#6b2d7a', '#f0e6d2'], anteile: [1, 4] },
    { art: 'scheibe', farbe: '#6b2d7a', r: 4, x: 36, y: 12 },
    { art: 'berg', farbe: '#6b2d7a' }),
  seleukiden_anker: f('Seleukidenreich',
    { art: 'feld', farbe: '#1d4f73' },
    { art: 'anker', farbe: '#e4c05a' }),
  ptolemaeer_adler: f('Ptolemäisches Ägypten',
    { art: 'feld', farbe: '#e0b84a' },
    { art: 'adler', farbe: '#1b3a5c', doppelt: false, groesse: 28 }),
  makedonien_sonne: f('Makedonien',
    { art: 'feld', farbe: '#1b3f73' },
    { art: 'sonne', farbe: '#e8c454', strahlen: 16, r: 13 }),
  pergamon_schlange: f('Pergamon',
    { art: 'feld', farbe: '#2f5b43' },
    { art: 'schwert', farbe: '#e4c05a' }),
  iberer_stier: f('Iberische Stämme',
    { art: 'feld', farbe: '#a86b3c' },
    { art: 'sonne', farbe: '#f0e0c0', strahlen: 8, r: 11 }),
  gallier_eber: f('Gallische Stämme',
    { art: 'feld', farbe: '#3e6b4a' },
    { art: 'eber', farbe: '#e6d9b8' }),
  illyrer_schiff: f('Illyrer',
    { art: 'feld', farbe: '#223a52' },
    { art: 'mond', farbe: '#cfe0ee', r: 10, x: 30, y: 20 }),

  /* --- Mittelalter ---------------------------------------------- */
  seldschuken_bogen: f('Großseldschukisches Reich',
    { art: 'feld', farbe: '#2e7fb8' },
    { art: 'bogen', farbe: '#f2e2b0' }),
  byzanz_tetragramm: f('Byzantinisches Reich',
    { art: 'feld', farbe: '#a8232a' },
    { art: 'kreuz', farbe: '#e8c454', dicke: 7 },
    ...[[14, 10], [46, 10], [14, 30], [46, 30]].map(([x, y]): Teil => ({
      art: 'scheibe', farbe: '#e8c454', r: 3.4, x, y,
    }))),
  fatimiden_weiss: f('Fatimidisches Kalifat',
    { art: 'feld', farbe: '#f4f1e8' },
    { art: 'rand', farbe: '#cbb272', dicke: 3 }),
  abbasiden_schwarz: f('Abbasidisches Kalifat',
    { art: 'feld', farbe: '#17181a' },
    { art: 'rand', farbe: '#5a5a5e', dicke: 2.5 }),
  karachaniden_mond: f('Karachanidenreich',
    { art: 'feld', farbe: '#1f3e6e' },
    { art: 'mond', farbe: '#eef2f6', r: 10 }),
  ghaznawiden_schwert: f('Ghaznawiden',
    { art: 'feld', farbe: '#1f5340' },
    { art: 'schwert', farbe: '#e8c454' }),
  georgien_kreuz: f('Königreich Georgien',
    { art: 'feld', farbe: '#fff' },
    { art: 'kreuz', farbe: '#d0202a', dicke: 7 },
    // Die vier kleinen Bolnisi-Kreuze in den Feldern. Als Vierzack
    // gezeichnet: in Symbolgröße liest sich das als Kreuz, ein echtes
    // Tatzenkreuz würde bei 20 Pixeln zum Fleck verlaufen.
    ...[[15, 11], [45, 11], [15, 29], [45, 29]].map(([x, y]): Teil => ({
      art: 'stern', farbe: '#d0202a', zacken: 4, r: 4, x, y,
    }))),
  araber_emirate: f('Arabische Emirate',
    { art: 'feld', farbe: '#1f6b4a' },
    { art: 'mond', farbe: '#f0e4bc', r: 9 }),
  franken_lilien: f('Frankenreich',
    { art: 'feld', farbe: '#2b4a9b' },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 20, y: 13 },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 40, y: 13 },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 30, y: 28 }),
  chasaren_tamga: f('Chasarenreich',
    { art: 'feld', farbe: '#1d5a5e' },
    { art: 'rossschweif', farbe: '#dce8e6' }),
  uiguren_sonne: f('Uigurisches Kaganat',
    { art: 'feld', farbe: '#4a86b8' },
    { art: 'sonne', farbe: '#fff', strahlen: 10, r: 11 }),
  tang_sonne: f('Tang-Reich',
    { art: 'feld', farbe: '#e0b23c' },
    { art: 'scheibe', farbe: '#b4232a', r: 11 }),
  tibet_berg: f('Tibetisches Reich',
    { art: 'feld', farbe: '#8c2330' },
    { art: 'berg', farbe: '#f0efe8' }),
  asturien_kreuz: f('Königreich Asturien',
    { art: 'feld', farbe: '#1f4b8c' },
    { art: 'kreuz', farbe: '#e8c454', dicke: 7 }),
  mongolen_tug: f('Mongolisches Reich',
    { art: 'feld', farbe: '#1f4e8c' },
    { art: 'rossschweif', farbe: '#f2f4f6' }),
  rus_fuersten: f('Fürstentümer der Rus',
    { art: 'feld', farbe: '#9c2b2b' },
    { art: 'schwert', farbe: '#e8d08a' }),
  song_drache: f('Song-Reich',
    { art: 'feld', farbe: '#efe6d4' },
    { art: 'scheibe', farbe: '#b4232a', r: 10 },
    { art: 'rand', farbe: '#b4232a', dicke: 2.5 }),
  delhi_mond: f('Sultanat von Delhi',
    { art: 'feld', farbe: '#1d5c3a' },
    { art: 'mond', farbe: '#e8c454', r: 9 }),
  ayyubiden_gelb: f('Ayyubiden',
    { art: 'feld', farbe: '#e3bc3f' },
    { art: 'rand', farbe: '#9a7c1e', dicke: 2.5 }),
  hre_doppeladler: f('Heiliges Römisches Reich', ...doppeladlerGold),
  ungarn_arpaden: f('Königreich Ungarn',
    {
      art: 'streifen',
      senkrecht: true,
      farben: ['#c8102e', '#f0f0f0', '#c8102e', '#f0f0f0', '#c8102e', '#f0f0f0', '#c8102e', '#f0f0f0'],
    }),

  /* --- Frühe Neuzeit -------------------------------------------- */
  osmanen_1500: f('Osmanisches Reich',
    { art: 'feld', farbe: '#c42b2b' },
    { art: 'mond', farbe: '#fff', r: 11 }),
  safawiden_sonne: f('Safawidenreich',
    { art: 'feld', farbe: '#1f7a4a' },
    { art: 'sonne', farbe: '#f0d274', strahlen: 14, r: 12 }),
  spanien_burgund: f('Spanien',
    { art: 'feld', farbe: '#f4f1e8' },
    { art: 'schraegkreuz', farbe: '#b02a2a', dicke: 6 }),
  portugal_kreuz: f('Portugal',
    { art: 'feld', farbe: '#f4f1e8' },
    { art: 'kreuz', farbe: '#1f4b8c', dicke: 7 },
    { art: 'scheibe', farbe: '#f4f1e8', r: 3.4 }),
  frankreich_lilien: f('Frankreich',
    { art: 'feld', farbe: '#2b4a9b' },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 20, y: 13 },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 40, y: 13 },
    { art: 'lilie', farbe: '#f0d274', groesse: 11, x: 30, y: 28 }),
  moskau_adler: f('Großfürstentum Moskau',
    { art: 'feld', farbe: '#9c2b2b' },
    { art: 'adler', farbe: '#e8c454', doppelt: true, groesse: 28 }),
  timuriden_ringe: f('Timuriden',
    { art: 'feld', farbe: '#1f5c52' },
    { art: 'ringe', farbe: '#e8c454' }),
  ming_drache: f('Ming-Reich',
    { art: 'feld', farbe: '#e8c042' },
    { art: 'rand', farbe: '#b4232a', dicke: 3.5 },
    { art: 'scheibe', farbe: '#b4232a', r: 8 }),
  usbeken_mond: f('Usbekisches Khanat',
    { art: 'feld', farbe: '#2f8c9c' },
    { art: 'mond', farbe: '#fff', r: 9 }),

  /* --- Aurelia: erfundenes Land, erfundene Flaggen ---------------- */
  au_nordreich: f('Nordreich',
    { art: 'feld', farbe: '#2f4858' },
    { art: 'kreuz', farbe: '#e8e2d2', dicke: 7, links: 0.37 },
    { art: 'stern', farbe: '#e8c454', r: 5, x: 22, y: 20 }),
  au_westmark: senkrecht('Westmark', '#1f3f7a', '#e8e2d2', '#1f3f7a'),
  au_ostbund: f('Ostbund',
    { art: 'streifen', farben: ['#7a1f2b', '#e8c454'] },
    { art: 'stern', farbe: '#e8e2d2', zacken: 6, r: 7, x: 15, y: 13 }),
  au_suedallianz: f('Südallianz',
    { art: 'feld', farbe: '#1f6b4a' },
    { art: 'sonne', farbe: '#f0d274', strahlen: 12, r: 11 }),
  au_zentralrepublik: f('Zentralrepublik',
    { art: 'streifen', farben: ['#e8e2d2', '#4a6b8c', '#e8e2d2'] },
    { art: 'scheibe', farbe: '#9c2b2b', r: 7 }),
  au_kuestenliga: f('Küstenliga',
    { art: 'feld', farbe: '#2f7f9c' },
    { art: 'anker', farbe: '#f0efe8' }),
  au_hochtal: f('Hochtal',
    { art: 'feld', farbe: '#6b5a8c' },
    { art: 'berg', farbe: '#f0efe8' }),
  au_steppenkhanat: f('Steppenkhanat',
    { art: 'feld', farbe: '#a8762f' },
    { art: 'rossschweif', farbe: '#2b2118' }),
  au_sonnenreich: f('Sonnenreich',
    { art: 'feld', farbe: '#c4552b' },
    { art: 'sonne', farbe: '#f7e3a8', strahlen: 16, r: 12 }),
  /* ---- Kreuzfahrerstaaten, 1099 ----
     Die drei Staaten führten die Zeichen ihrer Gründer, nicht die ihrer
     Länder: Ein Kreuzfahrerstaat war zunächst nichts als das Gefolge
     eines Fürsten. */
  kz_jerusalem: f('Königreich Jerusalem',
    { art: 'feld', farbe: '#f2efe4' },
    // Das Jerusalemkreuz: ein Krückenkreuz mit vier kleinen Kreuzen.
    { art: 'kreuz', farbe: '#d6a84e', dicke: 7 },
    ...[[18, 11], [42, 11], [18, 29], [42, 29]].map((xy) => ({
      art: 'stern' as const, farbe: '#d6a84e', zacken: 4, r: 3.4, x: xy[0], y: xy[1],
    }))),
  kz_antiochia: f('Fürstentum Antiochia',
    { art: 'feld', farbe: '#c0392b' },
    { art: 'kreuz', farbe: '#f2efe4', dicke: 8 }),
  kz_edessa: f('Grafschaft Edessa',
    { art: 'feld', farbe: '#6b4a8a' },
    { art: 'kreuz', farbe: '#f2efe4', dicke: 6, links: 0.34 }),
  danischmenden: f('Danischmenden',
    { art: 'feld', farbe: '#d98c2b' },
    { art: 'mond', farbe: '#2b2016', r: 10, x: 24, y: 20 },
    { art: 'schwert', farbe: '#2b2016', x: 42, y: 20 }),

  /* ---- Reich und Nachbarn, 1618 bis 1805 ---- */
  boehmen_loewe: f('Böhmen',
    /* Silberner Loewe auf rotem Grund - das boehmische Wappen. Auf der
       weiss-roten Streifenfahne verschwaende er in der roten Haelfte. */
    { art: 'feld', farbe: '#c8102e' },
    { art: 'loewe', farbe: '#f2efe4', groesse: 24 }),
  bayern_rauten: f('Bayern',
    { art: 'rauten', farben: ['#f2f4f7', '#4a7fc1'] }),
  sachsen_rautenkranz: f('Sachsen',
    { art: 'streifen', farben: ['#16181a', '#e8c454'] },
    // Der Rautenkranz: ein grüner Balken quer über das Wappen.
    { art: 'kreuz', farbe: '#2e7d4f', dicke: 5, links: -1 }),
  brandenburg_adler: f('Brandenburg',
    /* Weisses Tuch mit rotem Adler - das Banner der Mark. Die weiss-rote
       Streifenfahne kam erst spaeter; auf ihr verschwaende der rote Adler
       in der roten Haelfte. */
    { art: 'feld', farbe: '#f2f4f7' },
    { art: 'adler', farbe: '#c8102e', doppelt: false, groesse: 24 }),
  preussen_adler: f('Preußen',
    { art: 'feld', farbe: '#f2f4f7' },
    { art: 'adler', farbe: '#16181a', doppelt: false, groesse: 23 }),
  pfalz_loewe: f('Kurpfalz',
    { art: 'feld', farbe: '#16181a' },
    { art: 'loewe', farbe: '#e8c454', groesse: 23 }),
  wuerttemberg: f('Württemberg',
    { art: 'streifen', farben: ['#16181a', '#c8102e'] },
    ...[14, 24, 34, 44].map((x) => ({
      art: 'stern' as const, farbe: '#e8c454', zacken: 4, r: 3.2, x, y: 20,
    }))),
  niederlande_prinsenvlag: f('Prinsenvlag',
    // Die Flagge der aufständischen Provinzen: oben Orange, nicht Rot -
    // nach Wilhelm von Oranien. Das Rot kam erst im 17. Jahrhundert.
    { art: 'streifen', farben: ['#e07b2a', '#f2f2ef', '#1f3c88'] }),
  polen_adler: f('Polen-Litauen',
    /* Das Banner der Krone: weisser Adler auf rotem Tuch. */
    { art: 'feld', farbe: '#c8102e' },
    { art: 'adler', farbe: '#f2f2ef', doppelt: false, groesse: 24 }),
  venedig_markusloewe: f('Republik Venedig',
    { art: 'feld', farbe: '#8c1d2e' },
    { art: 'loewe', farbe: '#d6a84e', groesse: 24 },
    { art: 'rand', farbe: '#d6a84e', dicke: 2 }),
  kirchenstaat_schluessel: f('Kirchenstaat',
    // Senkrecht geteilt, Gelb am Mast - so seit 1808.
    { art: 'streifen', senkrecht: true, farben: ['#e8c454', '#f2efe4'] },
    { art: 'schluessel', farbe: '#9c7b2a', farben: ['#9c7b2a', '#b7babd'] }),
  savoyen_kreuz: f('Savoyen',
    { art: 'feld', farbe: '#c8102e' },
    { art: 'kreuz', farbe: '#f2efe4', dicke: 8 }),
  neapel_bourbonen: f('Königreich Neapel',
    { art: 'feld', farbe: '#f2efe4' },
    { art: 'lilie', farbe: '#1f3c88', groesse: 13, x: 22, y: 14 },
    { art: 'lilie', farbe: '#1f3c88', groesse: 13, x: 38, y: 14 },
    { art: 'lilie', farbe: '#1f3c88', groesse: 13, x: 30, y: 28 }),

  /* ---- 1939 ---- */
  su_hammer_sichel: f('Sowjetunion',
    { art: 'feld', farbe: '#c8102e' },
    { art: 'hammer_sichel', farbe: '#e8c454' },
    { art: 'stern', farbe: '#e8c454', zacken: 5, r: 4.4, x: 17, y: 30 }),
  jugoslawien: f('Jugoslawien',
    { art: 'streifen', farben: ['#1f3c88', '#f2f2ef', '#c8102e'] }),
  tuerkei_mond: f('Türkei',
    { art: 'feld', farbe: '#c8102e' },
    { art: 'mond', farbe: '#f2f2ef', r: 9, x: 26, y: 20 },
    { art: 'stern', farbe: '#f2f2ef', zacken: 5, r: 4.4, x: 38, y: 20 }),
  finnland_kreuz: f('Finnland',
    { art: 'feld', farbe: '#f4f7fa' },
    { art: 'kreuz', farbe: '#1f4a8c', dicke: 8, links: 0.36 }),

  /* ---- Fassungen, die es als echte Zeichnung gibt ----
     Die Bausteine hier sind nur die Rueckfallebene: flaggeSvg nimmt die
     echte Zeichnung, sobald es eine gibt. Sie stehen trotzdem in dieser
     Liste, weil daran der Name haengt - und weil die Pruefwerkzeuge
     wissen muessen, dass es die Kennung gibt. */
  pl_polen: f('Polen',
    { art: 'streifen', farben: ['#f2f2ef', '#c8102e'] }),
  portugal_1911: f('Portugal',
    { art: 'streifen', farben: ['#1f7a4d', '#c8102e'], anteile: [0.4, 0.6] }),
  ungarn_trikolore: f('Ungarn',
    { art: 'streifen', farben: ['#c8102e', '#f2f2ef', '#1f7a4d'] }),
  norwegen: f('Norwegen',
    { art: 'feld', farbe: '#c8102e' },
    { art: 'kreuz', farbe: '#f2f2ef', dicke: 11, links: 0.36 },
    { art: 'kreuz', farbe: '#1f3c88', dicke: 5, links: 0.36 }),

  au_freistaedte: f('Freistädte',
    { art: 'feld', farbe: '#e8e2d2' },
    { art: 'streifen', senkrecht: true, farben: ['#e8e2d2', '#2f4858', '#e8e2d2'], anteile: [2, 1, 2] },
    { art: 'scheibe', farbe: '#e8c454', r: 6 }),
};

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

/**
 * Zeichnet eine Flagge.
 *
 * Ist keine hinterlegt, kommt ein schlichtes Feld in der Landesfarbe mit
 * dem Anfangsbuchstaben - besser ein ehrlicher Platzhalter als eine
 * erfundene Flagge.
 */
export function flaggeSvg(
  flagId: string | undefined,
  ersatzFarbe: string,
  groesse = 40,
  buchstabe?: string,
): string {
  const flagge = flagId ? FLAGGEN[flagId] : undefined;
  const hoehe = Math.round((groesse * H) / B);
  /* Die Kennung hängt an der Flagge, nicht am Zufall. Dieselbe Flagge
     ergibt damit zweimal dasselbe HTML: Die Oberfläche vergleicht ihre
     Zeichenketten, um unnötiges Neuzeichnen zu vermeiden - mit einer
     Zufallskennung wäre jeder Vergleich wertlos. Gleiche Kennungen für
     gleiche Flaggen sind unschädlich, weil auch der Inhalt gleich ist. */
  const kennung = `fl-${flagId ?? 'leer'}-${groesse}`;

  /* Gibt es die Flagge als echte Zeichnung, hat die Vorrang. Nachgebaut
     wird nur, wofuer es keine gibt: untergegangene Reiche, mittelalter-
     liche Banner, erfundene Laender. */
  const echt = flagId ? ECHTE_FLAGGEN[flagId] : undefined;
  const inhalt = echt
    ? `<g transform="${ECHT_SKALIERUNG}">${echt}</g>`
    : flagge
      ? flagge.teile.map((t) => teilSvg(t, kennung)).join('')
      : teilSvg({ art: 'feld', farbe: ersatzFarbe }, kennung)
        + teilSvg({ art: 'schrift', text: buchstabe ?? '?', farbe: 'rgba(255,255,255,.85)', groesse: 20 }, kennung);

  /* Ein feiner Rahmen und ein Hauch Schattierung - sonst verschwimmt eine
     weiße Flagge mit dem hellen Hintergrund. */
  return `<svg class="flagge" viewBox="0 0 ${B} ${H}" width="${groesse}" height="${hoehe}"
      role="img" aria-label="Flagge${flagge ? ': ' + flagge.name : ''}">
    <defs>
      <clipPath id="${kennung}"><rect width="${B}" height="${H}" rx="2.5"/></clipPath>
      <linearGradient id="${kennung}g" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".14"/>
        <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".16"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${kennung})">
      ${inhalt}
      <rect width="${B}" height="${H}" fill="url(#${kennung}g)"/>
    </g>
    <rect x="0.5" y="0.5" width="${B - 1}" height="${H - 1}" rx="2.5"
      fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
  </svg>`;
}

/** Name der Flagge - für Kurzinfos. */
export function flaggeName(flagId: string | undefined): string | null {
  return (flagId && FLAGGEN[flagId]?.name) || null;
}

/* Fuer die Pruefung: Alle Flaggen nebeneinander zu sehen ist die einzige
   Art, Fehler wie doppelte Kennungen oder ein leeres Feld zu bemerken -
   einzeln sieht jede Flagge richtig aus. test/flaggen.mjs greift hierauf
   zu. Im Spiel selbst wird nichts davon benutzt. */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__FLAGGEN__ = {
    FLAGGEN, ECHTE_FLAGGEN, flaggeSvg,
  };
}

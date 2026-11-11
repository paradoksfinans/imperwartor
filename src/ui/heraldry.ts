/**
 * Wappengenerator.
 *
 * Jedes Land bekommt ein eigenes Wappen, berechnet aus seinem Namen. Gleicher
 * Name heisst immer gleiches Wappen - ohne dass Bilddateien mitgeliefert
 * werden muessen. Die Formensprache bleibt bewusst einfach und abstrakt:
 * Schildteilung, Farbe, ein Zeichen. Keine Nachbildung realer Hoheitszeichen.
 */

/** Kleiner, stabiler Zufallsgenerator aus einer Zahl. */
function folge(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Helligkeit einer Farbe anpassen. */
export function mischeFarbe(hex: string, ziel: string, anteil: number): string {
  const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  try {
    const [r1, g1, b1] = h(hex);
    const [r2, g2, b2] = h(ziel);
    const m = (a: number, b: number) => Math.round(a + (b - a) * anteil);
    return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return hex;
  }
}

export function aufhellen(hex: string, anteil: number): string {
  return mischeFarbe(hex, '#ffffff', anteil);
}
export function abdunkeln(hex: string, anteil: number): string {
  return mischeFarbe(hex, '#000000', anteil);
}

/** Zeichen, die als Wappenfigur dienen - abstrakt, nicht an reale Zeichen angelehnt. */
const FIGUREN = [
  // Turm
  'M -7 6 L -7 -4 L -5 -4 L -5 -6 L -3 -6 L -3 -4 L -1 -4 L -1 -6 L 1 -6 L 1 -4 L 3 -4 L 3 -6 L 5 -6 L 5 -4 L 7 -4 L 7 6 Z',
  // Stern
  'M 0 -8 L 2 -2 L 8 -2 L 3 2 L 5 8 L 0 4 L -5 8 L -3 2 L -8 -2 L -2 -2 Z',
  // Raute
  'M 0 -8 L 7 0 L 0 8 L -7 0 Z',
  // Kreuzbalken
  'M -2 -8 L 2 -8 L 2 -2 L 8 -2 L 8 2 L 2 2 L 2 8 L -2 8 L -2 2 L -8 2 L -8 -2 L -2 -2 Z',
  // Halbmond (abstrakt)
  'M 4 -7 A 8 8 0 1 0 4 7 A 6 6 0 1 1 4 -7 Z',
  // Dreiberg
  'M -8 7 L -4 -1 L 0 5 L 4 -5 L 8 7 Z',
  // Ring
  'M 0 -7 A 7 7 0 1 0 0 7 A 7 7 0 1 0 0 -7 M 0 -4 A 4 4 0 1 1 0 4 A 4 4 0 1 1 0 -4 Z',
  // Anker-Form
  'M -1 -8 L 1 -8 L 1 -4 L 5 -4 L 5 -1 L 1 -1 L 1 5 L 6 2 L 7 5 L 0 9 L -7 5 L -6 2 L -1 5 L -1 -1 L -5 -1 L -5 -4 L -1 -4 Z',
  // Flamme
  'M 0 -9 C 4 -4 6 -1 4 3 C 3 6 1 8 0 9 C -1 8 -3 6 -4 3 C -6 -1 -4 -4 0 -9 Z',
  // Schwerter gekreuzt (abstrakt, ohne Gewaltdarstellung)
  'M -7 -7 L -5 -8 L 7 5 L 6 7 Z M 7 -7 L 5 -8 L -7 5 L -6 7 Z',
];

type Teilung = 'voll' | 'gespalten' | 'geteilt' | 'schraeg' | 'balken' | 'spitze';

/**
 * Erzeugt ein Wappen als SVG-Zeichenkette.
 * @param seed  Kennung des Landes (stabile Zahl)
 * @param farbe Hauptfarbe des Landes
 * @param größe Kantenlaenge in Pixeln
 */
export function wappenSvg(seed: number, farbe: string, groesse = 40, buchstabe?: string): string {
  const r = folge(seed);
  const teilungen: Teilung[] = ['voll', 'gespalten', 'geteilt', 'schraeg', 'balken', 'spitze'];
  const teilung = teilungen[Math.floor(r() * teilungen.length)];
  const hell = aufhellen(farbe, 0.42);
  const dunkel = abdunkeln(farbe, 0.4);
  const metall = r() < 0.5 ? '#e8d9a8' : '#e9edf2';
  const figur = FIGUREN[Math.floor(r() * FIGUREN.length)];
  const figurFarbe = r() < 0.55 ? metall : hell;
  const zweit = r() < 0.5 ? dunkel : metall;

  const id = `w${seed % 100000}`;
  // Schildumriss: oben gerade, unten zugespitzt.
  const schild = 'M 2 2 L 38 2 L 38 22 C 38 32 30 38 20 42 C 10 38 2 32 2 22 Z';

  let fuellung = '';
  if (teilung === 'voll') {
    fuellung = `<path d="${schild}" fill="url(#g${id})"/>`;
  } else if (teilung === 'gespalten') {
    fuellung = `<path d="${schild}" fill="${farbe}"/>
      <path d="M 20 2 L 38 2 L 38 22 C 38 32 30 38 20 42 Z" fill="${zweit}"/>`;
  } else if (teilung === 'geteilt') {
    fuellung = `<path d="${schild}" fill="${farbe}"/>
      <path d="M 2 22 L 38 22 C 38 32 30 38 20 42 C 10 38 2 32 2 22 Z" fill="${zweit}"/>`;
  } else if (teilung === 'schraeg') {
    fuellung = `<path d="${schild}" fill="${farbe}"/>
      <path d="M 2 2 L 38 2 L 2 38 Z" fill="${zweit}" opacity="0.9"/>`;
  } else if (teilung === 'balken') {
    fuellung = `<path d="${schild}" fill="${farbe}"/>
      <rect x="2" y="14" width="36" height="9" fill="${zweit}"/>`;
  } else {
    fuellung = `<path d="${schild}" fill="${farbe}"/>
      <path d="M 20 2 L 38 2 L 38 10 L 20 26 L 2 10 L 2 2 Z" fill="${zweit}" opacity="0.85"/>`;
  }

  const zeichen = buchstabe
    ? `<text x="20" y="27" text-anchor="middle" font-size="17" font-weight="700"
         font-family="Georgia, serif" fill="${figurFarbe}"
         stroke="rgba(0,0,0,.35)" stroke-width="0.6" paint-order="stroke">${buchstabe}</text>`
    : `<g transform="translate(20 21) scale(0.95)">
         <path d="${figur}" fill="${figurFarbe}" stroke="rgba(0,0,0,.35)" stroke-width="0.7"/>
       </g>`;

  return `<svg viewBox="0 0 40 44" width="${groesse}" height="${Math.round(groesse * 1.1)}"
      xmlns="http://www.w3.org/2000/svg" class="wappen" aria-hidden="true">
    <defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${aufhellen(farbe, 0.2)}"/>
        <stop offset="1" stop-color="${abdunkeln(farbe, 0.25)}"/>
      </linearGradient>
    </defs>
    ${fuellung}
    ${zeichen}
    <path d="${schild}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="2"/>
    <path d="${schild}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="0.8"/>
  </svg>`;
}

/** Kleines rundes Abzeichen für Listen und Leisten. */
export function abzeichenSvg(seed: number, farbe: string, buchstabe: string, groesse = 26): string {
  const r = folge(seed + 7);
  const hell = aufhellen(farbe, 0.3);
  const id = `a${seed % 100000}`;
  const ring = r() < 0.5 ? '#e8d9a8' : 'rgba(255,255,255,.5)';
  return `<svg viewBox="0 0 32 32" width="${groesse}" height="${groesse}"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hell}"/><stop offset="1" stop-color="${abdunkeln(farbe, 0.3)}"/>
    </linearGradient></defs>
    <circle cx="16" cy="16" r="14" fill="url(#${id})" stroke="${ring}" stroke-width="1.6"/>
    <text x="16" y="21" text-anchor="middle" font-size="14" font-weight="700"
      font-family="Georgia, serif" fill="#fff" stroke="rgba(0,0,0,.4)"
      stroke-width="0.6" paint-order="stroke">${buchstabe}</text>
  </svg>`;
}

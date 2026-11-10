/**
 * Farben und Texturen der Karte.
 *
 * Leitbild: Das Meer ist Tinte, das Land ist Papier. Eine Landesfarbe wird
 * daher nicht flächig aufgetragen, sondern als Tinte in das Papier gerechnet.
 * Alle Wertekarten verwenden einen einzigen Farbton von hell nach dunkel,
 * die Beziehungskarte als einzige zwei Pole mit neutraler Mitte.
 */
import type { MapFilter, TerrainType } from '../../models/types';

export type ThemeId = 'dark' | 'light';

/* ------------------------------------------------------------------ */
/* Farbrechnen                                                         */
/* ------------------------------------------------------------------ */

function toRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return [128, 128, 128];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Mischt zwei Farben linear. */
export function mix(a: string, b: string, ratio: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const t = Math.max(0, Math.min(1, ratio));
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/** Multiplikatives Übereinanderlegen - wie Druckfarbe auf Papier. */
function multiply(a: string, b: string): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex([(r1 * r2) / 255, (g1 * g2) / 255, (b1 * b2) / 255]);
}

/* ------------------------------------------------------------------ */
/* Grundfarben je Design                                               */
/* ------------------------------------------------------------------ */

interface Palette {
  paper: string;
  paperShade: string;
  sea: string;
  seaDeep: string;
  ink: string;
  neutralLand: string;
  label: string;
  labelHalo: string;
  border: string;
  borderInner: string;
  river: string;
}

const PALETTES: Record<ThemeId, Palette> = {
  dark: {
    paper: '#e4d9c2',
    paperShade: '#c9bda3',
    sea: '#112230',
    seaDeep: '#081219',
    ink: '#0e1a24',
    neutralLand: '#b9b3a4',
    label: '#1b2730',
    labelHalo: 'rgba(233, 223, 199, 0.85)',
    border: '#121d26',
    borderInner: 'rgba(24, 38, 48, 0.35)',
    river: '#3f7f9c'
  },
  light: {
    paper: '#f6efdd',
    paperShade: '#e0d5ba',
    sea: '#b9ccd4',
    seaDeep: '#93adba',
    ink: '#2b3a44',
    neutralLand: '#d8d2c4',
    label: '#22303a',
    labelHalo: 'rgba(255, 252, 244, 0.88)',
    border: '#5d6b74',
    borderInner: 'rgba(93, 107, 116, 0.3)',
    river: '#5f93ad'
  }
};

export function palette(theme: ThemeId): Palette {
  return PALETTES[theme];
}

/**
 * Landesfarbe als Tinte auf Papier.
 * Das Papier bleibt die Grundlage - die Landesfarbe färbt es nur ein.
 * So bleibt Land immer deutlich heller als das Meer.
 */
export function landFill(ink: string, theme: ThemeId): string {
  const base = PALETTES[theme].paper;
  const tinted = mix(base, ink, theme === 'dark' ? 0.38 : 0.33);
  // Ein Hauch Multiplikation gibt der Fläche die Tiefe von Druckfarbe.
  return mix(tinted, multiply(tinted, mix(ink, '#ffffff', 0.55)), 0.3);
}

/** Fläche für herrenlose Gebiete. */
export function neutralFill(theme: ThemeId): string {
  return PALETTES[theme].neutralLand;
}

/* ------------------------------------------------------------------ */
/* Wertekarten                                                         */
/* ------------------------------------------------------------------ */

/** Ein Farbton je Wertekarte, von hell nach dunkel. */
const RAMPS: Partial<Record<MapFilter, [string, string]>> = {
  economy: ['#f2e6c4', '#7a5312'],
  population: ['#e2e7ef', '#24456d'],
  stability: ['#e6efe7', '#1f5e4d'],
  military: ['#f6e3dd', '#8b2e1e'],
  supply: ['#eae6f3', '#453878'],
  resources: ['#f4ecd8', '#6c5a16'],
  culture: ['#ece7f2', '#4b3a6b'],
  religion: ['#f1ecdf', '#6a5330']
};

/** Farbe eines Wertes zwischen 0 und 1 auf der Rampe der Wertekarte. */
export function rampColor(filter: MapFilter, ratio: number, theme: ThemeId): string {
  const ramp = RAMPS[filter] ?? RAMPS.economy!;
  const [light, dark] = ramp;
  const t = Math.max(0, Math.min(1, ratio));
  // Im dunklen Design bleibt die helle Stufe etwas gedämpft, damit die
  // Karte nicht blendet.
  const from = theme === 'dark' ? mix(light, '#b9ad93', 0.25) : light;
  return mix(from, dark, t);
}

/** Beziehungskarte: zwei Pole mit neutraler Mitte. */
export function relationColor(value: number, theme: ThemeId): string {
  const neutral = theme === 'dark' ? '#b4ae9f' : '#e3dcc9';
  if (value >= 0) return mix(neutral, '#1f6d5c', Math.min(1, value / 100));
  return mix(neutral, '#9b3324', Math.min(1, -value / 100));
}

/* ------------------------------------------------------------------ */
/* Gelände                                                            */
/* ------------------------------------------------------------------ */

export const TERRAIN_PATTERN: Record<TerrainType, string> = {
  plain: 'tx-plain',
  forest: 'tx-forest',
  mountain: 'tx-mountain',
  desert: 'tx-desert',
  swamp: 'tx-swamp',
  steppe: 'tx-steppe',
  coast: 'tx-coast',
  island: 'tx-coast',
  urban: 'tx-urban'
};

/* ------------------------------------------------------------------ */
/* Legenden                                                            */
/* ------------------------------------------------------------------ */

export interface LegendSpec {
  title: string;
  kind: 'countries' | 'ramp' | 'diverging' | 'terrain';
  /** Beschriftung der Rampenenden. */
  low?: string;
  high?: string;
  ramp?: [string, string];
}

export function legendFor(filter: MapFilter, theme: ThemeId): LegendSpec {
  switch (filter) {
    case 'political':
      return { title: 'Länder', kind: 'countries' };
    case 'diplomacy':
      return {
        title: 'Beziehungen zu dir',
        kind: 'diverging',
        low: 'feindlich',
        high: 'freundlich',
        ramp: [relationColor(-100, theme), relationColor(100, theme)]
      };
    case 'terrain':
      return { title: 'Gelände', kind: 'terrain' };
    case 'military':
      return {
        title: 'Truppenstärke',
        kind: 'ramp',
        low: 'schwach',
        high: 'stark',
        ramp: [rampColor('military', 0, theme), rampColor('military', 1, theme)]
      };
    case 'economy':
      return {
        title: 'Wirtschaftskraft',
        kind: 'ramp',
        low: 'gering',
        high: 'hoch',
        ramp: [rampColor('economy', 0, theme), rampColor('economy', 1, theme)]
      };
    case 'population':
      return {
        title: 'Bevölkerung',
        kind: 'ramp',
        low: 'wenig',
        high: 'viel',
        ramp: [rampColor('population', 0, theme), rampColor('population', 1, theme)]
      };
    case 'stability':
      return {
        title: 'Zufriedenheit',
        kind: 'ramp',
        low: 'unruhig',
        high: 'ruhig',
        ramp: [rampColor('stability', 0, theme), rampColor('stability', 1, theme)]
      };
    case 'supply':
      return {
        title: 'Versorgung',
        kind: 'ramp',
        low: 'knapp',
        high: 'reichlich',
        ramp: [rampColor('supply', 0, theme), rampColor('supply', 1, theme)]
      };
    case 'resources':
      return {
        title: 'Vorkommen',
        kind: 'ramp',
        low: 'keine',
        high: 'reich',
        ramp: [rampColor('resources', 0, theme), rampColor('resources', 1, theme)]
      };
    case 'culture':
      return { title: 'Kulturen', kind: 'countries' };
    case 'religion':
      return { title: 'Glaubensgemeinschaften', kind: 'countries' };
    default:
      return { title: 'Karte', kind: 'countries' };
  }
}

/** Beschriftung der Kartenfilter. */
export const FILTER_LABELS: Record<MapFilter, string> = {
  political: 'Politisch',
  diplomacy: 'Beziehungen',
  military: 'Militär',
  economy: 'Wirtschaft',
  population: 'Bevölkerung',
  stability: 'Zufriedenheit',
  supply: 'Versorgung',
  resources: 'Vorkommen',
  culture: 'Kultur',
  religion: 'Glaube',
  terrain: 'Gelände'
};

/** Farbe für eine Kultur oder einen Glauben (stabil aus dem Namen). */
export function categoryColor(key: string, theme: ThemeId): string {
  const inks = ['#336dc1', '#1d8fa6', '#5c7944', '#a18222', '#b65412', '#d46274', '#976082', '#8375d8'];
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return landFill(inks[Math.abs(hash) % inks.length], theme);
}

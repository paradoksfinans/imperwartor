/**
 * Geometrie der Karte.
 *
 * Aus den Gebietspolygonen werden die gemeinsamen Kanten berechnet. Daraus
 * ergeben sich Binnengrenzen, Landesgrenzen, Kriegsfronten und Küstenlinien -
 * so entstehen echte Grenzlinien statt umrandeter Einzelflächen.
 */
import type { GameMapDefinition } from '../../models/types';

export type Point = [number, number];

export interface Edge {
  a: Point;
  b: Point;
  /** Die Gebiete, die diese Kante teilen (eines bei Außenkanten). */
  territories: string[];
}

export interface MapGeometry {
  edges: Edge[];
  centroids: Record<string, Point>;
  /** Fläche in Kartenquadrateinheiten - steuert, ob eine Beschriftung passt. */
  areas: Record<string, number>;
  polygons: Record<string, Point[]>;
}

const cache = new Map<string, MapGeometry>();

export function parsePolygon(points: string): Point[] {
  const numbers = points.trim().split(/[\s,]+/).map(Number);
  const result: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    if (Number.isFinite(numbers[i]) && Number.isFinite(numbers[i + 1])) {
      result.push([numbers[i], numbers[i + 1]]);
    }
  }
  return result;
}

function edgeKey(a: Point, b: Point): string {
  const round = (value: number) => Math.round(value * 10) / 10;
  const first = `${round(a[0])},${round(a[1])}`;
  const second = `${round(b[0])},${round(b[1])}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function polygonArea(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    total += x1 * y2 - x2 * y1;
  }
  return Math.abs(total) / 2;
}

function polygonCentroid(points: Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-6) {
    const sum = points.reduce<Point>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / Math.max(1, points.length), sum[1] / Math.max(1, points.length)];
  }
  area *= 0.5;
  return [cx / (6 * area), cy / (6 * area)];
}

/** Berechnet die Geometrie einer Karte einmalig und merkt sie sich. */
export function getMapGeometry(map: GameMapDefinition): MapGeometry {
  const cached = cache.get(map.id);
  if (cached) return cached;

  const polygons: Record<string, Point[]> = {};
  const centroids: Record<string, Point> = {};
  const areas: Record<string, number> = {};
  const edgeMap = new Map<string, Edge>();

  for (const territory of map.territories) {
    const points = parsePolygon(territory.polygon);
    polygons[territory.id] = points;
    centroids[territory.id] = polygonCentroid(points);
    areas[territory.id] = polygonArea(points);

    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const key = edgeKey(a, b);
      const existing = edgeMap.get(key);
      if (existing) {
        if (!existing.territories.includes(territory.id)) existing.territories.push(territory.id);
      } else {
        edgeMap.set(key, { a, b, territories: [territory.id] });
      }
    }
  }

  const geometry: MapGeometry = {
    edges: [...edgeMap.values()],
    centroids,
    areas,
    polygons
  };
  cache.set(map.id, geometry);
  return geometry;
}

/** Mittelpunkt zweier Punkte, leicht versetzt - für gebogene Seewege. */
export function curveBetween(a: Point, b: Point, bend = 0.18): string {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
}

/** Allgemeine Hilfsfunktionen ohne Spiellogik. */

/** Tiefe Kopie eines JSON-serialisierbaren Objekts. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Begrenzt einen Wert auf ein Intervall. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Erzeugt den symmetrischen Schlüssel für die Beziehungstabelle. */
export function relationKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Erzeugt eine einfache, eindeutige ID. */
export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000).toString(36)}`;
}

/** Rundet auf eine feste Anzahl Nachkommastellen. */
export function round(value: number, digits = 0): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/** Summiert eine Zahlenliste. */
export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

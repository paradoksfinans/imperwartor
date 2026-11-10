/**
 * Deterministischer Zufallsgenerator (Mulberry32).
 * Der Startwert wird im Spielzustand gespeichert, damit gespeicherte Spiele
 * exakt reproduzierbar weiterlaufen.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Sicherstellen, dass immer ein gültiger 32-Bit-Wert vorliegt.
    this.state = (Number.isFinite(seed) ? seed : 1) >>> 0 || 1;
  }

  /** Liefert eine Zahl im Bereich [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Liefert eine Zahl im Bereich [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Liefert eine ganze Zahl im Bereich [min, max] (inklusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Liefert true mit der angegebenen Wahrscheinlichkeit (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Wählt ein zufälliges Element aus einer Liste (oder null bei leerer Liste). */
  pick<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    return items[Math.floor(this.next() * items.length)] ?? null;
  }

  /** Aktueller interner Zustand, um ihn im Spielstand zu sichern. */
  get seed(): number {
    return this.state;
  }
}

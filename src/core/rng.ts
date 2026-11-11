/**
 * Zufallsgenerator mit speicherbarem Zustand.
 *
 * Der eingebaute Math.random lässt sich nicht speichern. Damit ein geladener
 * Spielstand genauso weiterlaeuft wie der gespeicherte, bringt das Spiel
 * seinen eigenen Generator mit (Mulberry32).
 */

export interface Random {
  next(): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** Streufaktor um 1 herum, z. B. spread(0.2) ergibt 0,8 bis 1,2. */
  spread(amount: number): number;
  state(): number;
}

export function createRandom(seed: number): Random {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    spread: (amount) => 1 + (next() * 2 - 1) * amount,
    state: () => s,
  };
}

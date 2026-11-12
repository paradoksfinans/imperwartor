/**
 * Prueft, dass Kodierer (Werkzeug) und Dekodierer (Spiel) zueinander passen.
 *
 * Beide stehen an verschiedenen Stellen und in verschiedenen Sprachen. Geht
 * eine Seite auseinander, waeren alle Karten still verbogen - deshalb wird
 * hier mit Zufallsdaten hin- und zurueckgerechnet.
 *
 * Aufruf: npx tsx test/koordinaten.mjs
 */
import { dekodiereRing } from '../src/core/koordinaten.ts';

const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function kodiereZahl(n) {
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let raus = '';
  for (;;) {
    const teil = v & 31;
    v = Math.floor(v / 32);
    raus += ZEICHEN[v > 0 ? teil | 32 : teil];
    if (v === 0) return raus;
  }
}
function kodiereRing(punkte, teiler) {
  let raus = ''; let lx = 0; let ly = 0;
  for (const [x, y] of punkte) {
    const gx = Math.round(x * teiler); const gy = Math.round(y * teiler);
    raus += kodiereZahl(gx - lx) + kodiereZahl(gy - ly);
    lx = gx; ly = gy;
  }
  return raus;
}

const TEILER = 8;
let fehler = 0;
let punkte = 0;
let zeichen = 0;

for (let lauf = 0; lauf < 400; lauf++) {
  const n = 3 + Math.floor(Math.random() * 180);
  const ring = [];
  let x = Math.random() * 1500; let y = Math.random() * 1200;
  for (let i = 0; i < n; i++) {
    // Typischer Fall: kleine Schritte. Dazwischen grosse Spruenge.
    const w = Math.random() < 0.03 ? 60 : 1.5;
    x = Math.max(0, Math.min(1500, x + (Math.random() - 0.5) * w));
    y = Math.max(0, Math.min(1200, y + (Math.random() - 0.5) * w));
    ring.push([Math.round(x * TEILER) / TEILER, Math.round(y * TEILER) / TEILER]);
  }
  const wort = kodiereRing(ring, TEILER);
  punkte += n; zeichen += wort.length;
  const zurueck = dekodiereRing(wort, TEILER);
  if (zurueck.length !== n * 2) { fehler++; continue; }
  for (let i = 0; i < n; i++) {
    if (Math.abs(zurueck[i * 2] - ring[i][0]) > 1e-9
      || Math.abs(zurueck[i * 2 + 1] - ring[i][1]) > 1e-9) { fehler++; break; }
  }
}

console.log(`${fehler === 0 ? 'ok  ' : 'FEHL'} 400 Umrisse hin und zurueck, ${fehler} Abweichungen`);
console.log(`     ${(zeichen / punkte).toFixed(2)} Zeichen je Punkt`
  + ` (als Text waeren es etwa 12)`);
process.exit(fehler === 0 ? 0 : 1);

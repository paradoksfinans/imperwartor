/**
 * Prueft, wie viele Kanten sich benachbarte Gebiete wirklich teilen.
 *
 * Davon haengt ab, ob sich Staatsgrenzen als echte Linien zeichnen lassen
 * statt ueber einen teuren Bildfilter. Bei den alten Karten waren es zehn
 * Prozent - zu wenig.
 */
import { readFileSync } from 'node:fs';
import { dekodiereRing } from '../src/core/koordinaten.ts';

for (const name of ['europadetail', 'mittelmeer', 'vorderasien', 'welt']) {
  const m = JSON.parse(readFileSync(`src/data/maps/${name}.json`, 'utf8'));
  const t = m.ringTeiler ?? 8;
  const kanten = new Map();
  let gesamt = 0;
  for (const p of m.provinces) {
    const ringe = p.rings
      ? p.rings.map((r) => dekodiereRing(r, t))
      : (p.points ? [p.points.split(' ').flatMap((q) => {
        const i = q.indexOf(','); return [+q.slice(0, i), +q.slice(i + 1)];
      })] : []);
    for (const z of ringe) {
      const n = z.length / 2;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const a = `${z[i * 2]},${z[i * 2 + 1]}`;
        const b = `${z[j * 2]},${z[j * 2 + 1]}`;
        const k = a < b ? a + '|' + b : b + '|' + a;
        gesamt++;
        const e = kanten.get(k);
        if (e) { if (!e.includes(p.id)) e.push(p.id); } else kanten.set(k, [p.id]);
      }
    }
  }
  let geteilt = 0;
  for (const v of kanten.values()) if (v.length >= 2) geteilt++;
  console.log(`${name.padEnd(14)} Kanten ${String(kanten.size).padStart(6)}`
    + ` | von zwei Gebieten geteilt ${String(geteilt).padStart(6)}`
    + ` = ${(100 * geteilt / kanten.size).toFixed(1)}%`);
}

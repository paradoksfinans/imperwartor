/**
 * Zeichnet eine Karte aus den Daten heraus als Bild - ohne das Spiel.
 * So laesst sich die Geometrie pruefen, bevor der Renderer umgebaut ist.
 *
 * Aufruf: node test/kartenbild.mjs <karte> <ausgabe.png>
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const name = process.argv[2] ?? 'europadetail';
const ziel = process.argv[3] ?? `/tmp/karte-${name}.png`;
const m = JSON.parse(readFileSync(`src/data/maps/${name}.json`, 'utf8'));

const farben = ['#6b8fb5','#b5736b','#7fa36b','#b5a26b','#8b6bb5','#6bb5a2','#b56b96','#9a9a6b'];
import { ringeAlsPfad } from '../src/core/koordinaten.ts';

const flaechen = m.provinces.map((p, i) => {
  const d = p.rings
    ? ringeAlsPfad(p.rings, m.ringTeiler ?? 8)
    : (p.points ? 'M' + p.points.replace(/ /g, 'L') + 'Z' : '');
  if (!d) return '';
  return `<path d="${d}" fill="${farben[i % farben.length]}" stroke="#16202a"
     stroke-width="0.6" fill-rule="evenodd"/>`;
}).join('');

const html = `<body style="margin:0;background:#0d151d">
  <svg viewBox="${m.viewBox}" width="1500" xmlns="http://www.w3.org/2000/svg">${flaechen}</svg>
</body>`;

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const s = await b.newPage({ viewport: { width: 1500, height: 1200 } });
await s.setContent(html, { waitUntil: 'load' });
await s.screenshot({ path: ziel });
await b.close();
console.log(ziel, '|', m.provinces.length, 'Gebiete');

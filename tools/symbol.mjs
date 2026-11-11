/**
 * Erzeugt das App-Symbol in allen Groessen, die iOS und Android brauchen.
 *
 * Das Zeichen ist ein Wappenschild mit Schwertkreuz und Krone - zusammen mit
 * dem Namen imperWARtor also Herrschaft und Krieg. Es wird als SVG
 * beschrieben und ueber den Browser in PNG ausgegeben, damit es in jeder
 * Groesse scharf bleibt.
 *
 * iOS braucht zwingend ein PNG mit undurchsichtigem Hintergrund: Ein
 * transparentes Symbol bekommt auf dem Startbildschirm sonst einen schwarzen
 * Kasten. Deshalb hat jede Groesse eine deckende Flaeche.
 *
 * Aufruf: node tools/symbol.mjs
 */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const AUSGABE = path.join(import.meta.dirname, '..', 'site');

/** @param {number} groesse  @param {boolean} rand  Rand fuer iOS-Kacheln */
function symbolSvg(groesse, rand) {
  const luft = rand ? groesse * 0.12 : groesse * 0.04;
  const b = groesse - luft * 2;      // Breite des Schildes
  const x = luft;
  const y = luft;
  const h = b;

  // Schildkontur: oben gerade, unten zur Spitze zulaufend
  const schild = `
    M ${x} ${y + h * 0.06}
    Q ${x} ${y} ${x + b * 0.06} ${y}
    L ${x + b * 0.94} ${y}
    Q ${x + b} ${y} ${x + b} ${y + h * 0.06}
    L ${x + b} ${y + h * 0.52}
    Q ${x + b} ${y + h * 0.82} ${x + b / 2} ${y + h}
    Q ${x} ${y + h * 0.82} ${x} ${y + h * 0.52}
    Z`;

  const mx = x + b / 2;
  const my = y + h * 0.5;
  const s = b * 0.3;    // halbe Schwertlaenge

  /** Ein Schwert, um den Mittelpunkt gedreht. */
  const schwert = (winkel) => `
    <g transform="rotate(${winkel} ${mx} ${my})">
      <line x1="${mx}" y1="${my - s}" x2="${mx}" y2="${my + s * 0.82}"
            stroke="#f4e2b8" stroke-width="${b * 0.055}" stroke-linecap="round"/>
      <line x1="${mx - b * 0.1}" y1="${my + s * 0.34}"
            x2="${mx + b * 0.1}" y2="${my + s * 0.34}"
            stroke="#d6a84e" stroke-width="${b * 0.05}" stroke-linecap="round"/>
      <circle cx="${mx}" cy="${my + s * 0.78}" r="${b * 0.045}" fill="#d6a84e"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}"
       viewBox="0 0 ${groesse} ${groesse}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d2c38"/>
        <stop offset="1" stop-color="#0d151d"/>
      </linearGradient>
      <linearGradient id="s" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#2d4254"/>
        <stop offset="0.55" stop-color="#1b2a36"/>
        <stop offset="1" stop-color="#132029"/>
      </linearGradient>
    </defs>
    <rect width="${groesse}" height="${groesse}" fill="url(#g)"/>
    <path d="${schild}" fill="url(#s)" stroke="#d6a84e"
          stroke-width="${b * 0.035}" stroke-linejoin="round"/>
    ${schwert(45)}
    ${schwert(-45)}
    <!-- Krone über dem Schwertkreuz -->
    <path d="M ${mx - b * 0.17} ${y + h * 0.3}
             L ${mx - b * 0.17} ${y + h * 0.21}
             L ${mx - b * 0.085} ${y + h * 0.265}
             L ${mx} ${y + h * 0.185}
             L ${mx + b * 0.085} ${y + h * 0.265}
             L ${mx + b * 0.17} ${y + h * 0.21}
             L ${mx + b * 0.17} ${y + h * 0.3} Z"
          fill="#d6a84e"/>
  </svg>`;
}

const GROESSEN = [
  { datei: 'symbol-192.png', px: 192, rand: false },
  { datei: 'symbol-512.png', px: 512, rand: false },
  { datei: 'apple-touch-icon.png', px: 180, rand: true },
  { datei: 'symbol-maskable-512.png', px: 512, rand: true },
];

await mkdir(AUSGABE, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const g of GROESSEN) {
  const seite = await browser.newPage({ viewport: { width: g.px, height: g.px } });
  await seite.setContent(
    `<body style="margin:0">${symbolSvg(g.px, g.rand)}</body>`,
    { waitUntil: 'load' },
  );
  await seite.screenshot({ path: path.join(AUSGABE, g.datei), omitBackground: false });
  await seite.close();
  console.log('  ', g.datei, `${g.px}x${g.px}`);
}

await browser.close();

// Das Favicon als SVG - skaliert in jeder Groesse und bleibt klein.
await writeFile(path.join(AUSGABE, 'symbol.svg'), symbolSvg(512, false), 'utf8');
console.log('   symbol.svg');

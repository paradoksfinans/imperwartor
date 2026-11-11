import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();
await p.goto('file:///mnt/user-data/outputs/imperwartor.html');
await p.waitForTimeout(600);
await p.evaluate(() => document.querySelector('[data-neues-spiel]').click());
await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('[data-starten]').click());
await p.waitForTimeout(900);
console.log(await p.evaluate(() => {
  const karte = document.querySelector('.karte');
  const svg = document.querySelector('.karte-svg');
  const welt = svg.querySelector('g');
  const r = karte.getBoundingClientRect();
  const sr = svg.getBoundingClientRect();
  // Umgrenzung der Flaechen in Bildschirmkoordinaten
  const fl = [...svg.querySelectorAll('[data-province]')];
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  for (const f of fl) { const bb = f.getBoundingClientRect();
    minX=Math.min(minX,bb.left); maxX=Math.max(maxX,bb.right);
    minY=Math.min(minY,bb.top); maxY=Math.max(maxY,bb.bottom); }
  return JSON.stringify({
    karteRect: {w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)},
    svgRect: {w: Math.round(sr.width), h: Math.round(sr.height)},
    viewBox: svg.getAttribute('viewBox'),
    transform: welt.getAttribute('transform'),
    inhaltAufSchirm: {l: Math.round(minX), t: Math.round(minY), r: Math.round(maxX), b: Math.round(maxY),
      w: Math.round(maxX-minX), h: Math.round(maxY-minY)},
    fenster: {w: innerWidth, h: innerHeight},
  }, null, 1);
}));
await b.close();

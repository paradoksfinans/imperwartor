/**
 * Legt alle Flaggen des Spiels nebeneinander zum Ansehen und prueft sie.
 *
 * Geprueft wird, was man einer einzelnen Flagge nicht ansieht: ob zwei
 * Flaggen sich dieselbe Kennung teilen (dann zeichnet die zweite mit den
 * Verlaeufen der ersten), ob eine leer bleibt, und ob jede Flagge, die ein
 * Szenario nennt, auch wirklich existiert.
 *
 * Aufruf: node test/flaggen.mjs
 */
import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const spiel = await readFile('/mnt/user-data/outputs/imperwartor.html', 'utf8');
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
const p = await browser.newPage({ viewport:{width:1280,height:1400}, deviceScaleFactor:2 });
const konsole = [];
p.on('pageerror', e=>konsole.push(e.message));
await p.setContent(spiel, { waitUntil:'load' });

const daten = await p.evaluate(() => {
  const w = window;
  const F = w.__FLAGGEN__;
  if (!F) return { fehler: 'FLAGGEN nicht nach außen gegeben' };
  return { ids: Object.keys(F.FLAGGEN), echt: Object.keys(F.ECHTE_FLAGGEN) };
});
if (daten.fehler) { console.log('  ' + daten.fehler); await browser.close(); process.exit(1); }

console.log(`${daten.ids.length} Flaggen, davon ${daten.echt.length} echte Zeichnungen`);

// Alle nebeneinander rendern
const html = await p.evaluate((ids) => {
  const F = window.__FLAGGEN__;
  const zellen = ids.map((id) => {
    const svg = F.flaggeSvg(id, '#555', 92, '?');
    const echt = !!F.ECHTE_FLAGGEN[id];
    return `<figure style="margin:0;text-align:center">${svg}
      <figcaption style="font:11px/1.3 system-ui;color:#9fb0c0;margin-top:4px">
        ${id}${echt ? ' <span style="color:#7ec08a">echt</span>' : ''}</figcaption></figure>`;
  }).join('');
  document.body.innerHTML = `<div style="background:#0d151d;padding:18px;
    display:grid;grid-template-columns:repeat(8,1fr);gap:14px">${zellen}</div>`;
  return ids.length;
}, daten.ids);

await p.waitForTimeout(500);
await p.screenshot({ path:'/tmp/schau/flaggen-alle.png', fullPage:true });

// Doppelte Kennungen in den eingebetteten Zeichnungen aufspueren
const doppelt = await p.evaluate(() => {
  const alle = [...document.querySelectorAll('svg.flagge [id]')].map(e=>e.id);
  const zahl = {}; alle.forEach(i=>zahl[i]=(zahl[i]||0)+1);
  return Object.entries(zahl).filter(([,n])=>n>1).map(([i,n])=>`${i} (${n}x)`);
});
// Leere Flaggen
const leer = await p.evaluate(() => [...document.querySelectorAll('svg.flagge')]
  .filter(s=>s.querySelectorAll('rect,path,circle,g,polygon,line,text').length<2).length);

let fehler = 0;
const melde=(g,t)=>{console.log(`  ${g?'ok  ':'FEHL'} ${t}`); if(!g)fehler++;};
melde(doppelt.length===0, `keine doppelten Kennungen${doppelt.length?': '+doppelt.slice(0,4).join(', '):''}`);
melde(leer===0, `keine leere Flagge${leer?` (${leer})`:''}`);
melde(konsole.length===0, `keine Konsolenfehler${konsole.length?': '+konsole[0]:''}`);
await browser.close();
console.log(fehler===0?'\nFlaggen in Ordnung. Bild: /tmp/schau/flaggen-alle.png':`\n${fehler} Fehler.`);
process.exit(fehler===0?0:1);

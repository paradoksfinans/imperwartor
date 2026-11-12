/**
 * Verteilung der Zeit beim Gebietstipp auf Stil, Umbruch und Malen.
 * Ergänzt test/profil.mjs, der nur den eigenen Code aufschlüsselt.
 * Aufruf: node test/spur.mjs
 */
import { chromium, devices } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
const c = await b.newContext({ ...devices['iPhone 14'], locale:'de-DE' });
const p = await c.newPage();
await p.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil:'load' });
const cdp = await c.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.getByRole('button',{name:'Neues Spiel'}).click(); await p.waitForTimeout(400);
await p.locator('[data-szenario="europa_1914"]').click(); await p.waitForTimeout(400);
await p.locator('[data-starten]').click(); await p.waitForTimeout(2500);
await p.locator('[data-einstieg-aus]').click().catch(()=>{}); await p.waitForTimeout(600);
const box = await p.locator('svg').first().boundingBox();
const ev=[]; cdp.on('Tracing.dataCollected', d=>ev.push(...d.value));
await cdp.send('Tracing.start',{categories:'devtools.timeline',transferMode:'ReportEvents'});
for (let i=0;i<8;i++){ await p.touchscreen.tap(box.x+85+i*29, box.y+195+i*24); await p.waitForTimeout(450); }
const fertig=new Promise(f=>cdp.once('Tracing.tracingComplete',f)); await cdp.send('Tracing.end'); await fertig;
const G={FunctionCall:'eigener Code',TimerFire:'eigener Code',EventDispatch:'eigener Code',
 UpdateLayoutTree:'Stil neu berechnen',Layout:'Umbruch',UpdateLayerTree:'Ebenen',
 Paint:'Malen',PaintImage:'Malen',RasterTask:'Malen',CompositeLayers:'Zusammensetzen',ParseHTML:'HTML einlesen'};
const sum=new Map();
for(const e of ev){ if(e.ph!=='X'||!e.dur)continue; const g=G[e.name]; if(!g)continue; sum.set(g,(sum.get(g)??0)+e.dur/1000); }
const t=[...sum.values()].reduce((a,x)=>a+x,0);
console.log(`Über 8 Gebietstipps, gedrosselt auf 1/4 (${(t/8).toFixed(0)} ms je Tipp):\n`);
for(const [g,ms] of [...sum].sort((a,x)=>x[1]-a[1]))
  console.log(`  ${g.padEnd(20)} ${(ms/8).toFixed(0).padStart(4)} ms je Tipp  ${'#'.repeat(Math.round(ms/t*50))}`);
await b.close();

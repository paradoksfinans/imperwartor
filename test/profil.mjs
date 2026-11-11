/**
 * Nimmt ein Rechnerprofil waehrend typischer Tipper auf und nennt die
 * teuersten Stellen beim Namen.
 *
 * Gebaut wird dafuer eigens eine unverkuerzte Fassung, sonst heissen alle
 * Funktionen im Profil nur noch "e" oder "t".
 *
 * Aufruf: node test/profil.mjs
 */

import { chromium, devices } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const server = createServer(async (_q, r) => {
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  r.end(await readFile('/mnt/user-data/outputs/imperwartor-profil.html'));
});
await new Promise((f) => server.listen(0, '127.0.0.1', f));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
const seite = await ctx.newPage();
const cdp = await ctx.newCDPSession(seite);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

async function tippe(wahl) {
  const el = seite.locator(wahl).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.scrollIntoViewIfNeeded();
  const k = await el.boundingBox();
  await seite.touchscreen.tap(k.x + k.width / 2, k.y + k.height / 2);
}

await seite.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'load' });
await seite.waitForTimeout(900);
await tippe('[data-neues-spiel]'); await seite.waitForTimeout(900);
await tippe('[data-starten]'); await seite.waitForTimeout(3500);
await tippe('[data-einstieg-aus]'); await seite.waitForTimeout(500);

await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 120 });
await cdp.send('Profiler.start');

for (let i = 0; i < 4; i++) {
  await tippe('.reiterleiste [data-panel="wirtschaft"]');
  await seite.waitForTimeout(400);
  await tippe('[data-sheet-zu]');
  await seite.waitForTimeout(400);
  await tippe('svg .gebiet.eigen');
  await seite.waitForTimeout(400);
}

const { profile } = await cdp.send('Profiler.stop');

/* Eigenzeit je Funktion aufsummieren. */
const knoten = new Map(profile.nodes.map((n) => [n.id, n]));
const eigen = new Map();
const dauer = profile.timeDeltas;
for (let i = 0; i < profile.samples.length; i++) {
  const n = knoten.get(profile.samples[i]);
  if (!n) continue;
  const f = n.callFrame;
  const name = (f.functionName || '(anonym)')
    + (f.url ? '' : ' [intern]');
  eigen.set(name, (eigen.get(name) ?? 0) + (dauer[i] ?? 0) / 1000);
}

const gesamt = [...eigen.values()].reduce((a, b) => a + b, 0);
console.log(`\nGesamte Rechenzeit in 12 Tippern: ${gesamt.toFixed(0)} ms\n`);
console.log('  ms    Anteil  Funktion');
for (const [name, ms] of [...eigen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)) {
  if (ms < 1) break;
  console.log(`  ${ms.toFixed(0).padStart(5)}  ${(100 * ms / gesamt).toFixed(1).padStart(5)}%  ${name}`);
}

await browser.close();
server.close();

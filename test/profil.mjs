/**
 * Zeigt, welche Funktion beim Gebietstipp die Zeit verbraucht.
 *
 * Die Ablaufaufzeichnung sagt nur "eigener Code". Dieser Stichproben-
 * Profiler sieht alle paar Mikrosekunden nach, welche Funktion gerade läuft,
 * und zählt mit. Was oben steht, ist der Grund für das Ruckeln.
 *
 * Gemessen wird gegen die unverkleinerte Fassung (node build.mjs --profil),
 * sonst heißen alle Funktionen "a", "b", "c".
 *
 * Aufruf: node build.mjs --profil && node test/profil.mjs
 */

import { chromium, devices } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
const seite = await ctx.newPage();
await seite.goto('file:///mnt/user-data/outputs/imperwartor-profil.html', { waitUntil: 'load' });

const cdp = await ctx.newCDPSession(seite);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await seite.getByRole('button', { name: 'Neues Spiel' }).click();
await seite.waitForTimeout(400);
await seite.locator('[data-szenario="europa_1914"]').click();
await seite.waitForTimeout(400);
await seite.locator('[data-starten]').click();
await seite.waitForTimeout(2500);
await seite.locator('[data-einstieg-aus]').click().catch(() => {});
await seite.waitForTimeout(600);

const kasten = await seite.locator('svg').first().boundingBox();

await cdp.send('Profiler.enable');
// Feine Stichproben: Ein Tipp dauert nur Millisekunden.
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');

for (let i = 0; i < 8; i++) {
  await seite.touchscreen.tap(kasten.x + 85 + i * 29, kasten.y + 195 + i * 24);
  await seite.waitForTimeout(450);
}

const { profile } = await cdp.send('Profiler.stop');

/* Eigenzeit je Funktion aufsummieren: Wie oft wurde sie als die gerade
   laufende angetroffen? Das trennt den eigentlichen Verursacher von den
   Aufrufern, die nur darauf warten. */
const knoten = new Map(profile.nodes.map((n) => [n.id, n]));
const eigen = new Map();
const dauer = new Map();

for (let i = 0; i < profile.samples.length; i++) {
  const id = profile.samples[i];
  const dt = (profile.timeDeltas[i] ?? 0) / 1000;
  if (dt <= 0 || dt > 50) continue;
  const n = knoten.get(id);
  if (!n) continue;
  const f = n.callFrame;
  const name = f.functionName || '(namenlos)';
  const datei = (f.url || '').split('/').pop();
  const schluessel = datei ? `${name}  ${datei}:${f.lineNumber + 1}` : name;
  eigen.set(schluessel, (eigen.get(schluessel) ?? 0) + dt);
  dauer.set(name, (dauer.get(name) ?? 0) + dt);
}

const gesamt = [...eigen.values()].reduce((a, b) => a + b, 0);
console.log(`Eigenzeit je Funktion über 8 Gebietstipps (${gesamt.toFixed(0)} ms gemessen):\n`);
const liste = [...eigen].sort((a, b) => b[1] - a[1]).slice(0, 18);
for (const [name, ms] of liste) {
  if (ms < 1) continue;
  const anteil = (ms / gesamt) * 100;
  console.log(`  ${ms.toFixed(0).padStart(5)} ms  ${anteil.toFixed(0).padStart(3)}%  ${'#'.repeat(Math.round(anteil / 2))} ${name}`);
}

await browser.close();

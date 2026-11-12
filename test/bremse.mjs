/**
 * Findet heraus, welcher Darstellungseffekt das Spiel ausbremst.
 *
 * Die Zerlegung des Tipps hat gezeigt: Der eigene Code braucht kaum Zeit,
 * der Browser dagegen viel. Das deutet auf teure Effekte - Bildfilter auf
 * der Karte, Weichzeichner hinter den Tafeln, grosse Schatten.
 *
 * Hier wird jeder Verdaechtige einzeln abgeschaltet und danach neu gemessen.
 * Was die Zeit deutlich druecken, ist der Schuldige.
 *
 * Aufruf: node test/bremse.mjs
 */

import { chromium, devices } from 'playwright-core';

const VERSUCHE = {
  'nichts abgeschaltet': '',
  'ohne SVG-Filter': `svg * { filter: none !important; }`,
  'ohne Weichzeichner hinter Tafeln': `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`,
  'ohne Schatten': `* { box-shadow: none !important; text-shadow: none !important; }`,
  'ohne Verläufe': `* { background-image: none !important; }`,
  'ohne Übergänge/Animationen': `* { transition: none !important; animation: none !important; }`,
  'alles davon aus': `svg * { filter: none !important; }
     * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important;
         box-shadow: none !important; text-shadow: none !important;
         background-image: none !important; transition: none !important; animation: none !important; }`,
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const ergebnisse = [];

for (const [name, css] of Object.entries(VERSUCHE)) {
  const ctx = await browser.newContext({ ...devices['iPhone 14'], locale: 'de-DE' });
  const seite = await ctx.newPage();
  await seite.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil: 'load' });
  const cdp = await ctx.newCDPSession(seite);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await seite.getByRole('button', { name: 'Neues Spiel' }).click();
  await seite.waitForTimeout(400);
  await seite.locator('[data-szenario="europa_1914"]').click();
  await seite.waitForTimeout(400);
  await seite.locator('[data-starten]').click();
  await seite.waitForTimeout(2500);
  await seite.locator('[data-einstieg-aus]').click().catch(() => {});
  await seite.waitForTimeout(400);

  if (css) await seite.addStyleTag({ content: css });
  await seite.waitForTimeout(400);

  const kasten = await seite.locator('svg').first().boundingBox();
  const zeiten = [];
  for (let i = 0; i < 6; i++) {
    await seite.evaluate(() => { window.__t0 = performance.now(); });
    await seite.touchscreen.tap(kasten.x + 90 + i * 31, kasten.y + 200 + i * 25);
    zeiten.push(await seite.evaluate(() => new Promise((f) => {
      requestAnimationFrame(() => requestAnimationFrame(
        () => f(performance.now() - window.__t0)));
    })));
    await seite.waitForTimeout(250);
  }
  zeiten.sort((a, b) => a - b);
  const mitte = zeiten[Math.floor(zeiten.length / 2)];
  ergebnisse.push([name, mitte]);
  console.log(`${name.padEnd(36)} ${mitte.toFixed(0).padStart(5)} ms`);
  await ctx.close();
}

const grund = ergebnisse[0][1];
console.log('\nErsparnis gegenüber "nichts abgeschaltet":');
for (const [name, ms] of ergebnisse.slice(1)) {
  const weg = grund - ms;
  const anteil = (weg / grund) * 100;
  console.log(`  ${name.padEnd(36)} ${weg > 0 ? '-' : '+'}${Math.abs(weg).toFixed(0).padStart(4)} ms  (${anteil.toFixed(0)}%)`);
}

await browser.close();

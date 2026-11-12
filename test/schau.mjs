/**
 * Macht Bilder vom Spiel zum Ansehen - Auswahlbildschirm (Flaggen),
 * Karte (Grenzen) und eine Tafel. Ausgabe nach /tmp/schau/.
 * Aufruf: node test/schau.mjs [szenario]
 */
import { chromium, devices } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const SZ = process.argv[2] ?? 'europa_1914';
await mkdir('/tmp/schau', { recursive: true });
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const [name, ctxOpt] of [['telefon', {...devices['iPhone 14']}], ['rechner', {viewport:{width:1440,height:900}, deviceScaleFactor:2}]]) {
  const c = await b.newContext({ ...ctxOpt, locale:'de-DE' });
  const p = await c.newPage();
  await p.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil:'load' });
  await p.getByRole('button',{name:'Neues Spiel'}).click(); await p.waitForTimeout(500);
  await p.locator(`[data-szenario="${SZ}"]`).click(); await p.waitForTimeout(900);
  await p.screenshot({ path:`/tmp/schau/${SZ}-${name}-auswahl.png`, fullPage:name==='telefon' });
  await p.locator('[data-starten]').click(); await p.waitForTimeout(3000);
  await p.locator('[data-einstieg-aus]').click().catch(()=>{}); await p.waitForTimeout(600);
  await p.screenshot({ path:`/tmp/schau/${SZ}-${name}-karte.png` });
  await c.close();
}
await b.close();
console.log('Bilder in /tmp/schau/');

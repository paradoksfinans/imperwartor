import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const t = await ctx.newPage();
const fehler = [];
t.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
t.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
const klick = (sel, i = 0) => t.evaluate(([s, k]) => {
  const el = document.querySelectorAll(s)[k];
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, [sel, i]);

await t.goto('file:///mnt/user-data/outputs/imperwartor-klein.html', { waitUntil: 'load' });
await t.waitForTimeout(1200);
console.log('Oberfläche aufgebaut:', await t.evaluate(() => !!document.querySelector('#app')?.children.length));
console.log('Boot-Hinweis weg:', await t.evaluate(() => !document.getElementById('boot')));
await klick('[data-neues-spiel]'); await t.waitForTimeout(400);
await klick('[data-szenario]', 0); await t.waitForTimeout(500);
await klick('[data-starten]'); await t.waitForTimeout(1000);
console.log('Karte gezeichnet:', await t.evaluate(() => document.querySelectorAll('.gebiet').length), 'Gebiete');
console.log('Einstieg sichtbar:', await t.evaluate(() => !!document.querySelector('.einstieg')));
// Eine Runde spielen
await klick('[data-einstieg-aus]'); await t.waitForTimeout(200);
await klick('[data-runde]'); await t.waitForTimeout(900);
console.log('Runde:', await t.evaluate(() => document.querySelector('.kopf-runde,.kopfleiste')?.innerText.match(/Runde\s*\d+/)?.[0] ?? '?'));
await t.screenshot({ path: '/tmp/bilder/k-klein.png' });
console.log('Fehler:', fehler.length, fehler.slice(0, 3));
await browser.close();

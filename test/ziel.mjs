import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const t = await ctx.newPage();
const fehler = [];
t.on('pageerror', (e) => fehler.push(e.message));
t.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
const tippe = (sel, i = 0) => t.evaluate(([s, k]) => {
  const el = document.querySelectorAll(s)[k];
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, [sel, i]);
await t.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil: 'load' });
await t.waitForTimeout(600);
await tippe('[data-neues-spiel]'); await t.waitForTimeout(400);
await tippe('[data-szenario]', 0); await t.waitForTimeout(500);
await tippe('[data-starten]'); await t.waitForTimeout(900);
// Reiter "Ziele"
const ok = await t.evaluate(() => {
  const b = [...document.querySelectorAll('[data-panel]')].find((e) => e.getAttribute('data-panel') === 'ziele');
  if (!b) return false;
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
});
console.log('Ziele-Reiter gefunden:', ok);
await t.waitForTimeout(500);
await t.screenshot({ path: '/tmp/bilder/z-ziele.png' });
console.log('Fehler:', fehler.length, fehler.slice(0, 3));
await browser.close();

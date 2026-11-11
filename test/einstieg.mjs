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
const klick = (sel, i = 0) => t.evaluate(([s, k]) => {
  const el = document.querySelectorAll(s)[k];
  if (!el) return false;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
}, [sel, i]);
const text = () => t.evaluate(() => document.querySelector('.einstieg')?.innerText.replace(/\s+/g, ' ').slice(0, 90) ?? 'KEINE EINBLENDUNG');

await t.goto('file:///mnt/user-data/outputs/imperwartor.html', { waitUntil: 'load' });
await t.waitForTimeout(500);
await klick('[data-neues-spiel]'); await t.waitForTimeout(300);
await klick('[data-szenario]', 0); await t.waitForTimeout(400);
await klick('[data-starten]'); await t.waitForTimeout(900);
console.log('1:', await text());
await t.screenshot({ path: '/tmp/bilder/e-1.png' });

await klick('[data-einstieg-weiter]'); await t.waitForTimeout(350);
console.log('2:', await text());

// Eigenes Gebiet antippen
const getroffen = await t.evaluate(() => {
  const eigen = [...document.querySelectorAll('.gebiet.eigen')];
  if (!eigen.length) return 0;
  eigen[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return eigen.length;
});
console.log('   eigene Gebiete gefunden:', getroffen);
await t.waitForTimeout(500);
console.log('3:', await text());
await t.screenshot({ path: '/tmp/bilder/e-3.png' });
console.log('Fehler:', fehler.length, fehler.slice(0, 3));
await browser.close();

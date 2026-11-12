/**
 * Prüft das Handbuch im Browser.
 *
 * Geprüft wird, was es unbrauchbar machen würde: ein Kapitel, das sich nicht
 * öffnen lässt, eine Tabelle, die leer bleibt, weil sich ein Feldname im
 * Regelwerk geändert hat, oder ein Text, der am Telefon über den Rand läuft.
 *
 * Aufruf: node test/handbuch.mjs
 */
import { chromium, devices } from 'playwright-core';
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
let fehler = 0;
const melde = (gut, t) => { console.log(`  ${gut?'ok  ':'FEHL'} ${t}`); if(!gut) fehler++; };

for (const [name, opt] of [['Rechner',{viewport:{width:1400,height:900}}],['Telefon',{...devices['iPhone 14']}]]) {
  console.log(`\n${name}`);
  const ctx = await browser.newContext({...opt, locale:'de-DE'});
  const p = await ctx.newPage();
  const konsole = [];
  p.on('pageerror', e => konsole.push(e.message));
  p.on('console', m => { if (m.type()==='error') konsole.push(m.text()); });
  await p.goto('file:///mnt/user-data/outputs/imperwartor.html',{waitUntil:'load'});
  await p.getByRole('button',{name:'Handbuch'}).click();
  await p.waitForTimeout(600);

  const kapitel = await p.locator('[data-handbuch-kapitel]').evaluateAll(
    (es) => [...new Set(es.map(e => e.getAttribute('data-handbuch-kapitel')))]);
  melde(kapitel.length >= 20, `${kapitel.length} Kapitel vorhanden`);

  let leer = 0, ueberlauf = 0;
  for (const k of kapitel) {
    /* Am Telefon ist die Kapitelliste nur in der Übersicht zu sehen -
       vorher also dorthin zurück. */
    const eintrag = p.locator(`[data-handbuch-kapitel="${k}"]`).first();
    if (!await eintrag.isVisible().catch(() => false)) {
      await p.locator('[data-handbuch-liste]:visible').first().click().catch(() => {});
      await p.waitForTimeout(220);
    }
    await p.locator(`[data-handbuch-kapitel="${k}"]:visible`).first().click({ timeout: 6000 });
    await p.waitForTimeout(160);
    const mass = await p.evaluate(() => {
      const i = document.querySelector('.hb-inhalt');
      // Leere Tabellenzellen deuten auf einen umbenannten Feldnamen im
      // Regelwerk hin - die Zahl käme dann als "undefined" oder gar nicht.
      const zellen = [...i.querySelectorAll('.hb-tabelle td')];
      const leere = zellen.filter(c => !c.textContent.trim()).length;
      const undef = i.textContent.includes('undefined') || i.textContent.includes('NaN');
      return {
        zeichen: i.textContent.trim().length,
        zellen: zellen.length, leere, undef,
        breiter: i.scrollWidth > i.clientWidth + 2,
      };
    });
    if (mass.zeichen < 300) { console.log(`    dünn: ${k} (${mass.zeichen} Zeichen)`); leer++; }
    if (mass.undef) { console.log(`    FEHL ${k}: enthält "undefined" oder "NaN"`); fehler++; }
    if (mass.leere > 0) { console.log(`    FEHL ${k}: ${mass.leere} leere Tabellenzellen`); fehler++; }
    if (mass.breiter) { console.log(`    läuft über: ${k}`); ueberlauf++; }
  }
  melde(leer === 0, `alle Kapitel haben Inhalt`);
  melde(ueberlauf === 0, `nichts läuft über den Rand`);
  melde(konsole.length === 0, `keine Konsolenfehler${konsole.length?': '+konsole[0]:''}`);
  await ctx.close();
}
await browser.close();
console.log(fehler===0 ? '\nHandbuch in Ordnung.' : `\n${fehler} Fehler.`);
process.exit(fehler===0?0:1);

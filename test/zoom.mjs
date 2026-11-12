import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('src/data/maps/europadetail.json','utf8'));
const vb = process.argv[2] ?? '560 880 340 300';
const nurLand = process.argv[3] ?? null;
const regel = process.argv[4] ?? 'evenodd';
const farben = ['#6b8fb5','#b5736b','#7fa36b','#b5a26b','#8b6bb5','#6bb5a2','#b56b96','#9a9a6b'];
const liste = nurLand ? m.provinces.filter(p=>p.land===nurLand) : m.provinces;
const fl = liste.map((p,i)=>{
  const r = p.rings ?? (p.points?[p.points]:[]);
  if(!r.length) return '';
  const d = r.map(x=>'M'+x.replace(/ /g,'L')+'Z').join('');
  return `<path d="${d}" fill="${farben[i%8]}" stroke="#16202a" stroke-width="0.4" fill-rule="${regel}"/>`
    + `<text x="${p.center[0]}" y="${p.center[1]}" font-size="4" fill="#fff" text-anchor="middle">${p.name}</text>`;
}).join('');
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const s = await b.newPage({viewport:{width:1200,height:1050}});
await s.setContent(`<body style="margin:0;background:#0d151d"><svg viewBox="${vb}" width="1200" height="1050" xmlns="http://www.w3.org/2000/svg">${fl}</svg></body>`);
await s.screenshot({path:'/tmp/zoom.png'});
await b.close();
console.log('gezeichnet:', liste.length, 'Gebiete, Regel', regel);

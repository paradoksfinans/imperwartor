import { createNewGame } from '../src/core/setup';
import { endTurn } from '../src/core/turn';
import { recalculateSupply } from '../src/core/economy';
import { runAiTurn } from '../src/core/ai';
import { provincesOf, countryArmy, powerScore, regimentsTotal, UNIT_ORDER } from '../src/core/rules';
import { createRandom } from '../src/core/rng';
import { scenarios } from '../src/data/index';
import { formatDate } from '../src/core/format';

const runden = Number(process.argv[2] ?? 60);
for (const sc of scenarios) {
  const spieler = sc.countries[0].id;
  const g = createNewGame({ scenarioId: sc.id, playerCountryId: spieler, difficulty: 'normal', seed: 11 });
  recalculateSupply(g);
  const rnd = createRandom(11);
  const t0 = Date.now(); let n = 0;
  let belagerungen = 0, schlachten = 0;
  for (let i = 0; i < runden; i++) {
    g.pendingEvent = null; g.pendingPeaceOffers = [];
    const c = g.countries[g.playerCountryId];
    if (c.alive) { c.isPlayer = false; runAiTurn(g, g.playerCountryId, rnd); c.isPlayer = true; }
    endTurn(g); n++;
    belagerungen += g.provinceOrder.filter(p => g.provinces[p].siege).length;
    if (g.status !== 'playing') break;
  }
  schlachten = g.battleReports.length;
  const top = g.countryOrder.map(id=>({n:g.countries[id].name,p:provincesOf(g,id).length}))
    .sort((a,b)=>b.p-a.p).slice(0,3);
  const lebend = g.countryOrder.filter(i=>g.countries[i].alive).length;
  // Truppengattungen im Feld
  const gattungen: Record<string,number> = {};
  for (const pid of g.provinceOrder) for (const u of UNIT_ORDER) {
    const v = g.provinces[pid].regiments[u]; if (v) gattungen[u]=(gattungen[u]??0)+v;
  }
  const vasallen = g.countryOrder.filter(i=>g.countries[i].overlordId).length;
  console.log(`${sc.name.padEnd(26)} ${String(g.provinceOrder.length).padStart(3)}Geb | R${String(g.turn).padStart(3)} ${formatDate(g.year,g.turn,g.monthsPerTurn).padStart(12)} ${g.status.padEnd(7)} | ${(( Date.now()-t0)/n).toFixed(1)}ms/R`);
  console.log(`   lebend ${lebend}/${sc.countries.length} | Schlachten ${schlachten} | Belagerungsrunden ${belagerungen} | Vasallen ${vasallen} | Kriege ${g.wars.length}`);
  console.log(`   gross: ${top.map(x=>x.n+' '+x.p).join(', ')}`);
  console.log(`   Gattungen: ${Object.entries(gattungen).map(([k,v])=>k+' '+v).join(', ')}`);
  console.log(`   Erfolge: ${g.achievements.map(a=>a.name).join(', ') || 'keine'}`);
}

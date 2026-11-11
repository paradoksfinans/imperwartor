/**
 * Misst, ob Gold im Spiel eine knappe Ressource ist.
 *
 * Kennzahl ist nicht die absolute Hoehe des Einkommens, sondern das
 * Verhaeltnis zwischen Rundenueberschuss und dem, was man damit kaufen kann.
 * Liegt es bei 15, ist jede Ausgabe folgenlos; liegt es unter 1, steht alles
 * still. Angepeilt sind ein bis drei Bauten je Runde.
 */

import { createNewGame } from '../src/core/setup';
import { recalculateSupply, computeFinances } from '../src/core/economy';
import { endTurn } from '../src/core/turn';
import { runAiTurn } from '../src/core/ai';
import { buildingCost, countryArmy, provincesOf } from '../src/core/rules';
import { createRandom } from '../src/core/rng';
import { scenarios } from '../src/data/index';

const runden = Number(process.argv[2] ?? 30);

console.log('Szenario                  Geb  Brutto  Verwlt  Forsch  Heer  '
  + 'Netto   Bau  Bau/R  Pleiten');

for (const sc of scenarios) {
  const spieler = sc.countries[0].id;
  const g = createNewGame({
    scenarioId: sc.id, playerCountryId: spieler, difficulty: 'normal', seed: 11,
  });
  recalculateSupply(g);
  const rnd = createRandom(11);

  for (let i = 0; i < runden; i++) {
    g.pendingEvent = null;
    g.pendingPeaceOffers = [];
    const c = g.countries[g.playerCountryId];
    if (c.alive) { c.isPlayer = false; runAiTurn(g, g.playerCountryId, rnd); c.isPlayer = true; }
    endTurn(g);
    if (g.status !== 'playing') break;
  }

  const f = computeFinances(g, spieler);
  const kosten = buildingCost('economy', 0, undefined, g.kostenFaktor);
  const bautenJeRunde = f.net / kosten;

  // Wie viele Laender stehen in den roten Zahlen?
  let pleiten = 0;
  let summeGold = 0;
  let lebend = 0;
  for (const cid of g.countryOrder) {
    const c = g.countries[cid];
    if (!c.alive) continue;
    lebend++;
    summeGold += c.gold;
    if (c.debt > 400 || computeFinances(g, cid).net < 0) pleiten++;
  }

  const brutto = f.taxIncome + f.tradeIncome + f.vassalIncome + f.resourceIncome;
  console.log(
    sc.name.padEnd(24).slice(0, 24),
    String(provincesOf(g, spieler).length).padStart(4),
    String(Math.round(brutto)).padStart(7),
    String(Math.round(f.adminCost)).padStart(7),
    String(Math.round(f.researchSpending)).padStart(6),
    String(Math.round(f.armyUpkeep)).padStart(6),
    String(Math.round(f.net)).padStart(7),
    String(Math.round(kosten)).padStart(6),
    bautenJeRunde.toFixed(2).padStart(6),
    `${pleiten}/${lebend}`.padStart(7),
  );
}

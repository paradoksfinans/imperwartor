/**
 * Prüft jedes Land jedes Szenarios einzeln durch.
 *
 * test/sim.ts spielt immer nur das erste Land einer Liste. Damit sieht man
 * nicht, ob ein Szenario insgesamt trägt - ob jedes Land eine Aussicht hat,
 * oder ob eines nach drei Runden zwangsläufig verschwindet, weil es kein
 * Geld, keine Nachbarn oder keinen Zugang zum Meer hat.
 *
 * Gemeldet wird je Land, wie lange es überlebt und wie es ihm dabei geht.
 * "Alle tot ausser einem" ist genauso ein Befund wie "alle leben ewig":
 * Das erste heisst, die Startwerte sind unbrauchbar, das zweite, dass
 * niemand je etwas riskiert.
 *
 * Aufruf: npx tsx test/laender.ts [szenario] [runden]
 */

import { createNewGame } from '../src/core/setup';
import { endTurn } from '../src/core/turn';
import { recalculateSupply } from '../src/core/economy';
import { runAiTurn } from '../src/core/ai';
import { provincesOf, powerScore } from '../src/core/rules';
import { createRandom } from '../src/core/rng';
import { scenarios } from '../src/data/index';

const nurSzenario = process.argv[2] && !/^\d+$/.test(process.argv[2])
  ? process.argv[2] : null;
const RUNDEN = Number(process.argv.find((a, i) => i > 1 && /^\d+$/.test(a)) ?? 40);

let gesamtFehler = 0;

for (const sc of scenarios) {
  if (nurSzenario && sc.id !== nurSzenario) continue;
  console.log(`\n=== ${sc.name} (${sc.countries.length} Länder, ${RUNDEN} Runden)`);

  const zeilen: Array<{ name: string; runden: number; gebiete: number; macht: number; stab: number }> = [];

  for (const land of sc.countries) {
    let g;
    try {
      g = createNewGame({
        scenarioId: sc.id, playerCountryId: land.id,
        difficulty: 'normal', seed: 11,
      });
      recalculateSupply(g);
    } catch (e) {
      console.log(`  FEHL ${land.name}: Aufbau scheitert - ${(e as Error).message}`);
      gesamtFehler++;
      continue;
    }

    const rnd = createRandom(11);
    let ueberlebt = 0;
    try {
      for (let r = 0; r < RUNDEN; r++) {
        const c = g.countries[g.playerCountryId];
        if (!c.alive) break;
        // Der Spielerplatz wird von derselben Rechenlogik geführt wie die
        // Gegner - sonst misst man die eigene Untätigkeit.
        c.isPlayer = false; runAiTurn(g, g.playerCountryId, rnd); c.isPlayer = true;
        endTurn(g);
        ueberlebt = r + 1;
      }
    } catch (e) {
      console.log(`  FEHL ${land.name}: Absturz in Runde ${ueberlebt + 1} - ${(e as Error).message}`);
      gesamtFehler++;
      continue;
    }

    const c = g.countries[land.id];
    zeilen.push({
      name: land.name,
      runden: ueberlebt,
      gebiete: c.alive ? provincesOf(g, land.id).length : 0,
      macht: c.alive ? Math.round(powerScore(g, land.id)) : 0,
      stab: c.alive ? Math.round(c.stability) : 0,
    });
  }

  zeilen.sort((a, b) => b.macht - a.macht);
  for (const z of zeilen) {
    const lebt = z.runden >= RUNDEN;
    const marke = lebt ? 'ok  ' : (z.runden < RUNDEN * 0.3 ? 'KURZ' : 'raus');
    console.log(`  ${marke} ${z.name.padEnd(32)} ${String(z.runden).padStart(3)} R  `
      + `${String(z.gebiete).padStart(3)} Geb  Macht ${String(z.macht).padStart(5)}  Stab ${String(z.stab).padStart(3)}`);
  }

  const lebend = zeilen.filter((z) => z.runden >= RUNDEN).length;
  const sehrKurz = zeilen.filter((z) => z.runden < RUNDEN * 0.3).length;
  console.log(`  -> ${lebend}/${zeilen.length} überstehen ${RUNDEN} Runden, `
    + `${sehrKurz} verschwinden im ersten Drittel`);
  /* Wenn fast niemand überlebt, stimmen die Startwerte nicht. */
  if (lebend < Math.max(2, zeilen.length * 0.25)) {
    console.log('  WARN zu wenige Länder überstehen das Szenario');
    gesamtFehler++;
  }
}

console.log(gesamtFehler === 0 ? '\nAlle Szenarien tragen.' : `\n${gesamtFehler} Befund(e).`);
process.exit(gesamtFehler === 0 ? 0 : 1);

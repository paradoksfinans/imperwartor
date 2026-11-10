/**
 * Rundenablauf.
 *
 * Phasen:
 *  1. Einkommen, Rohstoffe und Bevölkerung
 *  2. Bauvorhaben und Forschung
 *  3. Innere Lage, Unruhe und Rebellionen
 *  4. Seeblockaden
 *  5. KI-Aktionen (Diplomatie, Ausbau, Rekrutierung, Kämpfe)
 *  6. Koalitionen und Vasallen
 *  7. Ereignisse
 *  8. Siegprüfung, Erfolge und Rundenabschluss
 */
import type { GameState, HistorySnapshot, TurnReport } from '../models/types';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import { runAiTurn } from './ai';
import { armySize, emptyArmy, scaleArmy } from './army';
import { checkAchievements } from './achievements';
import { updateCoalitions, updateVassals } from './diplomacy';
import { applyEconomyPhase, updateBlockades } from './economy';
import { rollEventForAi, rollEventForPlayer } from './events';
import { processConstruction } from './military';
import { applyResearchPhase } from './research';
import {
  BASE_ACTION_POINTS,
  getCountryScore,
  getCountryTerritories,
  getTechBonus,
  isAtWarAtAll
} from './rules';
import { checkVictory, updateCountryStatus } from './victory';

export function processTurn(state: GameState): void {
  if (state.status !== 'playing') return;

  const rng = new Rng(state.rngSeed);
  const playerId = state.playerCountryId;
  const goldBefore = state.countries[playerId]?.gold ?? 0;
  const territoriesBefore = getCountryTerritories(state, playerId).length;
  const battlesWonBefore = state.stats.battlesWon;
  const battlesLostBefore = state.stats.battlesLost;
  const logLengthBefore = state.log.length;

  let researchGained = 0;
  let powerGained = 0;
  const reportLines: string[] = [];

  // --- Phase 1 und 2 ---
  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country || !country.isAlive) continue;
    const breakdown = applyEconomyPhase(state, countryId);
    if (countryId === playerId) {
      researchGained = breakdown.researchPoints;
      powerGained = breakdown.politicalPower;
    }
    const messages = processConstruction(state, countryId);
    if (countryId === playerId) reportLines.push(...messages);
    applyResearchPhase(state, countryId);
  }

  // --- Phase 3 ---
  applyUnrestPhase(state, rng);

  // --- Phase 4 ---
  updateBlockades(state);

  // --- Phase 5 ---
  runAiTurn(state, rng);
  if (state.pendingBattleReportId) {
    const report = state.battleReports.find((entry) => entry.id === state.pendingBattleReportId);
    // Nur Schlachten, die den Spieler betreffen, öffnen ein Fenster.
    if (!report || (report.attackerId !== playerId && report.defenderId !== playerId)) {
      state.pendingBattleReportId = null;
    }
  }

  // --- Phase 6 ---
  updateCoalitions(state);
  updateVassals(state);

  // Kriegsmüdigkeit laufender Kriege
  for (const war of state.wars) {
    for (const countryId of [...war.attackers, ...war.defenders]) {
      const country = state.countries[countryId];
      if (country) country.warExhaustion = clamp(country.warExhaustion + 2, 0, 100);
    }
  }

  // Abgelaufene Waffenstillstände entfernen
  for (const [key, until] of Object.entries(state.truces)) {
    if (until <= state.turn) delete state.truces[key];
  }

  // --- Phase 7 ---
  for (const countryId of state.countryOrder) {
    if (countryId === playerId) continue;
    rollEventForAi(state, countryId, rng);
  }
  rollEventForPlayer(state, rng);

  // --- Phase 8 ---
  updateCountryStatus(state);
  writeHistory(state);

  state.turn += 1;
  state.year += state.yearsPerTurn;

  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country) continue;
    const bonus = getTechBonus(country);
    country.maxActionPoints = BASE_ACTION_POINTS + Math.round(bonus.actionPoints);
    country.actionPoints = country.maxActionPoints;
  }

  checkVictory(state);
  checkAchievements(state);
  state.rngSeed = rng.seed;

  // --- Rundenbericht ---
  const player = state.countries[playerId];
  const newLines = state.log.slice(0, Math.max(0, state.log.length - logLengthBefore));
  const warnings: string[] = [];
  if (player) {
    if (player.gold < 150) warnings.push('Die Staatskasse ist fast leer.');
    if (player.stability < 35) warnings.push('Die Stabilität ist gefährlich niedrig.');
    if (player.warExhaustion > 60) warnings.push('Die Kriegsmüdigkeit ist sehr hoch.');
    for (const territory of getCountryTerritories(state, playerId)) {
      if (territory.unrest > 70) {
        warnings.push('In mindestens einem Gebiet droht ein Aufstand.');
        break;
      }
    }
    if (player.vassals.length === 0 && isAtWarAtAll(state, playerId) && player.stability < 50) {
      warnings.push('Krieg bei niedriger Stabilität - achte auf Aufstände.');
    }
  }

  const report: TurnReport = {
    turn: state.turn,
    year: state.year,
    goldChange: Math.round((player?.gold ?? 0) - goldBefore),
    researchGained,
    politicalPowerGained: powerGained,
    battlesWon: state.stats.battlesWon - battlesWonBefore,
    battlesLost: state.stats.battlesLost - battlesLostBefore,
    territoriesGained: Math.max(0, getCountryTerritories(state, playerId).length - territoriesBefore),
    territoriesLost: Math.max(0, territoriesBefore - getCountryTerritories(state, playerId).length),
    lines: [
      ...reportLines.map((text) => ({ turn: state.turn, type: 'project' as const, text })),
      ...newLines.filter((entry) => entry.important)
    ].slice(0, 12),
    warnings
  };
  state.lastTurnReport = report;

  if (state.log.length > 140) state.log.length = 140;
}

/** Unruhe, Desertion und Aufstände. */
function applyUnrestPhase(state: GameState, rng: Rng): void {
  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country || !country.isAlive) continue;

    for (const territory of getCountryTerritories(state, countryId)) {
      if (country.stability < 30) territory.unrest = clamp(territory.unrest + 5, 0, 100);
      if (territory.occupiedTurns > 0) territory.unrest = clamp(territory.unrest + 3, 0, 100);
      if (territory.culture !== country.culture) territory.unrest = clamp(territory.unrest + 2, 0, 100);
      if (territory.religion !== country.religion) territory.unrest = clamp(territory.unrest + 1.5, 0, 100);
      if (territory.blockaded) territory.unrest = clamp(territory.unrest + 2, 0, 100);

      if (territory.unrest > 65) {
        const deserted = scaleArmy(territory.army, 0.07);
        territory.army = {
          infantry: territory.army.infantry - deserted.infantry,
          cavalry: territory.army.cavalry - deserted.cavalry,
          artillery: territory.army.artillery - deserted.artillery,
          fleet: territory.army.fleet - deserted.fleet
        };

        if (
          state.options.rebellions &&
          territory.unrest > 78 &&
          territory.id !== country.capitalId &&
          rng.chance(0.12)
        ) {
          territory.ownerId = '';
          territory.army = {
            ...emptyArmy(),
            infantry: Math.max(8, Math.floor(territory.population / 150)),
            cavalry: 2
          };
          territory.unrest = 45;
          territory.occupiedTurns = 0;
          territory.culture = 'Aufständische';
          country.stability = clamp(country.stability - 6, 0, 100);
          state.log.unshift({
            turn: state.turn,
            type: 'rebellion',
            text: `Aufstand: Ein Gebiet von ${country.name} erklärt seine Unabhängigkeit.`,
            important: countryId === state.playerCountryId
          });
        }
      }
    }
  }

  // Unabhängige Gebiete verstärken langsam ihre Miliz
  for (const territory of Object.values(state.territories)) {
    if (territory.ownerId) continue;
    if (armySize(territory.army) < Math.floor(territory.population / 130)) {
      territory.army.infantry += 1;
    }
  }
}

function writeHistory(state: GameState): void {
  const snapshot: HistorySnapshot = { turn: state.turn, entries: {} };
  for (const countryId of state.countryOrder) {
    const territories = getCountryTerritories(state, countryId);
    snapshot.entries[countryId] = {
      territories: territories.length,
      army: territories.reduce((total, t) => total + armySize(t.army), 0),
      gold: Math.round(state.countries[countryId]?.gold ?? 0),
      score: getCountryScore(state, countryId)
    };
  }
  state.history.push(snapshot);
  if (state.history.length > 80) state.history.shift();
}

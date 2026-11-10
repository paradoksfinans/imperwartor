/**
 * Kampfberechnung mit Truppengattungen, Feldherren und mehreren Gefechtsrunden.
 *
 * Angriffskraft  = Summe(Einheiten x Angriffswert x Geländefaktor)
 *                  x Technologie x Moral x Versorgung x Feldherr x Regierung x Landesbonus x Zufall
 * Verteidigung   = Summe(Einheiten x Verteidigungswert x Geländefaktor)
 *                  x Technologie x Moral x Gelände x Befestigung x Versorgung x Feldherr x Zufall
 *
 * Belagerungsgeschütze senken den Befestigungsfaktor. Der Zufallsfaktor liegt
 * zwischen 0.88 und 1.12 und kann das Ergebnis beeinflussen, aber nicht bestimmen.
 */
import type {
  Army,
  BattleModifier,
  BattleReport,
  BattleRound,
  GameState
} from '../models/types';
import { getTerritoryDefinition } from '../services/contentService';
import { clamp, createId, round } from '../utils/helpers';
import { Rng } from '../utils/rng';
import {
  addArmies,
  armyPower,
  armySize,
  cloneArmy,
  distributeLosses,
  emptyArmy,
  siegePower,
  subtractArmies
} from './army';
import { awardExperience, generalBonus, getGeneral } from './generals';
import {
  GOVERNMENT_INFO,
  TERRAIN_INFO,
  getFortificationFactor,
  getMoraleFactor,
  getProjectBonus,
  getSupplyFactor,
  getTechBonus
} from './rules';

export interface BattleInput {
  state: GameState;
  attackerId: string;
  defenderId: string;
  fromTerritoryId: string;
  targetTerritoryId: string;
  attackingArmy: Army;
  rng: Rng;
}

const MAX_ROUNDS = 3;

/**
 * Führt einen Kampf durch, verändert den Zustand (Verluste, Besitzwechsel)
 * und liefert einen nachvollziehbaren Kampfbericht zurück.
 */
export function resolveBattle(input: BattleInput): BattleReport {
  const { state, attackerId, defenderId, fromTerritoryId, targetTerritoryId, rng } = input;

  const source = state.territories[fromTerritoryId];
  const target = state.territories[targetTerritoryId];
  const attacker = state.countries[attackerId];
  const defender = state.countries[defenderId];

  const definition = getTerritoryDefinition(state.mapId, targetTerritoryId);
  const terrain = TERRAIN_INFO[definition.terrain];

  const attackingArmy = cloneArmy(input.attackingArmy);
  const defendingArmy = cloneArmy(target.army);

  // --- Feldherren ---
  const attackerGeneral = attacker ? getGeneral(attacker, source.generalId) : null;
  const defenderGeneral = defender ? getGeneral(defender, target.generalId) : null;
  const attackerGeneralBonus = generalBonus(attackerGeneral);
  const defenderGeneralBonus = generalBonus(defenderGeneral);

  // --- Modifikatoren ---
  const attackerTech = attacker ? 1 + getTechBonus(attacker).attack : 1;
  const attackerMorale = attacker ? getMoraleFactor(attacker) : 1;
  const attackerSupply = attacker ? getSupplyFactor(state, attacker, source) : 1;
  const attackerCommand = 1 + source.buildings.barracks * 0.03 + attackerGeneralBonus.attack;
  const attackerGovernment = attacker ? GOVERNMENT_INFO[attacker.government].attack : 1;
  const attackerTrait = attacker ? attacker.traits.attack : 1;

  const defenderTech = defender ? 1 + getTechBonus(defender).defense : 1;
  const defenderProjects = defender ? getProjectBonus(defender).defense : 0;
  const defenderMorale = defender ? getMoraleFactor(defender) : 0.88;
  const defenderSupply = defender ? getSupplyFactor(state, defender, target) : 0.9;
  const defenderGovernment = defender ? GOVERNMENT_INFO[defender.government].defense : 1;
  const defenderTrait = defender ? defender.traits.defense : 1;
  const defenderCommand = 1 + defenderGeneralBonus.defense;

  // Belagerung: Artillerie und Feldherr senken die Befestigungswirkung
  const techSiege = attacker ? getTechBonus(attacker).siege : 0;
  const siegeEffect =
    (siegePower(attackingArmy) / Math.max(1, armySize(attackingArmy))) +
    attackerGeneralBonus.siege +
    techSiege;
  const fortificationFactor = getFortificationFactor(target, siegeEffect);

  const attackerFlat =
    attackerTech * attackerMorale * attackerSupply * attackerCommand *
    attackerGovernment * attackerTrait;
  const defenderFlat =
    (defenderTech + defenderProjects) * defenderMorale * defenderSupply * defenderCommand *
    defenderGovernment * defenderTrait * terrain.defense * fortificationFactor;

  // --- Gefechtsrunden ---
  let currentAttackers = cloneArmy(attackingArmy);
  let currentDefenders = cloneArmy(defendingArmy);
  let attackerLosses = emptyArmy();
  let defenderLosses = emptyArmy();
  const rounds: BattleRound[] = [];
  let lastAttackPower = 0;
  let lastDefensePower = 0;

  for (let roundIndex = 1; roundIndex <= MAX_ROUNDS; roundIndex += 1) {
    if (armySize(currentAttackers) <= 0 || armySize(currentDefenders) <= 0) break;

    const attackerLuck = rng.range(0.88, 1.12);
    const defenderLuck = rng.range(0.88, 1.12);

    const attackPower =
      armyPower(currentAttackers, 'attack', definition.terrain) * attackerFlat * attackerLuck;
    const defensePower =
      Math.max(0.5, armyPower(currentDefenders, 'defense', definition.terrain)) *
      defenderFlat * defenderLuck;

    lastAttackPower = attackPower;
    lastDefensePower = defensePower;

    const total = attackPower + defensePower;
    const attackShare = total > 0 ? attackPower / total : 1;

    const attackerLossRate = clamp(0.05 + 0.26 * (1 - attackShare), 0.02, 0.4);
    const defenderLossRate = clamp(0.05 + 0.3 * attackShare, 0.02, 0.45);

    const roundAttackerLosses = distributeLosses(
      currentAttackers,
      Math.round(armySize(currentAttackers) * attackerLossRate)
    );
    const roundDefenderLosses = distributeLosses(
      currentDefenders,
      Math.round(armySize(currentDefenders) * defenderLossRate)
    );

    currentAttackers = subtractArmies(currentAttackers, roundAttackerLosses);
    currentDefenders = subtractArmies(currentDefenders, roundDefenderLosses);
    attackerLosses = addArmies(attackerLosses, roundAttackerLosses);
    defenderLosses = addArmies(defenderLosses, roundDefenderLosses);

    rounds.push({
      round: roundIndex,
      attackPower: round(attackPower, 1),
      defensePower: round(defensePower, 1),
      attackerLosses: armySize(roundAttackerLosses),
      defenderLosses: armySize(roundDefenderLosses)
    });
  }

  // --- Entscheidung ---
  const finalAttackPower = armyPower(currentAttackers, 'attack', definition.terrain) * attackerFlat;
  const finalDefensePower =
    armyPower(currentDefenders, 'defense', definition.terrain) * defenderFlat;
  const attackerWins =
    armySize(currentAttackers) > 0 &&
    (armySize(currentDefenders) <= 0 || finalAttackPower > finalDefensePower);

  // --- Zustand anpassen ---
  source.army = subtractArmies(source.army, attackingArmy);
  target.army = cloneArmy(currentDefenders);

  let captured = false;
  if (attackerWins) {
    captured = true;
    const previousOwner = target.ownerId;
    target.ownerId = attackerId;
    target.army = cloneArmy(currentAttackers);
    target.generalId = null;
    target.unrest = clamp(target.unrest + 42, 0, 100);
    target.stability = clamp(target.stability - 22, 0, 100);
    target.devastation = clamp(target.devastation + 28, 0, 100);
    target.occupiedTurns = 1;
    target.population = Math.max(120, Math.round(target.population * 0.95));
    recordCapture(state, attackerId, previousOwner, targetTerritoryId);
    // Der verteidigende Feldherr verliert sein Kommando
    if (defender && defenderGeneral) {
      defenderGeneral.assignedTerritoryId = null;
    }
  } else {
    // Überlebende Angreifer kehren zurück
    source.army = addArmies(source.army, currentAttackers);
  }

  // --- Feldherr: Erfahrung und Risiko ---
  let generalLost = false;
  const levelUpMessages: string[] = [];
  if (attackerGeneral) {
    const message = awardExperience(attackerGeneral, attackerWins ? 60 : 30, attackerWins);
    if (message) levelUpMessages.push(message);
    if (!attackerWins && rng.chance(0.07) && attacker) {
      attacker.generals = attacker.generals.filter((g) => g.id !== attackerGeneral.id);
      if (source.generalId === attackerGeneral.id) source.generalId = null;
      generalLost = true;
    }
  }
  if (defenderGeneral && defender) {
    const message = awardExperience(defenderGeneral, attackerWins ? 25 : 55, !attackerWins);
    if (message) levelUpMessages.push(message);
    if (attackerWins && rng.chance(0.07)) {
      defender.generals = defender.generals.filter((g) => g.id !== defenderGeneral.id);
    }
  }
  for (const message of levelUpMessages) {
    state.log.unshift({ turn: state.turn, type: 'system', text: message });
  }

  const modifiers: BattleModifier[] = [
    { label: 'Gelände', value: `${terrain.name} x${terrain.defense.toFixed(2)}`, positiveFor: terrain.defense > 1 ? 'defender' : 'none' },
    { label: 'Befestigung', value: `Stufe ${target.fortification} x${fortificationFactor.toFixed(2)}`, positiveFor: fortificationFactor > 1 ? 'defender' : 'none' },
    { label: 'Belagerungswirkung', value: siegeEffect > 0 ? `-${siegeEffect.toFixed(2)} Befestigung` : 'keine', positiveFor: siegeEffect > 0 ? 'attacker' : 'none' },
    { label: 'Technologie Angreifer', value: `x${attackerTech.toFixed(2)}`, positiveFor: attackerTech > 1 ? 'attacker' : 'none' },
    { label: 'Technologie Verteidiger', value: `x${(defenderTech + defenderProjects).toFixed(2)}`, positiveFor: defenderTech > 1 ? 'defender' : 'none' },
    { label: 'Moral Angreifer', value: `x${attackerMorale.toFixed(2)}`, positiveFor: attackerMorale > 1 ? 'attacker' : 'none' },
    { label: 'Moral Verteidiger', value: `x${defenderMorale.toFixed(2)}`, positiveFor: defenderMorale > 1 ? 'defender' : 'none' },
    { label: 'Versorgung Angreifer', value: `x${attackerSupply.toFixed(2)}`, positiveFor: attackerSupply >= 1 ? 'attacker' : 'defender' },
    { label: 'Versorgung Verteidiger', value: `x${defenderSupply.toFixed(2)}`, positiveFor: defenderSupply >= 1 ? 'defender' : 'attacker' },
    {
      label: 'Feldherr Angreifer',
      value: attackerGeneral ? `${attackerGeneral.name} (${attackerGeneral.trait}, Stufe ${attackerGeneral.level})` : 'keiner',
      positiveFor: attackerGeneral ? 'attacker' : 'none'
    },
    {
      label: 'Feldherr Verteidiger',
      value: defenderGeneral ? `${defenderGeneral.name} (${defenderGeneral.trait}, Stufe ${defenderGeneral.level})` : 'keiner',
      positiveFor: defenderGeneral ? 'defender' : 'none'
    },
    { label: 'Landesbonus Angreifer', value: `x${(attackerTrait * attackerGovernment).toFixed(2)}`, positiveFor: 'attacker' },
    { label: 'Landesbonus Verteidiger', value: `x${(defenderTrait * defenderGovernment).toFixed(2)}`, positiveFor: 'defender' }
  ];

  const report: BattleReport = {
    id: createId('battle'),
    turn: state.turn,
    attackerId,
    attackerName: attacker?.name ?? 'Unabhängig',
    defenderId,
    defenderName: defender?.name ?? 'Freie Gebiete',
    territoryId: targetTerritoryId,
    territoryName: definition.name,
    terrain: definition.terrain,
    attackingArmy,
    defendingArmy,
    attackerLosses,
    defenderLosses,
    remainingAttackers: cloneArmy(currentAttackers),
    remainingDefenders: cloneArmy(currentDefenders),
    attackPower: round(lastAttackPower, 1),
    defensePower: round(lastDefensePower, 1),
    rounds,
    winner: attackerWins ? 'attacker' : 'defender',
    captured,
    modifiers,
    generalName: attackerGeneral ? `${attackerGeneral.title} ${attackerGeneral.name}` : null,
    generalLost
  };

  state.battleReports.unshift(report);
  if (state.battleReports.length > 40) state.battleReports.length = 40;

  // --- Folgen für Moral, Stabilität und Statistik ---
  if (attacker) {
    attacker.warExhaustion = clamp(attacker.warExhaustion + (attackerWins ? 2 : 5), 0, 100);
    attacker.stability = clamp(attacker.stability + (attackerWins ? 2 : -3), 0, 100);
    attacker.prestige = clamp(attacker.prestige + (attackerWins ? 3 : -2), -60, 120);
  }
  if (defender) {
    defender.warExhaustion = clamp(defender.warExhaustion + (attackerWins ? 6 : 2), 0, 100);
    defender.stability = clamp(defender.stability + (attackerWins ? -6 : 3), 0, 100);
    defender.prestige = clamp(defender.prestige + (attackerWins ? -3 : 3), -60, 120);
  }

  if (attackerId === state.playerCountryId) {
    if (attackerWins) state.stats.battlesWon += 1;
    else state.stats.battlesLost += 1;
    if (captured) state.stats.territoriesConquered += 1;
    state.stats.unitsLost += armySize(attackerLosses);
  }
  if (defenderId === state.playerCountryId) {
    if (attackerWins) state.stats.battlesLost += 1;
    else state.stats.battlesWon += 1;
    state.stats.unitsLost += armySize(defenderLosses);
  }

  updateWarScore(state, attackerId, defenderId, attackerWins ? 11 : -6, target.id);
  return report;
}

function recordCapture(
  state: GameState,
  newOwnerId: string,
  previousOwnerId: string,
  territoryId: string
): void {
  const war = state.wars.find(
    (entry) =>
      (entry.attackers.includes(newOwnerId) && entry.defenders.includes(previousOwnerId)) ||
      (entry.attackers.includes(previousOwnerId) && entry.defenders.includes(newOwnerId))
  );
  if (!war) return;
  war.captured.push({ territoryId, previousOwnerId, newOwnerId });
}

function updateWarScore(
  state: GameState,
  attackerId: string,
  defenderId: string,
  delta: number,
  territoryId: string
): void {
  const war = state.wars.find(
    (entry) =>
      (entry.attackers.includes(attackerId) && entry.defenders.includes(defenderId)) ||
      (entry.attackers.includes(defenderId) && entry.defenders.includes(attackerId))
  );
  if (!war) return;
  const defenderCountry = state.countries[defenderId];
  const capitalBonus = defenderCountry?.capitalId === territoryId ? 10 : 0;
  const attackerIsWarAttacker = war.attackers.includes(attackerId);
  const total = delta + (delta > 0 ? capitalBonus : 0);
  war.score = clamp(war.score + (attackerIsWarAttacker ? total : -total), -100, 100);
}

/** Vorschau der Erfolgsaussichten ohne Zustandsänderung. */
export function estimateBattleOdds(
  state: GameState,
  attackerId: string,
  fromTerritoryId: string,
  targetTerritoryId: string,
  attackingArmy: Army
): number {
  const source = state.territories[fromTerritoryId];
  const target = state.territories[targetTerritoryId];
  if (!source || !target) return 0;
  if (armySize(attackingArmy) <= 0) return 0;

  const attacker = state.countries[attackerId];
  const defender = state.countries[target.ownerId];
  const definition = getTerritoryDefinition(state.mapId, targetTerritoryId);
  const terrain = TERRAIN_INFO[definition.terrain];

  const attackerGeneral = attacker ? getGeneral(attacker, source.generalId) : null;
  const defenderGeneral = defender ? getGeneral(defender, target.generalId) : null;
  const aBonus = generalBonus(attackerGeneral);
  const dBonus = generalBonus(defenderGeneral);

  const siegeEffect =
    siegePower(attackingArmy) / Math.max(1, armySize(attackingArmy)) +
    aBonus.siege +
    (attacker ? getTechBonus(attacker).siege : 0);

  const attackPower =
    armyPower(attackingArmy, 'attack', definition.terrain) *
    (attacker ? 1 + getTechBonus(attacker).attack : 1) *
    (attacker ? getMoraleFactor(attacker) : 1) *
    (attacker ? getSupplyFactor(state, attacker, source) : 1) *
    (1 + source.buildings.barracks * 0.03 + aBonus.attack) *
    (attacker ? attacker.traits.attack * GOVERNMENT_INFO[attacker.government].attack : 1);

  const defensePower =
    Math.max(0.5, armyPower(target.army, 'defense', definition.terrain)) *
    (defender ? 1 + getTechBonus(defender).defense + getProjectBonus(defender).defense : 1) *
    (defender ? getMoraleFactor(defender) : 0.88) *
    terrain.defense *
    getFortificationFactor(target, siegeEffect) *
    (defender ? getSupplyFactor(state, defender, target) : 0.9) *
    (1 + dBonus.defense) *
    (defender ? defender.traits.defense * GOVERNMENT_INFO[defender.government].defense : 1);

  const total = attackPower + defensePower;
  return total > 0 ? clamp(attackPower / total, 0, 1) : 0;
}

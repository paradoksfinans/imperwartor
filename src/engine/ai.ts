/**
 * Künstliche Intelligenz der nicht gespielten Länder.
 *
 * Die KI arbeitet in festen Schritten: Forschung, Diplomatie, Frieden, Ausbau,
 * Rekrutierung, Feldherren, Truppenverlagerung und Angriff. Jede Entscheidung
 * beruht auf bewerteten Kennzahlen. Der Schwierigkeitsgrad bestimmt nur, wie
 * zuverlässig die jeweils beste Option gewählt wird - die KI erhält keine
 * zusätzlichen Ressourcen.
 */
import type { AiPersonality, Army, BuildingId, GameState, ProjectId } from '../models/types';
import { getAllProjects, getTerritoryDefinition } from '../services/contentService';
import { clamp } from '../utils/helpers';
import { Rng } from '../utils/rng';
import {
  armySize,
  canAfford,
  emptyArmy,
  getAvailableUnits,
  landSize,
  recruitmentCost,
  scaleArmy
} from './army';
import { estimateBattleOdds } from './combat';
import {
  concludePeace,
  declareWar,
  getPeaceDemands,
  getWarScoreFor,
  finishWar
} from './diplomacy';
import { assignGeneral, hireGeneral } from './generals';
import {
  attackTerritory,
  constructBuilding,
  moveTroops,
  recruitTroops,
  startProject
} from './military';
import { getAvailableTechnologies, setResearch } from './research';
import {
  DIFFICULTY_INFO,
  areAllied,
  areAtWar,
  changeRelation,
  computeThreat,
  getCountryArmySize,
  getCountryScore,
  getCountryTerritories,
  getGeneralLimit,
  getNeighbourCountries,
  getNeighbourIds,
  getRelation,
  getRecruitDiscount,
  hasTrade,
  hasTruce,
  isAtWarAtAll
} from './rules';
import { runEspionageMission } from './espionage';

interface PersonalityProfile {
  aggression: number;
  minAttackOdds: number;
  buildRatio: number;
  recruitRatio: number;
  diplomacy: number;
  espionage: number;
  navalFocus: number;
}

const PROFILES: Record<AiPersonality, PersonalityProfile> = {
  aggressive:     { aggression: 0.85, minAttackOdds: 0.5,  buildRatio: 0.2,  recruitRatio: 0.6,  diplomacy: 0.2, espionage: 0.3, navalFocus: 0.2 },
  defensive:      { aggression: 0.18, minAttackOdds: 0.74, buildRatio: 0.48, recruitRatio: 0.4,  diplomacy: 0.45, espionage: 0.2, navalFocus: 0.25 },
  economic:       { aggression: 0.22, minAttackOdds: 0.72, buildRatio: 0.6,  recruitRatio: 0.25, diplomacy: 0.55, espionage: 0.25, navalFocus: 0.3 },
  diplomatic:     { aggression: 0.28, minAttackOdds: 0.66, buildRatio: 0.42, recruitRatio: 0.3,  diplomacy: 0.85, espionage: 0.35, navalFocus: 0.25 },
  expansionist:   { aggression: 0.78, minAttackOdds: 0.55, buildRatio: 0.3,  recruitRatio: 0.52, diplomacy: 0.3, espionage: 0.3, navalFocus: 0.3 },
  opportunistic:  { aggression: 0.55, minAttackOdds: 0.62, buildRatio: 0.36, recruitRatio: 0.42, diplomacy: 0.5, espionage: 0.5, navalFocus: 0.35 },
  isolationist:   { aggression: 0.12, minAttackOdds: 0.8,  buildRatio: 0.55, recruitRatio: 0.35, diplomacy: 0.25, espionage: 0.15, navalFocus: 0.2 }
};

export function runAiTurn(state: GameState, rng: Rng): void {
  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country || country.isPlayer || !country.isAlive) continue;
    try {
      runSingleAi(state, countryId, rng);
    } catch (error) {
      console.error(`KI-Fehler bei ${countryId}:`, error);
    }
  }
}

function runSingleAi(state: GameState, countryId: string, rng: Rng): void {
  const country = state.countries[countryId];
  if (!country) return;
  const profile = PROFILES[country.ai] ?? PROFILES.opportunistic;
  const difficulty = DIFFICULTY_INFO[state.difficulty] ?? DIFFICULTY_INFO.normal;
  const efficiency = difficulty.aiEfficiency;

  chooseResearch(state, countryId);
  handlePeace(state, countryId, efficiency);
  handleDiplomacy(state, countryId, profile, efficiency, difficulty.aiAggression, rng);
  handleGenerals(state, countryId, efficiency);
  handleProjects(state, countryId, profile, efficiency);
  handleConstruction(state, countryId, profile, efficiency);
  handleRecruitment(state, countryId, profile, efficiency);
  handleEspionage(state, countryId, profile, efficiency, rng);
  handleMovement(state, countryId, efficiency, rng);
  handleAttacks(state, countryId, profile, efficiency, rng);
}

/* ------------------------------------------------------------------ */
/* Forschung                                                           */
/* ------------------------------------------------------------------ */

function chooseResearch(state: GameState, countryId: string): void {
  const country = state.countries[countryId];
  if (!country || country.currentResearchId) return;
  const available = getAvailableTechnologies(state, countryId);
  if (available.length === 0) return;

  const preferMilitary = country.ai === 'aggressive' || country.ai === 'expansionist';
  const preferDefense = country.ai === 'defensive' || country.ai === 'isolationist';
  const preferEconomy = country.ai === 'economic' || country.ai === 'diplomatic';

  const sorted = [...available].sort((a, b) => {
    const score = (category: string, cost: number) => {
      let value = 1.4;
      if (category === 'military') value = preferMilitary ? 3.1 : 1.6;
      if (category === 'defense') value = preferDefense ? 3.0 : 1.6;
      if (category === 'economy') value = preferEconomy ? 2.8 : 2.0;
      if (category === 'administration') value = 2.2;
      if (category === 'logistics') value = 1.8;
      if (category === 'education') value = 2.1;
      if (category === 'naval') value = 1.5;
      return value - cost / 450;
    };
    return score(b.category, b.cost) - score(a.category, a.cost);
  });
  setResearch(state, countryId, sorted[0].id);
}

/* ------------------------------------------------------------------ */
/* Frieden                                                             */
/* ------------------------------------------------------------------ */

function handlePeace(state: GameState, countryId: string, efficiency: number): void {
  const country = state.countries[countryId];
  if (!country) return;

  for (const war of [...state.wars]) {
    const isAttacker = war.attackers.includes(countryId);
    const isDefender = war.defenders.includes(countryId);
    if (!isAttacker && !isDefender) continue;

    const myScore = getWarScoreFor(war, countryId);
    const duration = state.turn - war.startTurn;
    const wantsPeace = myScore < -20 || country.warExhaustion > 55 || duration > 14;
    const winning = myScore >= 35;

    const opponents = isAttacker ? war.defenders : war.attackers;
    const playerInvolved = opponents.includes(state.playerCountryId);

    // Gegen den Spieler entscheidet der Spieler über den Frieden.
    if (playerInvolved) {
      if (winning && duration > 3 && efficiency > 0.6) {
        // Die KI stellt selbst Forderungen, wenn sie klar führt.
        const loserId = opponents[0];
        const demands = getPeaceDemands(state, war, countryId, loserId)
          .filter((demand) => demand.territoryId)
          .slice(0, Math.max(1, Math.floor(myScore / 25)));
        if (demands.length > 0 && myScore >= 45) {
          const result = concludePeace(
            state,
            war,
            countryId,
            loserId,
            demands.map((d) => d.id),
            false
          );
          if (result.accepted) {
            state.log.unshift({
              turn: state.turn,
              type: 'peace',
              text: `${country.name} erzwingt einen Frieden.`,
              important: true
            });
          }
        }
      }
      continue;
    }

    if (!wantsPeace && !winning) continue;

    const opponentsWantPeace = opponents.every((id) => {
      const opponent = state.countries[id];
      if (!opponent) return true;
      const opponentScore = getWarScoreFor(war, id);
      return opponentScore < 35 || opponent.warExhaustion > 50 || duration > 14;
    });
    if (!opponentsWantPeace) continue;

    const winnerId = war.score >= 0 ? war.attackers[0] : war.defenders[0];
    const loserId = war.score >= 0 ? war.defenders[0] : war.attackers[0];
    const winnerScore = getWarScoreFor(war, winnerId);

    if (Math.abs(war.score) < 25) {
      finishWar(state, war, true);
      state.log.unshift({
        turn: state.turn,
        type: 'peace',
        text: `${state.countries[winnerId]?.name} und ${state.countries[loserId]?.name} schließen einen weißen Frieden.`
      });
      continue;
    }

    const demands = getPeaceDemands(state, war, winnerId, loserId);
    const chosen: string[] = [];
    let budget = winnerScore;
    for (const demand of demands) {
      if (demand.id === 'annex' && winnerScore < 95) continue;
      if (demand.cost <= budget) {
        chosen.push(demand.id);
        budget -= demand.cost;
      }
    }
    concludePeace(state, war, winnerId, loserId, chosen, true);
  }
}

/* ------------------------------------------------------------------ */
/* Diplomatie                                                          */
/* ------------------------------------------------------------------ */

function handleDiplomacy(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number,
  aggressionFactor: number,
  rng: Rng
): void {
  const country = state.countries[countryId];
  if (!country || country.overlordId) return;

  // Beziehungen pflegen und Handel treiben
  if (rng.chance(profile.diplomacy * efficiency * 0.45) && country.gold > 700 && country.actionPoints > 1) {
    const friend = state.countryOrder
      .filter(
        (id) =>
          id !== countryId &&
          state.countries[id]?.isAlive &&
          !areAtWar(state, countryId, id) &&
          getRelation(state, countryId, id) > -10
      )
      .sort((a, b) => getRelation(state, countryId, b) - getRelation(state, countryId, a))[0];
    if (friend) {
      country.gold -= 120;
      country.actionPoints -= 1;
      changeRelation(state, countryId, friend, 9);
      if (
        !hasTrade(state, countryId, friend) &&
        getRelation(state, countryId, friend) > 30 &&
        country.politicalPower > 10
      ) {
        country.politicalPower -= 4;
        state.trades.push({
          id: `trade_${countryId}_${friend}_${state.turn}`,
          a: countryId,
          b: friend,
          since: state.turn
        });
      }
    }
  }

  // Bündnisse gegen gemeinsame Bedrohungen
  if (rng.chance(profile.diplomacy * efficiency * 0.3) && country.politicalPower > 25) {
    const partner = state.countryOrder.find(
      (id) =>
        id !== countryId &&
        state.countries[id]?.isAlive &&
        !areAllied(state, countryId, id) &&
        getRelation(state, countryId, id) >= 50
    );
    if (partner) {
      country.politicalPower -= 10;
      const existing = state.alliances.find(
        (alliance) => alliance.members.includes(countryId) && !alliance.againstId
      );
      if (existing && existing.members.length < 4) {
        if (!existing.members.includes(partner)) existing.members.push(partner);
      } else if (!existing) {
        state.alliances.push({
          id: `alliance_${countryId}_${state.turn}`,
          name: `Pakt von ${country.name}`,
          members: [countryId, partner],
          leader: countryId,
          foundedTurn: state.turn,
          againstId: null
        });
      }
      changeRelation(state, countryId, partner, 12);
    }
  }

  // Ansprüche vorbereiten
  if (country.politicalPower > 55 && country.claims.length < 2 && rng.chance(0.3 * efficiency)) {
    const neighbours = getNeighbourCountries(state, countryId);
    const target = rng.pick(neighbours.filter((id) => !areAllied(state, countryId, id)));
    if (target) {
      const candidate = getCountryTerritories(state, target).find((territory) =>
        getCountryTerritories(state, countryId).some((own) =>
          getTerritoryDefinition(state.mapId, own.id).neighbours.includes(territory.id)
        )
      );
      if (candidate && !country.claims.includes(candidate.id)) {
        country.politicalPower -= 25;
        country.claims.push(candidate.id);
        changeRelation(state, countryId, target, -10);
      }
    }
  }

  // Kriegserklärung
  if (isAtWarAtAll(state, countryId) || country.actionPoints < 2) return;
  if (!rng.chance(profile.aggression * efficiency * aggressionFactor * 0.42)) return;
  if (country.warExhaustion > 40 || country.stability < 35) return;

  const ownStrength = getCountryArmySize(state, countryId);
  const candidates = getNeighbourCountries(state, countryId).filter((otherId) => {
    if (areAllied(state, countryId, otherId)) return false;
    if (hasTruce(state, countryId, otherId)) return false;
    if (areAtWar(state, countryId, otherId)) return false;
    if (state.countries[otherId]?.overlordId === countryId) return false;
    return true;
  });

  let bestTarget: string | null = null;
  let bestValue = 0;
  for (const otherId of candidates) {
    const otherStrength = getCountryArmySize(state, otherId) + getAllySupport(state, otherId);
    const relation = getRelation(state, countryId, otherId);
    const ratio = ownStrength / Math.max(1, otherStrength);
    const claimBonus = country.claims.some((id) => state.territories[id]?.ownerId === otherId) ? 0.8 : 0;
    const threatOfTarget = computeThreat(state, otherId) / 100;
    const value = ratio * 1.4 - relation / 55 + claimBonus + threatOfTarget * 0.5;
    if (ratio > 1.2 && value > bestValue) {
      bestValue = value;
      bestTarget = otherId;
    }
  }

  if (bestTarget) {
    country.actionPoints -= 1;
    declareWar(state, countryId, bestTarget);
  }
}

function getAllySupport(state: GameState, countryId: string): number {
  let total = 0;
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(countryId)) continue;
    for (const member of alliance.members) {
      if (member !== countryId) total += getCountryArmySize(state, member) * 0.5;
    }
  }
  return total;
}

/* ------------------------------------------------------------------ */
/* Feldherren                                                          */
/* ------------------------------------------------------------------ */

function handleGenerals(state: GameState, countryId: string, efficiency: number): void {
  const country = state.countries[countryId];
  if (!country) return;

  if (
    country.generals.length < getGeneralLimit(state, countryId) &&
    country.politicalPower > 60 &&
    country.gold > 900 &&
    efficiency > 0.5
  ) {
    hireGeneral(state, countryId);
  }

  // Feldherren an die bedrohtesten Fronten setzen
  const territories = getCountryTerritories(state, countryId)
    .map((territory) => ({ territory, threat: getThreatLevel(state, countryId, territory.id) }))
    .sort((a, b) => b.threat - a.threat);

  for (const general of country.generals) {
    const current = general.assignedTerritoryId
      ? state.territories[general.assignedTerritoryId]
      : null;
    if (current && current.ownerId === countryId && armySize(current.army) > 10) continue;
    const target = territories.find(
      (entry) =>
        armySize(entry.territory.army) > 8 &&
        !country.generals.some((g) => g.id !== general.id && g.assignedTerritoryId === entry.territory.id)
    );
    if (target) assignGeneral(state, countryId, general.id, target.territory.id);
  }
}

/* ------------------------------------------------------------------ */
/* Großprojekte                                                       */
/* ------------------------------------------------------------------ */

function handleProjects(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number
): void {
  const country = state.countries[countryId];
  if (!country || efficiency < 0.7) return;
  if (country.gold < 2600 || country.actionPoints < 3) return;
  const running = getCountryTerritories(state, countryId).some(
    (t) => t.construction.some((order) => order.kind === 'project')
  );
  if (running) return;

  const capital = state.territories[country.capitalId];
  if (!capital || capital.ownerId !== countryId) return;

  for (const project of getAllProjects()) {
    if (country.completedProjects.includes(project.id as ProjectId)) continue;
    if (project.requiresTech && !country.technologies.includes(project.requiresTech)) continue;
    if (!canAfford(country.resources, project.resources)) continue;
    const result = startProject(state, countryId, capital.id, project.id as ProjectId);
    if (result.ok) return;
  }
}

/* ------------------------------------------------------------------ */
/* Ausbau                                                              */
/* ------------------------------------------------------------------ */

function handleConstruction(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number
): void {
  const country = state.countries[countryId];
  if (!country) return;
  const budget = country.gold * profile.buildRatio * efficiency;
  if (budget < 180) return;

  // Bei voller Kasse merkt die KI ein zweites Vorhaben vor, sonst baut sie
  // in jedem Gebiet nur eines nach dem anderen.
  const queueAllowance = budget > 700 ? 2 : 1;
  const territories = getCountryTerritories(state, countryId)
    .filter((territory) => territory.construction.length < queueAllowance)
    .sort((a, b) => b.economy - a.economy);
  if (territories.length === 0) return;

  const atWar = isAtWarAtAll(state, countryId);
  const order: BuildingId[] = atWar
    ? ['fortress', 'barracks', 'granary', 'market', 'road', 'farm', 'workshop', 'temple', 'academy', 'harbour']
    : ['market', 'farm', 'road', 'workshop', 'academy', 'temple', 'harbour', 'granary', 'barracks', 'fortress'];

  let builds = 0;
  for (const territory of territories) {
    if (country.actionPoints < 2 || builds >= 2) return;
    for (const buildingId of order) {
      const result = constructBuilding(state, countryId, territory.id, buildingId);
      if (result.ok) {
        builds += 1;
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Rekrutierung                                                        */
/* ------------------------------------------------------------------ */

function handleRecruitment(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number
): void {
  const country = state.countries[countryId];
  if (!country) return;
  const budget = country.gold * profile.recruitRatio * efficiency;
  if (budget < 120) return;

  const territories = getCountryTerritories(state, countryId);
  if (territories.length === 0) return;

  const scored = territories
    .map((territory) => ({ territory, threat: getThreatLevel(state, countryId, territory.id) }))
    .sort((a, b) => b.threat - a.threat);

  const target = scored[0]?.territory;
  if (!target) return;

  const definition = getTerritoryDefinition(state.mapId, target.id);
  const available = getAvailableUnits(country);
  const discount = getRecruitDiscount(country, target);

  // Zusammensetzung nach Gelände und Persönlichkeit wählen
  const order: Army = emptyArmy();
  let remaining = budget;

  const wantsFleet =
    available.includes('fleet') &&
    definition.hasPort &&
    (profile.navalFocus > 0.28 || state.mapId === 'thalassa');
  if (wantsFleet && remaining > 400) {
    order.fleet = Math.min(3, Math.floor((remaining * 0.3) / (32 * discount)));
    remaining -= order.fleet * 32 * discount;
  }
  if (available.includes('artillery') && isAtWarAtAll(state, countryId) && remaining > 300) {
    order.artillery = Math.min(3, Math.floor((remaining * 0.25) / (28 * discount)));
    remaining -= order.artillery * 28 * discount;
  }
  const cavalryShare = ['plain', 'steppe', 'desert'].includes(definition.terrain) ? 0.4 : 0.22;
  order.cavalry = Math.max(0, Math.floor((remaining * cavalryShare) / (19 * discount)));
  remaining -= order.cavalry * 19 * discount;
  order.infantry = Math.max(0, Math.floor(remaining / (11 * discount)));

  // Bevölkerungs- und Rohstoffgrenzen beachten
  const limitByPopulation = Math.floor((target.population - 400) / 16);
  if (limitByPopulation <= 0) return;
  let total = armySize(order);
  if (total > limitByPopulation) {
    const factor = limitByPopulation / total;
    order.infantry = Math.floor(order.infantry * factor);
    order.cavalry = Math.floor(order.cavalry * factor);
    order.artillery = Math.floor(order.artillery * factor);
    order.fleet = Math.floor(order.fleet * factor);
  }
  order.infantry = Math.min(order.infantry, 30);
  total = armySize(order);
  if (total <= 0) return;

  // Rohstoffe prüfen und notfalls reduzieren
  let attempt = 0;
  while (attempt < 4) {
    const cost = recruitmentCost(order);
    if (canAfford(country.resources, cost.resources)) break;
    const reduced = scaleArmy(order, 0.5);
    order.infantry = reduced.infantry;
    order.cavalry = reduced.cavalry;
    order.artillery = reduced.artillery;
    order.fleet = reduced.fleet;
    attempt += 1;
  }
  if (armySize(order) <= 0) return;

  recruitTroops(state, countryId, target.id, order);
}

function getThreatLevel(state: GameState, countryId: string, territoryId: string): number {
  let threat = 0;
  for (const neighbourId of getNeighbourIds(state, territoryId)) {
    const neighbour = state.territories[neighbourId];
    if (!neighbour || neighbour.ownerId === countryId) continue;
    const hostile =
      neighbour.ownerId === ''
        ? 0.3
        : areAtWar(state, countryId, neighbour.ownerId)
          ? 2.2
          : 0.6;
    threat += armySize(neighbour.army) * hostile;
  }
  const own = state.territories[territoryId];
  const isCapital = state.countries[countryId]?.capitalId === territoryId;
  return threat - armySize(own?.army ?? emptyArmy()) * 0.8 + (isCapital ? 25 : 0);
}

/* ------------------------------------------------------------------ */
/* Spionage                                                            */
/* ------------------------------------------------------------------ */

function handleEspionage(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number,
  rng: Rng
): void {
  const country = state.countries[countryId];
  if (!country || country.politicalPower < 35 || country.gold < 500) return;
  if (!rng.chance(profile.espionage * efficiency * 0.35)) return;

  const enemies = state.countryOrder.filter(
    (id) => id !== countryId && state.countries[id]?.isAlive && areAtWar(state, countryId, id)
  );
  const rivals = enemies.length > 0
    ? enemies
    : getNeighbourCountries(state, countryId).filter((id) => getRelation(state, countryId, id) < 0);
  const targetId = rng.pick(rivals);
  if (!targetId) return;

  const targetTerritories = getCountryTerritories(state, targetId);
  const territory = rng.pick(targetTerritories);
  if (enemies.length > 0 && territory) {
    runEspionageMission(state, countryId, targetId, rng.chance(0.5) ? 'sabotage' : 'incite', territory.id);
  } else {
    runEspionageMission(state, countryId, targetId, 'recon');
  }
}

/* ------------------------------------------------------------------ */
/* Truppenverlagerung                                                  */
/* ------------------------------------------------------------------ */

function handleMovement(state: GameState, countryId: string, efficiency: number, rng: Rng): void {
  const country = state.countries[countryId];
  if (!country || country.actionPoints < 2) return;
  if (!rng.chance(efficiency)) return;

  const territories = getCountryTerritories(state, countryId);
  const scored = territories
    .map((territory) => ({ territory, threat: getThreatLevel(state, countryId, territory.id) }))
    .sort((a, b) => a.threat - b.threat);

  const safest = scored[0];
  const mostThreatened = scored[scored.length - 1];
  if (!safest || !mostThreatened) return;
  if (safest.territory.id === mostThreatened.territory.id) return;
  if (mostThreatened.threat <= 0) return;
  if (landSize(safest.territory.army) < 10) return;
  if (!getNeighbourIds(state, safest.territory.id).includes(mostThreatened.territory.id)) return;

  const order = scaleArmy(safest.territory.army, 0.55);
  if (armySize(order) <= 0) return;
  moveTroops(state, countryId, safest.territory.id, mostThreatened.territory.id, order);
}

/* ------------------------------------------------------------------ */
/* Angriffe                                                            */
/* ------------------------------------------------------------------ */

function handleAttacks(
  state: GameState,
  countryId: string,
  profile: PersonalityProfile,
  efficiency: number,
  rng: Rng
): void {
  const country = state.countries[countryId];
  if (!country) return;

  let guard = 0;
  while (country.actionPoints >= 2 && guard < 5) {
    guard += 1;
    let bestFrom: string | null = null;
    let bestTo: string | null = null;
    let bestValue = 0;
    let bestOrder: Army = emptyArmy();

    for (const territory of getCountryTerritories(state, countryId)) {
      if (landSize(territory.army) < 6) continue;
      for (const neighbourId of getNeighbourIds(state, territory.id)) {
        const target = state.territories[neighbourId];
        if (!target || target.ownerId === countryId) continue;
        if (target.ownerId !== '' && !areAtWar(state, countryId, target.ownerId)) continue;
        if (state.countries[target.ownerId]?.overlordId === countryId) continue;

        const order = scaleArmy(territory.army, 0.78);
        if (landSize(order) < 5) continue;
        const odds = estimateBattleOdds(state, countryId, territory.id, neighbourId, order);
        const capitalBonus = state.countries[target.ownerId]?.capitalId === neighbourId ? 0.07 : 0;
        const claimBonus = country.claims.includes(neighbourId) ? 0.05 : 0;
        const value = odds + capitalBonus + claimBonus;
        if (value > bestValue) {
          bestValue = value;
          bestFrom = territory.id;
          bestTo = neighbourId;
          bestOrder = order;
        }
      }
    }

    const threshold = profile.minAttackOdds + (1 - efficiency) * 0.16;
    if (!bestFrom || !bestTo || bestValue < threshold) return;
    if (!rng.chance(0.6 + efficiency * 0.4)) return;

    const result = attackTerritory(state, countryId, bestFrom, bestTo, bestOrder);
    if (!result.ok) return;
  }
}

export { clamp };

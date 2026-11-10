/**
 * Diplomatie: Beziehungen, Ansprüche, Kriegserklärungen, Friedensverhandlungen,
 * Bündnisse, Handelsabkommen, Vasallen und Koalitionen.
 */
import type {
  ActionResult,
  GameState,
  PeaceDemandOption,
  War,
  WarGoal
} from '../models/types';
import { getTerritoryDefinition } from '../services/contentService';
import { clamp, createId, relationKey } from '../utils/helpers';
import { armySize, scaleArmy } from './army';
import {
  CLAIM_COST,
  GOVERNMENT_INFO,
  areAllied,
  areAtWar,
  changeRelation,
  computeThreat,
  findWar,
  getCountryArmySize,
  getCountryScore,
  getCountryTerritories,
  getNeighbourCountries,
  getRelation,
  getSupporters,
  hasTrade,
  hasTruce
} from './rules';

export type DiplomaticActionId =
  | 'improve'
  | 'gift'
  | 'insult'
  | 'tradeAgreement'
  | 'cancelTrade'
  | 'nonAggression'
  | 'alliance'
  | 'breakAlliance'
  | 'callToWar'
  | 'fabricateClaim'
  | 'declareWar'
  | 'releaseVassal';

export interface DiplomaticActionInfo {
  id: DiplomaticActionId;
  name: string;
  description: string;
  goldCost: number;
  powerCost: number;
  actionPointCost: number;
  danger?: boolean;
}

export const DIPLOMATIC_ACTIONS: DiplomaticActionInfo[] = [
  { id: 'improve', name: 'Beziehungen verbessern', description: 'Eine Gesandtschaft hebt die Beziehung um etwa 10 Punkte.', goldCost: 120, powerCost: 2, actionPointCost: 1 },
  { id: 'gift', name: 'Gold senden', description: 'Ein großzügiges Geschenk verbessert die Beziehung deutlich.', goldCost: 250, powerCost: 0, actionPointCost: 1 },
  { id: 'insult', name: 'Ultimatum stellen', description: 'Erhöht das eigene Ansehen im Inneren, verschlechtert die Beziehung stark.', goldCost: 0, powerCost: 4, actionPointCost: 1 },
  { id: 'tradeAgreement', name: 'Handelsabkommen', description: 'Beide Seiten profitieren dauerhaft von den Einnahmen des anderen.', goldCost: 150, powerCost: 4, actionPointCost: 1 },
  { id: 'cancelTrade', name: 'Handel aufkündigen', description: 'Beendet das Handelsabkommen und schadet der Beziehung.', goldCost: 0, powerCost: 0, actionPointCost: 1 },
  { id: 'nonAggression', name: 'Nichtangriffspakt', description: 'Sichert für 10 Runden gegenseitigen Frieden zu.', goldCost: 80, powerCost: 5, actionPointCost: 1 },
  { id: 'alliance', name: 'Bündnis anbieten', description: 'Ein Militärbündnis verpflichtet beide Seiten zur Hilfe im Krieg.', goldCost: 150, powerCost: 10, actionPointCost: 1 },
  { id: 'breakAlliance', name: 'Bündnis auflösen', description: 'Beendet ein bestehendes Bündnis und schadet der Beziehung.', goldCost: 0, powerCost: 0, actionPointCost: 1, danger: true },
  { id: 'callToWar', name: 'Bündnispartner rufen', description: 'Bittet einen Verbündeten, in deinen laufenden Krieg einzutreten.', goldCost: 0, powerCost: 8, actionPointCost: 1 },
  { id: 'fabricateClaim', name: 'Anspruch erheben', description: 'Erzeugt einen Rechtsanspruch auf ein Grenzgebiet - rechtfertigt den nächsten Krieg.', goldCost: 200, powerCost: CLAIM_COST, actionPointCost: 1 },
  { id: 'declareWar', name: 'Krieg erklären', description: 'Eröffnet offiziell die Kampfhandlungen. Bündnispartner werden hineingezogen.', goldCost: 0, powerCost: 0, actionPointCost: 1, danger: true },
  { id: 'releaseVassal', name: 'Vasall freilassen', description: 'Entlässt einen Vasallen in die Unabhängigkeit - das bringt Ansehen.', goldCost: 0, powerCost: 10, actionPointCost: 1 }
];

export function getDiplomaticAction(id: DiplomaticActionId): DiplomaticActionInfo {
  const found = DIPLOMATIC_ACTIONS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unbekannte diplomatische Aktion: ${id}`);
  return found;
}

export function isActionAvailable(
  state: GameState,
  actorId: string,
  targetId: string,
  action: DiplomaticActionId
): boolean {
  if (actorId === targetId) return false;
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  if (!actor || !target || !target.isAlive) return false;

  const atWar = areAtWar(state, actorId, targetId);
  const allied = areAllied(state, actorId, targetId);
  const trade = hasTrade(state, actorId, targetId);
  const isVassal = target.overlordId === actorId;

  switch (action) {
    case 'improve':
    case 'gift':
      return !atWar;
    case 'insult':
      return !atWar && !allied;
    case 'tradeAgreement':
      return !atWar && !trade && getRelation(state, actorId, targetId) >= 10;
    case 'cancelTrade':
      return trade;
    case 'nonAggression':
      return !atWar && !hasTruce(state, actorId, targetId);
    case 'alliance':
      return !atWar && !allied && !isVassal && getRelation(state, actorId, targetId) >= 30;
    case 'breakAlliance':
      return allied;
    case 'callToWar':
      return allied && state.wars.some((war) => war.attackers.includes(actorId) || war.defenders.includes(actorId));
    case 'fabricateClaim':
      return !atWar && getNeighbourCountries(state, actorId).includes(targetId);
    case 'declareWar':
      return !atWar && !allied && !hasTruce(state, actorId, targetId) && !isVassal && actor.overlordId !== targetId;
    case 'releaseVassal':
      return isVassal;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Krieg                                                               */
/* ------------------------------------------------------------------ */

function getAllies(state: GameState, countryId: string): string[] {
  return getSupporters(state, countryId);
}

/** Welches Kriegsziel ergibt sich aus der Lage? */
export function determineWarGoal(state: GameState, attackerId: string, defenderId: string): WarGoal {
  const attacker = state.countries[attackerId];
  if (!attacker) return { type: 'conquest', territoryId: null, label: 'Eroberung' };
  const claim = attacker.claims.find(
    (territoryId) => state.territories[territoryId]?.ownerId === defenderId
  );
  if (claim) {
    const name = getTerritoryDefinition(state.mapId, claim).name;
    return { type: 'claim', territoryId: claim, label: `Anspruch auf ${name}` };
  }
  return { type: 'conquest', territoryId: null, label: 'Eroberung' };
}

export function declareWar(
  state: GameState,
  attackerId: string,
  defenderId: string
): ActionResult {
  const attacker = state.countries[attackerId];
  const defender = state.countries[defenderId];
  if (!attacker || !defender) return { ok: false, message: 'Ungültiges Land.' };
  if (areAtWar(state, attackerId, defenderId)) {
    return { ok: false, message: 'Ihr befindet euch bereits im Krieg.' };
  }
  if (hasTruce(state, attackerId, defenderId)) {
    return { ok: false, message: 'Ein Waffenstillstand verbietet die Kriegserklärung.' };
  }
  if (areAllied(state, attackerId, defenderId)) {
    return { ok: false, message: 'Ein Bündnispartner kann nicht angegriffen werden.' };
  }
  if (attacker.overlordId) {
    return { ok: false, message: 'Als Vasall darfst du keinen eigenen Krieg erklären.' };
  }

  const goal = determineWarGoal(state, attackerId, defenderId);
  const justified = goal.type === 'claim';

  const defenders = [defenderId, ...getAllies(state, defenderId)];
  const attackers = [attackerId, ...attacker.vassals].filter((id) => !defenders.includes(id));

  const war: War = {
    id: createId('war'),
    attackers,
    defenders,
    startTurn: state.turn,
    score: 0,
    captured: [],
    goal,
    justified
  };
  state.wars.push(war);
  if (attackerId === state.playerCountryId) state.stats.warsDeclared += 1;

  changeRelation(state, attackerId, defenderId, -45);
  const reputationHit = justified ? -3 : -9;
  for (const otherId of state.countryOrder) {
    if (otherId === attackerId || otherId === defenderId) continue;
    changeRelation(state, attackerId, otherId, reputationHit);
  }
  attacker.threat = clamp(attacker.threat + (justified ? 4 : 12), 0, 100);
  if (!justified) {
    attacker.stability = clamp(attacker.stability - 6, 0, 100);
  } else {
    attacker.claims = attacker.claims.filter((id) => id !== goal.territoryId);
  }

  state.log.unshift({
    turn: state.turn,
    type: 'war',
    text: `${attacker.name} erklärt ${defender.name} den Krieg (${goal.label}).`,
    important: attackerId === state.playerCountryId || defenderId === state.playerCountryId
  });

  return { ok: true, message: `Krieg gegen ${defender.name} erklärt. Kriegsziel: ${goal.label}.` };
}

/* ------------------------------------------------------------------ */
/* Friedensverhandlungen                                               */
/* ------------------------------------------------------------------ */

/** Kriegsfortschritt aus Sicht eines Landes. */
export function getWarScoreFor(war: War, countryId: string): number {
  return war.attackers.includes(countryId) ? war.score : -war.score;
}

/** Erzeugt alle Forderungen, die der Sieger stellen könnte. */
export function getPeaceDemands(
  state: GameState,
  war: War,
  winnerId: string,
  loserId: string
): PeaceDemandOption[] {
  const demands: PeaceDemandOption[] = [];
  const loser = state.countries[loserId];
  if (!loser) return demands;

  // Besetzte Gebiete behalten
  const occupied = war.captured.filter(
    (record) => record.newOwnerId === winnerId && state.territories[record.territoryId]?.ownerId === winnerId
  );
  for (const record of occupied) {
    const territory = state.territories[record.territoryId];
    if (!territory || record.previousOwnerId !== loserId) continue;
    const definition = getTerritoryDefinition(state.mapId, record.territoryId);
    demands.push({
      id: `cede_${record.territoryId}`,
      label: `${definition.name} abtreten`,
      description: `Wirtschaft ${Math.round(territory.economy)}, Bevölkerung ${Math.round(territory.population)}`,
      cost: 12 + Math.round(territory.economy / 10),
      territoryId: record.territoryId
    });
  }

  demands.push({
    id: 'reparations',
    label: 'Reparationen fordern',
    description: `Bis zu ${Math.round(Math.min(1200, loser.gold * 0.5))} Gold`,
    cost: 18
  });
  demands.push({
    id: 'disarm',
    label: 'Abrüstung erzwingen',
    description: 'Der Verlierer verliert 30 % seiner Armee.',
    cost: 15
  });
  if (!loser.overlordId && loser.id !== state.playerCountryId) {
    demands.push({
      id: 'vassalize',
      label: 'Vasallisierung',
      description: 'Der Verlierer wird Vasall und zahlt Tribut.',
      cost: 55
    });
  }
  if (!loser.overlordId) {
    demands.push({
      id: 'annex',
      label: 'Vollständige Annexion',
      description: 'Alle Gebiete des Verlierers gehen an dich über.',
      cost: 95
    });
  }
  return demands;
}

/** Wie viel ist die Gegenseite bereit zu akzeptieren? */
export function getAcceptanceLimit(state: GameState, war: War, loserId: string): number {
  const loser = state.countries[loserId];
  if (!loser) return 0;
  const scoreAgainst = -getWarScoreFor(war, loserId);
  const exhaustion = loser.warExhaustion * 0.35;
  const weakness = clamp(60 - getCountryArmySize(state, loserId) / 4, 0, 40);
  const duration = clamp((state.turn - war.startTurn) * 1.5, 0, 25);
  return clamp(scoreAgainst + exhaustion + weakness * 0.4 + duration, 0, 140);
}

export interface PeaceResult extends ActionResult {
  accepted: boolean;
}

/** Führt einen Friedensschluss mit den gewählten Forderungen durch. */
export function concludePeace(
  state: GameState,
  war: War,
  winnerId: string,
  loserId: string,
  demandIds: string[],
  force = false
): PeaceResult {
  const winner = state.countries[winnerId];
  const loser = state.countries[loserId];
  if (!winner || !loser) return { ok: false, accepted: false, message: 'Ungültige Parteien.' };

  const available = getPeaceDemands(state, war, winnerId, loserId);
  const chosen = available.filter((demand) => demandIds.includes(demand.id));
  const totalCost = chosen.reduce((sum, demand) => sum + demand.cost, 0);
  const warScore = getWarScoreFor(war, winnerId);
  const limit = getAcceptanceLimit(state, war, loserId);

  if (totalCost > Math.max(0, warScore)) {
    return {
      ok: false,
      accepted: false,
      message: `Der Kriegsfortschritt (${Math.round(warScore)}) reicht für diese Forderungen (${totalCost}) nicht aus.`
    };
  }
  if (!force && totalCost > limit) {
    return {
      ok: true,
      accepted: false,
      message: `${loser.name} lehnt ab. Die Forderungen sind zu hart (Bereitschaft: ${Math.round(limit)}).`
    };
  }

  // --- Forderungen umsetzen ---
  const annex = chosen.some((demand) => demand.id === 'annex');
  const vassalize = chosen.some((demand) => demand.id === 'vassalize');

  if (annex) {
    for (const territory of getCountryTerritories(state, loserId)) {
      territory.ownerId = winnerId;
      territory.unrest = clamp(territory.unrest + 45, 0, 100);
      territory.occupiedTurns = 1;
    }
    loser.isAlive = false;
    for (const vassalId of loser.vassals) {
      const vassal = state.countries[vassalId];
      if (vassal) vassal.overlordId = null;
    }
    loser.vassals = [];
    state.log.unshift({
      turn: state.turn,
      type: 'peace',
      text: `${loser.name} wurde von ${winner.name} vollständig annektiert.`,
      important: true
    });
  } else {
    for (const demand of chosen) {
      if (demand.territoryId) {
        const territory = state.territories[demand.territoryId];
        if (territory) {
          territory.ownerId = winnerId;
          territory.unrest = clamp(territory.unrest + 25, 0, 100);
          territory.occupiedTurns = 1;
        }
      }
      if (demand.id === 'reparations') {
        const amount = Math.round(Math.min(1200, loser.gold * 0.5));
        loser.gold = Math.max(0, loser.gold - amount);
        winner.gold += amount;
      }
      if (demand.id === 'disarm') {
        for (const territory of getCountryTerritories(state, loserId)) {
          territory.army = scaleArmy(territory.army, 0.7);
        }
      }
    }
    if (vassalize) {
      loser.overlordId = winnerId;
      loser.vassalSince = state.turn;
      if (!winner.vassals.includes(loserId)) winner.vassals.push(loserId);
      state.log.unshift({
        turn: state.turn,
        type: 'peace',
        text: `${loser.name} wird Vasall von ${winner.name}.`,
        important: true
      });
    }
  }

  // Nicht abgetretene Eroberungen zurücknehmen
  for (const record of war.captured) {
    if (annex) break;
    const kept = chosen.some((demand) => demand.territoryId === record.territoryId);
    if (kept) continue;
    const territory = state.territories[record.territoryId];
    if (territory && territory.ownerId === record.newOwnerId) {
      territory.ownerId = record.previousOwnerId;
      territory.unrest = clamp(territory.unrest + 12, 0, 100);
    }
  }

  finishWar(state, war, totalCost === 0);
  state.stats.peaceDeals += 1;

  if (totalCost === 0) {
    state.log.unshift({
      turn: state.turn,
      type: 'peace',
      text: `Weißer Friede zwischen ${winner.name} und ${loser.name}.`,
      important: winner.isPlayer || loser.isPlayer
    });
  } else if (!annex) {
    state.log.unshift({
      turn: state.turn,
      type: 'peace',
      text: `${winner.name} und ${loser.name} schließen Frieden (${chosen.length} Forderung(en)).`,
      important: winner.isPlayer || loser.isPlayer
    });
  }

  winner.prestige = clamp(winner.prestige + Math.round(totalCost / 6), -60, 160);
  loser.prestige = clamp(loser.prestige - Math.round(totalCost / 8), -60, 160);

  return {
    ok: true,
    accepted: true,
    message: totalCost === 0 ? 'Weißer Friede geschlossen.' : `Frieden zu deinen Bedingungen geschlossen.`
  };
}

/** Beendet einen Krieg, setzt Waffenstillstände und beruhigt die Beteiligten. */
export function finishWar(state: GameState, war: War, whitePeace: boolean): void {
  const truceUntil = state.turn + (whitePeace ? 10 : 8);
  for (const a of war.attackers) {
    for (const b of war.defenders) {
      state.truces[relationKey(a, b)] = truceUntil;
      changeRelation(state, a, b, whitePeace ? 20 : 8);
    }
  }
  for (const countryId of [...war.attackers, ...war.defenders]) {
    const country = state.countries[countryId];
    if (country) country.warExhaustion = clamp(country.warExhaustion - 28, 0, 100);
  }
  state.wars = state.wars.filter((entry) => entry.id !== war.id);
}

/* ------------------------------------------------------------------ */
/* Spieleraktionen                                                     */
/* ------------------------------------------------------------------ */

export function performDiplomaticAction(
  state: GameState,
  actorId: string,
  targetId: string,
  actionId: DiplomaticActionId,
  extra?: { territoryId?: string }
): ActionResult {
  const actor = state.countries[actorId];
  const target = state.countries[targetId];
  if (!actor || !target) return { ok: false, message: 'Ungültiges Land.' };
  if (!isActionAvailable(state, actorId, targetId, actionId)) {
    return { ok: false, message: 'Diese Aktion ist derzeit nicht möglich.' };
  }

  const info = getDiplomaticAction(actionId);
  if (actor.gold < info.goldCost) {
    return { ok: false, message: `Nicht genug Gold (benötigt: ${info.goldCost}).` };
  }
  if (actor.politicalPower < info.powerCost) {
    return { ok: false, message: `Nicht genug politische Macht (benötigt: ${info.powerCost}).` };
  }
  if (actor.actionPoints < info.actionPointCost) {
    return { ok: false, message: 'Keine Aktionspunkte mehr in dieser Runde.' };
  }

  actor.gold -= info.goldCost;
  actor.politicalPower -= info.powerCost;
  actor.actionPoints -= info.actionPointCost;

  const diplomacyFactor = GOVERNMENT_INFO[actor.government].diplomacy;

  switch (actionId) {
    case 'improve':
      changeRelation(state, actorId, targetId, Math.round(10 * diplomacyFactor));
      return { ok: true, message: `Beziehungen zu ${target.name} verbessert.` };

    case 'gift':
      target.gold += 250;
      changeRelation(state, actorId, targetId, Math.round(18 * diplomacyFactor));
      return { ok: true, message: `${target.name} nimmt das Geschenk dankend an.` };

    case 'insult':
      changeRelation(state, actorId, targetId, -22);
      actor.stability = clamp(actor.stability + 4, 0, 100);
      actor.prestige = clamp(actor.prestige + 4, -60, 160);
      return { ok: true, message: `Das Ultimatum an ${target.name} erhöht dein Ansehen im Inneren.` };

    case 'tradeAgreement': {
      const relation = getRelation(state, actorId, targetId);
      if (relation < 25 && !areAllied(state, actorId, targetId)) {
        changeRelation(state, actorId, targetId, 2);
        return { ok: true, message: `${target.name} lehnt das Handelsabkommen vorerst ab.` };
      }
      state.trades.push({ id: createId('trade'), a: actorId, b: targetId, since: state.turn });
      changeRelation(state, actorId, targetId, 12);
      state.log.unshift({
        turn: state.turn,
        type: 'diplomacy',
        text: `${actor.name} und ${target.name} schließen ein Handelsabkommen.`,
        important: actor.isPlayer
      });
      return { ok: true, message: `Handelsabkommen mit ${target.name} geschlossen.` };
    }

    case 'cancelTrade':
      state.trades = state.trades.filter(
        (trade) =>
          !((trade.a === actorId && trade.b === targetId) || (trade.a === targetId && trade.b === actorId))
      );
      changeRelation(state, actorId, targetId, -15);
      return { ok: true, message: `Das Handelsabkommen mit ${target.name} wurde beendet.` };

    case 'nonAggression': {
      const relation = getRelation(state, actorId, targetId);
      if (relation < -10) {
        changeRelation(state, actorId, targetId, -3);
        return { ok: true, message: `${target.name} lehnt den Nichtangriffspakt ab.` };
      }
      state.truces[relationKey(actorId, targetId)] = state.turn + 10;
      changeRelation(state, actorId, targetId, 8);
      return { ok: true, message: `${target.name} stimmt dem Nichtangriffspakt zu.` };
    }

    case 'alliance': {
      const relation = getRelation(state, actorId, targetId);
      const powerActor = getCountryScore(state, actorId);
      const powerTarget = getCountryScore(state, targetId);
      const threat = computeThreat(state, actorId);
      const accepted =
        relation >= 50 || (relation >= 30 && powerActor >= powerTarget * 0.75 && threat < 55);
      if (!accepted) {
        changeRelation(state, actorId, targetId, -2);
        return { ok: true, message: `${target.name} lehnt das Bündnis vorerst ab.` };
      }
      const existing = state.alliances.find(
        (alliance) => alliance.members.includes(actorId) || alliance.members.includes(targetId)
      );
      if (existing) {
        if (!existing.members.includes(actorId)) existing.members.push(actorId);
        if (!existing.members.includes(targetId)) existing.members.push(targetId);
      } else {
        state.alliances.push({
          id: createId('alliance'),
          name: `Pakt von ${actor.name}`,
          members: [actorId, targetId],
          leader: actorId,
          foundedTurn: state.turn,
          againstId: null
        });
      }
      changeRelation(state, actorId, targetId, 15);
      state.log.unshift({
        turn: state.turn,
        type: 'diplomacy',
        text: `${actor.name} und ${target.name} schließen ein Bündnis.`,
        important: actor.isPlayer
      });
      return { ok: true, message: `Bündnis mit ${target.name} geschlossen.` };
    }

    case 'breakAlliance':
      for (const alliance of state.alliances) {
        if (alliance.members.includes(actorId) && alliance.members.includes(targetId)) {
          alliance.members = alliance.members.filter((member) => member !== actorId);
        }
      }
      state.alliances = state.alliances.filter((alliance) => alliance.members.length >= 2);
      changeRelation(state, actorId, targetId, -28);
      actor.prestige = clamp(actor.prestige - 5, -60, 160);
      return { ok: true, message: `Das Bündnis mit ${target.name} wurde aufgelöst.` };

    case 'callToWar': {
      const war = state.wars.find(
        (entry) => entry.attackers.includes(actorId) || entry.defenders.includes(actorId)
      );
      if (!war) return { ok: false, message: 'Du führst derzeit keinen Krieg.' };
      if (war.attackers.includes(targetId) || war.defenders.includes(targetId)) {
        return { ok: false, message: `${target.name} kämpft bereits mit.` };
      }
      const relation = getRelation(state, actorId, targetId);
      const defending = war.defenders.includes(actorId);
      const accepted = relation >= 45 || (defending && relation >= 20);
      if (!accepted) {
        changeRelation(state, actorId, targetId, -8);
        return { ok: true, message: `${target.name} verweigert den Beistand.` };
      }
      if (war.attackers.includes(actorId)) war.attackers.push(targetId);
      else war.defenders.push(targetId);
      state.log.unshift({
        turn: state.turn,
        type: 'war',
        text: `${target.name} tritt an der Seite von ${actor.name} in den Krieg ein.`,
        important: actor.isPlayer
      });
      return { ok: true, message: `${target.name} tritt in den Krieg ein.` };
    }

    case 'fabricateClaim': {
      const candidates = getCountryTerritories(state, targetId).filter((territory) =>
        getCountryTerritories(state, actorId).some((own) =>
          getTerritoryDefinition(state.mapId, own.id).neighbours.includes(territory.id)
        )
      );
      const chosen = extra?.territoryId
        ? candidates.find((territory) => territory.id === extra.territoryId)
        : candidates[0];
      if (!chosen) return { ok: false, message: 'Kein geeignetes Grenzgebiet gefunden.' };
      if (actor.claims.includes(chosen.id)) {
        return { ok: false, message: 'Auf dieses Gebiet besteht bereits ein Anspruch.' };
      }
      actor.claims.push(chosen.id);
      changeRelation(state, actorId, targetId, -12);
      const name = getTerritoryDefinition(state.mapId, chosen.id).name;
      return { ok: true, message: `Anspruch auf ${name} erhoben. Ein Krieg darum gilt als gerechtfertigt.` };
    }

    case 'declareWar':
      return declareWar(state, actorId, targetId);

    case 'releaseVassal': {
      target.overlordId = null;
      target.vassalSince = 0;
      actor.vassals = actor.vassals.filter((id) => id !== targetId);
      changeRelation(state, actorId, targetId, 35);
      actor.prestige = clamp(actor.prestige + 10, -60, 160);
      for (const otherId of state.countryOrder) {
        if (otherId !== actorId) changeRelation(state, actorId, otherId, 4);
      }
      return { ok: true, message: `${target.name} ist wieder unabhängig.` };
    }

    default:
      return { ok: false, message: 'Unbekannte Aktion.' };
  }
}

/* ------------------------------------------------------------------ */
/* Koalitionen                                                         */
/* ------------------------------------------------------------------ */

/**
 * Bildet eine Koalition gegen ein übermächtiges Land.
 * Wird einmal pro Runde aus dem Rundenablauf aufgerufen.
 */
export function updateCoalitions(state: GameState): void {
  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country || !country.isAlive) continue;
    country.threat = clamp(country.threat * 0.96, 0, 100);
  }

  const alive = state.countryOrder.filter((id) => state.countries[id]?.isAlive);
  if (alive.length < 3) return;

  for (const countryId of alive) {
    const threat = computeThreat(state, countryId);
    if (threat < 62) continue;
    const existing = state.alliances.find((alliance) => alliance.againstId === countryId);
    const candidates = alive.filter(
      (id) =>
        id !== countryId &&
        !areAllied(state, id, countryId) &&
        state.countries[id]?.overlordId !== countryId &&
        getRelation(state, id, countryId) < 20
    );
    if (candidates.length < 2) continue;

    if (existing) {
      for (const candidate of candidates) {
        if (!existing.members.includes(candidate) && existing.members.length < 5) {
          existing.members.push(candidate);
        }
      }
      continue;
    }

    state.alliances.push({
      id: createId('coalition'),
      name: `Koalition gegen ${state.countries[countryId]?.name ?? countryId}`,
      members: candidates.slice(0, 4),
      leader: candidates[0],
      foundedTurn: state.turn,
      againstId: countryId
    });
    state.log.unshift({
      turn: state.turn,
      type: 'diplomacy',
      text: `Mehrere Mächte bilden eine Koalition gegen ${state.countries[countryId]?.name}.`,
      important: countryId === state.playerCountryId
    });
  }

  // Aufgelöste Koalitionen entfernen
  state.alliances = state.alliances.filter((alliance) => {
    alliance.members = alliance.members.filter((id) => state.countries[id]?.isAlive);
    if (alliance.againstId && computeThreat(state, alliance.againstId) < 45) return false;
    return alliance.members.length >= 2;
  });
}

/** Loyalität und mögliche Unabhängigkeitserklärung von Vasallen. */
export function updateVassals(state: GameState): void {
  for (const countryId of state.countryOrder) {
    const vassal = state.countries[countryId];
    if (!vassal || !vassal.isAlive || !vassal.overlordId) continue;
    const overlord = state.countries[vassal.overlordId];
    if (!overlord || !overlord.isAlive) {
      vassal.overlordId = null;
      vassal.vassalSince = 0;
      continue;
    }
    if (!overlord.vassals.includes(countryId)) overlord.vassals.push(countryId);

    const relation = getRelation(state, countryId, vassal.overlordId);
    const strength =
      getCountryScore(state, countryId) / Math.max(1, getCountryScore(state, vassal.overlordId));
    if (relation < -30 && strength > 0.75 && state.turn - vassal.vassalSince > 8) {
      const overlordId = vassal.overlordId;
      vassal.overlordId = null;
      vassal.vassalSince = 0;
      overlord.vassals = overlord.vassals.filter((id) => id !== countryId);
      declareWar(state, countryId, overlordId);
      state.log.unshift({
        turn: state.turn,
        type: 'war',
        text: `${vassal.name} erklärt sich für unabhängig und greift ${overlord.name} an.`,
        important: overlordId === state.playerCountryId
      });
    }
  }
}

/** Zusammenfassung der Lage für die Oberfläche. */
export function describeRelationState(state: GameState, a: string, b: string): string {
  if (areAtWar(state, a, b)) return 'Im Krieg';
  if (state.countries[b]?.overlordId === a) return 'Dein Vasall';
  if (state.countries[a]?.overlordId === b) return 'Dein Oberherr';
  if (areAllied(state, a, b)) return 'Verbündet';
  if (hasTrade(state, a, b)) return 'Handelspartner';
  if (hasTruce(state, a, b)) return 'Waffenstillstand';
  return 'Frieden';
}

export { armySize };

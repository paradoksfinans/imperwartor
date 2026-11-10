/**
 * Siegbedingungen und Spielende.
 */
import type { GameState } from '../models/types';
import { getCountryScore, getCountryTerritories } from './rules';

export function checkVictory(state: GameState): void {
  if (state.status !== 'playing') return;

  const playerTerritories = getCountryTerritories(state, state.playerCountryId).length;
  const player = state.countries[state.playerCountryId];

  if (playerTerritories === 0) {
    state.status = 'defeat';
    state.statusMessage =
      'Dein Reich hat alle Gebiete verloren. Die Geschichte wird von anderen geschrieben.';
    return;
  }

  if (player?.overlordId) {
    const overlord = state.countries[player.overlordId];
    state.statusMessage = `Du bist Vasall von ${overlord?.name ?? 'einer fremden Macht'}.`;
  }

  if (state.options.sandbox) return;

  // Sieg durch Gebietskontrolle (Vasallengebiete zählen zur Hälfte)
  const vassalTerritories = (player?.vassals ?? []).reduce(
    (total, vassalId) => total + getCountryTerritories(state, vassalId).length,
    0
  );
  const effectiveControl = playerTerritories + Math.floor(vassalTerritories / 2);

  if (effectiveControl >= state.victory.territoriesToControl) {
    state.status = 'victory';
    state.statusMessage = `Du kontrollierst ${playerTerritories} Gebiete${
      vassalTerritories > 0 ? ` und ${vassalTerritories} Vasallengebiete` : ''
    } und beherrschst damit die bekannte Welt.`;
    return;
  }

  // Sieg durch Alleinherrschaft
  const rivals = state.countryOrder.filter(
    (id) =>
      id !== state.playerCountryId &&
      state.countries[id]?.isAlive &&
      state.countries[id]?.overlordId !== state.playerCountryId
  );
  if (rivals.length === 0) {
    state.status = 'victory';
    state.statusMessage = 'Kein unabhängiger Rivale ist mehr übrig. Dein Reich steht allein.';
    return;
  }

  // Punktsieg nach Ablauf der Zeit
  if (state.turn > state.victory.survivalTurns) {
    const ranking = state.countryOrder
      .filter((id) => state.countries[id]?.isAlive)
      .map((id) => ({ id, score: getCountryScore(state, id) }))
      .sort((a, b) => b.score - a.score);
    const leader = ranking[0];
    if (leader && leader.id === state.playerCountryId) {
      state.status = 'victory';
      state.statusMessage = 'Nach Ablauf der Zeit führst du die Rangliste an.';
    } else {
      state.status = 'defeat';
      state.statusMessage = `Die Zeit ist abgelaufen. ${
        leader ? state.countries[leader.id]?.name : 'Ein anderes Land'
      } führt die Rangliste an.`;
    }
  }
}

/** Markiert Länder ohne Gebiete als besiegt und löst ihre Bindungen. */
export function updateCountryStatus(state: GameState): void {
  for (const countryId of state.countryOrder) {
    const country = state.countries[countryId];
    if (!country || !country.isAlive) continue;
    if (getCountryTerritories(state, countryId).length > 0) continue;

    country.isAlive = false;
    if (country.overlordId) {
      const overlord = state.countries[country.overlordId];
      if (overlord) overlord.vassals = overlord.vassals.filter((id) => id !== countryId);
      country.overlordId = null;
    }
    for (const vassalId of country.vassals) {
      const vassal = state.countries[vassalId];
      if (vassal) vassal.overlordId = null;
    }
    country.vassals = [];
    state.alliances = state.alliances
      .map((alliance) => ({
        ...alliance,
        members: alliance.members.filter((id) => id !== countryId)
      }))
      .filter((alliance) => alliance.members.length >= 2);
    state.trades = state.trades.filter((trade) => trade.a !== countryId && trade.b !== countryId);

    state.log.unshift({
      turn: state.turn,
      type: 'war',
      text: `${country.name} existiert nicht mehr.`,
      important: true
    });
  }

  // Kriege ohne lebende Teilnehmer beenden
  state.wars = state.wars.filter((war) => {
    war.attackers = war.attackers.filter((id) => state.countries[id]?.isAlive);
    war.defenders = war.defenders.filter((id) => state.countries[id]?.isAlive);
    return war.attackers.length > 0 && war.defenders.length > 0;
  });
}

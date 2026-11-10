/**
 * Erfolge. Sie werden im laufenden Spiel freigeschaltet und zusätzlich
 * dauerhaft im Browser gespeichert (siehe services/achievementStore.ts).
 */
import type { GameState } from '../models/types';
import { armySize } from './army';
import { getCountryScore, getCountryTerritories, isAtWarAtAll } from './rules';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Prüffunktion; true = freigeschaltet. */
  check: (state: GameState) => boolean;
}

function player(state: GameState) {
  return state.countries[state.playerCountryId];
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_blood',
    name: 'Erste Eroberung',
    description: 'Erobere dein erstes fremdes Gebiet.',
    icon: 'sword',
    check: (state) => state.stats.territoriesConquered >= 1
  },
  {
    id: 'ten_battles',
    name: 'Feldherr',
    description: 'Gewinne zehn Schlachten.',
    icon: 'shield',
    check: (state) => state.stats.battlesWon >= 10
  },
  {
    id: 'rich',
    name: 'Goldene Kassen',
    description: 'Besitze gleichzeitig 5000 Gold.',
    icon: 'coin',
    check: (state) => (player(state)?.gold ?? 0) >= 5000
  },
  {
    id: 'scholar',
    name: 'Gelehrtenhof',
    description: 'Erforsche zwölf Technologien.',
    icon: 'book',
    check: (state) => (player(state)?.technologies.length ?? 0) >= 12
  },
  {
    id: 'builder',
    name: 'Baumeister',
    description: 'Vollende ein Großprojekt.',
    icon: 'hammer',
    check: (state) => (player(state)?.completedProjects.length ?? 0) >= 1
  },
  {
    id: 'wonder_collector',
    name: 'Erbauer des Zeitalters',
    description: 'Vollende drei Großprojekte.',
    icon: 'crown',
    check: (state) => (player(state)?.completedProjects.length ?? 0) >= 3
  },
  {
    id: 'overlord',
    name: 'Oberherr',
    description: 'Halte gleichzeitig zwei Vasallen.',
    icon: 'crown',
    check: (state) => (player(state)?.vassals.length ?? 0) >= 2
  },
  {
    id: 'diplomat',
    name: 'Netzwerker',
    description: 'Unterhalte gleichzeitig drei Handelsabkommen.',
    icon: 'scroll',
    check: (state) =>
      state.trades.filter((t) => t.a === state.playerCountryId || t.b === state.playerCountryId).length >= 3
  },
  {
    id: 'peacemaker',
    name: 'Friedensstifter',
    description: 'Schließe fünf Friedensverträge.',
    icon: 'dove',
    check: (state) => state.stats.peaceDeals >= 5
  },
  {
    id: 'great_army',
    name: 'Heermacht',
    description: 'Stelle gleichzeitig 250 Einheiten auf.',
    icon: 'sword',
    check: (state) =>
      getCountryTerritories(state, state.playerCountryId).reduce(
        (total, t) => total + armySize(t.army),
        0
      ) >= 250
  },
  {
    id: 'stable_realm',
    name: 'Innerer Frieden',
    description: 'Erreiche 95 Stabilität.',
    icon: 'temple',
    check: (state) => (player(state)?.stability ?? 0) >= 95
  },
  {
    id: 'empire',
    name: 'Großreich',
    description: 'Kontrolliere 20 Gebiete.',
    icon: 'map',
    check: (state) => getCountryTerritories(state, state.playerCountryId).length >= 20
  },
  {
    id: 'survivor',
    name: 'Überlebenskünstler',
    description: 'Überstehe 25 Runden ununterbrochen im Krieg.',
    icon: 'fire',
    check: (state) => isAtWarAtAll(state, state.playerCountryId) && state.turn >= 25
  },
  {
    id: 'dominance',
    name: 'Vormacht',
    description: 'Führe die Rangliste mit doppelter Punktzahl des Zweiten an.',
    icon: 'crown',
    check: (state) => {
      const scores = state.countryOrder
        .filter((id) => state.countries[id]?.isAlive)
        .map((id) => ({ id, score: getCountryScore(state, id) }))
        .sort((a, b) => b.score - a.score);
      if (scores.length < 2) return false;
      return scores[0].id === state.playerCountryId && scores[0].score >= scores[1].score * 2;
    }
  },
  {
    id: 'no_loss',
    name: 'Unangefochten',
    description: 'Gewinne 15 Schlachten, ohne eine zu verlieren.',
    icon: 'shield',
    check: (state) => state.stats.battlesWon >= 15 && state.stats.battlesLost === 0
  },
  {
    id: 'victory',
    name: 'Herrscher des Zeitalters',
    description: 'Gewinne ein Spiel.',
    icon: 'crown',
    check: (state) => state.status === 'victory'
  }
];

/** Prüft alle Erfolge und liefert die neu freigeschalteten zurück. */
export function checkAchievements(state: GameState): AchievementDefinition[] {
  const unlocked: AchievementDefinition[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (state.unlockedAchievements.includes(achievement.id)) continue;
    let passed = false;
    try {
      passed = achievement.check(state);
    } catch {
      passed = false;
    }
    if (passed) {
      state.unlockedAchievements.push(achievement.id);
      unlocked.push(achievement);
      state.log.unshift({
        turn: state.turn,
        type: 'system',
        text: `Erfolg freigeschaltet: ${achievement.name}`,
        important: true
      });
    }
  }
  return unlocked;
}

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((entry) => entry.id === id);
}

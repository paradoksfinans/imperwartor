/**
 * Zentraler Reducer.
 *
 * Trennung von Logik und Oberfläche: Der Reducer ruft ausschließlich
 * Funktionen aus dem Ordner "engine" auf und hält selbst keine Spielregeln.
 */
import type {
  Army,
  BuildingId,
  Difficulty,
  GameOptions,
  GameState,
  ProjectId
} from '../models/types';
import { createInitialState, DEFAULT_GAME_OPTIONS } from '../engine/setup';
import {
  attackTerritory,
  cancelConstruction,
  constructBuilding,
  moveTroops,
  recruitTroops,
  rushConstruction,
  startProject
} from '../engine/military';
import {
  concludePeace,
  performDiplomaticAction,
  type DiplomaticActionId
} from '../engine/diplomacy';
import { assignGeneral, hireGeneral } from '../engine/generals';
import { runEspionageMission, type EspionageMissionId } from '../engine/espionage';
import { setResearch } from '../engine/research';
import { resolveEventChoice } from '../engine/events';
import { processTurn } from '../engine/turn';
import { checkAchievements } from '../engine/achievements';
import { MAX_TAX_RATE, MIN_TAX_RATE } from '../engine/rules';
import { clamp, clone } from '../utils/helpers';

export type ScreenId = 'menu' | 'scenario' | 'country' | 'game';

export interface SetupState {
  scenarioId: string | null;
  countryId: string | null;
  difficulty: Difficulty;
  options: GameOptions;
  seed: string;
}

export interface AppState {
  screen: ScreenId;
  setup: SetupState;
  game: GameState | null;
  notification: string | null;
  /** Zuletzt freigeschaltete Erfolge (für die Einblendung). */
  achievementToast: string | null;
}

export const initialAppState: AppState = {
  screen: 'menu',
  setup: {
    scenarioId: null,
    countryId: null,
    difficulty: 'normal',
    options: { ...DEFAULT_GAME_OPTIONS },
    seed: ''
  },
  game: null,
  notification: null,
  achievementToast: null
};

export type GameAction =
  | { type: 'GO_TO'; screen: ScreenId }
  | { type: 'SELECT_SCENARIO'; scenarioId: string }
  | { type: 'SELECT_SETUP_COUNTRY'; countryId: string }
  | { type: 'SET_DIFFICULTY'; difficulty: Difficulty }
  | { type: 'SET_OPTION'; key: keyof GameOptions; value: boolean }
  | { type: 'SET_SEED'; seed: string }
  | { type: 'START_GAME' }
  | { type: 'LOAD_STATE'; state: GameState }
  | { type: 'RECRUIT'; territoryId: string; order: Army }
  | { type: 'MOVE'; fromId: string; toId: string; order: Army }
  | { type: 'ATTACK'; fromId: string; toId: string; order: Army }
  | { type: 'BUILD'; territoryId: string; buildingId: BuildingId }
  | { type: 'RUSH_BUILD'; territoryId: string }
  | { type: 'CANCEL_BUILD'; territoryId: string; index: number }
  | { type: 'START_PROJECT'; territoryId: string; projectId: ProjectId }
  | { type: 'SET_RESEARCH'; techId: string | null }
  | { type: 'SET_TAX'; value: number }
  | { type: 'SET_BUDGET'; military: number; economy: number; research: number }
  | { type: 'DIPLOMACY'; targetId: string; actionId: DiplomaticActionId; territoryId?: string }
  | { type: 'MAKE_PEACE'; warId: string; winnerId: string; loserId: string; demands: string[] }
  | { type: 'ESPIONAGE'; targetId: string; missionId: EspionageMissionId; territoryId?: string }
  | { type: 'HIRE_GENERAL' }
  | { type: 'ASSIGN_GENERAL'; generalId: string; territoryId: string | null }
  | { type: 'RESOLVE_EVENT'; choiceIndex: number }
  | { type: 'END_TURN' }
  | { type: 'CLOSE_BATTLE_REPORT' }
  | { type: 'CLOSE_TURN_REPORT' }
  | { type: 'CLEAR_NOTIFICATION' }
  | { type: 'CLEAR_ACHIEVEMENT_TOAST' }
  | { type: 'TOGGLE_GAME_OPTION'; key: keyof GameOptions }
  | { type: 'QUIT_TO_MENU' };

/** Führt eine Engine-Aktion auf einer Kopie des Spielzustands aus. */
function withGame(
  state: AppState,
  mutator: (draft: GameState) => string | null | void
): AppState {
  if (!state.game) return state;
  try {
    const draft = clone(state.game);
    const message = mutator(draft) ?? null;
    const unlocked = checkAchievements(draft);
    return {
      ...state,
      game: draft,
      notification: message,
      achievementToast: unlocked.length > 0 ? unlocked[0].name : state.achievementToast
    };
  } catch (error) {
    console.error('Fehler bei der Verarbeitung einer Aktion:', error);
    return {
      ...state,
      notification: 'Bei dieser Aktion ist ein Fehler aufgetreten. Es wurde nichts verändert.'
    };
  }
}

function parseSeed(seed: string): number | undefined {
  const trimmed = seed.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric);
  // Textsaat in eine Zahl umwandeln
  let hash = 2166136261;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) || 1;
}

export function gameReducer(state: AppState, action: GameAction): AppState {
  switch (action.type) {
    case 'GO_TO':
      return { ...state, screen: action.screen, notification: null };

    case 'SELECT_SCENARIO':
      return {
        ...state,
        setup: { ...state.setup, scenarioId: action.scenarioId, countryId: null },
        screen: 'country'
      };

    case 'SELECT_SETUP_COUNTRY':
      return { ...state, setup: { ...state.setup, countryId: action.countryId } };

    case 'SET_DIFFICULTY':
      return { ...state, setup: { ...state.setup, difficulty: action.difficulty } };

    case 'SET_OPTION':
      return {
        ...state,
        setup: {
          ...state.setup,
          options: { ...state.setup.options, [action.key]: action.value }
        }
      };

    case 'SET_SEED':
      return { ...state, setup: { ...state.setup, seed: action.seed } };

    case 'START_GAME': {
      const { scenarioId, countryId, difficulty, options, seed } = state.setup;
      if (!scenarioId || !countryId) {
        return { ...state, notification: 'Bitte zuerst Szenario und Land auswählen.' };
      }
      try {
        const game = createInitialState({
          scenarioId,
          playerCountryId: countryId,
          difficulty,
          options,
          seed: parseSeed(seed)
        });
        return { ...state, game, screen: 'game', notification: null };
      } catch (error) {
        console.error('Spiel konnte nicht gestartet werden:', error);
        return { ...state, notification: 'Das Spiel konnte nicht gestartet werden.' };
      }
    }

    case 'LOAD_STATE':
      return { ...state, game: action.state, screen: 'game', notification: 'Spielstand geladen.' };

    case 'RECRUIT':
      return withGame(state, (draft) =>
        recruitTroops(draft, draft.playerCountryId, action.territoryId, action.order).message
      );

    case 'MOVE':
      return withGame(state, (draft) =>
        moveTroops(draft, draft.playerCountryId, action.fromId, action.toId, action.order).message
      );

    case 'ATTACK':
      return withGame(state, (draft) =>
        attackTerritory(draft, draft.playerCountryId, action.fromId, action.toId, action.order).message
      );

    case 'BUILD':
      return withGame(state, (draft) =>
        constructBuilding(draft, draft.playerCountryId, action.territoryId, action.buildingId).message
      );

    case 'RUSH_BUILD':
      return withGame(state, (draft) =>
        rushConstruction(draft, draft.playerCountryId, action.territoryId).message
      );

    case 'CANCEL_BUILD':
      return withGame(state, (draft) =>
        cancelConstruction(draft, draft.playerCountryId, action.territoryId, action.index).message
      );

    case 'START_PROJECT':
      return withGame(state, (draft) =>
        startProject(draft, draft.playerCountryId, action.territoryId, action.projectId).message
      );

    case 'SET_RESEARCH':
      return withGame(state, (draft) =>
        setResearch(draft, draft.playerCountryId, action.techId).message
      );

    case 'SET_TAX':
      return withGame(state, (draft) => {
        const country = draft.countries[draft.playerCountryId];
        if (!country) return;
        country.taxRate = clamp(action.value, MIN_TAX_RATE, MAX_TAX_RATE);
      });

    case 'SET_BUDGET':
      return withGame(state, (draft) => {
        const country = draft.countries[draft.playerCountryId];
        if (!country) return;
        country.budget = {
          military: action.military,
          economy: action.economy,
          research: action.research
        };
      });

    case 'DIPLOMACY':
      return withGame(state, (draft) =>
        performDiplomaticAction(draft, draft.playerCountryId, action.targetId, action.actionId, {
          territoryId: action.territoryId
        }).message
      );

    case 'MAKE_PEACE':
      return withGame(state, (draft) => {
        const war = draft.wars.find((entry) => entry.id === action.warId);
        if (!war) return 'Dieser Krieg ist bereits beendet.';
        const result = concludePeace(
          draft,
          war,
          action.winnerId,
          action.loserId,
          action.demands,
          false
        );
        return result.message;
      });

    case 'ESPIONAGE':
      return withGame(state, (draft) =>
        runEspionageMission(
          draft,
          draft.playerCountryId,
          action.targetId,
          action.missionId,
          action.territoryId
        ).message
      );

    case 'HIRE_GENERAL':
      return withGame(state, (draft) => hireGeneral(draft, draft.playerCountryId).message);

    case 'ASSIGN_GENERAL':
      return withGame(state, (draft) =>
        assignGeneral(draft, draft.playerCountryId, action.generalId, action.territoryId).message
      );

    case 'RESOLVE_EVENT':
      return withGame(state, (draft) => resolveEventChoice(draft, action.choiceIndex));

    case 'END_TURN':
      return withGame(state, (draft) => {
        if (draft.pendingEvent) return 'Bitte zuerst das offene Ereignis entscheiden.';
        processTurn(draft);
        return null;
      });

    case 'CLOSE_BATTLE_REPORT':
      return withGame(state, (draft) => {
        draft.pendingBattleReportId = null;
      });

    case 'CLOSE_TURN_REPORT':
      return withGame(state, (draft) => {
        draft.lastTurnReport = null;
      });

    case 'TOGGLE_GAME_OPTION':
      return withGame(state, (draft) => {
        draft.options[action.key] = !draft.options[action.key];
      });

    case 'CLEAR_NOTIFICATION':
      return { ...state, notification: null };

    case 'CLEAR_ACHIEVEMENT_TOAST':
      return { ...state, achievementToast: null };

    case 'QUIT_TO_MENU':
      return { ...initialAppState, setup: state.setup };

    default:
      return state;
  }
}

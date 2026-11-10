/**
 * React-Context: stellt Reducer, Einstellungen und automatisches Speichern bereit.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode
} from 'react';
import { AUTOSAVE_SLOT, saveGame } from '../services/storage';
import {
  DEFAULT_SETTINGS,
  addUnlockedAchievements,
  loadSettings,
  saveSettings,
  type AppSettings
} from '../services/settingsStore';
import { playSound, setSoundEnabled } from '../services/audio';
import { gameReducer, initialAppState, type AppState, type GameAction } from './gameReducer';

interface GameContextValue {
  state: AppState;
  dispatch: Dispatch<GameAction>;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialAppState);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return loadSettings();
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const lastTurn = useRef<number>(0);
  const lastStatus = useRef<string>('playing');

  // Design anwenden
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Ton aktivieren oder stummschalten
  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // Automatisches Speichern nach jedem Rundenwechsel
  useEffect(() => {
    const game = state.game;
    if (!game || state.screen !== 'game') return;
    if (game.turn !== lastTurn.current) {
      lastTurn.current = game.turn;
      saveGame(AUTOSAVE_SLOT, game);
      if (game.turn > 1) playSound('endTurn');
    }
  }, [state.game?.turn, state.screen]);

  // Spielende: Ton und dauerhafte Erfolge sichern
  useEffect(() => {
    const game = state.game;
    if (!game) {
      lastStatus.current = 'playing';
      return;
    }
    if (game.status !== lastStatus.current) {
      lastStatus.current = game.status;
      if (game.status === 'victory') playSound('victory');
      if (game.status === 'defeat') playSound('defeat');
    }
    if (game.unlockedAchievements.length > 0) {
      addUnlockedAchievements(game.unlockedAchievements);
    }
  }, [state.game?.status, state.game?.unlockedAchievements.length]);

  // Erfolgseinblendung mit Ton
  useEffect(() => {
    if (state.achievementToast) playSound('achievement');
  }, [state.achievementToast]);

  const value = useMemo(
    () => ({ state, dispatch, settings, updateSettings }),
    [state, settings, updateSettings]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame muss innerhalb von <GameProvider> verwendet werden.');
  }
  return context;
}

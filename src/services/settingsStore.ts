/**
 * Dauerhafte Einstellungen und freigeschaltete Erfolge.
 * Diese Daten überdauern einzelne Spiele.
 */
const PREFIX = 'empire-tactics';

export type ThemeId = 'dark' | 'light';

export interface AppSettings {
  theme: ThemeId;
  sound: boolean;
  /** Zierwerk der Karte: Windrose und Maßstab. */
  showGrid: boolean;
  /** Zeichen in den Gebieten: Hauptstadt, Hafen, Festung und weitere. */
  showGlyphs: boolean;
  /** Übersichtskarte in der Ecke. */
  showMinimap: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sound: true,
  showGrid: true,
  showGlyphs: true,
  showMinimap: true
};

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}:${key}`);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, value);
  } catch {
    /* Speicher nicht verfügbar - Einstellungen gelten nur für diese Sitzung. */
  }
}

export function loadSettings(): AppSettings {
  const raw = safeGet('settings');
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  safeSet('settings', JSON.stringify(settings));
}

/** Dauerhaft freigeschaltete Erfolge über alle Spiele hinweg. */
export function loadUnlockedAchievements(): string[] {
  const raw = safeGet('achievements');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function addUnlockedAchievements(ids: string[]): string[] {
  const current = new Set(loadUnlockedAchievements());
  for (const id of ids) current.add(id);
  const result = [...current];
  safeSet('achievements', JSON.stringify(result));
  return result;
}

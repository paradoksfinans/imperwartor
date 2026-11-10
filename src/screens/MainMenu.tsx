/**
 * Startbildschirm. Die Karte ist der Held: sie zeigt gleich, worum es geht.
 */
import { useMemo, useState } from 'react';
import type { GameState } from '../models/types';
import { getAllScenarios } from '../services/contentService';
import { AUTOSAVE_SLOT, listSlots, loadGame } from '../services/storage';
import { ACHIEVEMENTS } from '../engine/achievements';
import { loadUnlockedAchievements } from '../services/settingsStore';
import { Icon } from '../components/ui/Icon';
import { Segmented } from '../components/ui/Bits';
import { ScenarioPreview } from '../components/map/ScenarioPreview';
import type { ThemeId } from '../components/map/mapVisuals';

interface MainMenuProps {
  theme: ThemeId;
  onNewGame: () => void;
  onLoadGame: (state: GameState) => void;
  onOpenHelp: () => void;
  onSetTheme: (theme: ThemeId) => void;
}

export function MainMenu({ theme, onNewGame, onLoadGame, onOpenHelp, onSetTheme }: MainMenuProps) {
  const [showSaves, setShowSaves] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const scenarios = getAllScenarios();
  const slots = useMemo(() => listSlots(), [showSaves]);
  const autosave = slots.find((slot) => slot.id === AUTOSAVE_SLOT);
  const unlocked = loadUnlockedAchievements();

  // Die Vorschau zeigt wechselnd eines der Szenarien
  const [previewIndex, setPreviewIndex] = useState(0);
  const preview = scenarios[previewIndex % scenarios.length];

  const continueGame = () => {
    const state = loadGame(AUTOSAVE_SLOT);
    if (state) onLoadGame(state);
    else setNote('Es gibt keinen laufenden Spielstand.');
  };

  return (
    <div className="menu">
      <div className="menu-inner">
        <div
          className="cartouche"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '1.5rem' }}
        >
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'minmax(16rem, 22rem) minmax(0, 1fr)' }}>
            <div>
              <svg className="title-mark" viewBox="0 0 120 8" aria-hidden="true">
                <path d="M0 4h44M76 4h44" stroke="currentColor" strokeWidth="1.2" />
                <path d="M60 0l6 4-6 4-6-4 6-4z" fill="currentColor" />
                <circle cx="50" cy="4" r="1.6" fill="currentColor" />
                <circle cx="70" cy="4" r="1.6" fill="currentColor" />
              </svg>

              <h1 style={{ marginBottom: '0.3rem' }}>Empire Tactics</h1>
              <p className="lede">
                Führe ein Reich über eine gezeichnete Karte: Gebiete verwalten, Truppen
                ausheben, Bündnisse schmieden, Kriege führen und Frieden aushandeln. Jede Runde
                hast du weniger Mittel als Pläne.
              </p>

              <div className="menu-actions">
                <button type="button" className="primary" onClick={onNewGame}>
                  <Icon name="compass" size={17} />
                  Neue Partie
                </button>
                {autosave?.exists ? (
                  <button type="button" onClick={continueGame}>
                    <Icon name="recenter" size={16} />
                    Fortsetzen · {autosave.countryName}, Runde {autosave.turn}
                  </button>
                ) : null}
                <button type="button" onClick={() => setShowSaves((value) => !value)}>
                  <Icon name="archive" size={16} />
                  Spielstand laden
                </button>
                <button type="button" className="quiet" onClick={onOpenHelp}>
                  <Icon name="help" size={16} />
                  Wie es gespielt wird
                </button>
              </div>

              <div className="row between" style={{ marginTop: '1.25rem' }}>
                <span className="faint">
                  {unlocked.length} von {ACHIEVEMENTS.length} Auszeichnungen
                </span>
                <Segmented
                  options={[
                    { id: 'dark', label: 'Nacht' },
                    { id: 'light', label: 'Tag' }
                  ]}
                  value={theme}
                  onChange={onSetTheme}
                  ariaLabel="Design"
                />
              </div>
            </div>

            <div>
              <ScenarioPreview scenarioId={preview.id} theme={theme} />
              <div className="row between" style={{ marginTop: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <strong className="serif">{preview.name}</strong>
                  <div className="faint">
                    {preview.era} · Start {preview.startYear} · {preview.countries.length} Mächte
                  </div>
                </div>
                <button
                  type="button"
                  className="small quiet"
                  onClick={() => setPreviewIndex((index) => index + 1)}
                >
                  nächste Karte
                  <Icon name="chevronRight" size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {showSaves ? (
          <div className="panel" style={{ marginTop: '1.25rem', padding: '0.75rem 0.9rem' }}>
            <div className="section-title">Spielstände</div>
            <div className="stack tight ruled">
              {slots.map((slot) => (
                <div className="row between" key={slot.id}>
                  <span>
                    <strong style={{ fontSize: '0.92rem' }}>{slot.label}</strong>
                    <span className="faint" style={{ display: 'block' }}>
                      {slot.exists
                        ? `${slot.countryName} · ${slot.scenarioName} · Runde ${slot.turn}`
                        : 'leer'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="small"
                    disabled={!slot.exists}
                    onClick={() => {
                      const state = loadGame(slot.id);
                      if (state) onLoadGame(state);
                      else setNote('Dieser Platz ist leer oder beschädigt.');
                    }}
                  >
                    Laden
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid two" style={{ marginTop: '1.25rem' }}>
          <div className="panel" style={{ padding: '0.75rem 0.9rem' }}>
            <div className="section-title">Was dich erwartet</div>
            <ul className="stack tight" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li style={{ fontSize: '0.9rem' }}>Drei Karten mit 16 bis 46 Gebieten</li>
              <li style={{ fontSize: '0.9rem' }}>Vier Truppengattungen mit Geländestärken</li>
              <li style={{ fontSize: '0.9rem' }}>Feldherren, die mit jeder Schlacht lernen</li>
              <li style={{ fontSize: '0.9rem' }}>Diplomatie, Spionage, Vasallen und Koalitionen</li>
              <li style={{ fontSize: '0.9rem' }}>Friedensverhandlungen mit echtem Verhandlungsgewicht</li>
              <li style={{ fontSize: '0.9rem' }}>24 Technologien, 10 Ausbauten, 5 Großprojekte</li>
            </ul>
          </div>
          <div className="panel" style={{ padding: '0.75rem 0.9rem' }}>
            <div className="section-title">Auszeichnungen</div>
            <div className="stack tight">
              {ACHIEVEMENTS.slice(0, 6).map((achievement) => {
                const done = unlocked.includes(achievement.id);
                return (
                  <div
                    className="row tight"
                    key={achievement.id}
                    style={{ opacity: done ? 1 : 0.55, alignItems: 'flex-start' }}
                  >
                    <Icon name={done ? 'trophy' : 'target'} size={14} />
                    <span style={{ fontSize: '0.86rem' }}>
                      {achievement.name}
                      <span className="faint"> {achievement.description}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {note ? (
          <p className="faint" style={{ marginTop: '0.75rem' }}>
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

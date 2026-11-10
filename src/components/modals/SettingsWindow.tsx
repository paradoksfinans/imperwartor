/**
 * Einstellungen und Spielstände in einem Fenster.
 */
import { useState } from 'react';
import type { GameOptions, GameState } from '../../models/types';
import type { AppSettings } from '../../services/settingsStore';
import {
  deleteGame,
  exportGame,
  importGame,
  listSlots,
  loadGame,
  saveGame,
  type SaveSlotId
} from '../../services/storage';
import { Icon } from '../ui/Icon';
import { Segmented } from '../ui/Bits';
import { Window } from '../ui/Window';

interface SettingsWindowProps {
  game: GameState;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onToggleOption: (key: keyof GameOptions) => void;
  onLoad: (state: GameState) => void;
  onQuit: () => void;
  onClose: () => void;
}

export function SettingsWindow({
  game,
  settings,
  onUpdateSettings,
  onToggleOption,
  onLoad,
  onQuit,
  onClose
}: SettingsWindowProps) {
  const [note, setNote] = useState<string | null>(null);
  const [transfer, setTransfer] = useState('');
  const [slots, setSlots] = useState(() => listSlots());
  const [confirmQuit, setConfirmQuit] = useState(false);

  const refresh = () => setSlots(listSlots());

  const handleSave = (slot: SaveSlotId) => {
    const ok = saveGame(slot, game);
    setNote(ok ? 'Gespeichert.' : 'Der Browser erlaubt kein Speichern.');
    refresh();
  };

  const handleLoad = (slot: SaveSlotId) => {
    const state = loadGame(slot);
    if (state) {
      onLoad(state);
      onClose();
    } else {
      setNote('Dieser Platz ist leer oder beschädigt.');
    }
  };

  return (
    <Window
      title="Einstellungen"
      icon="gear"
      onClose={onClose}
      footer={
        <>
          {confirmQuit ? (
            <>
              <span className="faint" style={{ marginRight: 'auto' }}>
                Nicht gespeicherter Fortschritt geht verloren.
              </span>
              <button type="button" onClick={() => setConfirmQuit(false)}>
                Abbrechen
              </button>
              <button type="button" className="danger" onClick={onQuit}>
                Wirklich beenden
              </button>
            </>
          ) : (
            <>
              <button type="button" className="danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmQuit(true)}>
                Partie beenden
              </button>
              <button type="button" className="primary" onClick={onClose}>
                Schließen
              </button>
            </>
          )}
        </>
      }
    >
      {/* --- Darstellung --- */}
      <div className="section-title">Darstellung</div>
      <div className="row between" style={{ marginBottom: '0.5rem' }}>
        <span>Design</span>
        <Segmented
          options={[
            { id: 'dark', label: 'Nacht' },
            { id: 'light', label: 'Tag' }
          ]}
          value={settings.theme}
          onChange={(theme) => onUpdateSettings({ theme })}
          ariaLabel="Design"
        />
      </div>
      {(
        [
          ['showMinimap', 'Übersichtskarte zeigen'],
          ['showGlyphs', 'Zeichen in den Gebieten zeigen'],
          ['showGrid', 'Windrose und Maßstab zeigen'],
          ['sound', 'Töne abspielen']
        ] as [keyof AppSettings, string][]
      ).map(([key, label]) => (
        <label key={key} className="row between" style={{ cursor: 'pointer', padding: '0.2rem 0' }}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={Boolean(settings[key])}
            onChange={(event) => onUpdateSettings({ [key]: event.target.checked } as Partial<AppSettings>)}
          />
        </label>
      ))}

      {/* --- Spielregeln --- */}
      <div className="section-title">Regeln dieser Partie</div>
      {(
        [
          ['fogOfWar', 'Aufklärung nötig (Nebel des Krieges)'],
          ['rebellions', 'Aufstände möglich'],
          ['showTurnReport', 'Rundenbericht anzeigen'],
          ['sandbox', 'Freies Spiel ohne Spielende']
        ] as [keyof GameOptions, string][]
      ).map(([key, label]) => (
        <label key={key} className="row between" style={{ cursor: 'pointer', padding: '0.2rem 0' }}>
          <span>{label}</span>
          <input
            type="checkbox"
            checked={game.options[key]}
            onChange={() => onToggleOption(key)}
          />
        </label>
      ))}

      {/* --- Spielstände --- */}
      <div className="section-title">Spielstände</div>
      <div className="stack tight">
        {slots.map((slot) => (
          <div className="row between" key={slot.id}>
            <span style={{ minWidth: 0 }}>
              <strong style={{ fontSize: '0.9rem' }}>{slot.label}</strong>
              <span className="faint" style={{ display: 'block' }}>
                {slot.exists
                  ? `${slot.countryName} · Runde ${slot.turn} · ${slot.scenarioName}`
                  : 'leer'}
              </span>
            </span>
            <span className="row tight">
              {slot.id !== 'autosave' ? (
                <button type="button" className="small" onClick={() => handleSave(slot.id)}>
                  Speichern
                </button>
              ) : null}
              <button
                type="button"
                className="small"
                disabled={!slot.exists}
                onClick={() => handleLoad(slot.id)}
              >
                Laden
              </button>
              <button
                type="button"
                className="small danger"
                disabled={!slot.exists}
                onClick={() => {
                  deleteGame(slot.id);
                  setNote('Gelöscht.');
                  refresh();
                }}
                aria-label={`${slot.label} löschen`}
              >
                <Icon name="close" size={13} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="section-title">Übertragen</div>
      <div className="row">
        <button
          type="button"
          className="small"
          onClick={async () => {
            const text = exportGame(game);
            try {
              await navigator.clipboard.writeText(text);
              setNote('Spielstand in die Zwischenablage kopiert.');
            } catch {
              setTransfer(text);
              setNote('Zwischenablage gesperrt - der Text steht im Feld.');
            }
          }}
        >
          Ausgeben
        </button>
        <button
          type="button"
          className="small"
          disabled={!transfer.trim()}
          onClick={() => {
            const state = importGame(transfer);
            if (state) {
              onLoad(state);
              onClose();
            } else {
              setNote('Der Text ist kein gültiger Spielstand.');
            }
          }}
        >
          Einlesen
        </button>
      </div>
      <textarea
        rows={4}
        value={transfer}
        placeholder="Spielstand hier einfügen"
        onChange={(event) => setTransfer(event.target.value)}
        style={{ marginTop: '0.4rem' }}
      />

      {note ? (
        <p className="faint" style={{ marginTop: '0.5rem' }}>
          {note}
        </p>
      ) : null}
    </Window>
  );
}

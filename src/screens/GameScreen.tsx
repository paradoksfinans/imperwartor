/**
 * Hauptspielbildschirm.
 *
 * Hält ausschließlich Oberflächenzustand - Auswahl, Ansicht, offene
 * Fenster - und leitet jede Entscheidung als Aktion an den Reducer weiter.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Army, BuildingId, GameOptions, GameState, MapFilter, MilitaryActionMode, ProjectId } from '../models/types';
import type { DiplomaticActionId } from '../engine/diplomacy';
import type { EspionageMissionId } from '../engine/espionage';
import { getAdvice, type Advice } from '../engine/advisor';
import { getAttackTargets, getMoveTargets } from '../engine/military';
import { getEvent } from '../services/contentService';
import { playSound } from '../services/audio';
import { useGame } from '../state/GameContext';
import { MapView, type MapControls } from '../components/map/MapView';
import { CommandBar } from '../components/hud/CommandBar';
import { FilterBar } from '../components/hud/FilterBar';
import { AdvisorBar } from '../components/hud/AdvisorBar';
import { TerritoryStrip } from '../components/hud/TerritoryStrip';
import { Dossier, DOSSIER_TABS, type DossierTab } from '../components/panels/Dossier';
import { BattleWindow } from '../components/modals/BattleWindow';
import { TurnWindow } from '../components/modals/TurnWindow';
import { EventWindow } from '../components/modals/EventWindow';
import { PeaceWindow } from '../components/modals/PeaceWindow';
import { GameOverWindow } from '../components/modals/GameOverWindow';
import { HelpWindow } from '../components/modals/HelpWindow';
import { SettingsWindow } from '../components/modals/SettingsWindow';
import { Icon } from '../components/ui/Icon';

const FILTER_CYCLE: MapFilter[] = [
  'political',
  'diplomacy',
  'military',
  'economy',
  'population',
  'stability',
  'supply',
  'resources',
  'culture',
  'religion',
  'terrain'
];

export function GameScreen({ game }: { game: GameState }) {
  const { state, dispatch, settings, updateSettings } = useGame();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<MilitaryActionMode>('none');
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MapFilter>('political');
  // Auf kleinen Geräten bleibt das Dossier zunächst geschlossen,
  // damit die Karte sichtbar ist.
  const [dossierOpen, setDossierOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches
  );
  const [dossierTab, setDossierTab] = useState<DossierTab>('realm');
  const [overlay, setOverlay] = useState<'help' | 'settings' | null>(null);
  const [peaceWarId, setPeaceWarId] = useState<string | null>(null);
  const [gameOverSeen, setGameOverSeen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const mapControls = useRef<MapControls | null>(null);

  /* ---------------------------------------------------------------- */
  /* Abgeleitete Werte                                                 */
  /* ---------------------------------------------------------------- */

  const moveTargets = useMemo(
    () => (selectedId && actionMode === 'move' ? getMoveTargets(game, game.playerCountryId, selectedId) : []),
    [game, selectedId, actionMode]
  );

  const attackTargets = useMemo(
    () => (selectedId && actionMode === 'attack' ? getAttackTargets(game, game.playerCountryId, selectedId) : []),
    [game, selectedId, actionMode]
  );

  const advice = useMemo(() => getAdvice(game), [game]);
  const urgentCount = advice.filter((entry) => entry.severity === 'urgent').length;

  const pendingReport = game.pendingBattleReportId
    ? game.battleReports.find((report) => report.id === game.pendingBattleReportId) ?? null
    : null;
  const pendingEvent = game.pendingEvent ? getEvent(game.pendingEvent.definitionId) : undefined;
  const turnReport = game.options.showTurnReport ? game.lastTurnReport : null;

  /* ---------------------------------------------------------------- */
  /* Meldungen ausblenden                                              */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!state.notification && !note) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'CLEAR_NOTIFICATION' });
      setNote(null);
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [state.notification, note, dispatch]);

  useEffect(() => {
    if (!state.achievementToast) return;
    const timer = window.setTimeout(() => dispatch({ type: 'CLEAR_ACHIEVEMENT_TOAST' }), 5000);
    return () => window.clearTimeout(timer);
  }, [state.achievementToast, dispatch]);

  /* ---------------------------------------------------------------- */
  /* Töne zu den wichtigen Ereignissen                                 */
  /* ---------------------------------------------------------------- */

  const lastBattleId = useRef<string | null>(null);
  const lastWarCount = useRef<number>(game.wars.length);
  const lastEventId = useRef<string | null>(null);

  useEffect(() => {
    const report = pendingReport;
    if (!report || report.id === lastBattleId.current) return;
    lastBattleId.current = report.id;
    if (report.captured) playSound('conquer');
    else if (report.winner === 'attacker') playSound('battleWin');
    else playSound('battleLose');
  }, [pendingReport]);

  useEffect(() => {
    const count = game.wars.length;
    if (count > lastWarCount.current) playSound('war');
    else if (count < lastWarCount.current) playSound('peace');
    lastWarCount.current = count;
  }, [game.wars.length]);

  useEffect(() => {
    const id = game.pendingEvent?.definitionId ?? null;
    if (id && id !== lastEventId.current) playSound('event');
    lastEventId.current = id;
  }, [game.pendingEvent?.definitionId]);

  /* ---------------------------------------------------------------- */
  /* Auswahl auf der Karte                                             */
  /* ---------------------------------------------------------------- */

  const handleSelect = (territoryId: string) => {
    if (actionMode === 'move' && moveTargets.includes(territoryId)) {
      setPendingTargetId(territoryId);
      return;
    }
    if (actionMode === 'attack' && attackTargets.includes(territoryId)) {
      setPendingTargetId(territoryId);
      return;
    }
    setSelectedId(territoryId);
    setActionMode('none');
    setPendingTargetId(null);
  };

  const endTurn = () => {
    setActionMode('none');
    setPendingTargetId(null);
    dispatch({ type: 'END_TURN' });
  };

  const followAdvice = (entry: Advice) => {
    if (entry.territoryId) {
      setSelectedId(entry.territoryId);
      setActionMode('none');
      setPendingTargetId(null);
      mapControls.current?.focus(entry.territoryId);
    }
    if (entry.panel && entry.panel !== 'territory') {
      const tab = entry.panel === 'intel' ? 'diplomacy' : entry.panel;
      if (DOSSIER_TABS.some((option) => option.id === tab)) {
        setDossierTab(tab as DossierTab);
        setDossierOpen(true);
      }
    }
  };

  /* ---------------------------------------------------------------- */
  /* Tastenkürzel                                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Offene Fenster fangen die Tasten selbst ab
      if (pendingEvent || pendingReport || turnReport || overlay || peaceWarId) {
        if (event.key === 'Escape') {
          setOverlay(null);
          setPeaceWarId(null);
        }
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          endTurn();
          break;
        case 'd':
        case 'D':
          setDossierOpen((value) => !value);
          break;
        case 'k':
        case 'K':
          setFilter((current) => {
            const index = FILTER_CYCLE.indexOf(current);
            return FILTER_CYCLE[(index + 1) % FILTER_CYCLE.length];
          });
          break;
        case 'b':
        case 'B':
          if (selectedId && game.territories[selectedId]?.ownerId === game.playerCountryId) {
            setActionMode((mode) => (mode === 'move' ? 'none' : 'move'));
            setPendingTargetId(null);
          }
          break;
        case 'a':
        case 'A':
          if (selectedId && game.territories[selectedId]?.ownerId === game.playerCountryId) {
            setActionMode((mode) => (mode === 'attack' ? 'none' : 'attack'));
            setPendingTargetId(null);
          }
          break;
        case '+':
          mapControls.current?.zoomIn();
          break;
        case '-':
          mapControls.current?.zoomOut();
          break;
        case '0':
          mapControls.current?.reset();
          break;
        case 'Escape':
          setActionMode('none');
          setPendingTargetId(null);
          break;
        case '?':
          setOverlay('help');
          break;
        default:
          if (/^[1-6]$/.test(event.key)) {
            const tab = DOSSIER_TABS[Number(event.key) - 1];
            if (tab) {
              setDossierTab(tab.id);
              setDossierOpen(true);
            }
          }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, game, pendingEvent, pendingReport, turnReport, overlay, peaceWarId]);

  /* ---------------------------------------------------------------- */
  /* Darstellung                                                       */
  /* ---------------------------------------------------------------- */

  return (
    <div className="game">
      <CommandBar
        game={game}
        theme={settings.theme}
        dossierOpen={dossierOpen}
        urgentCount={urgentCount}
        onEndTurn={endTurn}
        onToggleDossier={() => setDossierOpen((value) => !value)}
        onOpenHelp={() => setOverlay('help')}
        onOpenSettings={() => setOverlay('settings')}
      />

      <div className="game-body">
        <div className="map-column">
          <FilterBar value={filter} onChange={setFilter} />
          <AdvisorBar advice={advice} onPick={followAdvice} />

          <MapView
            game={game}
            theme={settings.theme}
            filter={filter}
            selectedId={selectedId}
            moveTargets={moveTargets}
            attackTargets={attackTargets}
            pendingTargetId={pendingTargetId}
            showMinimap={settings.showMinimap}
            showGlyphs={settings.showGlyphs}
            showOrnaments={settings.showGrid}
            controls={mapControls}
            onSelect={handleSelect}
          />

          <TerritoryStrip
            game={game}
            territoryId={selectedId}
            moveTargets={moveTargets}
            attackTargets={attackTargets}
            pendingTargetId={pendingTargetId}
            actionMode={actionMode}
            onChangeActionMode={(mode) => {
              setActionMode(mode);
              setPendingTargetId(null);
            }}
            onSelectTarget={setPendingTargetId}
            onRecruit={(territoryId: string, order: Army) =>
              dispatch({ type: 'RECRUIT', territoryId, order })
            }
            onMove={(fromId: string, toId: string, order: Army) =>
              dispatch({ type: 'MOVE', fromId, toId, order })
            }
            onAttack={(fromId: string, toId: string, order: Army) =>
              dispatch({ type: 'ATTACK', fromId, toId, order })
            }
            onBuild={(territoryId: string, buildingId: BuildingId) =>
              dispatch({ type: 'BUILD', territoryId, buildingId })
            }
            onProject={(territoryId: string, projectId: ProjectId) =>
              dispatch({ type: 'START_PROJECT', territoryId, projectId })
            }
            onRush={(territoryId: string) => dispatch({ type: 'RUSH_BUILD', territoryId })}
            onCancelBuild={(territoryId: string, index: number) =>
              dispatch({ type: 'CANCEL_BUILD', territoryId, index })
            }
            onAssignGeneral={(generalId: string, territoryId: string | null) =>
              dispatch({ type: 'ASSIGN_GENERAL', generalId, territoryId })
            }
          />
        </div>

        <Dossier
          game={game}
          theme={settings.theme}
          open={dossierOpen}
          tab={dossierTab}
          onChangeTab={setDossierTab}
          onClose={() => setDossierOpen(false)}
          onSelectTerritory={(territoryId) => {
            setSelectedId(territoryId);
            mapControls.current?.focus(territoryId);
            if (window.matchMedia('(max-width: 900px)').matches) setDossierOpen(false);
          }}
          onSetTax={(value) => dispatch({ type: 'SET_TAX', value })}
          onSetBudget={(military, economy, research) =>
            dispatch({ type: 'SET_BUDGET', military, economy, research })
          }
          onSetResearch={(techId) => dispatch({ type: 'SET_RESEARCH', techId })}
          onDiplomacy={(targetId: string, actionId: DiplomaticActionId, territoryId?: string) =>
            dispatch({ type: 'DIPLOMACY', targetId, actionId, territoryId })
          }
          onEspionage={(targetId: string, missionId: EspionageMissionId, territoryId?: string) =>
            dispatch({ type: 'ESPIONAGE', targetId, missionId, territoryId })
          }
          onHireGeneral={() => dispatch({ type: 'HIRE_GENERAL' })}
          onAssignGeneral={(generalId, territoryId) =>
            dispatch({ type: 'ASSIGN_GENERAL', generalId, territoryId })
          }
          onOpenPeace={(warId) => setPeaceWarId(warId)}
        />
      </div>

      {/* Bereichsleiste für kleine Geräte */}
      <nav className="tabbar" aria-label="Bereiche">
        {DOSSIER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={dossierOpen && dossierTab === tab.id}
            onClick={() => {
              if (dossierOpen && dossierTab === tab.id) {
                setDossierOpen(false);
              } else {
                setDossierTab(tab.id);
                setDossierOpen(true);
              }
            }}
          >
            <Icon name={tab.icon} size={18} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* --- Fenster --- */}
      {pendingEvent ? (
        <EventWindow
          definition={pendingEvent}
          onChoose={(choiceIndex) => dispatch({ type: 'RESOLVE_EVENT', choiceIndex })}
        />
      ) : null}

      {pendingReport ? (
        <BattleWindow report={pendingReport} onClose={() => dispatch({ type: 'CLOSE_BATTLE_REPORT' })} />
      ) : null}

      {turnReport && !pendingReport && !pendingEvent ? (
        <TurnWindow
          report={turnReport}
          turnLabel={game.turnLabel}
          onClose={() => dispatch({ type: 'CLOSE_TURN_REPORT' })}
        />
      ) : null}

      {peaceWarId ? (
        <PeaceWindow
          game={game}
          warId={peaceWarId}
          onClose={() => setPeaceWarId(null)}
          onConfirm={(warId, winnerId, loserId, demands) => {
            dispatch({ type: 'MAKE_PEACE', warId, winnerId, loserId, demands });
            setPeaceWarId(null);
          }}
        />
      ) : null}

      {overlay === 'help' ? <HelpWindow onClose={() => setOverlay(null)} /> : null}

      {overlay === 'settings' ? (
        <SettingsWindow
          game={game}
          settings={settings}
          onUpdateSettings={updateSettings}
          onToggleOption={(key: keyof GameOptions) => dispatch({ type: 'TOGGLE_GAME_OPTION', key })}
          onLoad={(loaded) => dispatch({ type: 'LOAD_STATE', state: loaded })}
          onQuit={() => dispatch({ type: 'QUIT_TO_MENU' })}
          onClose={() => setOverlay(null)}
        />
      ) : null}

      {game.status !== 'playing' && !gameOverSeen ? (
        <GameOverWindow
          game={game}
          onBackToMenu={() => dispatch({ type: 'QUIT_TO_MENU' })}
          onKeepPlaying={() => setGameOverSeen(true)}
        />
      ) : null}

      {/* --- Meldungen --- */}
      {state.achievementToast ? (
        <div className="toast achievement" role="status">
          <Icon name="trophy" size={16} />
          Auszeichnung: {state.achievementToast}
        </div>
      ) : null}

      {(state.notification || note) && !state.achievementToast ? (
        <div className="toast" role="status">
          {note ?? state.notification}
        </div>
      ) : null}
    </div>
  );
}

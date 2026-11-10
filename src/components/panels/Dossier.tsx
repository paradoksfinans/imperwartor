/**
 * Dossier: die Seitenleiste des Spiels. Auf kleinen Geräten erscheint sie
 * als Blatt am unteren Rand.
 */
import type { GameState } from '../../models/types';
import type { DiplomaticActionId } from '../../engine/diplomacy';
import type { EspionageMissionId } from '../../engine/espionage';
import { Icon, type IconName } from '../ui/Icon';
import type { ThemeId } from '../map/mapVisuals';
import { RealmPanel } from './RealmPanel';
import { MilitaryPanel } from './MilitaryPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { EconomyPanel } from './EconomyPanel';
import { ResearchPanel } from './ResearchPanel';
import { ChroniclePanel } from './ChroniclePanel';

export type DossierTab = 'realm' | 'military' | 'diplomacy' | 'economy' | 'research' | 'chronicle';

export const DOSSIER_TABS: { id: DossierTab; label: string; icon: IconName }[] = [
  { id: 'realm', label: 'Reich', icon: 'crown' },
  { id: 'military', label: 'Militär', icon: 'sword' },
  { id: 'diplomacy', label: 'Diplomatie', icon: 'treaty' },
  { id: 'economy', label: 'Wirtschaft', icon: 'gold' },
  { id: 'research', label: 'Forschung', icon: 'research' },
  { id: 'chronicle', label: 'Chronik', icon: 'chronicle' }
];

interface DossierProps {
  game: GameState;
  theme: ThemeId;
  open: boolean;
  tab: DossierTab;
  onChangeTab: (tab: DossierTab) => void;
  onClose: () => void;
  onSelectTerritory: (territoryId: string) => void;
  onSetTax: (value: number) => void;
  onSetBudget: (military: number, economy: number, research: number) => void;
  onSetResearch: (techId: string | null) => void;
  onDiplomacy: (targetId: string, actionId: DiplomaticActionId, territoryId?: string) => void;
  onEspionage: (targetId: string, missionId: EspionageMissionId, territoryId?: string) => void;
  onHireGeneral: () => void;
  onAssignGeneral: (generalId: string, territoryId: string | null) => void;
  onOpenPeace: (warId: string) => void;
}

export function Dossier(props: DossierProps) {
  const { game, theme, open, tab, onChangeTab, onClose } = props;

  return (
    <aside className={`dossier${open ? '' : ' hidden'}`} aria-label="Dossier">
      <div className="dossier-tabs" role="tablist" aria-label="Bereiche">
        {DOSSIER_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-pressed={tab === entry.id}
            aria-selected={tab === entry.id}
            onClick={() => onChangeTab(entry.id)}
            title={entry.label}
          >
            <Icon name={entry.icon} size={17} />
            {entry.label}
          </button>
        ))}
      </div>

      <div className="dossier-body scroll">
        <div className="dossier-head">
          <span className="faint">
            {game.scenarioName}
          </span>
          <button type="button" className="quiet small" onClick={onClose} aria-label="Dossier schließen">
            <Icon name="close" size={15} />
          </button>
        </div>

        {tab === 'realm' ? (
          <RealmPanel game={game} theme={theme} onOpenPeace={props.onOpenPeace} />
        ) : null}
        {tab === 'military' ? (
          <MilitaryPanel
            game={game}
            onSelectTerritory={props.onSelectTerritory}
            onHireGeneral={props.onHireGeneral}
            onAssignGeneral={props.onAssignGeneral}
          />
        ) : null}
        {tab === 'diplomacy' ? (
          <DiplomacyPanel
            game={game}
            theme={theme}
            onAction={props.onDiplomacy}
            onEspionage={props.onEspionage}
            onOpenPeace={props.onOpenPeace}
          />
        ) : null}
        {tab === 'economy' ? (
          <EconomyPanel game={game} onSetTax={props.onSetTax} onSetBudget={props.onSetBudget} />
        ) : null}
        {tab === 'research' ? <ResearchPanel game={game} onSetResearch={props.onSetResearch} /> : null}
        {tab === 'chronicle' ? <ChroniclePanel game={game} theme={theme} /> : null}
      </div>
    </aside>
  );
}

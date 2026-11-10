/**
 * Kommandozeile: Wappen, Zeit, alle Kennzahlen des Reiches und der
 * Rundenabschluss. Zahlen stehen in Tabellenziffern, damit sie beim
 * Wechsel der Runde nicht springen.
 */
import type { GameState } from '../../models/types';
import { calculateIncome } from '../../engine/economy';
import { getCountryPopulation, getCountryTerritories } from '../../engine/rules';
import { RESOURCE_ORDER, RESOURCE_LABELS } from '../../engine/army';
import { formatNumber, formatSigned } from '../../utils/format';
import { Icon, RESOURCE_ICON } from '../ui/Icon';
import { Pips, Readout } from '../ui/Bits';
import { landFill, type ThemeId } from '../map/mapVisuals';

interface CommandBarProps {
  game: GameState;
  theme: ThemeId;
  dossierOpen: boolean;
  urgentCount: number;
  onEndTurn: () => void;
  onToggleDossier: () => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
}

export function CommandBar({
  game,
  theme,
  dossierOpen,
  urgentCount,
  onEndTurn,
  onToggleDossier,
  onOpenHelp,
  onOpenSettings
}: CommandBarProps) {
  const country = game.countries[game.playerCountryId];
  if (!country) return null;

  const income = calculateIncome(game, country.id);
  const population = getCountryPopulation(game, country.id);
  const territories = getCountryTerritories(game, country.id).length;

  return (
    <header className="command">
      <div className="command-realm">
        <span
          className="crest"
          style={{ background: landFill(country.color, theme) }}
          aria-hidden="true"
        />
        <div style={{ minWidth: 0 }}>
          <div className="name" title={`${country.name} unter ${country.ruler}`}>
            {country.name}
          </div>
          <div className="faint" style={{ fontSize: '0.74rem', lineHeight: 1 }}>
            {game.turnLabel} {game.year}
            <span style={{ opacity: 0.5 }}> </span>
            Runde {game.turn}
          </div>
        </div>
      </div>

      <div className="command-sep" />

      <div className="readouts">
        <Readout
          icon="gold"
          value={formatNumber(country.gold)}
          delta={formatSigned(income.net)}
          tone={income.net >= 0 ? undefined : 'negative'}
          title={`Staatskasse. Bilanz dieser Runde: ${formatSigned(income.net)} Gold`}
        />
        <Readout
          icon="people"
          value={formatNumber(population)}
          title={`Bevölkerung in ${territories} Gebieten`}
        />
        <Readout
          icon="stability"
          value={Math.round(country.stability)}
          title="Zufriedenheit im Land. Unter 35 drohen Aufstände."
          tone={country.stability < 35 ? 'negative' : undefined}
        />
        <Readout
          icon="research"
          value={formatNumber(country.researchPoints)}
          delta={`+${formatNumber(income.researchPoints)}`}
          title="Forschungspunkte und Zuwachs je Runde"
        />
        <Readout
          icon="power"
          value={Math.round(country.politicalPower)}
          delta={`+${Math.round(income.politicalPower)}`}
          title="Politische Macht für Diplomatie, Spionage und Ansprüche"
        />
        <Readout
          icon="prestige"
          value={Math.round(country.prestige)}
          title="Ansehen - beeinflusst Bündnisse und Forderungen"
        />

        <span className="command-sep" />

        {RESOURCE_ORDER.map((key) => (
          <Readout
            key={key}
            icon={RESOURCE_ICON[key]}
            value={Math.round(country.resources[key])}
            delta={formatSigned(income.resources[key])}
            title={`${RESOURCE_LABELS[key]}: Bestand und Zuwachs je Runde`}
          />
        ))}
      </div>

      <div className="row tight nowrap">
        <span className="row tight" title="Aktionspunkte dieser Runde">
          <Icon name="action" size={15} className="glyph" />
          <Pips value={country.actionPoints} max={country.maxActionPoints} />
        </span>

        <button type="button" className="quiet small" onClick={onOpenHelp} aria-label="Spielhilfe">
          <Icon name="help" size={16} />
        </button>
        <button type="button" className="quiet small" onClick={onOpenSettings} aria-label="Einstellungen">
          <Icon name="gear" size={16} />
        </button>
        <button
          type="button"
          className="quiet small"
          onClick={onToggleDossier}
          aria-pressed={dossierOpen}
          aria-label="Dossier ein- oder ausklappen"
        >
          <Icon name="layers" size={16} />
        </button>
        <span className="end-turn">
          <button type="button" className="primary" onClick={onEndTurn}>
            Runde beenden
          </button>
          {urgentCount > 0 ? (
            <span className="badge" title={`${urgentCount} dringende Hinweise`}>
              {urgentCount}
            </span>
          ) : null}
        </span>
      </div>
    </header>
  );
}

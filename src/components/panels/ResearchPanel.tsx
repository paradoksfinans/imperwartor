/**
 * Forschung: der Technologiebaum nach Stufen, das laufende Vorhaben und
 * die Summe aller bereits erreichten Boni.
 */
import type { GameState, TechCategory, Technology } from '../../models/types';
import {
  getAllBuildings,
  getAllTechnologies,
  getAllUnits,
  getTechnology
} from '../../services/contentService';
import { getAvailableTechnologies, getResearchTurns } from '../../engine/research';
import { calculateIncome } from '../../engine/economy';
import { getTechBonus } from '../../engine/rules';
import { formatNumber, formatPercent } from '../../utils/format';
import { Icon, type IconName } from '../ui/Icon';
import { Bar, Empty, KeyValue, Tag } from '../ui/Bits';

const CATEGORY_LABEL: Record<TechCategory, string> = {
  military: 'Militär',
  economy: 'Wirtschaft',
  administration: 'Verwaltung',
  defense: 'Verteidigung',
  logistics: 'Logistik',
  education: 'Bildung',
  naval: 'Seefahrt',
  espionage: 'Spionage'
};

const CATEGORY_ICON: Record<TechCategory, IconName> = {
  military: 'sword',
  economy: 'market',
  administration: 'scroll',
  defense: 'shield',
  logistics: 'road',
  education: 'academy',
  naval: 'fleet',
  espionage: 'spy'
};

/** Kurzfassung der Wirkung einer Technologie. */
function describeEffects(tech: Technology): string {
  const parts: string[] = [];
  const effects = tech.effects;
  const percent = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100)} %`;
  if (effects.attack) parts.push(`${percent(effects.attack)} Angriff`);
  if (effects.defense) parts.push(`${percent(effects.defense)} Verteidigung`);
  if (effects.income) parts.push(`${percent(effects.income)} Einnahmen`);
  if (effects.research) parts.push(`${percent(effects.research)} Forschung`);
  if (effects.supply) parts.push(`${percent(effects.supply)} Versorgung`);
  if (effects.naval) parts.push(`${percent(effects.naval)} Flotten`);
  if (effects.siege) parts.push(`${percent(effects.siege)} Belagerung`);
  if (effects.espionage) parts.push(`${percent(effects.espionage)} Spionage`);
  if (effects.recruitCost) parts.push(`${percent(effects.recruitCost)} Aushebungskosten`);
  if (effects.stability) parts.push(`${effects.stability > 0 ? '+' : ''}${effects.stability} Zufriedenheit`);
  if (effects.politicalPower) parts.push(`${effects.politicalPower > 0 ? '+' : ''}${effects.politicalPower} Macht`);
  if (effects.actionPoints) parts.push(`+${effects.actionPoints} Aktionspunkt`);
  return parts.join(' · ');
}

/** Übersetzt die Kennung einer Freischaltung in ihren Anzeigenamen. */
function unlockName(id: string): string {
  const unit = getAllUnits().find((entry) => entry.id === id);
  if (unit) return unit.name;
  const building = getAllBuildings().find((entry) => entry.id === id);
  if (building) return building.name;
  return id;
}

export function ResearchPanel({
  game,
  onSetResearch
}: {
  game: GameState;
  onSetResearch: (techId: string | null) => void;
}) {
  const country = game.countries[game.playerCountryId];
  if (!country) return null;

  const all = getAllTechnologies();
  const available = new Set(getAvailableTechnologies(game, country.id).map((tech) => tech.id));
  const owned = new Set(country.technologies);
  const perTurn = calculateIncome(game, country.id).researchPoints;
  const current = country.currentResearchId ? getTechnology(country.currentResearchId) : null;
  const bonus = getTechBonus(country);

  const tiers = [...new Set(all.map((tech) => tech.tier))].sort((a, b) => a - b);

  return (
    <div className="stack">
      {/* --- Laufendes Vorhaben --- */}
      <div>
        <div className="section-title">Forschung</div>
        <KeyValue label="Punkte" value={formatNumber(country.researchPoints)} />
        <KeyValue label="Zuwachs je Runde" value={`+${formatNumber(perTurn)}`} />
        {current ? (
          <div style={{ marginTop: '0.4rem' }}>
            <div className="row between">
              <strong style={{ fontSize: '0.92rem' }}>{current.name}</strong>
              <span className="faint">
                {formatNumber(country.researchPoints)} / {formatNumber(current.cost)}
              </span>
            </div>
            <Bar value={country.researchPoints} max={current.cost} />
            <div className="row between" style={{ marginTop: '0.3rem' }}>
              <span className="faint">
                noch etwa {getResearchTurns(current.cost, country.researchPoints, perTurn)} Runden
              </span>
              <button type="button" className="small quiet" onClick={() => onSetResearch(null)}>
                abbrechen
              </button>
            </div>
          </div>
        ) : (
          <Empty text="Kein Vorhaben gewählt - Punkte sammeln sich an." icon="flask" />
        )}
      </div>

      {/* --- Baum --- */}
      {tiers.map((tier) => (
        <div key={tier}>
          <div className="section-title">Stufe {tier}</div>
          <div className="tech-tier">
            {all
              .filter((tech) => tech.tier === tier)
              .map((tech) => {
                const done = owned.has(tech.id);
                const open = available.has(tech.id);
                const active = country.currentResearchId === tech.id;
                const missing = tech.requires
                  .filter((id) => !owned.has(id))
                  .map((id) => getTechnology(id)?.name ?? id);

                return (
                  <button
                    key={tech.id}
                    type="button"
                    className={`tech${done ? ' done' : ''}${active ? ' active' : ''}${!done && !open ? ' locked' : ''}`}
                    disabled={done || !open}
                    onClick={() => onSetResearch(tech.id)}
                    title={
                      done
                        ? 'Bereits erforscht'
                        : missing.length > 0
                          ? `Voraussetzung: ${missing.join(', ')}`
                          : describeEffects(tech)
                    }
                  >
                    <span className="row tight" style={{ width: '100%' }}>
                      <Icon name={CATEGORY_ICON[tech.category]} size={13} />
                      <span className="tech-name">{tech.name}</span>
                      {done ? <Icon name="check" size={13} /> : null}
                    </span>
                    <span className="faint">
                      {CATEGORY_LABEL[tech.category]} · {formatNumber(tech.cost)}
                    </span>
                    <span className="faint">{describeEffects(tech)}</span>
                    {!done && missing.length > 0 ? (
                      <span className="faint">braucht {missing.join(', ')}</span>
                    ) : null}
                    {tech.unlocks && tech.unlocks.length > 0 ? (
                      <span className="faint">
                        schaltet frei: {tech.unlocks.map(unlockName).join(', ')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      {/* --- Summe --- */}
      <div>
        <div className="section-title">Erreichte Boni</div>
        <div className="row tight">
          {bonus.attack ? <Tag icon="sword">Angriff {formatPercent(bonus.attack)}</Tag> : null}
          {bonus.defense ? <Tag icon="shield">Verteidigung {formatPercent(bonus.defense)}</Tag> : null}
          {bonus.income ? <Tag icon="gold">Einnahmen {formatPercent(bonus.income)}</Tag> : null}
          {bonus.research ? <Tag icon="research">Forschung {formatPercent(bonus.research)}</Tag> : null}
          {bonus.supply ? <Tag icon="granary">Versorgung {formatPercent(bonus.supply)}</Tag> : null}
          {bonus.naval ? <Tag icon="fleet">Flotten {formatPercent(bonus.naval)}</Tag> : null}
          {bonus.siege ? <Tag icon="artillery">Belagerung {formatPercent(bonus.siege)}</Tag> : null}
          {bonus.espionage ? <Tag icon="spy">Spionage {formatPercent(bonus.espionage)}</Tag> : null}
          {country.technologies.length === 0 ? <span className="faint">noch keine</span> : null}
        </div>
      </div>
    </div>
  );
}

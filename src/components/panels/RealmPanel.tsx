/**
 * Reich: Lage des eigenen Landes auf einen Blick - Regierung, Zufriedenheit,
 * Haushalt, laufende Kriege, Vasallen und erreichte Auszeichnungen.
 */
import type { GameState } from '../../models/types';
import { ACHIEVEMENTS } from '../../engine/achievements';
import { calculateIncome } from '../../engine/economy';
import { getWarScoreFor } from '../../engine/diplomacy';
import {
  DIFFICULTY_INFO,
  GOVERNMENT_INFO,
  getCountryArmySize,
  getCountryPopulation,
  getCountryScore,
  getCountryTerritories
} from '../../engine/rules';
import { formatNumber, formatSigned } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { Bar, KeyValue, Meter, Tag } from '../ui/Bits';
import { Sparkline } from '../ui/Charts';
import { landFill, type ThemeId } from '../map/mapVisuals';

export function RealmPanel({
  game,
  theme,
  onOpenPeace
}: {
  game: GameState;
  theme: ThemeId;
  onOpenPeace: (warId: string) => void;
}) {
  const country = game.countries[game.playerCountryId];
  if (!country) return null;

  const income = calculateIncome(game, country.id);
  const government = GOVERNMENT_INFO[country.government];
  const difficulty = DIFFICULTY_INFO[game.difficulty];
  const territories = getCountryTerritories(game, country.id);
  const score = getCountryScore(game, country.id);

  const scoreHistory = game.history.map((entry) => entry.entries[country.id]?.score ?? 0);
  const myWars = game.wars.filter(
    (war) => war.attackers.includes(country.id) || war.defenders.includes(country.id)
  );

  const unlocked = new Set(game.unlockedAchievements);

  return (
    <div className="stack">
      {/* --- Kopf --- */}
      <div className="row" style={{ gap: '0.6rem' }}>
        <span className="crest lg" style={{ background: landFill(country.color, theme) }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{country.name}</h2>
          <div className="faint">
            {country.ruler} · {government.name}
          </div>
        </div>
      </div>

      <p className="faint" style={{ margin: 0 }}>
        {country.bonusText}
      </p>

      <div className="row tight">
        <Tag icon="globe">{game.era}</Tag>
        <Tag>{difficulty.name}</Tag>
        <Tag icon="chart">{formatNumber(score)} Punkte</Tag>
        {game.options.sandbox ? <Tag icon="info">Freies Spiel</Tag> : null}
        {country.overlordId ? (
          <Tag kind="war">Vasall von {game.countries[country.overlordId]?.name}</Tag>
        ) : null}
      </div>

      {scoreHistory.length > 2 ? (
        <div className="row between">
          <span className="faint">Punkteverlauf</span>
          <Sparkline values={scoreHistory} color="var(--accent)" width={150} height={28} />
        </div>
      ) : null}

      {/* --- Innere Lage --- */}
      <div>
        <div className="section-title">Innere Lage</div>
        <div className="stack tight">
          <Meter
            label="Zufriedenheit"
            value={country.stability}
            color={country.stability < 35 ? 'var(--negative)' : 'var(--positive)'}
            hint="Sinkt durch Steuern, Kriege und Besatzung. Unter 35 drohen Aufstände."
          />
          <Meter
            label="Kriegsmüdigkeit"
            value={country.warExhaustion}
            color={country.warExhaustion > 50 ? 'var(--negative)' : 'var(--warning)'}
            hint="Wächst in jedem Kriegsjahr und senkt die Moral der Truppen."
          />
          <Meter
            label="Politische Macht"
            value={country.politicalPower}
            max={200}
            display={Math.round(country.politicalPower).toString()}
            color="var(--indigo)"
            hint="Wird für Diplomatie, Spionage und Gebietsansprüche gebraucht."
          />
          <Meter
            label="Ansehen"
            value={country.prestige + 60}
            max={220}
            display={Math.round(country.prestige).toString()}
            color="var(--accent)"
            hint="Steigt durch Siege und Projekte, fällt durch Niederlagen."
          />
        </div>
      </div>

      {/* --- Haushalt --- */}
      <div>
        <div className="section-title">Haushalt dieser Runde</div>
        <KeyValue label="Steuern" value={formatNumber(income.taxes)} />
        <KeyValue label="Handel" value={formatNumber(income.trade)} />
        {income.vassalTribute > 0 ? (
          <KeyValue label="Tribut der Vasallen" value={formatNumber(income.vassalTribute)} />
        ) : null}
        <KeyValue label="Armeeunterhalt" value={`-${formatNumber(income.armyUpkeep)}`} tone="negative" />
        <KeyValue label="Gebäude" value={`-${formatNumber(income.buildingUpkeep)}`} tone="negative" />
        <KeyValue label="Verwaltung" value={`-${formatNumber(income.administration)}`} tone="negative" />
        {income.blockadeLoss > 0 ? (
          <KeyValue label="Blockaden" value={`-${formatNumber(income.blockadeLoss)}`} tone="negative" />
        ) : null}
        <KeyValue
          label="Bilanz"
          value={formatSigned(income.net)}
          tone={income.net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* --- Reichsgrösse --- */}
      <div>
        <div className="section-title">Reich</div>
        <KeyValue label="Gebiete" value={territories.length} />
        <KeyValue label="Bevölkerung" value={formatNumber(getCountryPopulation(game, country.id))} />
        <KeyValue label="Truppen" value={formatNumber(getCountryArmySize(game, country.id))} />
        <KeyValue label="Technologien" value={country.technologies.length} />
        <KeyValue label="Projekte" value={country.completedProjects.length} />
        {country.vassals.length > 0 ? (
          <KeyValue
            label="Vasallen"
            value={country.vassals.map((id) => game.countries[id]?.name ?? id).join(', ')}
          />
        ) : null}
        {country.claims.length > 0 ? (
          <KeyValue label="Ansprüche" value={country.claims.length} />
        ) : null}
      </div>

      {/* --- Kriege --- */}
      {myWars.length > 0 ? (
        <div>
          <div className="section-title">Kriege</div>
          <div className="stack tight">
            {myWars.map((war) => {
              const progress = getWarScoreFor(war, country.id);
              const opponents = (war.attackers.includes(country.id) ? war.defenders : war.attackers)
                .map((id) => game.countries[id]?.name ?? id)
                .join(', ');
              return (
                <div key={war.id} className="panel sunk" style={{ padding: '0.5rem 0.6rem' }}>
                  <div className="row between">
                    <strong style={{ fontSize: '0.9rem' }}>gegen {opponents}</strong>
                    <span className={progress >= 0 ? 'positive' : 'negative'}>
                      {formatSigned(progress)}
                    </span>
                  </div>
                  <div className="faint" style={{ marginBottom: '0.3rem' }}>
                    {war.goal.label} · seit Runde {war.startTurn}
                    {war.justified ? '' : ' · ohne Rechtfertigung'}
                  </div>
                  <Bar
                    value={progress + 100}
                    max={200}
                    color={progress >= 0 ? 'var(--positive)' : 'var(--negative)'}
                  />
                  <div className="row" style={{ marginTop: '0.4rem' }}>
                    <button type="button" className="small" onClick={() => onOpenPeace(war.id)}>
                      <Icon name="peace" size={14} />
                      Frieden verhandeln
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* --- Auszeichnungen --- */}
      <div>
        <div className="section-title">
          Auszeichnungen {unlocked.size}/{ACHIEVEMENTS.length}
        </div>
        <div className="stack tight">
          {ACHIEVEMENTS.map((achievement) => {
            const done = unlocked.has(achievement.id);
            return (
              <div
                key={achievement.id}
                className="row tight"
                style={{ opacity: done ? 1 : 0.5, alignItems: 'flex-start' }}
              >
                <Icon name={done ? 'trophy' : 'target'} size={15} />
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: done ? 600 : 400 }}>
                    {achievement.name}
                  </div>
                  <div className="faint">{achievement.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

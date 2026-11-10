/**
 * Militär: Gesamtstärke nach Gattungen, Feldherren und alle eigenen
 * Gebiete mit Versorgungslage.
 */
import type { GameState } from '../../models/types';
import { getTerritoryDefinition, getUnit } from '../../services/contentService';
import { UNIT_ORDER, armySize, armyUpkeep, landSize } from '../../engine/army';
import { getGeneralLimit, getSupplyCapacity, GENERAL_COST_GOLD, GENERAL_COST_POWER, TERRAIN_INFO } from '../../engine/rules';
import { formatNumber } from '../../utils/format';
import { Icon, UNIT_ICON } from '../ui/Icon';
import { Bar, Empty, KeyValue, Tag } from '../ui/Bits';
import { ShareBar } from '../ui/Charts';

const UNIT_COLORS: Record<string, string> = {
  infantry: '#336dc1',
  cavalry: '#b65412',
  artillery: '#5c7944',
  fleet: '#1d8fa6'
};

export function MilitaryPanel({
  game,
  onSelectTerritory,
  onHireGeneral,
  onAssignGeneral
}: {
  game: GameState;
  onSelectTerritory: (territoryId: string) => void;
  onHireGeneral: () => void;
  onAssignGeneral: (generalId: string, territoryId: string | null) => void;
}) {
  const country = game.countries[game.playerCountryId];
  if (!country) return null;

  const territories = Object.values(game.territories).filter(
    (territory) => territory.ownerId === country.id
  );

  const total = UNIT_ORDER.reduce(
    (acc, unitId) => {
      acc[unitId] = territories.reduce((sum, territory) => sum + territory.army[unitId], 0);
      return acc;
    },
    { infantry: 0, cavalry: 0, artillery: 0, fleet: 0 } as Record<string, number>
  );
  const totalSize = Object.values(total).reduce((sum, value) => sum + value, 0);
  const upkeep = armyUpkeep({
    infantry: total.infantry,
    cavalry: total.cavalry,
    artillery: total.artillery,
    fleet: total.fleet
  });

  const generalLimit = getGeneralLimit(game, country.id);
  const canHire =
    country.generals.length < generalLimit &&
    country.gold >= GENERAL_COST_GOLD &&
    country.politicalPower >= GENERAL_COST_POWER;

  return (
    <div className="stack">
      <div>
        <div className="section-title">Streitkräfte</div>
        {totalSize === 0 ? (
          <Empty text="Du hast derzeit keine Truppen." icon="infantry" />
        ) : (
          <>
            <ShareBar
              parts={UNIT_ORDER.filter((unitId) => total[unitId] > 0).map((unitId) => ({
                label: getUnit(unitId).short,
                value: total[unitId],
                color: UNIT_COLORS[unitId]
              }))}
            />
            <div style={{ marginTop: '0.5rem' }}>
              {UNIT_ORDER.map((unitId) => {
                const unit = getUnit(unitId);
                return (
                  <div className="kv" key={unitId}>
                    <span className="row tight">
                      <Icon name={UNIT_ICON[unitId]} size={14} />
                      {unit.name}
                    </span>
                    <span>{formatNumber(total[unitId])}</span>
                  </div>
                );
              })}
              <KeyValue label="Unterhalt je Runde" value={`-${formatNumber(upkeep)}`} tone="negative" />
            </div>
          </>
        )}
      </div>

      {/* --- Feldherren --- */}
      <div>
        <div className="section-title">
          Feldherren {country.generals.length}/{generalLimit}
        </div>
        {country.generals.length === 0 ? (
          <Empty text="Noch kein Feldherr im Dienst." icon="general" />
        ) : (
          <div className="stack tight ruled">
            {country.generals.map((general) => {
              const place = general.assignedTerritoryId
                ? getTerritoryDefinition(game.mapId, general.assignedTerritoryId).name
                : null;
              return (
                <div key={general.id}>
                  <div className="row between">
                    <strong style={{ fontSize: '0.9rem' }}>
                      {general.title} {general.name}
                    </strong>
                    <Tag kind="brass">Stufe {general.level}</Tag>
                  </div>
                  <div className="faint">
                    {general.trait} · Angriff +{Math.round(general.attack * 100)} % · Verteidigung +
                    {Math.round(general.defense * 100)} % · Belagerung +{Math.round(general.siege * 100)} %
                  </div>
                  <div className="row between" style={{ marginTop: '0.2rem' }}>
                    <span className="faint">
                      {place ? `stationiert in ${place}` : 'ohne Kommando'}
                      {general.battles > 0 ? ` · ${general.victories} von ${general.battles} Schlachten gewonnen` : ''}
                    </span>
                    {place ? (
                      <button
                        type="button"
                        className="small quiet"
                        onClick={() => onAssignGeneral(general.id, null)}
                      >
                        abziehen
                      </button>
                    ) : null}
                  </div>
                  <Bar value={general.experience % 100} max={100} thin />
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          className="block"
          style={{ marginTop: '0.5rem' }}
          disabled={!canHire}
          onClick={onHireGeneral}
          title={
            country.generals.length >= generalLimit
              ? 'Mehr Feldherren braucht ein grösseres Reich.'
              : `${GENERAL_COST_GOLD} Gold und ${GENERAL_COST_POWER} politische Macht`
          }
        >
          <Icon name="general" size={15} />
          Feldherrn anwerben ({GENERAL_COST_GOLD} Gold)
        </button>
      </div>

      {/* --- Gebiete --- */}
      <div>
        <div className="section-title">Standorte</div>
        <div className="stack tight">
          {territories
            .slice()
            .sort((a, b) => armySize(b.army) - armySize(a.army))
            .map((territory) => {
              const definition = getTerritoryDefinition(game.mapId, territory.id);
              const capacity = getSupplyCapacity(game, country, territory);
              const size = armySize(territory.army);
              const overloaded = size > capacity;
              return (
                <button
                  key={territory.id}
                  type="button"
                  className="choice"
                  onClick={() => onSelectTerritory(territory.id)}
                >
                  <span className="row between" style={{ width: '100%' }}>
                    <span className="choice-title" style={{ fontSize: '0.92rem' }}>
                      {definition.name}
                    </span>
                    <span className={overloaded ? 'negative' : ''}>
                      {formatNumber(size)} / {formatNumber(capacity)}
                    </span>
                  </span>
                  <span className="faint">
                    {TERRAIN_INFO[definition.terrain].name} · Befestigung {territory.fortification}
                    {landSize(territory.army) === 0 && size > 0 ? ' · nur Flotte' : ''}
                    {territory.generalId ? ' · Feldherr vor Ort' : ''}
                    {overloaded ? ' · Versorgung überlastet' : ''}
                  </span>
                  <Bar
                    value={size}
                    max={Math.max(capacity, size)}
                    color={overloaded ? 'var(--negative)' : 'var(--accent)'}
                    thin
                  />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

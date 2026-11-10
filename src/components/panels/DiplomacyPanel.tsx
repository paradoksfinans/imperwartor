/**
 * Diplomatie: Beziehungen zu allen Mächten, Verträge, Kriege und
 * geheime Unternehmungen.
 */
import { useState } from 'react';
import type { GameState } from '../../models/types';
import { getTerritoryDefinition } from '../../services/contentService';
import {
  DIPLOMATIC_ACTIONS,
  describeRelationState,
  getWarScoreFor,
  isActionAvailable,
  type DiplomaticActionId
} from '../../engine/diplomacy';
import { ESPIONAGE_MISSIONS, getIntelLevel, getMissionChance, type EspionageMissionId } from '../../engine/espionage';
import {
  areAllied,
  areAtWar,
  getCountryArmySize,
  getCountryTerritories,
  getNeighbourCountries,
  getNeighbourIds,
  getRelation,
  hasTrade,
  hasTruce
} from '../../engine/rules';
import { formatNumber, formatPercent } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { Empty, KeyValue, RelationAxis, Tag } from '../ui/Bits';
import { landFill, type ThemeId } from '../map/mapVisuals';

interface DiplomacyPanelProps {
  game: GameState;
  theme: ThemeId;
  onAction: (targetId: string, actionId: DiplomaticActionId, territoryId?: string) => void;
  onEspionage: (targetId: string, missionId: EspionageMissionId, territoryId?: string) => void;
  onOpenPeace: (warId: string) => void;
}

export function DiplomacyPanel({
  game,
  theme,
  onAction,
  onEspionage,
  onOpenPeace
}: DiplomacyPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [territoryChoice, setTerritoryChoice] = useState<string | null>(null);

  const player = game.countries[game.playerCountryId];
  if (!player) return null;

  const others = game.countryOrder
    .map((id) => game.countries[id])
    .filter((country) => country && country.isAlive && country.id !== player.id);

  const selected = selectedId ? game.countries[selectedId] : null;

  return (
    <div className="stack">
      {/* --- Laufende Kriege --- */}
      {game.wars.length > 0 ? (
        <div>
          <div className="section-title">Kriege der Welt</div>
          <div className="stack tight">
            {game.wars.map((war) => {
              const involved = war.attackers.includes(player.id) || war.defenders.includes(player.id);
              return (
                <div key={war.id} className="panel sunk" style={{ padding: '0.45rem 0.55rem' }}>
                  <div style={{ fontSize: '0.86rem' }}>
                    {war.attackers.map((id) => game.countries[id]?.name ?? id).join(', ')}
                    <span className="faint"> gegen </span>
                    {war.defenders.map((id) => game.countries[id]?.name ?? id).join(', ')}
                  </div>
                  <div className="row between faint">
                    <span>
                      {war.goal.label} · seit Runde {war.startTurn}
                    </span>
                    {involved ? (
                      <button type="button" className="small" onClick={() => onOpenPeace(war.id)}>
                        Frieden ({Math.round(getWarScoreFor(war, player.id))})
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* --- Bündnisse --- */}
      {game.alliances.length > 0 ? (
        <div>
          <div className="section-title">Bündnisse</div>
          {game.alliances.map((alliance) => (
            <div key={alliance.id} style={{ marginBottom: '0.3rem' }}>
              <div className="row tight">
                <Icon name="treaty" size={14} />
                <strong style={{ fontSize: '0.88rem' }}>{alliance.name}</strong>
                {alliance.againstId ? <Tag kind="war">Koalition</Tag> : null}
              </div>
              <div className="faint">
                {alliance.members.map((id) => game.countries[id]?.name ?? id).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* --- Mächte --- */}
      <div>
        <div className="section-title">Mächte</div>
        <div className="stack tight">
          {others.map((country) => {
            const relation = getRelation(game, player.id, country.id);
            const intel = getIntelLevel(game, player.id, country.id);
            const war = areAtWar(game, player.id, country.id);
            const allied = areAllied(game, player.id, country.id);
            const trade = hasTrade(game, player.id, country.id);
            const truce = hasTruce(game, player.id, country.id);
            const isVassal = country.overlordId === player.id;
            return (
              <button
                key={country.id}
                type="button"
                className={`choice${selectedId === country.id ? ' selected' : ''}`}
                aria-pressed={selectedId === country.id}
                onClick={() => {
                  setSelectedId(selectedId === country.id ? null : country.id);
                  setTerritoryChoice(null);
                }}
              >
                <span className="row between" style={{ width: '100%' }}>
                  <span className="row tight">
                    <span
                      className="crest"
                      style={{ background: landFill(country.color, theme), width: '1.1rem', height: '1.1rem' }}
                    />
                    <span className="choice-title" style={{ fontSize: '0.92rem' }}>
                      {country.name}
                    </span>
                  </span>
                  <span className={relation < -25 ? 'negative' : relation > 25 ? 'positive' : 'faint'}>
                    {relation > 0 ? `+${relation}` : relation}
                  </span>
                </span>
                <span style={{ width: '100%', display: 'block', margin: '0.2rem 0' }}>
                  <RelationAxis value={relation} />
                </span>
                <span className="row tight">
                  {war ? <Tag kind="war" icon="war">Krieg</Tag> : null}
                  {allied ? <Tag kind="ally" icon="treaty">Bündnis</Tag> : null}
                  {trade ? <Tag icon="market">Handel</Tag> : null}
                  {truce ? <Tag icon="peace">Waffenruhe</Tag> : null}
                  {isVassal ? <Tag kind="brass">Vasall</Tag> : null}
                  {country.overlordId && country.overlordId !== player.id ? (
                    <Tag>Vasall von {game.countries[country.overlordId]?.name}</Tag>
                  ) : null}
                  <Tag icon="eye">Aufklärung {intel}/3</Tag>
                </span>
                <span className="faint">
                  {describeRelationState(game, player.id, country.id)}
                  {intel >= 2
                    ? ` · ${formatNumber(getCountryArmySize(game, country.id))} Truppen · ${getCountryTerritories(game, country.id).length} Gebiete`
                    : ' · Stärke unbekannt'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- Aktionen --- */}
      {selected ? (
        <div className="panel sunk" style={{ padding: '0.6rem' }}>
          <div className="section-title">{selected.name}</div>
          <p className="faint" style={{ marginTop: 0 }}>
            {selected.description}
          </p>
          <KeyValue label="Herrscher" value={selected.ruler} />
          <KeyValue label="Regierung" value={selected.government} />
          <KeyValue label="Kultur" value={`${selected.culture} · ${selected.religion}`} />
          {getIntelLevel(game, player.id, selected.id) >= 1 ? (
            <KeyValue label="Bedrohung" value={Math.round(selected.threat)} />
          ) : null}

          <div className="section-title" style={{ marginTop: '0.6rem' }}>
            Gesandtschaft
          </div>
          <div className="stack tight">
            {DIPLOMATIC_ACTIONS.map((action) => {
              const available = isActionAvailable(game, player.id, selected.id, action.id);
              if (!available) return null;
              const affordable =
                player.gold >= action.goldCost &&
                player.politicalPower >= action.powerCost &&
                player.actionPoints >= action.actionPointCost;

              const needsTerritory = action.id === 'fabricateClaim';
              const claimTargets = needsTerritory
                ? getCountryTerritories(game, selected.id).filter((territory) =>
                    getNeighbourIds(game, territory.id).some(
                      (id) => game.territories[id]?.ownerId === player.id
                    )
                  )
                : [];

              return (
                <div key={action.id}>
                  <div className="row between">
                    <span style={{ fontSize: '0.88rem' }}>{action.name}</span>
                    <button
                      type="button"
                      className={`small${action.danger ? ' danger' : ''}`}
                      disabled={!affordable || (needsTerritory && !territoryChoice)}
                      onClick={() =>
                        onAction(selected.id, action.id, needsTerritory ? territoryChoice ?? undefined : undefined)
                      }
                      title={action.description}
                    >
                      {action.goldCost > 0 ? `${formatNumber(action.goldCost)} Gold` : ''}
                      {action.powerCost > 0 ? ` ${action.powerCost} Macht` : ''}
                      {action.goldCost === 0 && action.powerCost === 0 ? 'ausführen' : ''}
                    </button>
                  </div>
                  {needsTerritory ? (
                    <div className="row tight" style={{ marginBottom: '0.3rem' }}>
                      {claimTargets.length === 0 ? (
                        <span className="faint">Kein angrenzendes Gebiet.</span>
                      ) : (
                        claimTargets.map((territory) => (
                          <button
                            key={territory.id}
                            type="button"
                            className={`small${territoryChoice === territory.id ? ' selected' : ''}`}
                            onClick={() => setTerritoryChoice(territory.id)}
                          >
                            {getTerritoryDefinition(game.mapId, territory.id).name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {DIPLOMATIC_ACTIONS.every(
              (action) => !isActionAvailable(game, player.id, selected.id, action.id)
            ) ? (
              <Empty text="Derzeit ist keine Gesandtschaft möglich." />
            ) : null}
          </div>

          {/* --- Spionage --- */}
          <div className="section-title" style={{ marginTop: '0.7rem' }}>
            Geheime Unternehmungen
          </div>
          <div className="stack tight">
            {ESPIONAGE_MISSIONS.map((mission) => {
              const chance = getMissionChance(game, player.id, selected.id, mission.id);
              const affordable =
                player.gold >= mission.goldCost &&
                player.politicalPower >= mission.powerCost &&
                player.actionPoints >= 1;
              const territories = mission.needsTerritory
                ? getCountryTerritories(game, selected.id)
                : [];
              return (
                <div key={mission.id}>
                  <div className="row between">
                    <span style={{ fontSize: '0.88rem' }} title={mission.description}>
                      {mission.name}
                      <span className="faint"> {formatPercent(chance)}</span>
                    </span>
                    <button
                      type="button"
                      className="small"
                      disabled={!affordable || (mission.needsTerritory && !territoryChoice)}
                      onClick={() =>
                        onEspionage(
                          selected.id,
                          mission.id,
                          mission.needsTerritory ? territoryChoice ?? undefined : undefined
                        )
                      }
                    >
                      {formatNumber(mission.goldCost)} Gold · {mission.powerCost} Macht
                    </button>
                  </div>
                  {mission.needsTerritory ? (
                    <div className="row tight" style={{ marginBottom: '0.3rem' }}>
                      {territories.slice(0, 8).map((territory) => (
                        <button
                          key={territory.id}
                          type="button"
                          className={`small${territoryChoice === territory.id ? ' selected' : ''}`}
                          onClick={() => setTerritoryChoice(territory.id)}
                        >
                          {getTerritoryDefinition(game.mapId, territory.id).name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!getNeighbourCountries(game, player.id).includes(selected.id) ? (
            <p className="faint" style={{ margin: '0.5rem 0 0' }}>
              Dieses Land grenzt nicht an dein Reich - Ansprüche sind daher nicht möglich.
            </p>
          ) : null}
        </div>
      ) : (
        <Empty text="Wähle eine Macht, um Gesandte zu schicken." icon="treaty" />
      )}
    </div>
  );
}

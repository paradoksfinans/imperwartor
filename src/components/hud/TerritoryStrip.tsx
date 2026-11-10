/**
 * Gebietsleiste am unteren Rand.
 *
 * Zeigt alles zum gewählten Gebiet und führt alle Aktionen aus, die dort
 * möglich sind: Aushebung, Verlegung, Angriff, Ausbau, Großprojekt und
 * Zuweisung eines Feldherrn.
 */
import { useEffect, useState } from 'react';
import type {
  Army,
  BuildingId,
  GameState,
  MilitaryActionMode,
  ProjectId
} from '../../models/types';
import {
  getAllBuildings,
  getAllProjects,
  getTerritoryDefinition,
  getUnit
} from '../../services/contentService';
import {
  armySize,
  canAfford,
  describeMissing,
  emptyArmy,
  getAvailableUnits,
  landSize,
  recruitmentCost,
  scaleCost,
  UNIT_ORDER
} from '../../engine/army';
import { estimateBattleOdds } from '../../engine/combat';
import { getPlannedLevel, hasProjectInProgress } from '../../engine/military';
import { getGeneralInTerritory } from '../../engine/generals';
import {
  MAX_CONSTRUCTION_QUEUE,
  TERRAIN_INFO,
  areAtWar,
  getBuildingCost,
  getRecruitDiscount,
  getSupplyCapacity
} from '../../engine/rules';
import { formatDecimal, formatNumber, formatPercent } from '../../utils/format';
import { clamp } from '../../utils/helpers';
import { BUILDING_ICON, Icon, PROJECT_ICON, UNIT_ICON } from '../ui/Icon';
import { Bar, Empty, KeyValue, Tag } from '../ui/Bits';
import { ArmyPicker } from '../ui/ArmyPicker';

type StripMode = 'none' | 'recruit' | 'move' | 'attack' | 'build' | 'project' | 'general';

interface TerritoryStripProps {
  game: GameState;
  territoryId: string | null;
  moveTargets: string[];
  attackTargets: string[];
  pendingTargetId: string | null;
  actionMode: MilitaryActionMode;
  onChangeActionMode: (mode: MilitaryActionMode) => void;
  onSelectTarget: (territoryId: string | null) => void;
  onRecruit: (territoryId: string, order: Army) => void;
  onMove: (fromId: string, toId: string, order: Army) => void;
  onAttack: (fromId: string, toId: string, order: Army) => void;
  onBuild: (territoryId: string, buildingId: BuildingId) => void;
  onProject: (territoryId: string, projectId: ProjectId) => void;
  onRush: (territoryId: string) => void;
  onCancelBuild: (territoryId: string, index: number) => void;
  onAssignGeneral: (generalId: string, territoryId: string | null) => void;
}

export function TerritoryStrip(props: TerritoryStripProps) {
  const { game, territoryId, moveTargets, attackTargets, pendingTargetId, actionMode } = props;

  const [mode, setMode] = useState<StripMode>('none');
  const [order, setOrder] = useState<Army>(emptyArmy());

  const territory = territoryId ? game.territories[territoryId] : null;
  const player = game.countries[game.playerCountryId];

  // Bei Gebietswechsel alle Eingaben zurücksetzen
  useEffect(() => {
    setMode('none');
    setOrder(emptyArmy());
  }, [territoryId]);

  // Die Karte und die Leiste teilen denselben Aktionszustand
  useEffect(() => {
    if (actionMode === 'move' && mode !== 'move') setMode('move');
    if (actionMode === 'attack' && mode !== 'attack') setMode('attack');
    if (actionMode === 'none' && (mode === 'move' || mode === 'attack')) setMode('none');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionMode]);

  if (!territoryId || !territory || !player) {
    return (
      <div className="territory-strip">
        <Empty text="Tippe ein Gebiet auf der Karte an, um es zu verwalten." icon="target" />
      </div>
    );
  }

  const definition = getTerritoryDefinition(game.mapId, territoryId);
  const terrain = TERRAIN_INFO[definition.terrain];
  const owner = territory.ownerId ? game.countries[territory.ownerId] : null;
  const isOwn = territory.ownerId === player.id;
  const atWar = owner && !isOwn ? areAtWar(game, player.id, owner.id) : false;
  const capacity = isOwn ? getSupplyCapacity(game, player, territory) : 0;
  const general = isOwn ? getGeneralInTerritory(player, territoryId) : null;
  const troops = armySize(territory.army);

  const setActionMode = (next: MilitaryActionMode) => {
    props.onChangeActionMode(next);
    props.onSelectTarget(null);
    setOrder(emptyArmy());
    setMode(next === 'none' ? 'none' : next);
  };

  const openPanel = (next: StripMode) => {
    if (next === 'move' || next === 'attack') {
      setActionMode(next);
      return;
    }
    props.onChangeActionMode('none');
    setMode(mode === next ? 'none' : next);
    setOrder(emptyArmy());
  };

  return (
    <div className="territory-strip">
      <div className="strip-head">
        <span className="strip-name">{definition.name}</span>
        <Tag icon="layers">{terrain.name}</Tag>
        {owner ? (
          <Tag kind={isOwn ? 'brass' : atWar ? 'war' : undefined}>
            {owner.name}
            {atWar ? ' · im Krieg' : ''}
          </Tag>
        ) : (
          <Tag>herrenlos</Tag>
        )}
        {owner?.capitalId === territoryId ? <Tag icon="crown">Hauptstadt</Tag> : null}
        {definition.hasPort ? <Tag icon="anchor">Hafen</Tag> : null}
        {territory.blockaded ? <Tag kind="war" icon="blockade">blockiert</Tag> : null}
        {territory.construction.length > 0 ? (
          <Tag icon="crane">
            Bauschlange {territory.construction.length}/{MAX_CONSTRUCTION_QUEUE}
          </Tag>
        ) : null}
        {general ? (
          <Tag kind="brass" icon="general">
            {general.name}
          </Tag>
        ) : null}
        <span className="faint" style={{ marginLeft: 'auto' }}>
          {terrain.hint}
        </span>
      </div>

      <div className="facts">
        <KeyValue
          label="Truppen"
          value={`${formatNumber(troops)}${capacity > 0 ? ` / ${formatNumber(capacity)}` : ''}`}
          hint="Stationierte Truppen und Versorgungsgrenze"
          tone={capacity > 0 && troops > capacity ? 'negative' : undefined}
        />
        <KeyValue label="Bevölkerung" value={formatNumber(territory.population)} />
        <KeyValue label="Wirtschaft" value={formatNumber(territory.economy)} />
        <KeyValue label="Infrastruktur" value={territory.infrastructure} />
        <KeyValue
          label="Befestigung"
          value={`Stufe ${territory.fortification} · ×${formatDecimal(terrain.defense * (1 + territory.fortification * 0.1))}`}
          hint="Gelände und Befestigung zusammen"
        />
        <KeyValue
          label="Unruhe"
          value={Math.round(territory.unrest)}
          tone={territory.unrest > 50 ? 'negative' : undefined}
        />
        <KeyValue label="Kultur" value={territory.culture} />
        <KeyValue label="Glaube" value={territory.religion} />
        {territory.devastation > 5 ? (
          <KeyValue
            label="Kriegsschäden"
            value={Math.round(territory.devastation)}
            tone="negative"
          />
        ) : null}
        <KeyValue label="Vorkommen" value={definition.resources.join(', ') || 'keine'} />
      </div>

      {/* Truppenaufstellung */}
      {troops > 0 ? (
        <div className="row tight" style={{ marginBottom: '0.5rem' }}>
          {UNIT_ORDER.filter((unitId) => territory.army[unitId] > 0).map((unitId) => (
            <Tag key={unitId} icon={UNIT_ICON[unitId]}>
              {getUnit(unitId).name} {territory.army[unitId]}
            </Tag>
          ))}
        </div>
      ) : null}

      {/* Bauschlange */}
      {territory.construction.length > 0 ? (
        <div className="panel sunk" style={{ padding: '0.5rem 0.6rem', marginBottom: '0.5rem' }}>
          <div className="row between" style={{ marginBottom: '0.3rem' }}>
            <span className="row tight">
              <Icon name="crane" size={15} />
              <strong style={{ fontSize: '0.9rem' }}>Bauschlange</strong>
            </span>
            <span className="faint">
              {territory.construction.length} von {MAX_CONSTRUCTION_QUEUE} Plätzen belegt
            </span>
          </div>

          <div className="queue">
            {territory.construction.map((order, index) => {
              const active = index === 0;
              const done = order.totalTurns - order.turnsLeft;
              return (
                <div className={`queue-item${active ? ' active' : ''}`} key={`${order.kind}-${order.id}-${index}`}>
                  <span className="queue-position">{index + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="row tight">
                      <Icon
                        name={
                          order.kind === 'project'
                            ? 'trophy'
                            : BUILDING_ICON[order.id] ?? 'hammer'
                        }
                        size={14}
                      />
                      <span style={{ fontSize: '0.88rem' }}>{buildLabel(order.kind, order.id)}</span>
                      {order.kind === 'project' ? <Tag kind="brass">Großprojekt</Tag> : null}
                    </div>
                    <div className="faint">
                      {active
                        ? `in Arbeit · noch ${order.turnsLeft} von ${order.totalTurns} ${turnWord(order.totalTurns)}`
                        : `wartet · ${order.totalTurns} ${turnWord(order.totalTurns)} Bauzeit`}
                    </div>
                    {active ? <Bar value={done} max={order.totalTurns} thin /> : null}
                  </div>
                  {isOwn ? (
                    <span className="row tight">
                      {active ? (
                        <button
                          type="button"
                          className="small"
                          onClick={() => props.onRush(territoryId)}
                          title={`Kostet ${order.turnsLeft * 12} politische Macht`}
                        >
                          beschleunigen
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="small quiet"
                        onClick={() => props.onCancelBuild(territoryId, index)}
                        aria-label="Vorhaben abbrechen"
                        title={
                          active
                            ? 'Abbrechen - die Hälfte der Kosten wird erstattet'
                            : 'Aus der Schlange nehmen - Kosten werden voll erstattet'
                        }
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isOwn ? (
        <p className="faint" style={{ margin: 0 }}>
          Fremdes Gebiet. Aktionen sind nur in eigenen Gebieten möglich - ein Angriff beginnt
          immer in einem eigenen Nachbargebiet.
        </p>
      ) : (
        <>
          <div className="action-bar">
            <button type="button" className={mode === 'recruit' ? 'selected' : ''} onClick={() => openPanel('recruit')}>
              <Icon name="infantry" size={15} />
              Ausheben
            </button>
            <button
              type="button"
              className={actionMode === 'move' ? 'selected' : ''}
              onClick={() => setActionMode(actionMode === 'move' ? 'none' : 'move')}
              disabled={troops <= 0}
            >
              <Icon name="road" size={15} />
              Verlegen
            </button>
            <button
              type="button"
              className={actionMode === 'attack' ? 'selected' : ''}
              onClick={() => setActionMode(actionMode === 'attack' ? 'none' : 'attack')}
              disabled={landSize(territory.army) <= 0}
            >
              <Icon name="sword" size={15} />
              Angreifen
            </button>
            <button type="button" className={mode === 'build' ? 'selected' : ''} onClick={() => openPanel('build')}>
              <Icon name="hammer" size={15} />
              Ausbauen
            </button>
            <button type="button" className={mode === 'project' ? 'selected' : ''} onClick={() => openPanel('project')}>
              <Icon name="trophy" size={15} />
              Projekt
            </button>
            <button
              type="button"
              className={mode === 'general' ? 'selected' : ''}
              onClick={() => openPanel('general')}
              disabled={player.generals.length === 0}
            >
              <Icon name="general" size={15} />
              Feldherr
            </button>
          </div>

          {mode === 'recruit' ? <RecruitForm {...props} order={order} setOrder={setOrder} /> : null}
          {(mode === 'move' || mode === 'attack') && actionMode !== 'none' ? (
            <MarchForm
              {...props}
              order={order}
              setOrder={setOrder}
              targets={actionMode === 'move' ? moveTargets : attackTargets}
              isAttack={actionMode === 'attack'}
            />
          ) : null}
          {mode === 'build' ? <BuildList {...props} /> : null}
          {mode === 'project' ? <ProjectList {...props} /> : null}
          {mode === 'general' ? <GeneralList {...props} /> : null}
        </>
      )}
    </div>
  );
}

/** Einzahl oder Mehrzahl von "Runde". */
function turnWord(count: number): string {
  return count === 1 ? 'Runde' : 'Runden';
}

function buildLabel(kind: 'building' | 'project', id: string): string {
  if (kind === 'project') {
    return getAllProjects().find((project) => project.id === id)?.name ?? id;
  }
  return getAllBuildings().find((building) => building.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ */
/* Aushebung                                                           */
/* ------------------------------------------------------------------ */

function RecruitForm({
  game,
  territoryId,
  order,
  setOrder,
  onRecruit
}: TerritoryStripProps & { order: Army; setOrder: (next: Army) => void }) {
  const player = game.countries[game.playerCountryId];
  const territory = territoryId ? game.territories[territoryId] : null;
  if (!player || !territory || !territoryId) return null;

  const definition = getTerritoryDefinition(game.mapId, territoryId);
  const allowed = getAvailableUnits(player).filter(
    (unitId) => unitId !== 'fleet' || definition.hasPort
  );

  // Höchstmenge ergibt sich aus Gold, Bevölkerung und Rohstoffen
  const discount = getRecruitDiscount(player, territory);
  const headroom = Math.max(0, Math.floor((territory.population - 250) / 20));
  const available: Army = emptyArmy();
  for (const unitId of allowed) {
    const unit = getUnit(unitId);
    const byGold = Math.floor(player.gold / Math.max(1, unit.gold * discount));
    const byPeople = Math.floor((territory.population - 250) / Math.max(1, unit.population));
    available[unitId] = clamp(Math.min(byGold, byPeople, 60), 0, 60);
  }

  const cost = recruitmentCost(order);
  const goldCost = Math.round(cost.gold * discount);
  const resourceCost = scaleCost(cost.resources, discount);
  const missing = describeMissing(player.resources, resourceCost);
  const affordable =
    player.gold >= goldCost &&
    canAfford(player.resources, resourceCost) &&
    territory.population - cost.population >= 250 &&
    armySize(order) > 0 &&
    player.actionPoints >= 1;

  return (
    <div className="panel sunk" style={{ padding: '0.6rem', marginTop: '0.5rem' }}>
      <div className="section-title">Aushebung in {definition.name}</div>
      <ArmyPicker available={available} value={order} onChange={setOrder} allowed={allowed} />
      <hr className="rule" />
      <div className="row between">
        <div className="faint">
          Kosten: {formatNumber(goldCost)} Gold · {formatNumber(cost.population)} Einwohner
          {Object.keys(resourceCost).length > 0
            ? ` · ${Object.entries(resourceCost)
                .map(([key, amount]) => `${Math.round(Number(amount))} ${key === 'grain' ? 'Getreide' : key === 'iron' ? 'Eisen' : key === 'timber' ? 'Holz' : key === 'horses' ? 'Pferde' : 'Luxus'}`)
                .join(', ')}`
            : ''}
          {' · 1 Aktionspunkt'}
          {discount < 1 ? ` · Kaserne senkt die Kosten um ${Math.round((1 - discount) * 100)} %` : ''}
          {missing ? ` · fehlt: ${missing}` : ''}
        </div>
        <button
          type="button"
          className="primary"
          disabled={!affordable}
          onClick={() => onRecruit(territoryId, order)}
        >
          Ausheben
        </button>
      </div>
      {headroom < 10 ? (
        <p className="faint" style={{ margin: '0.3rem 0 0' }}>
          Die Bevölkerung dieses Gebietes trägt kaum noch Aushebungen.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Verlegung und Angriff                                               */
/* ------------------------------------------------------------------ */

function MarchForm({
  game,
  territoryId,
  pendingTargetId,
  order,
  setOrder,
  targets,
  isAttack,
  onSelectTarget,
  onMove,
  onAttack,
  onChangeActionMode
}: TerritoryStripProps & {
  order: Army;
  setOrder: (next: Army) => void;
  targets: string[];
  isAttack: boolean;
}) {
  const territory = territoryId ? game.territories[territoryId] : null;
  if (!territory || !territoryId) return null;

  const odds =
    isAttack && pendingTargetId
      ? estimateBattleOdds(game, game.playerCountryId, territoryId, pendingTargetId, order)
      : 0;

  const target = pendingTargetId ? game.territories[pendingTargetId] : null;

  return (
    <div className="panel sunk" style={{ padding: '0.6rem', marginTop: '0.5rem' }}>
      <div className="section-title">{isAttack ? 'Angriff vorbereiten' : 'Truppen verlegen'}</div>

      {targets.length === 0 ? (
        <Empty
          text={
            isAttack
              ? 'Kein angreifbares Nachbargebiet. Ein Angriff braucht eine Kriegserklärung.'
              : 'Kein benachbartes eigenes Gebiet.'
          }
        />
      ) : (
        <>
          <div className="row tight" style={{ marginBottom: '0.5rem' }}>
            {targets.map((id) => {
              const other = game.territories[id];
              const name = getTerritoryDefinition(game.mapId, id).name;
              return (
                <button
                  key={id}
                  type="button"
                  className={`small${pendingTargetId === id ? ' selected' : ''}`}
                  onClick={() => onSelectTarget(id)}
                >
                  {name}
                  {isAttack && other ? ` (${formatNumber(armySize(other.army))})` : ''}
                </button>
              );
            })}
          </div>

          <ArmyPicker available={territory.army} value={order} onChange={setOrder} />

          {isAttack && target ? (
            <div style={{ marginTop: '0.5rem' }}>
              <div className="row between">
                <span className="faint">Erfolgsaussicht</span>
                <strong className={odds > 0.6 ? 'positive' : odds < 0.4 ? 'negative' : undefined}>
                  {formatPercent(odds)}
                </strong>
              </div>
              <Bar
                value={odds * 100}
                color={odds > 0.6 ? 'var(--positive)' : odds < 0.4 ? 'var(--negative)' : 'var(--warning)'}
              />
              <p className="faint" style={{ margin: '0.3rem 0 0' }}>
                Verteidiger: {formatNumber(armySize(target.army))} Truppen · Gelände{' '}
                {TERRAIN_INFO[getTerritoryDefinition(game.mapId, target.id).terrain].name} · Befestigung{' '}
                {target.fortification}
              </p>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: '0.6rem' }}>
            <button
              type="button"
              className="primary"
              disabled={!pendingTargetId || armySize(order) <= 0}
              onClick={() => {
                if (!pendingTargetId) return;
                if (isAttack) onAttack(territoryId, pendingTargetId, order);
                else onMove(territoryId, pendingTargetId, order);
                onSelectTarget(null);
                onChangeActionMode('none');
                setOrder(emptyArmy());
              }}
            >
              {isAttack ? 'Angriff befehlen' : 'Verlegen'}
            </button>
            <button type="button" onClick={() => onChangeActionMode('none')}>
              Abbrechen
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ausbau                                                              */
/* ------------------------------------------------------------------ */

function BuildList({ game, territoryId, onBuild }: TerritoryStripProps) {
  const player = game.countries[game.playerCountryId];
  const territory = territoryId ? game.territories[territoryId] : null;
  if (!player || !territory || !territoryId) return null;
  const definition = getTerritoryDefinition(game.mapId, territoryId);

  return (
    <div className="panel sunk" style={{ padding: '0.6rem', marginTop: '0.5rem' }}>
      <div className="section-title">Ausbau</div>
      <p className="faint" style={{ marginTop: 0 }}>
        Bis zu {MAX_CONSTRUCTION_QUEUE} Vorhaben lassen sich vormerken. Gebaut wird eines nach
        dem anderen, bezahlt wird sofort.
      </p>
      <div className="grid two">
        {getAllBuildings().map((building) => {
          const level = territory.buildings[building.id];
          // Kosten und Höchststufe richten sich nach der geplanten Stufe.
          const planned = getPlannedLevel(territory, building.id);
          const queued = planned - level;
          const cost = getBuildingCost(building.id, planned);
          const maxed = planned >= building.maxLevel;
          const needsPort = building.requiresPort && !definition.hasPort;
          const needsTech = building.requiresTech && !player.technologies.includes(building.requiresTech);
          const resourceCost = building.resources ?? {};
          const lacking = describeMissing(player.resources, resourceCost);
          const queueFull = territory.construction.length >= MAX_CONSTRUCTION_QUEUE;
          const blocked =
            maxed ||
            needsPort ||
            Boolean(needsTech) ||
            player.gold < cost ||
            Boolean(lacking) ||
            queueFull;

          return (
            <div key={building.id} className="stack tight" style={{ gap: '0.2rem' }}>
              <div className="row tight">
                <Icon name={BUILDING_ICON[building.id] ?? 'hammer'} size={16} />
                <strong style={{ fontSize: '0.88rem' }}>{building.name}</strong>
                <span className="faint">
                  {level} / {building.maxLevel}
                  {queued > 0 ? ` (+${queued} geplant)` : ''}
                </span>
              </div>
              <p className="faint" style={{ margin: 0 }}>
                {building.description}
              </p>
              <button
                type="button"
                className="small"
                disabled={blocked}
                onClick={() => onBuild(territoryId, building.id)}
                title={
                  needsPort
                    ? 'Nur in Hafengebieten'
                    : needsTech
                      ? 'Technologie fehlt'
                      : lacking
                        ? `Rohstoffe fehlen: ${lacking}`
                        : queueFull
                          ? 'Die Bauschlange dieses Gebietes ist voll'
                          : undefined
                }
              >
                {maxed
                  ? 'Höchste Stufe'
                  : needsPort
                    ? 'Hafen nötig'
                    : needsTech
                      ? 'Technologie fehlt'
                      : queueFull
                        ? 'Schlange voll'
                        : `${queued > 0 ? 'Vormerken' : 'Bauen'} · ${formatNumber(cost)} Gold · ${building.buildTurns} R.`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Großprojekte                                                       */
/* ------------------------------------------------------------------ */

function ProjectList({ game, territoryId, onProject }: TerritoryStripProps) {
  const player = game.countries[game.playerCountryId];
  const territory = territoryId ? game.territories[territoryId] : null;
  if (!player || !territory || !territoryId) return null;
  const definition = getTerritoryDefinition(game.mapId, territoryId);

  return (
    <div className="panel sunk" style={{ padding: '0.6rem', marginTop: '0.5rem' }}>
      <div className="section-title">Großprojekte</div>
      <p className="faint" style={{ marginTop: 0 }}>
        Jedes Projekt entsteht nur einmal im Reich und wirkt dauerhaft im ganzen Land.
      </p>
      <div className="stack tight">
        {getAllProjects().map((project) => {
          const done = player.completedProjects.includes(project.id);
          const needsPort = project.requiresPort && !definition.hasPort;
          const needsTech = project.requiresTech && !player.technologies.includes(project.requiresTech);
          const lacking = describeMissing(player.resources, project.resources ?? {});
          const queueFull = territory.construction.length >= MAX_CONSTRUCTION_QUEUE;
          const otherProject = hasProjectInProgress(game, player.id);
          const blocked =
            done ||
            needsPort ||
            Boolean(needsTech) ||
            player.gold < project.gold ||
            Boolean(lacking) ||
            queueFull ||
            otherProject;

          return (
            <div key={project.id} className="row between" style={{ gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <div className="row tight">
                  <Icon name={PROJECT_ICON[project.id] ?? 'trophy'} size={16} />
                  <strong style={{ fontSize: '0.88rem' }}>{project.name}</strong>
                  {done ? <Tag kind="ally">errichtet</Tag> : null}
                </div>
                <div className="faint">{project.effectText}</div>
              </div>
              <button
                type="button"
                className="small"
                disabled={blocked}
                onClick={() => onProject(territoryId, project.id)}
                title={
                  needsTech
                    ? 'Technologie fehlt'
                    : lacking
                      ? `Fehlt: ${lacking}`
                      : otherProject
                        ? 'Dein Reich errichtet bereits ein Großprojekt'
                        : queueFull
                          ? 'Die Bauschlange dieses Gebietes ist voll'
                          : undefined
                }
              >
                {done
                  ? 'fertig'
                  : otherProject
                    ? 'eines zur Zeit'
                    : `${formatNumber(project.gold)} Gold · ${project.turns} R.`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feldherren                                                          */
/* ------------------------------------------------------------------ */

function GeneralList({ game, territoryId, onAssignGeneral }: TerritoryStripProps) {
  const player = game.countries[game.playerCountryId];
  if (!player || !territoryId) return null;

  return (
    <div className="panel sunk" style={{ padding: '0.6rem', marginTop: '0.5rem' }}>
      <div className="section-title">Feldherren</div>
      <div className="stack tight ruled">
        {player.generals.map((general) => {
          const here = general.assignedTerritoryId === territoryId;
          return (
            <div key={general.id} className="row between">
              <div>
                <div className="row tight">
                  <Icon name="general" size={15} />
                  <strong style={{ fontSize: '0.88rem' }}>{general.name}</strong>
                  <span className="faint">
                    {general.title} · Stufe {general.level}
                  </span>
                </div>
                <div className="faint">
                  {general.trait} · Angriff +{Math.round(general.attack * 100)} % · Verteidigung +
                  {Math.round(general.defense * 100)} % · Belagerung +{Math.round(general.siege * 100)} %
                  {general.battles > 0 ? ` · ${general.victories}/${general.battles} Siege` : ''}
                </div>
              </div>
              <button
                type="button"
                className="small"
                onClick={() => onAssignGeneral(general.id, here ? null : territoryId)}
              >
                {here ? 'abziehen' : 'hierher'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

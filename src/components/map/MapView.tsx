/**
 * Die Karte.
 *
 * Aufbau in Ebenen: Meer, Tiefenzonen, Seegang, Küstensaum, Landflächen mit
 * Geländetextur und Relief, Grenzen und Kriegsfronten, Flüsse, Straßen und
 * Seewege, Auswahl und Ziele, Beschriftung und Zeichen, Zierwerk.
 *
 * Die Karte stellt nur dar und meldet Klicks nach oben - sie kennt keine
 * Spielregeln.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { Army, GameState, MapFilter, TerritoryState } from '../../models/types';
import { getMap, getTerritoryDefinition } from '../../services/contentService';
import { armySize, landSize } from '../../engine/army';
import { getIntelLevel } from '../../engine/espionage';
import { areAllied, areAtWar, getRelation, getSupplyCapacity, TERRAIN_INFO } from '../../engine/rules';
import { useElementSize } from '../../hooks/useElementSize';
import { parseViewBox, useMapCamera } from '../../hooks/useMapCamera';
import { clamp } from '../../utils/helpers';
import { formatNumber } from '../../utils/format';
import { Icon, MapGlyph } from '../ui/Icon';
import { MapDefs } from './MapDefs';
import { CompassRose, ScaleBar } from './MapOrnaments';
import { MiniMap } from './MiniMap';
import { getMapGeometry, curveBetween, type Point } from './mapGeometry';
import {
  categoryColor,
  landFill,
  legendFor,
  mix,
  neutralFill,
  palette,
  rampColor,
  relationColor,
  TERRAIN_PATTERN,
  type ThemeId
} from './mapVisuals';

interface MapViewProps {
  game: GameState;
  theme: ThemeId;
  filter: MapFilter;
  selectedId: string | null;
  moveTargets: string[];
  attackTargets: string[];
  pendingTargetId: string | null;
  showMinimap: boolean;
  showGlyphs: boolean;
  showOrnaments: boolean;
  /** Erlaubt der Umgebung, die Karte per Tastatur zu steuern. */
  controls?: MutableRefObject<MapControls | null>;
  onSelect: (territoryId: string) => void;
}

export interface MapControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  focus: (territoryId: string) => void;
}

export function MapView({
  game,
  theme,
  filter,
  selectedId,
  moveTargets,
  attackTargets,
  pendingTargetId,
  showMinimap,
  showGlyphs,
  showOrnaments,
  controls,
  onSelect
}: MapViewProps) {
  const map = getMap(game.mapId);
  const world = useMemo(() => parseViewBox(map.viewBox), [map.viewBox]);
  const geometry = useMemo(() => getMapGeometry(map), [map]);
  const colors = palette(theme);

  const [frameRef, size] = useElementSize<HTMLDivElement>();
  const camera = useMapCamera(world, size);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches
  );

  /** Kartenlänge eines Bildschirmpixels - hält Schrift und Zeichen gleich groß. */
  const px = camera.box.width / Math.max(1, size.width);

  // Tastatursteuerung der Karte bereitstellen
  useEffect(() => {
    if (!controls) return;
    controls.current = {
      zoomIn: () => camera.zoomAt(1.3),
      zoomOut: () => camera.zoomAt(1 / 1.3),
      reset: camera.reset,
      focus: (territoryId: string) => {
        const point = geometry.centroids[territoryId];
        if (point) camera.centerOn(point[0], point[1]);
      }
    };
    return () => {
      controls.current = null;
    };
  }, [controls, camera.zoomAt, camera.reset, camera.centerOn, geometry.centroids]);

  /* ---------------------------------------------------------------- */
  /* Aufklärung                                                       */
  /* ---------------------------------------------------------------- */

  const intelByCountry = useMemo(() => {
    const result: Record<string, number> = {};
    for (const id of game.countryOrder) {
      result[id] = getIntelLevel(game, game.playerCountryId, id);
    }
    return result;
  }, [game]);

  const isKnown = (territory: TerritoryState) =>
    !territory.ownerId || (intelByCountry[territory.ownerId] ?? 0) >= 1;

  /* ---------------------------------------------------------------- */
  /* Wertebereiche der Wertekarten                                     */
  /* ---------------------------------------------------------------- */

  const ranges = useMemo(() => {
    const list = Object.values(game.territories);
    const span = (pick: (t: TerritoryState) => number) => {
      const values = list.map(pick);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { min, max: max > min ? max : min + 1 };
    };
    return {
      economy: span((t) => t.economy),
      population: span((t) => t.population),
      military: span((t) => armySize(t.army)),
      supply: span((t) => t.infrastructure + t.buildings.road * 2 + t.buildings.granary),
      resources: span((t) => getTerritoryDefinition(game.mapId, t.id).resources.length)
    };
  }, [game.territories, game.mapId]);

  const ratio = (value: number, range: { min: number; max: number }) =>
    clamp((value - range.min) / (range.max - range.min), 0, 1);

  /** Flächenfarbe eines Gebietes je nach Kartenansicht. */
  const fillOf = (territory: TerritoryState): string => {
    const definition = getTerritoryDefinition(game.mapId, territory.id);
    const owner = territory.ownerId ? game.countries[territory.ownerId] : null;

    if (filter !== 'political' && filter !== 'terrain' && !isKnown(territory)) {
      return neutralFill(theme);
    }

    switch (filter) {
      case 'political':
        return owner ? landFill(owner.color, theme) : neutralFill(theme);
      case 'terrain':
        return mix(TERRAIN_INFO[definition.terrain].color, colors.paper, theme === 'dark' ? 0.12 : 0.28);
      case 'economy':
        return rampColor('economy', ratio(territory.economy, ranges.economy), theme);
      case 'population':
        return rampColor('population', ratio(territory.population, ranges.population), theme);
      case 'military':
        return rampColor('military', ratio(armySize(territory.army), ranges.military), theme);
      case 'stability':
        return rampColor('stability', clamp(territory.stability / 100, 0, 1), theme);
      case 'supply':
        return rampColor(
          'supply',
          ratio(territory.infrastructure + territory.buildings.road * 2 + territory.buildings.granary, ranges.supply),
          theme
        );
      case 'resources':
        return rampColor('resources', ratio(definition.resources.length, ranges.resources), theme);
      case 'culture':
        return categoryColor(territory.culture, theme);
      case 'religion':
        return categoryColor(territory.religion, theme);
      case 'diplomacy': {
        if (!owner) return neutralFill(theme);
        if (owner.id === game.playerCountryId) return landFill(owner.color, theme);
        if (areAtWar(game, game.playerCountryId, owner.id)) return relationColor(-100, theme);
        if (areAllied(game, game.playerCountryId, owner.id)) return relationColor(100, theme);
        return relationColor(getRelation(game, game.playerCountryId, owner.id), theme);
      }
      default:
        return neutralFill(theme);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Grenzen                                                           */
  /* ---------------------------------------------------------------- */

  const borders = useMemo(() => {
    const inner: string[] = [];
    const national: string[] = [];
    const fronts: string[] = [];
    const shore: string[] = [];

    for (const edge of geometry.edges) {
      const line = `M${edge.a[0]},${edge.a[1]}L${edge.b[0]},${edge.b[1]}`;
      if (edge.territories.length < 2) {
        shore.push(line);
        continue;
      }
      const [first, second] = edge.territories;
      const ownerA = game.territories[first]?.ownerId ?? '';
      const ownerB = game.territories[second]?.ownerId ?? '';
      if (ownerA === ownerB) {
        inner.push(line);
      } else if (ownerA && ownerB && areAtWar(game, ownerA, ownerB)) {
        fronts.push(line);
      } else {
        national.push(line);
      }
    }
    return { inner, national, fronts, shore };
  }, [geometry.edges, game]);

  /* ---------------------------------------------------------------- */
  /* Straßen und Seewege                                              */
  /* ---------------------------------------------------------------- */

  const routes = useMemo(() => {
    const roads: string[] = [];
    const seaLanes: string[] = [];
    const seen = new Set<string>();

    for (const definition of map.territories) {
      const here = game.territories[definition.id];
      if (!here) continue;
      const from = geometry.centroids[definition.id];

      for (const otherId of definition.neighbours) {
        const key = [definition.id, otherId].sort().join('|');
        if (seen.has(key)) continue;
        const other = game.territories[otherId];
        if (!other) continue;
        if (here.buildings.road > 0 && other.buildings.road > 0) {
          seen.add(key);
          const to = geometry.centroids[otherId];
          if (from && to) roads.push(`M${from[0]},${from[1]}L${to[0]},${to[1]}`);
        }
      }

      for (const otherId of definition.seaNeighbours) {
        const key = `sea|${[definition.id, otherId].sort().join('|')}`;
        if (seen.has(key)) continue;
        const otherDefinition = getTerritoryDefinition(game.mapId, otherId);
        if (!definition.hasPort || !otherDefinition.hasPort) continue;
        seen.add(key);
        const to = geometry.centroids[otherId];
        if (from && to) seaLanes.push(curveBetween(from, to));
      }
    }
    return { roads, seaLanes };
  }, [map.territories, game.territories, game.mapId, geometry.centroids]);

  /* ---------------------------------------------------------------- */
  /* Ländernamen: einmal je Reich, wie im Atlas                        */
  /* ---------------------------------------------------------------- */

  const countryLabels = useMemo(() => {
    const result: { id: string; name: string; x: number; y: number; area: number }[] = [];
    for (const countryId of game.countryOrder) {
      const country = game.countries[countryId];
      if (!country?.isAlive) continue;
      const owned = Object.values(game.territories).filter(
        (territory) => territory.ownerId === countryId
      );
      if (owned.length === 0) continue;

      // Flächengewichteter Mittelpunkt des Reiches
      let weight = 0;
      let x = 0;
      let y = 0;
      for (const territory of owned) {
        const point = geometry.centroids[territory.id];
        const area = geometry.areas[territory.id] ?? 0;
        if (!point || area <= 0) continue;
        x += point[0] * area;
        y += point[1] * area;
        weight += area;
      }
      if (weight <= 0) continue;
      let px0 = x / weight;
      let py0 = y / weight;

      // Liegt der Punkt auf einer Gebietsbeschriftung, weicht er nach oben aus
      const tooClose = owned.some((territory) => {
        const point = geometry.centroids[territory.id];
        if (!point) return false;
        return Math.hypot(point[0] - px0, point[1] - py0) < 26 * px;
      });
      if (tooClose) py0 -= 26 * px;

      result.push({ id: countryId, name: country.name, x: px0, y: py0, area: weight });
    }
    return result;
  }, [game.countryOrder, game.countries, game.territories, geometry, px]);

  /**
   * Gebiete, deren Namen hinter einem Ländernamen verschwinden würden.
   * Dort entfällt die kleinere Beschriftung.
   */
  const hiddenNames = useMemo(() => {
    const hidden = new Set<string>();
    for (const label of countryLabels) {
      // Breite des Schriftzugs abschätzen: Schriftgrad 16 plus Sperrung
      const halfWidth = ((label.name.length * 8.6 + 20) / 2) * px;
      const halfHeight = 13 * px;
      for (const territory of Object.values(game.territories)) {
        const point = geometry.centroids[territory.id];
        if (!point) continue;
        if (
          Math.abs(point[0] - label.x) < halfWidth &&
          Math.abs(point[1] - label.y) < halfHeight
        ) {
          hidden.add(territory.id);
        }
      }
    }
    return hidden;
  }, [countryLabels, game.territories, geometry.centroids, px]);

  /* ---------------------------------------------------------------- */
  /* Darstellung                                                       */
  /* ---------------------------------------------------------------- */

  const legend = legendFor(filter, theme);
  const hoveredTerritory = hover ? game.territories[hover.id] : null;

  const handleClick = (territoryId: string) => {
    if (camera.wasDragged()) return;
    onSelect(territoryId);
  };

  /** Stufen für die Beschriftung: nur zeichnen, wenn genug Platz ist. */
  const screenArea = (territoryId: string) => (geometry.areas[territoryId] ?? 0) / (px * px);

  return (
    <div className="map-frame" ref={frameRef}>
      <svg
        ref={svgRef}
        className={`map-svg${camera.dragging ? ' dragging' : ''}`}
        viewBox={camera.viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label={`Karte ${map.name}`}
        {...camera.handlers}
        onPointerLeave={(event) => {
          camera.handlers.onPointerLeave();
          setHover(null);
          void event;
        }}
      >
        <MapDefs countries={Object.values(game.countries)} theme={theme} />

        {/* 1. Meer */}
        <rect
          x={world.x - world.width}
          y={world.y - world.height}
          width={world.width * 3}
          height={world.height * 3}
          fill={colors.sea}
        />

        {/* 2. Tiefenzonen */}
        <g>
          {map.oceanCells.map((cell, index) => (
            <polygon
              key={`ocean-${index}`}
              points={cell.points}
              fill={mix(colors.sea, colors.seaDeep, clamp(cell.depth, 0, 1))}
            />
          ))}
        </g>

        {/* 3. Seegang */}
        <rect
          x={world.x - world.width * 0.5}
          y={world.y - world.height * 0.5}
          width={world.width * 2}
          height={world.height * 2}
          fill="url(#tx-sea)"
        />

        {/* 4. Küstensaum: mehrere abnehmende Linien wie im Kupferstich */}
        <g fill="none" strokeLinejoin="round">
          {map.coastlines.map((line, index) => (
            <g key={`coast-${index}`}>
              <polyline points={line} stroke={colors.paper} strokeWidth={5 * px} opacity="0.1" />
              <polyline points={line} stroke={colors.paper} strokeWidth={2.6 * px} opacity="0.16" />
            </g>
          ))}
        </g>

        {/* 5. Landflächen */}
        <g pointerEvents="none">
          {map.territories.map((definition) => {
            const territory = game.territories[definition.id];
            if (!territory) return null;
            const known = isKnown(territory);
            return (
              <g key={`land-${definition.id}`}>
                <polygon points={definition.polygon} fill={fillOf(territory)} />
                {filter === 'political' && territory.ownerId && known ? (
                  <polygon points={definition.polygon} fill={`url(#ident-${territory.ownerId})`} />
                ) : null}
                <polygon
                  points={definition.polygon}
                  fill={`url(#${TERRAIN_PATTERN[definition.terrain]})`}
                  opacity={filter === 'political' || filter === 'terrain' ? 0.9 : 0.4}
                />
                <polygon
                  points={definition.polygon}
                  fill="url(#hillshade)"
                  opacity={0.1 + definition.elevation * 0.24}
                />
                {territory.devastation > 25 ? (
                  <polygon
                    points={definition.polygon}
                    fill="url(#tx-ruin)"
                    opacity={clamp(territory.devastation / 140, 0, 0.7)}
                  />
                ) : null}
                {!known ? <polygon points={definition.polygon} fill="url(#tx-fog)" /> : null}
              </g>
            );
          })}
        </g>

        {/* 6. Grenzen */}
        <g fill="none" pointerEvents="none" strokeLinecap="round">
          <path d={borders.inner.join(' ')} stroke={colors.borderInner} strokeWidth={0.9 * px} />
          <path d={borders.shore.join(' ')} stroke={colors.border} strokeWidth={1.6 * px} opacity="0.75" />
          <path d={borders.national.join(' ')} stroke={colors.border} strokeWidth={2.4 * px} opacity="0.9" />
          <path
            d={borders.fronts.join(' ')}
            className="front-line"
            strokeWidth={3 * px}
            strokeDasharray={`${7 * px} ${5 * px}`}
          />
        </g>

        {/* 7. Flüsse */}
        <g fill="none" pointerEvents="none" strokeLinecap="round">
          {map.rivers.map((river, index) => (
            <polyline
              key={`river-${index}`}
              points={river}
              stroke={colors.river}
              strokeWidth={2.2 * px}
              opacity="0.75"
            />
          ))}
        </g>

        {/* 8. Straßen und Seewege */}
        <g fill="none" pointerEvents="none">
          <path
            d={routes.roads.join(' ')}
            stroke={theme === 'dark' ? '#6b5a3c' : '#8a7549'}
            strokeWidth={1.8 * px}
            strokeDasharray={`${1.5 * px} ${3 * px}`}
            opacity="0.8"
          />
          <path
            d={routes.seaLanes.join(' ')}
            stroke={theme === 'dark' ? '#5c8ca6' : '#6f93a6'}
            strokeWidth={1.2 * px}
            strokeDasharray={`${5 * px} ${4 * px}`}
            opacity="0.5"
          />
        </g>

        {/* 9. Auswahl und Ziele */}
        <g pointerEvents="none" fill="none">
          {moveTargets.map((id) => {
            const definition = map.territories.find((entry) => entry.id === id);
            return definition ? (
              <polygon
                key={`move-${id}`}
                points={definition.polygon}
                stroke="#4e9a8f"
                strokeWidth={3 * px}
                strokeDasharray={`${8 * px} ${5 * px}`}
                fill="#4e9a8f"
                fillOpacity="0.12"
              />
            ) : null;
          })}
          {attackTargets.map((id) => {
            const definition = map.territories.find((entry) => entry.id === id);
            return definition ? (
              <polygon
                key={`attack-${id}`}
                points={definition.polygon}
                stroke="#c4502f"
                strokeWidth={3 * px}
                strokeDasharray={`${6 * px} ${4 * px}`}
                fill="#c4502f"
                fillOpacity="0.14"
              />
            ) : null;
          })}

          {selectedId && geometry.polygons[selectedId] ? (
            <polygon
              points={map.territories.find((entry) => entry.id === selectedId)?.polygon}
              className="sel-ring"
              strokeWidth={2.6 * px}
              strokeDasharray={`${9 * px} ${6 * px}`}
            />
          ) : null}

          {/* Zielpfeil vom gewählten Gebiet zum Ziel */}
          {selectedId && pendingTargetId && geometry.centroids[selectedId] && geometry.centroids[pendingTargetId] ? (
            <path
              d={curveBetween(geometry.centroids[selectedId], geometry.centroids[pendingTargetId], 0.1)}
              stroke={attackTargets.includes(pendingTargetId) ? '#c4502f' : '#4e9a8f'}
              strokeWidth={3.2 * px}
              markerEnd={`url(#${attackTargets.includes(pendingTargetId) ? 'arrow-attack' : 'arrow-move'})`}
            />
          ) : null}
        </g>

        {/* 10. Beschriftung und Zeichen */}
        <g pointerEvents="none">
          {map.territories.map((definition) => {
            const territory = game.territories[definition.id];
            if (!territory) return null;
            const area = screenArea(definition.id);
            if (area < 700) return null;

            const owner = territory.ownerId ? game.countries[territory.ownerId] : null;
            const known = isKnown(territory);
            const isCapital = owner?.capitalId === definition.id;
            const troops = armySize(territory.army);
            const center = geometry.centroids[definition.id] ?? [definition.labelX, definition.labelY];
            const showName = area > 2600 && !hiddenNames.has(definition.id);
            const showDetail = area > 6200;

            const glyphs: { name: Parameters<typeof MapGlyph>[0]['name']; tone: string }[] = [];
            if (isCapital) glyphs.push({ name: 'crown', tone: theme === 'dark' ? '#8a6a12' : '#6d5410' });
            if (definition.hasPort) glyphs.push({ name: 'anchor', tone: colors.label });
            if (territory.fortification > 1) glyphs.push({ name: 'fortress', tone: colors.label });
            if (territory.construction.length > 0) glyphs.push({ name: 'crane', tone: '#7a5e14' });
            if (territory.generalId) glyphs.push({ name: 'general', tone: '#8a6a12' });
            if (territory.blockaded) glyphs.push({ name: 'blockade', tone: '#9d3722' });
            if (territory.unrest > 45) glyphs.push({ name: 'unrest', tone: '#9d3722' });

            return (
              <g key={`mark-${definition.id}`}>
                {showName ? (
                  <text
                    className="label-land"
                    x={center[0]}
                    y={center[1] - 2 * px}
                    fontSize={12.5 * px}
                    fill={colors.label}
                    stroke={colors.labelHalo}
                    strokeWidth={3.4 * px}
                  >
                    {definition.name}
                  </text>
                ) : null}

                {/* Truppenmarke */}
                {troops > 0 && known ? (
                  <g>
                    <rect
                      x={center[0] - 15 * px}
                      y={center[1] + (showDetail ? 15 : 3) * px}
                      width={30 * px}
                      height={13 * px}
                      rx={2 * px}
                      fill={owner ? mix(owner.color, colors.ink, 0.45) : '#4a4a44'}
                      stroke={colors.labelHalo}
                      strokeWidth={1.2 * px}
                      opacity="0.95"
                    />
                    <text
                      className="label-sub"
                      x={center[0]}
                      y={center[1] + (showDetail ? 24.5 : 12.5) * px}
                      fontSize={9.5 * px}
                      fill="#f2ead8"
                      fontWeight="600"
                    >
                      {formatNumber(troops)}
                    </text>
                  </g>
                ) : null}

                {/* Zeichen in einer Reihe darunter */}
                {showDetail && showGlyphs
                  ? glyphs.slice(0, 5).map((glyph, index) => (
                      <MapGlyph
                        key={`${definition.id}-${glyph.name}`}
                        name={glyph.name}
                        x={center[0] + (index - (Math.min(glyphs.length, 5) - 1) / 2) * 13 * px}
                        y={center[1] - 16 * px}
                        size={11 * px}
                        color={glyph.tone}
                        halo={colors.labelHalo}
                        haloWidth={3 * px}
                      />
                    ))
                  : null}
              </g>
            );
          })}
        </g>

        {/* 11. Ländernamen */}
        {(filter === 'political' || filter === 'diplomacy') && showGlyphs ? (
          <g pointerEvents="none">
            {countryLabels
              .filter((label) => label.area / (px * px) > 9000)
              .map((label) => (
                <text
                  key={`country-${label.id}`}
                  className="label-land"
                  x={label.x}
                  y={label.y}
                  fontSize={16 * px}
                  letterSpacing={2.2 * px}
                  fill={colors.label}
                  stroke={colors.labelHalo}
                  strokeWidth={4.2 * px}
                  opacity="0.82"
                >
                  {label.name}
                </text>
              ))}
          </g>
        ) : null}

        {/* 12. Zierwerk des Kartenblatts */}
        {showOrnaments ? (
          <>
            <CompassRose x={world.x + world.width - 58} y={world.y + 62} theme={theme} />
            <ScaleBar
              x={world.x + 40}
              y={world.y + world.height - 34}
              theme={theme}
              pixelsPerSegment={Math.max(24, world.width / 28)}
            />
          </>
        ) : null}

        {/* 13. Randabdunklung */}
        <rect
          x={camera.box.x}
          y={camera.box.y}
          width={camera.box.width}
          height={camera.box.height}
          fill="url(#vignette)"
          pointerEvents="none"
        />

        {/* 14. Bedienschicht: fängt alle Klicks */}
        <g>
          {map.territories.map((definition) => (
            <polygon
              key={`hit-${definition.id}`}
              className="territory"
              points={definition.polygon}
              fill="transparent"
              onClick={() => handleClick(definition.id)}
              onPointerEnter={(event) =>
                setHover({ id: definition.id, left: event.clientX, top: event.clientY })
              }
              onPointerMove={(event) =>
                setHover((current) =>
                  current && current.id === definition.id
                    ? { ...current, left: event.clientX, top: event.clientY }
                    : current
                )
              }
              aria-label={definition.name}
            />
          ))}
        </g>
      </svg>

      {/* --- Zeigerhinweis --- */}
      {hover && hoveredTerritory ? (
        <TerritoryTip
          game={game}
          territory={hoveredTerritory}
          anchor={hover}
          frame={svgRef.current?.getBoundingClientRect() ?? null}
          known={isKnown(hoveredTerritory)}
        />
      ) : null}

      {/* --- Werkzeuge --- */}
      <div className="map-tools">
        <button type="button" onClick={() => camera.zoomAt(1.3)} aria-label="Karte vergrössern">
          <Icon name="zoomIn" size={18} />
        </button>
        <button type="button" onClick={() => camera.zoomAt(1 / 1.3)} aria-label="Karte verkleinern">
          <Icon name="zoomOut" size={18} />
        </button>
        <button type="button" onClick={camera.reset} aria-label="Ansicht zurücksetzen">
          <Icon name="recenter" size={18} />
        </button>
      </div>

      {showMinimap ? (
        <MiniMap game={game} box={camera.box} theme={theme} onJump={(x, y) => camera.centerOn(x, y)} />
      ) : null}

      {/* --- Legende --- */}
      <div className="map-legend">
        <div className="row between nowrap" style={{ gap: '0.4rem' }}>
          <strong style={{ fontSize: '0.82rem' }}>{legend.title}</strong>
          <button
            type="button"
            className="quiet small"
            style={{ minHeight: '1.4rem', padding: '0 0.2rem' }}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((value) => !value)}
            aria-label={legendOpen ? 'Legende einklappen' : 'Legende ausklappen'}
          >
            <Icon name={legendOpen ? 'minus' : 'plus'} size={13} />
          </button>
        </div>
        {legendOpen ? (
          <>
        {legend.kind === 'countries' && filter === 'political' ? (
          <div style={{ marginTop: '0.25rem' }}>
            {game.countryOrder
              .map((id) => game.countries[id])
              .filter((country) => country?.isAlive)
              .slice(0, 9)
              .map((country) => (
                <div className="legend-row" key={country.id}>
                  <span
                    className="legend-swatch"
                    style={{ background: landFill(country.color, theme) }}
                  />
                  <span>
                    {country.name}
                    {country.id === game.playerCountryId ? ' (du)' : ''}
                  </span>
                </div>
              ))}
          </div>
        ) : null}

        {legend.kind === 'ramp' || legend.kind === 'diverging' ? (
          <div>
            <div
              className="legend-ramp"
              style={{
                background: `linear-gradient(90deg, ${legend.ramp?.[0]}, ${
                  legend.kind === 'diverging' ? relationColor(0, theme) + ',' : ''
                } ${legend.ramp?.[1]})`
              }}
            />
            <div className="row between faint" style={{ fontSize: '0.72rem' }}>
              <span>{legend.low}</span>
              <span>{legend.high}</span>
            </div>
          </div>
        ) : null}

        {legend.kind === 'terrain' ? (
          <div style={{ marginTop: '0.25rem' }}>
            {(Object.keys(TERRAIN_INFO) as (keyof typeof TERRAIN_INFO)[])
              .filter((key) => key !== 'island')
              .map((key) => (
                <div className="legend-row" key={key}>
                  <span
                    className="legend-swatch"
                    style={{
                      background: mix(TERRAIN_INFO[key].color, colors.paper, theme === 'dark' ? 0.12 : 0.28)
                    }}
                  />
                  <span>{TERRAIN_INFO[key].name}</span>
                </div>
              ))}
          </div>
        ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Zeigerhinweis                                                       */
/* ------------------------------------------------------------------ */

function TerritoryTip({
  game,
  territory,
  anchor,
  frame,
  known
}: {
  game: GameState;
  territory: TerritoryState;
  anchor: { left: number; top: number };
  frame: DOMRect | null;
  known: boolean;
}) {
  const definition = getTerritoryDefinition(game.mapId, territory.id);
  const owner = territory.ownerId ? game.countries[territory.ownerId] : null;
  const terrain = TERRAIN_INFO[definition.terrain];
  const player = game.countries[game.playerCountryId];

  const left = frame ? anchor.left - frame.left + 16 : 16;
  const top = frame ? anchor.top - frame.top + 16 : 16;
  const flipX = frame ? left > frame.width - 190 : false;
  const flipY = frame ? top > frame.height - 150 : false;

  const capacity = owner && player && owner.id === player.id ? getSupplyCapacity(game, player, territory) : 0;
  const troops: Army = territory.army;

  return (
    <div
      className="map-tip"
      style={{
        left: flipX ? undefined : left,
        right: flipX && frame ? frame.width - left + 32 : undefined,
        top: flipY ? undefined : top,
        bottom: flipY && frame ? frame.height - top + 32 : undefined
      }}
    >
      <div className="tip-name">{definition.name}</div>
      <div className="faint" style={{ marginBottom: '0.2rem' }}>
        {owner ? (known ? owner.name : 'unbekannte Macht') : 'herrenlos'} · {terrain.name}
      </div>
      {known ? (
        <>
          <div className="row between" style={{ fontSize: '0.8rem' }}>
            <span>Truppen</span>
            <span>
              {formatNumber(armySize(troops))}
              {capacity > 0 ? ` / ${formatNumber(capacity)}` : ''}
            </span>
          </div>
          <div className="row between" style={{ fontSize: '0.8rem' }}>
            <span>Wirtschaft</span>
            <span>{formatNumber(territory.economy)}</span>
          </div>
          <div className="row between" style={{ fontSize: '0.8rem' }}>
            <span>Bevölkerung</span>
            <span>{formatNumber(territory.population)}</span>
          </div>
          {landSize(troops) === 0 && armySize(troops) > 0 ? (
            <div className="faint">nur Flotte stationiert</div>
          ) : null}
        </>
      ) : (
        <div className="faint">Erst Aufklärung zeigt Einzelheiten.</div>
      )}
    </div>
  );
}

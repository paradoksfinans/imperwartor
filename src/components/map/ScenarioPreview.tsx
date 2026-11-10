/**
 * Kartenvorschau eines Szenarios - vor Spielbeginn.
 *
 * Zeigt die politische Lage zum Startjahr. Ein Klick auf ein Land wählt es
 * als Spielerland, sodass die Auswahl direkt auf der Karte möglich ist.
 */
import { useMemo } from 'react';
import { getMap, getScenario } from '../../services/contentService';
import { TERRAIN_INFO } from '../../engine/rules';
import { getMapGeometry } from './mapGeometry';
import { MapDefs } from './MapDefs';
import { CompassRose } from './MapOrnaments';
import { landFill, mix, neutralFill, palette, type ThemeId } from './mapVisuals';
import { parseViewBox } from '../../hooks/useMapCamera';

interface ScenarioPreviewProps {
  scenarioId: string;
  theme: ThemeId;
  selectedCountryId?: string | null;
  onPickCountry?: (countryId: string) => void;
  /** Namen der Länder in ihre Gebiete schreiben. */
  showLabels?: boolean;
  compact?: boolean;
}

export function ScenarioPreview({
  scenarioId,
  theme,
  selectedCountryId,
  onPickCountry,
  showLabels = true,
  compact = false
}: ScenarioPreviewProps) {
  const scenario = getScenario(scenarioId);
  const map = getMap(scenario.mapId);
  const world = parseViewBox(map.viewBox);
  const geometry = useMemo(() => getMapGeometry(map), [map]);
  const colors = palette(theme);

  /** Zuordnung Gebiet zu Land aus den Szenariodaten. */
  const ownerOf = useMemo(() => {
    const result: Record<string, string> = {};
    for (const country of scenario.countries) {
      for (const territoryId of country.territories) result[territoryId] = country.id;
    }
    return result;
  }, [scenario]);

  /** Grenzen aus gemeinsamen Kanten. */
  const borders = useMemo(() => {
    const inner: string[] = [];
    const national: string[] = [];
    const shore: string[] = [];
    for (const edge of geometry.edges) {
      const line = `M${edge.a[0]},${edge.a[1]}L${edge.b[0]},${edge.b[1]}`;
      if (edge.territories.length < 2) {
        shore.push(line);
        continue;
      }
      const [a, b] = edge.territories;
      if ((ownerOf[a] ?? '') === (ownerOf[b] ?? '')) inner.push(line);
      else national.push(line);
    }
    return { inner, national, shore };
  }, [geometry.edges, ownerOf]);

  const unit = world.width / 900;

  /** Je Land ein Beschriftungspunkt: das grösste eigene Gebiet. */
  const labels = useMemo(() => {
    if (!showLabels) return [];
    return scenario.countries
      .map((country) => {
        const best = country.territories
          .map((id) => ({ id, area: geometry.areas[id] ?? 0 }))
          .sort((a, b) => b.area - a.area)[0];
        if (!best) return null;
        const point = geometry.centroids[best.id];
        return point ? { id: country.id, name: country.name, x: point[0], y: point[1] } : null;
      })
      .filter((entry): entry is { id: string; name: string; x: number; y: number } => entry !== null);
  }, [scenario.countries, geometry, showLabels]);

  return (
    <svg
      viewBox={map.viewBox}
      style={{ width: '100%', height: 'auto', display: 'block', background: colors.sea, borderRadius: 'var(--r)' }}
      role="img"
      aria-label={`Lage in ${scenario.name}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <MapDefs countries={scenario.countries} theme={theme} />

      <rect x={world.x} y={world.y} width={world.width} height={world.height} fill={colors.sea} />
      {map.oceanCells.map((cell, index) => (
        <polygon
          key={`o-${index}`}
          points={cell.points}
          fill={mix(colors.sea, colors.seaDeep, cell.depth)}
        />
      ))}
      <rect x={world.x} y={world.y} width={world.width} height={world.height} fill="url(#tx-sea)" />

      {map.coastlines.map((line, index) => (
        <polyline
          key={`c-${index}`}
          points={line}
          fill="none"
          stroke={colors.paper}
          strokeWidth={4 * unit}
          opacity="0.12"
        />
      ))}

      {/* Flächen */}
      {map.territories.map((definition) => {
        const countryId = ownerOf[definition.id];
        const country = scenario.countries.find((entry) => entry.id === countryId);
        const selected = Boolean(selectedCountryId && countryId === selectedCountryId);
        return (
          <g key={definition.id}>
            <polygon
              points={definition.polygon}
              fill={country ? landFill(country.color, theme) : neutralFill(theme)}
              opacity={selectedCountryId && !selected ? 0.72 : 1}
            />
            {country ? <polygon points={definition.polygon} fill={`url(#ident-${country.id})`} /> : null}
            <polygon
              points={definition.polygon}
              fill={`url(#${definition.terrain === 'mountain' ? 'tx-mountain' : definition.terrain === 'forest' ? 'tx-forest' : definition.terrain === 'desert' ? 'tx-desert' : definition.terrain === 'swamp' ? 'tx-swamp' : definition.terrain === 'urban' ? 'tx-urban' : definition.terrain === 'steppe' ? 'tx-steppe' : 'tx-plain'})`}
              opacity="0.85"
            />
            <polygon
              points={definition.polygon}
              fill="url(#hillshade)"
              opacity={0.22 + definition.elevation * 0.45}
            />
          </g>
        );
      })}

      {/* Grenzen */}
      <g fill="none">
        <path d={borders.inner.join(' ')} stroke={colors.borderInner} strokeWidth={0.9 * unit} />
        <path d={borders.shore.join(' ')} stroke={colors.border} strokeWidth={1.5 * unit} opacity="0.7" />
        <path d={borders.national.join(' ')} stroke={colors.border} strokeWidth={2.4 * unit} opacity="0.9" />
      </g>

      {/* Flüsse */}
      {map.rivers.map((river, index) => (
        <polyline
          key={`r-${index}`}
          points={river}
          fill="none"
          stroke={colors.river}
          strokeWidth={2 * unit}
          opacity="0.7"
        />
      ))}

      {/* Hervorhebung des gewählten Landes */}
      {selectedCountryId
        ? map.territories
            .filter((definition) => ownerOf[definition.id] === selectedCountryId)
            .map((definition) => (
              <polygon
                key={`sel-${definition.id}`}
                points={definition.polygon}
                fill="none"
                stroke={theme === 'dark' ? '#f0e6cd' : '#2b3a44'}
                strokeWidth={3 * unit}
              />
            ))
        : null}

      {/* Hauptstadtzeichen */}
      {scenario.countries.map((country) => {
        const point = geometry.centroids[country.capitalId];
        if (!point) return null;
        return (
          <g key={`cap-${country.id}`} pointerEvents="none">
            <circle
              cx={point[0]}
              cy={point[1]}
              r={4.2 * unit}
              fill={theme === 'dark' ? '#f2e9d2' : '#22303a'}
              stroke={colors.border}
              strokeWidth={unit}
            />
          </g>
        );
      })}

      {/* Beschriftung */}
      {labels.map((label) => (
        <text
          key={label.id}
          className="label-land"
          x={label.x}
          y={label.y}
          fontSize={(compact ? 15 : 17) * unit}
          fill={colors.label}
          stroke={colors.labelHalo}
          strokeWidth={3.5 * unit}
          pointerEvents="none"
        >
          {label.name}
        </text>
      ))}

      {!compact ? <CompassRose x={world.x + world.width - 60} y={world.y + 64} theme={theme} /> : null}

      {/* Bedienschicht */}
      {onPickCountry
        ? map.territories.map((definition) => {
            const countryId = ownerOf[definition.id];
            if (!countryId) return null;
            const country = scenario.countries.find((entry) => entry.id === countryId);
            return (
              <polygon
                key={`hit-${definition.id}`}
                points={definition.polygon}
                fill="transparent"
                className="territory"
                style={{ cursor: 'pointer' }}
                onClick={() => onPickCountry(countryId)}
                aria-label={`${definition.name} - ${country?.name ?? ''}`}
              >
                <title>{`${definition.name} · ${country?.name ?? ''} · ${TERRAIN_INFO[definition.terrain].name}`}</title>
              </polygon>
            );
          })
        : null}
    </svg>
  );
}

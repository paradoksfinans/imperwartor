/**
 * Minikarte mit Sichtfeldrahmen.
 * Ein Klick oder Zug darin bewegt die Hauptkarte an diese Stelle.
 */
import type { MouseEvent } from 'react';
import type { GameState } from '../../models/types';
import { getMap } from '../../services/contentService';
import type { WorldBox } from '../../hooks/useMapCamera';
import { landFill, neutralFill, palette, type ThemeId } from './mapVisuals';
import { parseViewBox } from '../../hooks/useMapCamera';

interface MiniMapProps {
  game: GameState;
  box: WorldBox;
  theme: ThemeId;
  onJump: (x: number, y: number) => void;
}

export function MiniMap({ game, box, theme, onJump }: MiniMapProps) {
  const map = getMap(game.mapId);
  const world = parseViewBox(map.viewBox);
  const colors = palette(theme);

  const jump = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = world.x + ((event.clientX - rect.left) / rect.width) * world.width;
    const y = world.y + ((event.clientY - rect.top) / rect.height) * world.height;
    onJump(x, y);
  };

  return (
    <div className="minimap" title="Übersicht - hier klicken, um die Karte zu bewegen">
      <svg
        viewBox={map.viewBox}
        onClick={jump}
        role="img"
        aria-label="Übersichtskarte"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={world.x} y={world.y} width={world.width} height={world.height} fill={colors.sea} />
        {map.territories.map((definition) => {
          const territory = game.territories[definition.id];
          if (!territory) return null;
          const owner = territory.ownerId ? game.countries[territory.ownerId] : null;
          return (
            <polygon
              key={definition.id}
              points={definition.polygon}
              fill={owner ? landFill(owner.color, theme) : neutralFill(theme)}
              stroke={colors.border}
              strokeWidth={world.width / 600}
            />
          );
        })}
        <rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          fill="none"
          stroke={theme === 'dark' ? '#e3bd48' : '#8a6a12'}
          strokeWidth={world.width / 220}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

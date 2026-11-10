/**
 * Zeichensatz des Spiels.
 *
 * Alle Symbole sind handgesetzte SVG-Pfade auf einem 24er-Raster und
 * übernehmen die Textfarbe. Dadurch bleibt das Spiel frei von externen
 * Bilddateien und funktioniert offline.
 */

export type IconName =
  | 'gold'
  | 'income'
  | 'people'
  | 'stability'
  | 'research'
  | 'power'
  | 'prestige'
  | 'action'
  | 'infantry'
  | 'cavalry'
  | 'artillery'
  | 'fleet'
  | 'sword'
  | 'shield'
  | 'crown'
  | 'anchor'
  | 'fortress'
  | 'general'
  | 'war'
  | 'peace'
  | 'treaty'
  | 'spy'
  | 'eye'
  | 'hammer'
  | 'crane'
  | 'farm'
  | 'market'
  | 'workshop'
  | 'road'
  | 'academy'
  | 'temple'
  | 'granary'
  | 'harbour'
  | 'grain'
  | 'iron'
  | 'timber'
  | 'horses'
  | 'luxury'
  | 'unrest'
  | 'devastation'
  | 'blockade'
  | 'compass'
  | 'layers'
  | 'chart'
  | 'trophy'
  | 'chronicle'
  | 'gear'
  | 'target'
  | 'globe'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'info'
  | 'warning'
  | 'sun'
  | 'moon'
  | 'sound'
  | 'mute'
  | 'archive'
  | 'zoomIn'
  | 'zoomOut'
  | 'recenter'
  | 'chevronDown'
  | 'chevronRight'
  | 'help'
  | 'share'
  | 'flask'
  | 'scroll';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
  strokeWidth?: number;
}

/** Strichzeichnungen: werden mit currentColor gezeichnet. */
const STROKE: Partial<Record<IconName, string>> = {
  income: 'M3 17l5-6 4 3 4-6 5 4M17 7h4v4',
  people:
    'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.7-5 6-5s6 2 6 5M16.5 11.5a2.5 2.5 0 100-5M17 15.5c2.4.4 4 2.2 4 4.5',
  stability: 'M12 3l7 3v6c0 4-3 7.3-7 9-4-1.7-7-5-7-9V6l7-3z',
  research: 'M9 3h6M10 3v5l-4.5 8.5A3 3 0 008 21h8a3 3 0 002.5-4.5L14 8V3M7.5 14h9',
  prestige: 'M12 4c3 2 4.5 5 4.5 8.5S14 19 12 20c-2-1-4.5-3.5-4.5-7.5S9 6 12 4zM12 9v8',
  action: 'M4 20l7-7M8 4h4l8 8-4 4-8-8V4z',
  infantry: 'M12 3v12M8 7h8M7 21h10l-5-6-5 6z',
  cavalry: 'M5 20l2-7 3-4 2-4 3 2-1 3 4 3v7M8 13l-3 2',
  artillery: 'M4 17h16M6 17l-1-4 12-4 1 3M8 20a2 2 0 100-4 2 2 0 000 4zM17 20a2 2 0 100-4 2 2 0 000 4z',
  fleet: 'M4 16h16l-3 5H7l-3-5zM12 3v10M12 6l6 3-6 3M12 6L6 9l6 3',
  sword: 'M14 4h6v6M20 4L9 15M4 18l3 3M5.5 16.5l4 4M3 20l1 1',
  shield: 'M12 3l8 3.2v5.3c0 4.6-3.3 8.3-8 9.5-4.7-1.2-8-4.9-8-9.5V6.2L12 3z',
  anchor: 'M12 8v13M12 8a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 14a7 7 0 0014 0M5 14h3M19 14h-3',
  fortress: 'M4 21V9l3-2 3 2V5h4v4l3-2 3 2v12M4 14h16M10 21v-4h4v4',
  general: 'M12 3l2.5 5 5.5.8-4 4 1 5.5-5-2.7-5 2.7 1-5.5-4-4 5.5-.8L12 3z',
  war: 'M4 4l16 16M20 4L4 20M8 4H4v4M16 20h4v-4',
  peace: 'M12 21V9M12 9c-2-4-5-5-8-4 1 4 4 6 8 5zM12 9c2-4 5-5 8-4-1 4-4 6-8 5z',
  treaty: 'M3 7h6l3 3 3-3h6M3 7v10h18V7M8 17v-6M16 17v-6',
  spy: 'M4 11h16M6 15a3 3 0 106 0 3 3 0 00-6 0zM12 15a3 3 0 106 0 3 3 0 00-6 0zM7 11l2-5h6l2 5',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6zM12 15a3 3 0 100-6 3 3 0 000 6z',
  hammer: 'M14 4l6 6-3 3-6-6 3-3zM11 9L4 16v4h4l7-7',
  crane: 'M5 21V4h11l4 5M9 4v5M5 9h11M12 9v5a3 3 0 006 0',
  farm: 'M12 21V8M12 8l4-4M12 12l4-3M12 16l4-3M12 8L8 4M12 12l-4-3M12 16l-4-3',
  market: 'M4 9h16l-1-5H5L4 9zM5 9v12h14V9M9 21v-6h6v6',
  workshop: 'M4 21V11l5-3v3l5-3v3l6-3v13M8 21v-4h3v4',
  road: 'M8 21L10 3M16 21l-2-18M12 6v3M12 12v3M12 18v2',
  academy: 'M3 9l9-4 9 4-9 4-9-4zM7 11v5c0 2 2.3 3 5 3s5-1 5-3v-5M3 9v5',
  temple: 'M12 3l8 5H4l8-5zM6 8v10M10 8v10M14 8v10M18 8v10M3 21h18',
  granary: 'M6 21V10l6-5 6 5v11M6 14h12M12 5v16',
  harbour: 'M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5M9 11h6',
  grain: 'M12 21V8M12 8c-2-1-3-3-3-5 2 0 3.5 1 4 3M12 8c2-1 3-3 3-5-2 0-3.5 1-4 3M12 13c-2-1-3.5-2.5-4-4.5M12 13c2-1 3.5-2.5 4-4.5M12 18c-2-1-3.5-2.5-4-4.5M12 18c2-1 3.5-2.5 4-4.5',
  iron: 'M5 8l7-4 7 4v8l-7 4-7-4V8zM12 4v16M5 8l14 8M19 8L5 16',
  timber: 'M4 18h16M6 18l2-11h8l2 11M9 7l1-3h4l1 3M12 7v11',
  horses: 'M6 21v-7l2-4 2-3 1-4 3 2-1 3 4 3 1 10M8 14l-2 1M15 11l2 1',
  luxury: 'M12 3l7 6-7 12-7-12 7-6zM5 9h14M12 3L9 9l3 12 3-12-3-6z',
  unrest: 'M12 21c3.3 0 6-2.5 6-5.5 0-4-6-12.5-6-12.5S6 11.5 6 15.5C6 18.5 8.7 21 12 21z',
  devastation: 'M4 20L9 4l2 7 3-4 1 6 2-3 3 10M4 20h17',
  blockade: 'M4 12a4 4 0 014-4h2v8H8a4 4 0 01-4-4zM20 12a4 4 0 00-4-4h-2v8h2a4 4 0 004-4zM10 12h4',
  compass: 'M12 2a10 10 0 100 20 10 10 0 000-20zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  chart: 'M3 21h18M6 21V11M11 21V5M16 21v-8M21 21v-4',
  trophy: 'M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3M12 14v4M8 21h8l-1-3H9l-1 3z',
  chronicle: 'M5 4h9l5 5v11H5V4zM14 4v5h5M8 13h8M8 17h5',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2l1.5 2.6 3-.4.4 3 2.6 1.5-1.4 2.6 1.4 2.6-2.6 1.5-.4 3-3-.4L12 22l-1.5-2.6-3 .4-.4-3L4.5 15.3 5.9 12.7 4.5 10.1l2.6-1.5.4-3 3 .4L12 2z',
  target: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 7a5 5 0 100 10 5 5 0 000-10zM12 11a1 1 0 100 2 1 1 0 000-2z',
  globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22c-3-3-4.5-6.5-4.5-10S9 5 12 2z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M4 13l5 5L20 6',
  close: 'M5 5l14 14M19 5L5 19',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 10v7M12 7v.5',
  warning: 'M12 3l9 17H3l9-17zM12 9v5M12 17v.5',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  sound: 'M4 10v4h3l5 4V6L7 10H4zM16 9c1.3 1.3 1.3 4.7 0 6M19 6c2.7 2.7 2.7 9.3 0 12',
  mute: 'M4 10v4h3l5 4V6L7 10H4zM16 10l5 4M21 10l-5 4',
  archive: 'M3 6h18v4H3V6zM5 10v11h14V10M9 14h6',
  zoomIn: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5M8 11h6',
  recenter: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  help: 'M12 2a10 10 0 100 20 10 10 0 000-20zM9.5 9a2.5 2.5 0 115 .5c0 1.5-2.5 2-2.5 4M12 18v.5',
  share: 'M12 3v12M8 7l4-4 4 4M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M7.5 15h9',
  scroll: 'M6 4h12v16H6V4zM9 8h6M9 12h6M9 16h3',
  power: 'M12 3a4 4 0 014 4c0 1.8-1.2 3.3-2.8 3.8L14 21h-4l.8-10.2A4 4 0 0112 3z'
};

/** Flächige Symbole. */
const FILLED: Partial<Record<IconName, string>> = {
  gold: 'M12 3c4.4 0 8 1.8 8 4s-3.6 4-8 4-8-1.8-8-4 3.6-4 8-4zm8 7.5c0 2.2-3.6 4-8 4s-8-1.8-8-4V17c0 2.2 3.6 4 8 4s8-1.8 8-4v-6.5z'
};

export function Icon({ name, size = 18, className, title, strokeWidth = 1.7 }: IconProps) {
  const filled = FILLED[name];
  const path = filled ?? STROKE[name] ?? STROKE.info!;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ flex: '0 0 auto', display: 'block' }}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={path}
        fill={filled ? 'currentColor' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Rohdaten eines Symbols für den Einsatz direkt in der Karte.
 * Dort wird das Symbol in Kartenkoordinaten skaliert gezeichnet.
 */
export function iconPath(name: IconName): { d: string; filled: boolean } {
  const filled = FILLED[name];
  return { d: filled ?? STROKE[name] ?? STROKE.info!, filled: Boolean(filled) };
}

/**
 * Symbol in Kartenkoordinaten: zeichnet das 24er-Raster auf die gewünschte
 * Grösse an der gewünschten Stelle.
 */
export function MapGlyph({
  name,
  x,
  y,
  size,
  color,
  halo,
  haloWidth
}: {
  name: IconName;
  x: number;
  y: number;
  size: number;
  color: string;
  halo?: string;
  haloWidth?: number;
}) {
  const { d, filled } = iconPath(name);
  const scale = size / 24;
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`} pointerEvents="none">
      {halo ? (
        <path
          d={d}
          fill="none"
          stroke={halo}
          strokeWidth={(haloWidth ?? 3) / scale}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <path
        d={d}
        fill={filled ? color : 'none'}
        stroke={filled ? 'none' : color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** Symbol je Truppengattung. */
export const UNIT_ICON: Record<string, IconName> = {
  infantry: 'infantry',
  cavalry: 'cavalry',
  artillery: 'artillery',
  fleet: 'fleet'
};

/** Symbol je Rohstoff. */
export const RESOURCE_ICON: Record<string, IconName> = {
  grain: 'grain',
  iron: 'iron',
  timber: 'timber',
  horses: 'horses',
  luxury: 'luxury'
};

/** Symbol je Großprojekt. */
export const PROJECT_ICON: Record<string, IconName> = {
  great_library: 'academy',
  grand_exchange: 'market',
  citadel: 'fortress',
  cathedral: 'temple',
  great_harbour: 'harbour'
};

/** Symbol je Gebäude. */
export const BUILDING_ICON: Record<string, IconName> = {
  farm: 'farm',
  market: 'market',
  workshop: 'workshop',
  road: 'road',
  barracks: 'infantry',
  fortress: 'fortress',
  harbour: 'harbour',
  academy: 'academy',
  temple: 'temple',
  granary: 'granary'
};

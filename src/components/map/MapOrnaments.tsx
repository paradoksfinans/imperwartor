/**
 * Zierelemente des Kartenblatts: Windrose und Maßstab.
 * Sie liegen im Koordinatenraum der Karte und bewegen sich daher mit,
 * als wären sie mitgedruckt.
 */
import { palette, type ThemeId } from './mapVisuals';

interface OrnamentProps {
  x: number;
  y: number;
  theme: ThemeId;
}

export function CompassRose({ x, y, theme }: OrnamentProps) {
  const ink = theme === 'dark' ? '#d8cbae' : '#4a5d68';
  const brass = theme === 'dark' ? '#c9a227' : '#8a6a12';
  const r = 34;
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.72" aria-hidden="true" pointerEvents="none">
      <circle r={r} fill="none" stroke={ink} strokeWidth="0.9" opacity="0.5" />
      <circle r={r * 0.72} fill="none" stroke={ink} strokeWidth="0.5" opacity="0.35" />
      {/* Nebenrichtungen */}
      {[45, 135, 225, 315].map((angle) => (
        <path
          key={angle}
          d={`M0 0L${(r * 0.52 * Math.sin((angle * Math.PI) / 180)).toFixed(1)} ${(
            -r *
            0.52 *
            Math.cos((angle * Math.PI) / 180)
          ).toFixed(1)}`}
          stroke={ink}
          strokeWidth="0.7"
          opacity="0.45"
        />
      ))}
      {/* Hauptrichtungen als gefüllte Spitzen */}
      {[0, 90, 180, 270].map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d={`M0 ${-r} L5.5 0 L0 6 L-5.5 0 Z`} fill={angle === 0 ? brass : ink} opacity={angle === 0 ? 0.95 : 0.6} />
        </g>
      ))}
      <circle r="2.4" fill={brass} />
      <text
        x="0"
        y={-r - 7}
        textAnchor="middle"
        fontSize="12"
        fontFamily="Spectral, Georgia, serif"
        fontStyle="italic"
        fill={ink}
      >
        N
      </text>
    </g>
  );
}

export function ScaleBar({
  x,
  y,
  theme,
  unitsPerSegment = 100,
  segments = 4,
  pixelsPerSegment = 40
}: OrnamentProps & { unitsPerSegment?: number; segments?: number; pixelsPerSegment?: number }) {
  const ink = theme === 'dark' ? '#d8cbae' : '#4a5d68';
  const colors = palette(theme);
  return (
    <g transform={`translate(${x} ${y})`} opacity="0.75" aria-hidden="true" pointerEvents="none">
      {Array.from({ length: segments }, (_, index) => (
        <rect
          key={index}
          x={index * pixelsPerSegment}
          y="0"
          width={pixelsPerSegment}
          height="6"
          fill={index % 2 === 0 ? ink : colors.paper}
          stroke={ink}
          strokeWidth="0.6"
        />
      ))}
      <text x="0" y="-4" fontSize="9.5" fill={ink} fontFamily="Spectral, Georgia, serif">
        0
      </text>
      <text
        x={segments * pixelsPerSegment}
        y="-4"
        fontSize="9.5"
        textAnchor="end"
        fill={ink}
        fontFamily="Spectral, Georgia, serif"
      >
        {segments * unitsPerSegment} Meilen
      </text>
    </g>
  );
}

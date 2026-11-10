/**
 * Alle Muster, Verläufe und Filter der Karte.
 *
 * Die Geländetexturen sind als Stichmuster angelegt - Schraffuren für
 * Gebirge, Baumzeichen für Wald, Punktierung für Wüste. Das Muster eines
 * Landes liegt zusätzlich auf der Fläche und macht Länder auch ohne
 * Farbwahrnehmung unterscheidbar.
 */
import type { PatternId } from '../../models/types';
import { palette, type ThemeId } from './mapVisuals';

/** Nur diese drei Angaben braucht die Musterdefinition eines Landes. */
export interface PatternSource {
  id: string;
  color: string;
  pattern: PatternId;
}

interface MapDefsProps {
  countries: PatternSource[];
  theme: ThemeId;
}

/** Ein Landesmuster: Tinte des Landes auf der eingefärbten Fläche. */
function IdentityPattern({ id, color, kind }: { id: string; color: string; kind: PatternId }) {
  const stroke = color;
  switch (kind) {
    case 'stripes':
      return (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 2.5h9" stroke={stroke} strokeWidth="2.2" opacity="0.32" />
        </pattern>
      );
    case 'dots':
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.7" fill={stroke} opacity="0.34" />
          <circle cx="8" cy="8" r="1.7" fill={stroke} opacity="0.34" />
        </pattern>
      );
    case 'grid':
      return (
        <pattern id={id} width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M0 0h11M0 0v11" stroke={stroke} strokeWidth="1.5" opacity="0.3" />
        </pattern>
      );
    case 'diagonal':
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M-2 8L8 -2M2 12L12 2" stroke={stroke} strokeWidth="2" opacity="0.3" />
        </pattern>
      );
    case 'cross':
      return (
        <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M-2 10L10 -2M2 14L14 2M-2 2L10 14M2 -2L14 10" stroke={stroke} strokeWidth="1.3" opacity="0.26" />
        </pattern>
      );
    case 'solid':
    default:
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill={stroke} opacity="0.1" />
        </pattern>
      );
  }
}

export function MapDefs({ countries, theme }: MapDefsProps) {
  const colors = palette(theme);
  const engrave = theme === 'dark' ? '#2a2a24' : '#4a4634';
  const engraveOpacity = theme === 'dark' ? 0.4 : 0.34;

  return (
    <defs>
      {/* --- Landesmuster --- */}
      {countries.map((country) => (
        <IdentityPattern
          key={country.id}
          id={`ident-${country.id}`}
          color={country.color}
          kind={country.pattern}
        />
      ))}

      {/* --- Geländetexturen --- */}
      <pattern id="tx-plain" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="5" r="0.7" fill={engrave} opacity={engraveOpacity * 0.6} />
        <circle cx="11" cy="12" r="0.7" fill={engrave} opacity={engraveOpacity * 0.6} />
      </pattern>

      <pattern id="tx-forest" width="15" height="15" patternUnits="userSpaceOnUse">
        <g stroke={engrave} strokeWidth="0.9" fill="none" opacity={engraveOpacity}>
          <path d="M3 10.5L5 5.5L7 10.5M5 10.5v1.6" />
          <path d="M9.5 14L11.5 9L13.5 14M11.5 14v1.4" />
        </g>
      </pattern>

      <pattern id="tx-mountain" width="16" height="13" patternUnits="userSpaceOnUse">
        <g stroke={engrave} strokeWidth="1.1" fill="none" opacity={engraveOpacity * 1.15} strokeLinecap="round">
          <path d="M1 8.5L4.5 3L8 8.5" />
          <path d="M8.5 12.5L12 7L15.5 12.5" />
        </g>
      </pattern>

      <pattern id="tx-desert" width="14" height="14" patternUnits="userSpaceOnUse">
        <g opacity={engraveOpacity}>
          <path d="M1 6q3-2.4 6 0" stroke={engrave} strokeWidth="0.9" fill="none" />
          <path d="M7 12q3-2.4 6 0" stroke={engrave} strokeWidth="0.9" fill="none" />
          <circle cx="11" cy="4" r="0.6" fill={engrave} />
          <circle cx="3" cy="11" r="0.6" fill={engrave} />
        </g>
      </pattern>

      <pattern id="tx-swamp" width="14" height="12" patternUnits="userSpaceOnUse">
        <g stroke={engrave} strokeWidth="1" fill="none" opacity={engraveOpacity}>
          <path d="M1 3.5h5M8 3.5h4" />
          <path d="M3 7.5h5M10 7.5h3" />
          <path d="M1 11h4M7 11h5" />
        </g>
      </pattern>

      <pattern id="tx-steppe" width="13" height="13" patternUnits="userSpaceOnUse">
        <g stroke={engrave} strokeWidth="0.9" opacity={engraveOpacity * 0.9} strokeLinecap="round">
          <path d="M3 4v3.4M8.5 8v3.4M11 2.5v2.6" />
        </g>
      </pattern>

      <pattern id="tx-coast" width="13" height="13" patternUnits="userSpaceOnUse">
        <g fill={engrave} opacity={engraveOpacity * 0.75}>
          <circle cx="3" cy="3" r="0.75" />
          <circle cx="9" cy="6" r="0.75" />
          <circle cx="5" cy="10" r="0.75" />
          <circle cx="11" cy="11.5" r="0.75" />
        </g>
      </pattern>

      <pattern id="tx-urban" width="13" height="13" patternUnits="userSpaceOnUse">
        <g fill="none" stroke={engrave} strokeWidth="0.95" opacity={engraveOpacity}>
          <rect x="2" y="2" width="3.4" height="3.4" />
          <rect x="7.5" y="4.5" width="3" height="3" />
          <rect x="3.5" y="8.5" width="3.6" height="2.8" />
        </g>
      </pattern>

      {/* --- Seegang: gestochene Wasserlinien --- */}
      <pattern id="tx-sea" width="26" height="14" patternUnits="userSpaceOnUse">
        <path
          d="M0 4q6.5-3 13 0t13 0"
          stroke={theme === 'dark' ? '#5f8ca8' : '#7ea3b4'}
          strokeWidth="0.8"
          fill="none"
          opacity="0.3"
        />
        <path
          d="M0 11q6.5-3 13 0t13 0"
          stroke={theme === 'dark' ? '#5f8ca8' : '#7ea3b4'}
          strokeWidth="0.55"
          fill="none"
          opacity="0.18"
        />
      </pattern>

      {/* --- Unbekanntes Land --- */}
      <pattern id="tx-fog" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={theme === 'dark' ? '#16222c' : '#9aa6ad'} opacity="0.26" />
        <path d="M-2 6L6 -2M2 10L10 2" stroke={theme === 'dark' ? '#55656f' : '#6f7d85'} strokeWidth="1.2" opacity="0.4" />
      </pattern>

      {/* --- Kriegsschäden --- */}
      <pattern id="tx-ruin" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M0 10L10 0" stroke="#7d2a1c" strokeWidth="1.3" opacity="0.5" />
        <path d="M0 5L5 0M5 10L10 5" stroke="#7d2a1c" strokeWidth="0.8" opacity="0.32" />
      </pattern>

      {/* --- Reliefschattierung: Licht aus Nordwest --- */}
      <linearGradient id="hillshade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
        <stop offset="55%" stopColor="#000000" stopOpacity="0.04" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
      </linearGradient>

      {/* --- Meerestiefe --- */}
      <linearGradient id="sea-shallow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={colors.sea} />
        <stop offset="100%" stopColor={colors.seaDeep} stopOpacity="0.55" />
      </linearGradient>

      {/* --- Randabdunklung --- */}
      <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity={theme === 'dark' ? 0.16 : 0.08} />
      </radialGradient>

      {/* --- Papierkorn --- */}
      <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="7" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" result="grey" />
        <feComponentTransfer in="grey" result="soft">
          <feFuncA type="linear" slope="0.09" intercept="0" />
        </feComponentTransfer>
        <feComposite in="soft" in2="SourceAlpha" operator="in" />
      </filter>

      {/* --- Leuchten um ausgewählte Gebiete --- */}
      <filter id="pick-glow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* --- Pfeilspitzen für Bewegung und Angriff --- */}
      <marker id="arrow-move" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0 1L9 5L0 9z" fill="#4e9a8f" />
      </marker>
      <marker id="arrow-attack" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M0 1L9 5L0 9z" fill="#c4502f" />
      </marker>
    </defs>
  );
}

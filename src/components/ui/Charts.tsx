/**
 * Diagramme als Inline-SVG.
 *
 * Grundsätze: eine Achse, dezente Hilfslinien, 2px-Linien, Legende ab zwei
 * Reihen, Direktbeschriftung der wichtigsten Reihen und ein Strichmuster je
 * Reihe als zweite Codierung neben der Farbe.
 */
import { useId, useState } from 'react';
import { formatNumber } from '../../utils/format';

export interface Series {
  id: string;
  label: string;
  color: string;
  values: number[];
}

/** Strichmuster als zweite Codierung (Reihenfolge ist fest). */
const DASHES = ['', '6 3', '2 3', '9 3 2 3', '4 2 1 2', '1 3', '12 4', '7 2 2 2'];

/* ------------------------------------------------------------------ */
/* Verlaufsdiagramm mit mehreren Reihen                                */
/* ------------------------------------------------------------------ */

export function HistoryChart({
  series,
  labels,
  height = 180,
  unit = '',
  highlightId
}: {
  series: Series[];
  labels: number[];
  height?: number;
  unit?: string;
  highlightId?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();

  const width = 360;
  const pad = { top: 10, right: 52, bottom: 20, left: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const count = labels.length;
  if (count < 2 || series.length === 0) {
    return <p className="faint">Noch zu wenige Runden für einen Verlauf.</p>;
  }

  // Der Wertebereich folgt den Daten, damit Unterschiede sichtbar bleiben.
  const allValues = series.flatMap((entry) => entry.values);
  const rawMax = Math.max(1, ...allValues);
  const rawMin = Math.min(...allValues);
  const spread = rawMax - rawMin;
  const maxValue = rawMax + Math.max(1, spread * 0.08);
  const minValue = spread > rawMax * 0.25 ? 0 : Math.max(0, rawMin - spread * 0.25);
  const span = Math.max(1, maxValue - minValue);

  const x = (index: number) => pad.left + (index / (count - 1)) * innerW;
  const y = (value: number) => pad.top + innerH - ((value - minValue) / span) * innerH;

  // Vier Hilfswerte über den sichtbaren Bereich
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(minValue + span * ratio));

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-labelledby={titleId}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const relative = ((event.clientX - box.left) / box.width) * width;
          const index = Math.round(((relative - pad.left) / innerW) * (count - 1));
          setHover(index >= 0 && index < count ? index : null);
        }}
      >
        <title id={titleId}>Verlauf über {count} Runden</title>

        {/* Hilfslinien treten zurück */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={pad.left + innerW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--rule)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 3.5}
              textAnchor="end"
              fontSize="8.5"
              fill="var(--text-faint)"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {/* Zeitachse: erste, mittlere und letzte Runde */}
        {[0, Math.floor((count - 1) / 2), count - 1].map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 6}
            textAnchor="middle"
            fontSize="8.5"
            fill="var(--text-faint)"
          >
            {labels[index]}
          </text>
        ))}

        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="var(--rule-strong)"
            strokeWidth="1"
          />
        ) : null}

        {series.map((entry, order) => {
          const path = entry.values
            .map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
            .join(' ');
          const isMine = entry.id === highlightId;
          return (
            <g key={entry.id}>
              <path
                d={path}
                fill="none"
                stroke={entry.color}
                strokeWidth={isMine ? 2.8 : 2}
                strokeDasharray={isMine ? '' : DASHES[order % DASHES.length]}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isMine ? 1 : 0.85}
              />
              {hover !== null ? (
                <circle
                  cx={x(hover)}
                  cy={y(entry.values[hover] ?? 0)}
                  r="3.5"
                  fill={entry.color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}

        {/* Direktbeschriftung: höchstens vier, damit nichts kollidiert */}
        {[...series]
          .sort((a, b) => (b.values.at(-1) ?? 0) - (a.values.at(-1) ?? 0))
          .slice(0, 4)
          .map((entry) => (
            <text
              key={entry.id}
              x={pad.left + innerW + 5}
              y={y(entry.values.at(-1) ?? 0) + 3}
              fontSize="9"
              fill="var(--text-muted)"
            >
              {entry.label.length > 9 ? `${entry.label.slice(0, 8)}.` : entry.label}
            </text>
          ))}
      </svg>

      {hover !== null ? (
        <figcaption className="faint" style={{ marginTop: '0.2rem' }}>
          Runde {labels[hover]}:{' '}
          {[...series]
            .sort((a, b) => (b.values[hover] ?? 0) - (a.values[hover] ?? 0))
            .slice(0, 3)
            .map((entry) => `${entry.label} ${formatNumber(entry.values[hover] ?? 0)}${unit}`)
            .join(' · ')}
        </figcaption>
      ) : null}

      {series.length > 1 ? (
        <div className="row tight" style={{ marginTop: '0.35rem', gap: '0.5rem' }}>
          {series.map((entry, order) => (
            <span
              key={entry.id}
              className="row tight"
              style={{ gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}
            >
              <svg width="18" height="8" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={entry.color}
                  strokeWidth={entry.id === highlightId ? 3 : 2}
                  strokeDasharray={entry.id === highlightId ? '' : DASHES[order % DASHES.length]}
                />
              </svg>
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Anteilsbalken: ersetzt ein Ringdiagramm                             */
/* ------------------------------------------------------------------ */

export function ShareBar({
  parts,
  height = 26
}: {
  parts: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0);
  if (total <= 0) return <p className="faint">Keine Werte vorhanden.</p>;

  let offset = 0;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} role="img" preserveAspectRatio="none">
        {parts.map((part) => {
          const share = (Math.max(0, part.value) / total) * 100;
          const rect = (
            <rect
              key={part.label}
              x={offset}
              y="0"
              width={Math.max(0, share - 0.6)}
              height={height}
              rx="1.5"
              fill={part.color}
            />
          );
          offset += share;
          return rect;
        })}
      </svg>
      <div className="row tight" style={{ marginTop: '0.3rem', gap: '0.6rem' }}>
        {parts.map((part) => (
          <span
            key={part.label}
            className="row tight"
            style={{ gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}
          >
            <i
              style={{
                width: '0.6rem',
                height: '0.6rem',
                borderRadius: '2px',
                background: part.color,
                display: 'inline-block'
              }}
            />
            {part.label} {Math.round((part.value / total) * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Kleiner Verlauf ohne Achsen                                         */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  color = 'var(--accent)',
  width = 90,
  height = 24
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <path d={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Waagerechter Vergleichsbalken für Ranglisten                       */
/* ------------------------------------------------------------------ */

export function RankBars({
  rows,
  max,
  unit = ''
}: {
  rows: { label: string; value: number; color: string; mine?: boolean }[];
  max?: number;
  unit?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((row) => row.value));
  return (
    <div className="stack tight">
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.1rem 0.5rem' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: row.mine ? 600 : 400 }}>{row.label}</span>
          <span style={{ fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(row.value)}
            {unit}
          </span>
          <div style={{ gridColumn: '1 / -1' }}>
            <svg width="100%" height="7" preserveAspectRatio="none" viewBox="0 0 100 7" aria-hidden="true">
              <rect x="0" y="0" width="100" height="7" rx="1.5" fill="var(--surface-sunk)" />
              <rect
                x="0"
                y="0"
                width={Math.max(0.5, (row.value / top) * 100)}
                height="7"
                rx="1.5"
                fill={row.color}
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

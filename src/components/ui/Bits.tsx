/**
 * Kleine wiederverwendbare Anzeigebausteine:
 * Balken, Messwerte, Beziehungsachse, Aktionspunkte, Kennzahlen.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { clamp } from '../../utils/helpers';

/* ------------------------------------------------------------------ */

export function Bar({
  value,
  max = 100,
  color,
  thin = false,
  title
}: {
  value: number;
  max?: number;
  color?: string;
  thin?: boolean;
  title?: string;
}) {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0;
  return (
    <div className={`bar${thin ? ' thin' : ''}`} title={title}>
      <i style={{ width: `${ratio * 100}%`, background: color }} />
    </div>
  );
}

export function Meter({
  label,
  value,
  display,
  max = 100,
  color,
  hint
}: {
  label: string;
  value: number;
  display?: string;
  max?: number;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="meter" title={hint}>
      <span className="label">{label}</span>
      <span>{display ?? Math.round(value)}</span>
      <Bar value={value} max={max} color={color} />
    </div>
  );
}

/** Beziehungsachse von -100 bis +100 mit Mittelmarke. */
export function RelationAxis({ value }: { value: number }) {
  const position = ((clamp(value, -100, 100) + 100) / 200) * 100;
  return (
    <div className="relation" title={`Beziehung ${value}`}>
      <i style={{ left: `calc(${position}% - 1px)` }} />
    </div>
  );
}

/** Aktionspunkte als abzählbare Marken. */
export function Pips({ value, max }: { value: number; max: number }) {
  const total = Math.max(max, value);
  return (
    <span className="pips" title={`${value} von ${max} Aktionspunkten`}>
      {Array.from({ length: total }, (_, index) => (
        <i key={index} className={`pip${index < value ? ' on' : ''}`} />
      ))}
    </span>
  );
}

/** Kennzahl in der Kommandozeile. */
export function Readout({
  icon,
  value,
  delta,
  title,
  tone
}: {
  icon: IconName;
  value: ReactNode;
  delta?: ReactNode;
  title: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <span className="readout" title={title}>
      <Icon name={icon} size={15} className="glyph" />
      <span className={`value${tone ? ` ${tone}` : ''}`}>{value}</span>
      {delta !== undefined && delta !== null ? <span className="delta">{delta}</span> : null}
    </span>
  );
}

export function KeyValue({
  label,
  value,
  hint,
  tone
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  tone?: 'positive' | 'negative' | 'warning';
}) {
  return (
    <div className="kv" title={hint}>
      <span>{label}</span>
      <span className={tone}>{value}</span>
    </div>
  );
}

export function Tag({
  children,
  kind,
  icon
}: {
  children: ReactNode;
  kind?: 'war' | 'ally' | 'brass';
  icon?: IconName;
}) {
  return (
    <span className={`tag${kind ? ` ${kind}` : ''}`}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

/** Umschalter mit mehreren gleichwertigen Optionen. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          title={option.hint}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Zahleneingabe mit Plus und Minus für Touch-Bedienung. */
export function Stepper({
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  label
}: {
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const set = (next: number) => onChange(clamp(Math.round(next), min, Math.max(min, max)));
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label="weniger">
        <Icon name="minus" size={14} />
      </button>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label="mehr">
        <Icon name="plus" size={14} />
      </button>
    </span>
  );
}

/** Schieberegler, dessen Spur den gefüllten Anteil zeigt. */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  label: string;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      style={{ ['--fill' as string]: `${fill}%` }}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

/** Leerer Zustand mit Handlungsaufforderung. */
export function Empty({ text, icon = 'info' }: { text: string; icon?: IconName }) {
  return (
    <p className="faint" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <Icon name={icon} size={15} />
      {text}
    </p>
  );
}

/** Umschalter der Kartenansichten. */
import type { MapFilter } from '../../models/types';
import { FILTER_LABELS } from '../map/mapVisuals';

const ORDER: MapFilter[] = [
  'political',
  'diplomacy',
  'military',
  'economy',
  'population',
  'stability',
  'supply',
  'resources',
  'culture',
  'religion',
  'terrain'
];

export function FilterBar({
  value,
  onChange
}: {
  value: MapFilter;
  onChange: (filter: MapFilter) => void;
}) {
  return (
    <div className="filters" role="tablist" aria-label="Kartenansicht">
      {ORDER.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-pressed={value === filter}
          aria-selected={value === filter}
          onClick={() => onChange(filter)}
        >
          {FILTER_LABELS[filter]}
        </button>
      ))}
    </div>
  );
}

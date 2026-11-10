/**
 * Auswahl einer Truppenaufstellung nach Gattungen.
 * Wird für Rekrutierung, Verlegung und Angriff verwendet.
 */
import type { Army, UnitTypeId } from '../../models/types';
import { getUnit } from '../../services/contentService';
import { UNIT_ORDER } from '../../engine/army';
import { clamp } from '../../utils/helpers';
import { Icon, UNIT_ICON } from './Icon';
import { Slider, Stepper } from './Bits';

interface ArmyPickerProps {
  /** Höchstmenge je Gattung. */
  available: Army;
  value: Army;
  onChange: (next: Army) => void;
  /** Gattungen, die hier überhaupt erlaubt sind. */
  allowed?: UnitTypeId[];
  /** Zeigt die Schnellwahl für alle Gattungen zusammen. */
  showQuickPick?: boolean;
}

export function ArmyPicker({
  available,
  value,
  onChange,
  allowed,
  showQuickPick = true
}: ArmyPickerProps) {
  const units = UNIT_ORDER.filter(
    (unitId) => (!allowed || allowed.includes(unitId)) && available[unitId] > 0
  );

  if (units.length === 0) {
    return <p className="faint">Hier stehen keine passenden Einheiten bereit.</p>;
  }

  const set = (unitId: UnitTypeId, next: number) =>
    onChange({ ...value, [unitId]: clamp(Math.round(next), 0, available[unitId]) });

  const applyRatio = (ratio: number) => {
    const next = { ...value };
    for (const unitId of units) {
      next[unitId] = Math.floor(available[unitId] * ratio);
    }
    onChange(next);
  };

  return (
    <div className="stack tight">
      {units.map((unitId) => {
        const unit = getUnit(unitId);
        return (
          <div className="unit-row" key={unitId}>
            <Icon name={UNIT_ICON[unitId]} size={17} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem' }}>{unit.name}</div>
              <Slider
                value={value[unitId]}
                min={0}
                max={available[unitId]}
                onChange={(next) => set(unitId, next)}
                label={`${unit.name} auswählen`}
              />
            </div>
            <span className="count">{value[unitId]}</span>
            <span className="faint">/ {available[unitId]}</span>
            <Stepper
              value={value[unitId]}
              max={available[unitId]}
              onChange={(next) => set(unitId, next)}
              label={`${unit.name} ändern`}
            />
          </div>
        );
      })}

      {showQuickPick ? (
        <div className="row tight">
          {[
            { ratio: 0.25, label: '25 %' },
            { ratio: 0.5, label: '50 %' },
            { ratio: 0.75, label: '75 %' },
            { ratio: 1, label: 'alles' }
          ].map((entry) => (
            <button key={entry.label} type="button" className="small" onClick={() => applyRatio(entry.ratio)}>
              {entry.label}
            </button>
          ))}
          <button type="button" className="small quiet" onClick={() => applyRatio(0)}>
            zurücksetzen
          </button>
        </div>
      ) : null}
    </div>
  );
}

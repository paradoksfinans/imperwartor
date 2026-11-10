/**
 * Ratgeberleiste: zeigt die wichtigsten Hinweise des Reichsrats.
 * Ein Klick springt zum betroffenen Gebiet oder in den passenden Bereich.
 */
import type { Advice } from '../../engine/advisor';
import { Icon } from '../ui/Icon';

export function AdvisorBar({
  advice,
  onPick
}: {
  advice: Advice[];
  onPick: (entry: Advice) => void;
}) {
  if (advice.length === 0) {
    return (
      <div className="advisor">
        <span className="hint chance">
          <Icon name="check" size={13} />
          Der Rat hat nichts einzuwenden
        </span>
      </div>
    );
  }

  return (
    <div className="advisor" aria-label="Hinweise des Reichsrats">
      {advice.map((entry) => (
        <button
          key={entry.id}
          type="button"
          className={`hint ${entry.severity === 'urgent' ? 'urgent' : entry.severity === 'chance' ? 'chance' : ''}`}
          onClick={() => onPick(entry)}
          title="Zum betroffenen Bereich springen"
        >
          <Icon
            name={entry.severity === 'urgent' ? 'warning' : entry.severity === 'chance' ? 'info' : 'action'}
            size={13}
          />
          {entry.text}
        </button>
      ))}
    </div>
  );
}

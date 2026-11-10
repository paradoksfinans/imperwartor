/**
 * Ereignisfenster.
 *
 * Jede Kategorie erhält ein eigenes gezeichnetes Emblem, und jede Antwort
 * zeigt ihre Folgen vorab - so bleibt die Entscheidung eine Entscheidung und
 * kein Ratespiel.
 */
import type { EventEffects, GameEventDefinition } from '../../models/types';
import { RESOURCE_LABELS } from '../../engine/army';
import { Window } from '../ui/Window';

/** Gezeichnetes Emblem je Kategorie. */
function EventEmblem({ category }: { category: GameEventDefinition['category'] }) {
  const ink = 'var(--text)';
  const brass = 'var(--accent)';

  const motif = () => {
    switch (category) {
      case 'military':
        return (
          <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
            <path d="M18 18L46 46M46 18L18 46" />
            <path d="M32 14l12 5v12c0 9-5 15-12 18-7-3-12-9-12-18V19l12-5z" stroke={brass} />
          </g>
        );
      case 'economy':
        return (
          <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
            <path d="M32 14v34M18 22h28" />
            <path d="M18 22l-6 12h12l-6-12zM46 22l-6 12h12l-6-12z" stroke={brass} />
            <path d="M24 50h16" />
          </g>
        );
      case 'politics':
        return (
          <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
            <circle cx="32" cy="26" r="11" stroke={brass} />
            <path d="M26 36l-4 16 10-5 10 5-4-16" />
            <path d="M28 26h8M32 21v10" />
          </g>
        );
      case 'nature':
        return (
          <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
            <circle cx="32" cy="24" r="8" stroke={brass} />
            <path d="M32 10v-4M32 42v4M18 24h-4M50 24h4M22 14l-3-3M42 14l3-3" stroke={brass} />
            <path d="M12 44q10-6 20 0t20 0M12 52q10-6 20 0t20 0" />
          </g>
        );
      case 'culture':
      default:
        return (
          <g fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round">
            <path d="M32 20v26M32 20c-5-4-11-5-18-4v26c7-1 13 0 18 4M32 20c5-4 11-5 18-4v26c-7-1-13 0-18 4" />
            <path d="M32 14l3-5 3 5-3 2-3-2z" stroke={brass} />
          </g>
        );
    }
  };

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <circle cx="32" cy="32" r="30" fill="none" stroke="var(--rule-strong)" strokeWidth="1" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="var(--rule)" strokeWidth="0.6" />
      {motif()}
    </svg>
  );
}

/** Folgen einer Antwort als lesbare Liste. */
function describeEffects(effects: EventEffects): string[] {
  const parts: string[] = [];
  const signed = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  if (effects.gold) parts.push(`${signed(effects.gold)} Gold`);
  if (effects.stability) parts.push(`${signed(effects.stability)} Zufriedenheit`);
  if (effects.population) parts.push(`${signed(effects.population)} Bevölkerung`);
  if (effects.army) parts.push(`${signed(effects.army)} Truppen`);
  if (effects.research) parts.push(`${signed(effects.research)} Forschung`);
  if (effects.politicalPower) parts.push(`${signed(effects.politicalPower)} Macht`);
  if (effects.prestige) parts.push(`${signed(effects.prestige)} Ansehen`);
  if (effects.warExhaustion) parts.push(`${signed(effects.warExhaustion)} Kriegsmüdigkeit`);
  if (effects.unrest) parts.push(`${signed(effects.unrest)} Unruhe`);
  if (effects.relations) parts.push(`${signed(effects.relations)} Beziehungen`);
  if (effects.resources) {
    for (const [key, amount] of Object.entries(effects.resources)) {
      if (amount) parts.push(`${signed(Number(amount))} ${RESOURCE_LABELS[key as keyof typeof RESOURCE_LABELS]}`);
    }
  }
  return parts;
}

export function EventWindow({
  definition,
  onChoose
}: {
  definition: GameEventDefinition;
  onChoose: (choiceIndex: number) => void;
}) {
  return (
    <Window title={definition.name} icon="scroll" blocking>
      <div className="row" style={{ gap: '0.9rem', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
        <EventEmblem category={definition.category} />
        <p className="lede" style={{ margin: 0 }}>
          {definition.description}
        </p>
      </div>

      <div className="section-title">Entscheidung</div>
      <div className="stack">
        {definition.choices.map((choice, index) => {
          const effects = describeEffects(choice.effects);
          return (
            <button
              key={choice.text}
              type="button"
              className="choice"
              style={{ borderLeftColor: 'var(--rule-strong)' }}
              onClick={() => onChoose(index)}
            >
              <span className="choice-title">{choice.text}</span>
              {effects.length > 0 ? (
                <span className="row tight" style={{ marginTop: '0.2rem' }}>
                  {effects.map((entry) => (
                    <span
                      className={`tag${entry.startsWith('-') ? ' war' : ''}`}
                      key={entry}
                    >
                      {entry}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="faint">keine unmittelbaren Folgen</span>
              )}
            </button>
          );
        })}
      </div>
    </Window>
  );
}

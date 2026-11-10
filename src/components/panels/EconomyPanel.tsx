/**
 * Wirtschaft: Steuern, Haushaltsschwerpunkte, Rohstoffe und Handel.
 */
import type { GameState } from '../../models/types';
import { RESOURCE_LABELS, RESOURCE_ORDER } from '../../engine/army';
import { calculateIncome, getResourceConsumption, getTradePartners } from '../../engine/economy';
import { MAX_TAX_RATE, MIN_TAX_RATE, getCountryTerritories } from '../../engine/rules';
import { formatNumber, formatPercent, formatSigned } from '../../utils/format';
import { Icon, RESOURCE_ICON } from '../ui/Icon';
import { Empty, KeyValue, Slider } from '../ui/Bits';
import { ShareBar } from '../ui/Charts';

const BUDGET_COLORS = { military: '#b65412', economy: '#a18222', research: '#336dc1' };

export function EconomyPanel({
  game,
  onSetTax,
  onSetBudget
}: {
  game: GameState;
  onSetTax: (value: number) => void;
  onSetBudget: (military: number, economy: number, research: number) => void;
}) {
  const country = game.countries[game.playerCountryId];
  if (!country) return null;

  const income = calculateIncome(game, country.id);
  const consumption = getResourceConsumption(game, country.id);
  const partners = getTradePartners(game, country.id);
  const territories = getCountryTerritories(game, country.id);

  /** Verschiebt einen Schwerpunkt und verteilt den Rest anteilig. */
  const setBudget = (key: 'military' | 'economy' | 'research', value: number) => {
    const others = (['military', 'economy', 'research'] as const).filter((entry) => entry !== key);
    const rest = Math.max(0, 100 - value);
    const previous = others.reduce((sum, entry) => sum + country.budget[entry], 0);
    const next = { ...country.budget, [key]: value };
    for (const entry of others) {
      next[entry] = previous > 0 ? Math.round((country.budget[entry] / previous) * rest) : Math.round(rest / 2);
    }
    onSetBudget(next.military, next.economy, next.research);
  };

  return (
    <div className="stack">
      {/* --- Steuern --- */}
      <div>
        <div className="section-title">Steuersatz {formatPercent(country.taxRate)}</div>
        <Slider
          value={Math.round(country.taxRate * 100)}
          min={MIN_TAX_RATE * 100}
          max={MAX_TAX_RATE * 100}
          onChange={(value) => onSetTax(value / 100)}
          label="Steuersatz"
        />
        <p className="faint" style={{ margin: 0 }}>
          Hohe Steuern füllen die Kasse sofort, senken aber die Zufriedenheit dauerhaft. Unter 25 %
          steigt sie langsam wieder.
        </p>
      </div>

      {/* --- Haushalt --- */}
      <div>
        <div className="section-title">Schwerpunkte</div>
        <ShareBar
          parts={[
            { label: 'Militär', value: country.budget.military, color: BUDGET_COLORS.military },
            { label: 'Wirtschaft', value: country.budget.economy, color: BUDGET_COLORS.economy },
            { label: 'Forschung', value: country.budget.research, color: BUDGET_COLORS.research }
          ]}
        />
        <div className="stack tight" style={{ marginTop: '0.5rem' }}>
          {(['military', 'economy', 'research'] as const).map((key) => (
            <div key={key}>
              <div className="row between">
                <span style={{ fontSize: '0.86rem' }}>
                  {key === 'military' ? 'Militär' : key === 'economy' ? 'Wirtschaft' : 'Forschung'}
                </span>
                <span className="faint">{country.budget[key]} %</span>
              </div>
              <Slider
                value={country.budget[key]}
                min={0}
                max={100}
                onChange={(value) => setBudget(key, value)}
                label={`Schwerpunkt ${key}`}
              />
            </div>
          ))}
        </div>
        <p className="faint" style={{ margin: '0.3rem 0 0' }}>
          Militär senkt die Unterhaltskosten der Armee nicht, sondern bestimmt ihre Versorgung.
          Forschung erhöht die Punkte je Runde, Wirtschaft die Einnahmen.
        </p>
      </div>

      {/* --- Bilanz --- */}
      <div>
        <div className="section-title">Bilanz</div>
        <KeyValue label="Steuern" value={formatNumber(income.taxes)} />
        <KeyValue label="Handel" value={formatNumber(income.trade)} />
        {income.vassalTribute > 0 ? (
          <KeyValue label="Tribut" value={formatNumber(income.vassalTribute)} />
        ) : null}
        <KeyValue label="Armee" value={`-${formatNumber(income.armyUpkeep)}`} tone="negative" />
        <KeyValue label="Gebäude" value={`-${formatNumber(income.buildingUpkeep)}`} tone="negative" />
        <KeyValue
          label={`Verwaltung (${territories.length} Gebiete)`}
          value={`-${formatNumber(income.administration)}`}
          tone="negative"
        />
        {income.blockadeLoss > 0 ? (
          <KeyValue label="Blockaden" value={`-${formatNumber(income.blockadeLoss)}`} tone="negative" />
        ) : null}
        <KeyValue
          label="Ergebnis"
          value={formatSigned(income.net)}
          tone={income.net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* --- Rohstoffe --- */}
      <div>
        <div className="section-title">Rohstoffe</div>
        <table className="ledger">
          <thead>
            <tr>
              <th>Rohstoff</th>
              <th>Bestand</th>
              <th>Zufluss</th>
              <th>Bedarf</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_ORDER.map((key) => {
              const net = income.resources[key] - consumption[key];
              return (
                <tr key={key}>
                  <td>
                    <span className="row tight">
                      <Icon name={RESOURCE_ICON[key]} size={14} />
                      {RESOURCE_LABELS[key]}
                    </span>
                  </td>
                  <td>{Math.round(country.resources[key])}</td>
                  <td>{Math.round(income.resources[key])}</td>
                  <td className={net < 0 ? 'negative' : undefined}>{Math.round(consumption[key])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="faint" style={{ margin: '0.3rem 0 0' }}>
          Fehlen Rohstoffe, können Einheiten nicht ausgehoben und Gebäude nicht errichtet werden.
        </p>
      </div>

      {/* --- Handel --- */}
      <div>
        <div className="section-title">Handelspartner</div>
        {partners.length === 0 ? (
          <Empty text="Noch keine Handelsabkommen. Sie bringen beiden Seiten Einnahmen." icon="market" />
        ) : (
          <div className="row tight">
            {partners.map((id) => (
              <span className="tag" key={id}>
                <Icon name="market" size={12} />
                {game.countries[id]?.name ?? id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

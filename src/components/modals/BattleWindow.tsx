/**
 * Kampfbericht.
 *
 * Zeigt das Kräfteverhältnis, den Verlauf der Gefechtsrunden, die Verluste
 * nach Gattungen und jeden einzelnen Faktor der Berechnung - damit jedes
 * Ergebnis nachvollziehbar bleibt.
 */
import type { Army, BattleReport } from '../../models/types';
import { getUnit } from '../../services/contentService';
import { UNIT_ORDER, armySize } from '../../engine/army';
import { TERRAIN_INFO } from '../../engine/rules';
import { formatNumber } from '../../utils/format';
import { Icon, UNIT_ICON } from '../ui/Icon';
import { Window } from '../ui/Window';

/** Setzt Zahlen in den Faktorangaben auf deutsche Schreibweise. */
function germanNumbers(value: string): string {
  return value.replace(/(\d)\.(\d)/g, '$1,$2').replace(/\bx(?=\d)/g, '×');
}

export function BattleWindow({
  report,
  onClose
}: {
  report: BattleReport;
  onClose: () => void;
}) {
  const total = report.attackPower + report.defensePower;
  const attackerShare = total > 0 ? (report.attackPower / total) * 100 : 50;
  const won = report.winner === 'attacker';

  const maxRoundLoss = Math.max(
    1,
    ...report.rounds.map((round) => Math.max(round.attackerLosses, round.defenderLosses))
  );

  return (
    <Window
      title={`Schlacht um ${report.territoryName}`}
      icon="sword"
      onClose={onClose}
      footer={
        <button type="button" className="primary" onClick={onClose}>
          Bericht schließen
        </button>
      }
    >
      <p className={won ? 'positive' : 'negative'} style={{ fontFamily: 'Spectral, serif', fontSize: '1.1rem' }}>
        {won
          ? `${report.attackerName} nimmt ${report.territoryName} ein.`
          : `${report.defenderName} hält ${report.territoryName}.`}
      </p>

      {/* --- Kräfteverhältnis --- */}
      <div className="scales">
        <div className="side">
          <div className="faint">{report.attackerName}</div>
          <div className="power">{formatNumber(report.attackPower)}</div>
        </div>
        <Icon name="shield" size={18} />
        <div className="side right">
          <div className="faint">{report.defenderName}</div>
          <div className="power">{formatNumber(report.defensePower)}</div>
        </div>
      </div>
      <div className="tug" aria-label="Kräfteverhältnis">
        <i style={{ width: `${attackerShare}%` }} />
        <i />
      </div>
      <p className="faint" style={{ marginTop: '0.3rem' }}>
        Gelände: {TERRAIN_INFO[report.terrain].name}
        {report.generalName ? ` · Feldherr ${report.generalName}` : ''}
        {report.generalLost ? ' · der Feldherr fiel in der Schlacht' : ''}
      </p>

      {/* --- Verluste nach Gattungen --- */}
      <div className="section-title">Verluste</div>
      <table className="ledger">
        <thead>
          <tr>
            <th>Gattung</th>
            <th>Angreifer</th>
            <th>Verlust</th>
            <th>Verteidiger</th>
            <th>Verlust</th>
          </tr>
        </thead>
        <tbody>
          {UNIT_ORDER.filter(
            (unitId) => report.attackingArmy[unitId] > 0 || report.defendingArmy[unitId] > 0
          ).map((unitId) => (
            <tr key={unitId}>
              <td>
                <span className="row tight">
                  <Icon name={UNIT_ICON[unitId]} size={14} />
                  {getUnit(unitId).name}
                </span>
              </td>
              <td>{report.attackingArmy[unitId]}</td>
              <td className="negative">
                {report.attackerLosses[unitId] > 0 ? `-${report.attackerLosses[unitId]}` : '0'}
              </td>
              <td>{report.defendingArmy[unitId]}</td>
              <td className="negative">
                {report.defenderLosses[unitId] > 0 ? `-${report.defenderLosses[unitId]}` : '0'}
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Gesamt</strong>
            </td>
            <td>{formatNumber(armySize(report.attackingArmy))}</td>
            <td className="negative">-{formatNumber(armySize(report.attackerLosses))}</td>
            <td>{formatNumber(armySize(report.defendingArmy))}</td>
            <td className="negative">-{formatNumber(armySize(report.defenderLosses))}</td>
          </tr>
        </tbody>
      </table>

      <div className="row between" style={{ marginTop: '0.4rem' }}>
        <span className="faint">
          verbleibend: {formatNumber(armySize(report.remainingAttackers))} Angreifer
        </span>
        <span className="faint">
          {formatNumber(armySize(report.remainingDefenders))} Verteidiger
        </span>
      </div>

      {/* --- Verlauf der Gefechtsrunden --- */}
      {report.rounds.length > 0 ? (
        <>
          <div className="section-title">Verlauf</div>
          <svg
            viewBox={`0 0 ${Math.max(120, report.rounds.length * 46)} 90`}
            width={Math.max(120, report.rounds.length * 46)}
            height="90"
            role="img"
            aria-label="Verluste je Gefechtsrunde"
            style={{ maxWidth: '100%' }}
          >
            {report.rounds.map((round, index) => {
              const x = index * 46 + 10;
              const attackerHeight = (round.attackerLosses / maxRoundLoss) * 34;
              const defenderHeight = (round.defenderLosses / maxRoundLoss) * 34;
              return (
                <g key={round.round}>
                  <rect
                    x={x}
                    y={40 - attackerHeight}
                    width="14"
                    height={Math.max(1, attackerHeight)}
                    rx="2"
                    fill="#b5422f"
                  />
                  <rect x={x} y={44} width="14" height={Math.max(1, defenderHeight)} rx="2" fill="#4e9a8f" />
                  <text x={x + 7} y={86} fontSize="9" textAnchor="middle" fill="var(--text-faint)">
                    {round.round}
                  </text>
                </g>
              );
            })}
            <line x1="0" y1="42" x2="100%" y2="42" stroke="var(--rule)" strokeWidth="1" />
          </svg>
          <div className="row tight faint" style={{ fontSize: '0.78rem' }}>
            <span className="row tight">
              <i style={{ width: '0.6rem', height: '0.6rem', background: '#b5422f', display: 'inline-block' }} />
              Verluste des Angreifers
            </span>
            <span className="row tight">
              <i style={{ width: '0.6rem', height: '0.6rem', background: '#4e9a8f', display: 'inline-block' }} />
              Verluste des Verteidigers
            </span>
          </div>
        </>
      ) : null}

      {/* --- Faktoren --- */}
      <div className="section-title">Berechnung</div>
      <div className="modifiers">
        {report.modifiers.map((modifier) => (
          <div className="kv" key={modifier.label}>
            <span>{modifier.label}</span>
            <span
              className={
                modifier.positiveFor === 'attacker'
                  ? 'negative'
                  : modifier.positiveFor === 'defender'
                    ? 'positive'
                    : undefined
              }
            >
              {germanNumbers(modifier.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="faint" style={{ marginTop: '0.4rem' }}>
        Grün hilft dem Verteidiger, rot dem Angreifer. Der Zufall wirkt in beide Richtungen,
        entscheidet aber nie allein.
      </p>
    </Window>
  );
}

/** Kurzfassung einer Aufstellung für Listen. */
export function armyLabel(army: Army): string {
  return UNIT_ORDER.filter((unitId) => army[unitId] > 0)
    .map((unitId) => `${army[unitId]} ${getUnit(unitId).short}`)
    .join(', ');
}

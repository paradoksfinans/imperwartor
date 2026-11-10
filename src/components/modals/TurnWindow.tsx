/**
 * Rundenbericht: was in der vergangenen Runde geschehen ist.
 */
import type { TurnReport } from '../../models/types';
import { formatNumber, formatSigned } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { KeyValue } from '../ui/Bits';
import { Window } from '../ui/Window';

export function TurnWindow({
  report,
  turnLabel,
  onClose
}: {
  report: TurnReport;
  turnLabel: string;
  onClose: () => void;
}) {
  return (
    <Window
      title={`${turnLabel} ${report.year}`}
      icon="chronicle"
      onClose={onClose}
      footer={
        <button type="button" className="primary" onClick={onClose}>
          Weiter regieren
        </button>
      }
    >
      <div className="grid two">
        <KeyValue
          label="Kasse"
          value={formatSigned(report.goldChange)}
          tone={report.goldChange >= 0 ? 'positive' : 'negative'}
        />
        <KeyValue label="Forschung" value={`+${formatNumber(report.researchGained)}`} />
        <KeyValue label="Politische Macht" value={`+${formatNumber(report.politicalPowerGained)}`} />
        <KeyValue
          label="Schlachten"
          value={`${report.battlesWon} gewonnen · ${report.battlesLost} verloren`}
        />
        <KeyValue
          label="Gebiete"
          value={`${report.territoriesGained > 0 ? `+${report.territoriesGained}` : '0'} / ${
            report.territoriesLost > 0 ? `-${report.territoriesLost}` : '0'
          }`}
          tone={
            report.territoriesGained > report.territoriesLost
              ? 'positive'
              : report.territoriesLost > report.territoriesGained
                ? 'negative'
                : undefined
          }
        />
      </div>

      {report.warnings.length > 0 ? (
        <>
          <div className="section-title">Der Rat warnt</div>
          <div className="stack tight">
            {report.warnings.map((warning) => (
              <div className="row tight" key={warning} style={{ alignItems: 'flex-start' }}>
                <Icon name="warning" size={15} />
                <span style={{ fontSize: '0.88rem' }} className="negative">
                  {warning}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {report.lines.length > 0 ? (
        <>
          <div className="section-title">Meldungen</div>
          <div className="chronicle">
            {report.lines.map((line, index) => (
              <div
                key={`${line.turn}-${index}`}
                className={`chronicle-entry ${line.type}${line.important ? ' important' : ''}`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="faint">In dieser Runde ist nichts Bemerkenswertes geschehen.</p>
      )}
    </Window>
  );
}

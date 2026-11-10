/**
 * Chronik: Rangliste aller Mächte, Verlaufsdiagramme und das Ereignisbuch.
 */
import { useState } from 'react';
import type { GameState, LogType } from '../../models/types';
import {
  getCountryArmySize,
  getCountryPopulation,
  getCountryScore,
  getCountryTerritories
} from '../../engine/rules';
import { formatNumber } from '../../utils/format';
import { Empty, Segmented } from '../ui/Bits';
import { HistoryChart, RankBars, type Series } from '../ui/Charts';
import { landFill, type ThemeId } from '../map/mapVisuals';

type Measure = 'score' | 'territories' | 'army' | 'gold';

const MEASURES: { id: Measure; label: string }[] = [
  { id: 'score', label: 'Punkte' },
  { id: 'territories', label: 'Gebiete' },
  { id: 'army', label: 'Truppen' },
  { id: 'gold', label: 'Gold' }
];

/** Kuerzt lange Staatsnamen fuer enge Tabellen. */
function shortName(name: string): string {
  if (name.length <= 15) return name;
  const parts = name.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

const LOG_LABEL: Partial<Record<LogType, string>> = {
  war: 'Krieg',
  peace: 'Frieden',
  battle: 'Schlacht',
  event: 'Ereignis',
  diplomacy: 'Diplomatie',
  research: 'Forschung',
  economy: 'Wirtschaft',
  espionage: 'Spionage',
  project: 'Projekt',
  rebellion: 'Aufstand',
  system: 'Reich'
};

export function ChroniclePanel({ game, theme }: { game: GameState; theme: ThemeId }) {
  const [measure, setMeasure] = useState<Measure>('score');
  const [onlyImportant, setOnlyImportant] = useState(false);

  const living = game.countryOrder
    .map((id) => game.countries[id])
    .filter((country) => country && country.isAlive);

  const rows = living
    .map((country) => ({
      id: country.id,
      name: country.name,
      color: landFill(country.color, theme),
      score: getCountryScore(game, country.id),
      territories: getCountryTerritories(game, country.id).length,
      army: getCountryArmySize(game, country.id),
      population: getCountryPopulation(game, country.id),
      technologies: country.technologies.length,
      mine: country.id === game.playerCountryId
    }))
    .sort((a, b) => b.score - a.score);

  const series: Series[] = living.map((country) => ({
    id: country.id,
    label: country.name.split(' ').pop() ?? country.name,
    color: landFill(country.color, theme),
    values: game.history.map((snapshot) => {
      const entry = snapshot.entries[country.id];
      if (!entry) return 0;
      if (measure === 'territories') return entry.territories;
      if (measure === 'army') return entry.army;
      if (measure === 'gold') return entry.gold;
      return entry.score;
    })
  }));

  const labels = game.history.map((snapshot) => snapshot.turn);
  const log = onlyImportant ? game.log.filter((entry) => entry.important) : game.log;

  return (
    <div className="stack">
      <div>
        <div className="section-title">Rangliste</div>
        <table className="ledger">
          <thead>
            <tr>
              <th>Macht</th>
              <th>Geb.</th>
              <th>Truppen</th>
              <th>Tech</th>
              <th>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.mine ? 'me' : undefined}>
                <td>
                  <span className="row tight">
                    <i
                      style={{
                        width: '0.6rem',
                        height: '0.6rem',
                        background: row.color,
                        borderRadius: '2px',
                        display: 'inline-block'
                      }}
                    />
                    {shortName(row.name)}
                  </span>
                </td>
                <td>{row.territories}</td>
                <td>{formatNumber(row.army)}</td>
                <td>{row.technologies}</td>
                <td>{formatNumber(row.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="section-title">Verlauf</div>
        <Segmented
          options={MEASURES}
          value={measure}
          onChange={setMeasure}
          ariaLabel="Grösse des Verlaufs"
        />
        <div style={{ marginTop: '0.5rem' }}>
          <HistoryChart
            series={series}
            labels={labels}
            highlightId={game.playerCountryId}
            height={190}
          />
        </div>
      </div>

      <div>
        <div className="section-title">Vergleich</div>
        <RankBars
          rows={rows.map((row) => ({
            label: row.name,
            value: measure === 'territories' ? row.territories : measure === 'army' ? row.army : row.score,
            color: row.color,
            mine: row.mine
          }))}
        />
      </div>

      <div>
        <div className="row between">
          <div className="section-title" style={{ flex: 1 }}>
            Ereignisbuch
          </div>
          <button
            type="button"
            className="small quiet"
            aria-pressed={onlyImportant}
            onClick={() => setOnlyImportant((value) => !value)}
          >
            {onlyImportant ? 'alle zeigen' : 'nur wichtige'}
          </button>
        </div>
        {log.length === 0 ? (
          <Empty text="Noch nichts geschehen." icon="chronicle" />
        ) : (
          <div className="chronicle">
            {log.slice(0, 60).map((entry, index) => (
              <div
                key={`${entry.turn}-${index}`}
                className={`chronicle-entry ${entry.type}${entry.important ? ' important' : ''}`}
              >
                <span className="chronicle-turn">
                  R{entry.turn} {LOG_LABEL[entry.type] ?? ''}
                </span>
                {entry.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Abschluss einer Partie: Urteil, Bilanz des Reiches und die Karte zum Teilen.
 */
import { useState } from 'react';
import type { GameState } from '../../models/types';
import { getCountryScore, getCountryTerritories } from '../../engine/rules';
import { buildSummaryText, downloadShareCard } from '../../services/shareCard';
import { formatNumber } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { KeyValue } from '../ui/Bits';
import { Window } from '../ui/Window';

export function GameOverWindow({
  game,
  onBackToMenu,
  onKeepPlaying
}: {
  game: GameState;
  onBackToMenu: () => void;
  onKeepPlaying: () => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const country = game.countries[game.playerCountryId];
  const won = game.status === 'victory';

  const ranking = game.countryOrder
    .filter((id) => game.countries[id]?.isAlive)
    .map((id) => ({ id, name: game.countries[id].name, score: getCountryScore(game, id) }))
    .sort((a, b) => b.score - a.score);

  const share = async () => {
    const ok = await downloadShareCard(game);
    setNote(ok ? 'Die Abschlusskarte liegt in deinen Downloads.' : 'Das Bild konnte nicht erzeugt werden.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(game));
      setNote('Zusammenfassung kopiert.');
    } catch {
      setNote('Die Zwischenablage ist nicht verfügbar.');
    }
  };

  return (
    <Window
      title={won ? 'Sieg' : 'Niederlage'}
      icon={won ? 'trophy' : 'shield'}
      blocking
      footer={
        <>
          <button type="button" onClick={onKeepPlaying}>
            Weiterspielen
          </button>
          <button type="button" className="primary" onClick={onBackToMenu}>
            Zurück zum Hauptmenü
          </button>
        </>
      }
    >
      <div className="cartouche" style={{ marginBottom: '0.9rem' }}>
        <h2 style={{ marginBottom: '0.2rem' }}>{country?.name}</h2>
        <p className="lede" style={{ margin: 0 }}>
          {game.statusMessage}
        </p>
      </div>

      <div className="grid two">
        <KeyValue label="Dauer" value={`${game.turn} Runden bis ${game.year}`} />
        <KeyValue label="Gebiete" value={getCountryTerritories(game, game.playerCountryId).length} />
        <KeyValue label="Punkte" value={formatNumber(getCountryScore(game, game.playerCountryId))} />
        <KeyValue label="Schlachten gewonnen" value={game.stats.battlesWon} />
        <KeyValue label="Schlachten verloren" value={game.stats.battlesLost} />
        <KeyValue label="Gebiete erobert" value={game.stats.territoriesConquered} />
        <KeyValue label="Kriege erklärt" value={game.stats.warsDeclared} />
        <KeyValue label="Friedensschlüsse" value={game.stats.peaceDeals} />
        <KeyValue label="Verlorene Einheiten" value={formatNumber(game.stats.unitsLost)} />
        <KeyValue label="Gold erwirtschaftet" value={formatNumber(game.stats.goldEarned)} />
      </div>

      <div className="section-title">Endstand</div>
      <table className="ledger">
        <thead>
          <tr>
            <th>Macht</th>
            <th>Punkte</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((entry) => (
            <tr key={entry.id} className={entry.id === game.playerCountryId ? 'me' : undefined}>
              <td>{entry.name}</td>
              <td>{formatNumber(entry.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-title">Teilen</div>
      <div className="row">
        <button type="button" onClick={share}>
          <Icon name="share" size={15} />
          Abschlusskarte als Bild
        </button>
        <button type="button" onClick={copy}>
          <Icon name="archive" size={15} />
          Zusammenfassung kopieren
        </button>
      </div>
      {note ? (
        <p className="faint" style={{ marginTop: '0.4rem' }}>
          {note}
        </p>
      ) : null}
    </Window>
  );
}

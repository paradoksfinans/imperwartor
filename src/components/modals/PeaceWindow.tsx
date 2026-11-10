/**
 * Friedensverhandlung.
 *
 * Der Sieger stellt Forderungen, deren Gewicht die Gegenseite abwägt.
 * Je besser der Krieg lief und je erschöpfter der Gegner ist, desto mehr
 * lässt sich durchsetzen.
 */
import { useMemo, useState } from 'react';
import type { GameState } from '../../models/types';
import { getAcceptanceLimit, getPeaceDemands, getWarScoreFor } from '../../engine/diplomacy';
import { formatNumber } from '../../utils/format';
import { clamp } from '../../utils/helpers';
import { Bar, Empty } from '../ui/Bits';
import { Window } from '../ui/Window';

interface PeaceWindowProps {
  game: GameState;
  warId: string;
  onConfirm: (warId: string, winnerId: string, loserId: string, demands: string[]) => void;
  onClose: () => void;
}

export function PeaceWindow({ game, warId, onConfirm, onClose }: PeaceWindowProps) {
  const [picked, setPicked] = useState<string[]>([]);

  const war = game.wars.find((entry) => entry.id === warId);
  const player = game.countries[game.playerCountryId];

  const opponentId = useMemo(() => {
    if (!war || !player) return null;
    const side = war.attackers.includes(player.id) ? war.defenders : war.attackers;
    return side.find((id) => game.countries[id]?.isAlive) ?? side[0] ?? null;
  }, [war, player, game.countries]);

  if (!war || !player || !opponentId) {
    return (
      <Window title="Friedensverhandlung" icon="peace" onClose={onClose}>
        <Empty text="Dieser Krieg ist bereits beendet." icon="peace" />
      </Window>
    );
  }

  const opponent = game.countries[opponentId];
  const score = getWarScoreFor(war, player.id);
  const winning = score >= 0;

  const winnerId = winning ? player.id : opponentId;
  const loserId = winning ? opponentId : player.id;

  const demands = winning ? getPeaceDemands(game, war, winnerId, loserId) : [];
  const limit = getAcceptanceLimit(game, war, loserId);
  const cost = demands
    .filter((demand) => picked.includes(demand.id))
    .reduce((sum, demand) => sum + demand.cost, 0);
  const accepted = cost <= limit;

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );

  return (
    <Window
      title={`Frieden mit ${opponent?.name ?? 'dem Gegner'}`}
      icon="peace"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose}>
            Krieg fortsetzen
          </button>
          <button
            type="button"
            className="primary"
            disabled={winning && picked.length > 0 && !accepted}
            onClick={() => onConfirm(warId, winnerId, loserId, winning ? picked : [])}
          >
            {winning
              ? picked.length === 0
                ? 'Weißen Frieden schließen'
                : 'Forderungen stellen'
              : 'Weißen Frieden anbieten'}
          </button>
        </>
      }
    >
      <div className="row between">
        <span className="faint">Kriegsfortschritt</span>
        <strong className={score >= 0 ? 'positive' : 'negative'}>
          {score > 0 ? `+${Math.round(score)}` : Math.round(score)}
        </strong>
      </div>
      <Bar
        value={score + 100}
        max={200}
        color={score >= 0 ? 'var(--positive)' : 'var(--negative)'}
      />

      <p className="faint" style={{ marginTop: '0.5rem' }}>
        {winning
          ? `${opponent?.name} ist bereit, Forderungen im Gewicht von etwa ${Math.round(limit)} zu akzeptieren. Mehr führt zum Abbruch der Verhandlung.`
          : `Der Krieg läuft gegen dich. Ein weißer Frieden gibt alle Eroberungen zurück - ${opponent?.name} nimmt ihn an, wenn die eigene Lage nicht deutlich besser ist.`}
      </p>

      {winning ? (
        <>
          <div className="section-title">Forderungen</div>
          {demands.length === 0 ? (
            <Empty text="Noch gibt es nichts zu fordern - erobere zuerst Gebiete." icon="target" />
          ) : (
            <div className="stack tight ruled">
              {demands.map((demand) => {
                const active = picked.includes(demand.id);
                return (
                  <label
                    key={demand.id}
                    className="row between"
                    style={{ gap: '0.5rem', cursor: 'pointer' }}
                  >
                    <span className="row tight" style={{ minWidth: 0 }}>
                      <input type="checkbox" checked={active} onChange={() => toggle(demand.id)} />
                      <span>
                        <span style={{ fontSize: '0.9rem' }}>{demand.label}</span>
                        <span className="faint" style={{ display: 'block' }}>
                          {demand.description}
                        </span>
                      </span>
                    </span>
                    <span className="faint">Gewicht {demand.cost}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '0.6rem' }}>
            <div className="row between">
              <span className="faint">Gewicht der Forderungen</span>
              <span className={accepted ? 'positive' : 'negative'}>
                {formatNumber(cost)} von {formatNumber(limit)}
              </span>
            </div>
            <Bar
              value={clamp(cost, 0, Math.max(limit, cost))}
              max={Math.max(limit, cost, 1)}
              color={accepted ? 'var(--positive)' : 'var(--negative)'}
            />
            {!accepted ? (
              <p className="negative" style={{ margin: '0.3rem 0 0', fontSize: '0.86rem' }}>
                So weit geht {opponent?.name} nicht. Nimm eine Forderung zurück oder führe den
                Krieg weiter.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </Window>
  );
}

/**
 * Modale Fenster: Kampfbericht, Ereignis, Friedensangebot, Spielende, Hilfe.
 *
 * Alle liefern reines HTML. Der Hauptbildschirm hängt es in eine Huelle und
 * wertet Klicks über Datenattribute aus.
 */

import type { BattleReport, GameState, PeaceOffer, PendingEvent } from '../core/types';
import { TERRAIN, UNITS, UNIT_ORDER } from '../core/rules';
import { formatNumber, jahrText } from '../core/format';
import { esc, zeile } from './dom';
import { heeresRing, kraftWaage } from './charts';
import { flaggeSvg } from './flaggen';
import { rangliste } from '../core/victory';
import { GATTUNG_FARBEN } from './panels';

/** Wandelt eine Aufstellung in die Eingabe des Ringdiagramms. */
function ringTeile(r: Record<string, number | undefined>) {
  return UNIT_ORDER.filter((u) => (r[u] ?? 0) > 0)
    .map((u) => ({ name: UNITS[u].name, wert: r[u] as number, farbe: GATTUNG_FARBEN[u] }));
}

function truppenListe(r: Record<string, number | undefined>): string {
  const teile = UNIT_ORDER.filter((u) => (r[u] ?? 0) > 0)
    .map((u) => `<span class="truppen-chip"><b>${UNITS[u].kurz}</b>${r[u]}</span>`);
  return teile.length ? `<div class="truppen-reihe">${teile.join('')}</div>`
    : '<span class="schwach">—</span>';
}

/* ------------------------------------------------------------------ */
/* Kampfbericht                                                        */
/* ------------------------------------------------------------------ */

export function kampfberichtModal(s: GameState, b: BattleReport): string {
  const angreifer = s.countries[b.attackerId];
  const verteidiger = b.defenderId ? s.countries[b.defenderId] : null;

  const rechnung = b.factors.map((f) => `
    <div class="rechnung-zeile">
      <span>${esc(f.label)}</span>
      <span class="zahl angriff">${f.istFaktor ? `x${f.attacker.toFixed(2)}` : formatNumber(f.attacker)}</span>
      <span class="zahl abwehr">${f.istFaktor ? `x${f.defender.toFixed(2)}` : formatNumber(f.defender)}</span>
    </div>`).join('');

  const ergebnisText = b.siegeStarted
    ? 'Die Mauern halten – eine Belagerung beginnt'
    : b.attackerWon ? 'Der Angreifer setzt sich durch' : 'Der Verteidiger hält das Feld';

  return `
    <div class="modal gross">
      <div class="modal-kopf">
        <div class="block-titel">Kampfbericht &middot; Runde ${b.turn}</div>
        <h2>${esc(b.provinceName)}</h2>
        <p class="leise-text">
          ${esc(b.attackerName)} greift ${esc(b.defenderName)} an
          &middot; ${esc(TERRAIN[b.terrain].name)}
          ${b.generalName ? ` &middot; unter ${esc(b.generalName)}` : ''}
        </p>
      </div>

      <div class="kampf-gegenüber">
        <div class="kampf-seite">
          ${angreifer ? flaggeSvg(angreifer.flag, angreifer.color, 44, angreifer.emblem) : ''}
          <div class="block-titel">Angriff</div>
          ${heeresRing(ringTeile(b.attackerRegiments), 86)}
          ${truppenListe(b.attackerRegiments)}
        </div>
        <div class="kampf-mitte">
          ${kraftWaage(b.attackPower, b.defensePower)}
          <div class="kampf-ergebnis ${b.attackerWon ? 'gut' : 'schlecht'}">${esc(ergebnisText)}</div>
        </div>
        <div class="kampf-seite">
          ${verteidiger ? flaggeSvg(verteidiger.flag, verteidiger.color, 44, verteidiger.emblem)
    : '<span class="wappen-leer">—</span>'}
          <div class="block-titel">Abwehr</div>
          ${heeresRing(ringTeile(b.defenderRegiments), 86)}
          ${truppenListe(b.defenderRegiments)}
        </div>
      </div>

      <div class="karte-block">
        <div class="block-titel">Die Rechnung</div>
        <div class="rechnung">
          <div class="rechnung-zeile kopf">
            <span>Faktor</span><span class="zahl">Angriff</span><span class="zahl">Abwehr</span>
          </div>
          ${rechnung}
          <div class="rechnung-zeile summe">
            <span>Kampfkraft</span>
            <span class="zahl angriff">${b.attackPower.toFixed(0)}</span>
            <span class="zahl abwehr">${b.defensePower.toFixed(0)}</span>
          </div>
        </div>
      </div>

      <div class="karte-block">
        <div class="block-titel">Verluste</div>
        <div class="verlust-paar">
          <div><span class="bez">Angreifer</span>${truppenListe(b.attackerLosses)}</div>
          <div><span class="bez">Verteidiger</span>${truppenListe(b.defenderLosses)}</div>
        </div>
        ${b.retreated > 0
    ? zeile('Abgesetzt', `${formatNumber(b.retreated)} Einheiten entkamen`) : ''}
        ${zeile('Gebiet', b.captured ? 'erobert' : b.siegeStarted ? 'belagert' : 'gehalten',
    b.captured ? 'gut' : '')}
      </div>

      <p class="leise-text">${esc(b.note)}</p>
      <div class="modal-fuß">
        <button class="haupt" data-modal-schliessen>Weiter</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Ereignis                                                            */
/* ------------------------------------------------------------------ */

const WIRKUNG_NAMEN: Record<string, string> = {
  gold: 'Gold', stability: 'Stabilität', unrest: 'Unruhe',
  politicalPower: 'Einfluss', populationPct: 'Bevölkerung %',
  armyPct: 'Heer %', researchPoints: 'Forschung', relationsAll: 'Beziehungen',
  warExhaustion: 'Kriegsmüdigkeit', manpower: 'Reserve',
};

export function ereignisModal(e: PendingEvent): string {
  const wahlen = e.choices.map((c, i) => {
    const wirkungen = Object.entries(c.effects)
      .filter(([, v]) => typeof v === 'number' && v !== 0)
      .map(([k, v]) => {
        const gut = (k === 'unrest' || k === 'warExhaustion') ? (v as number) < 0 : (v as number) > 0;
        return `<span class="wirkung ${gut ? 'gut' : 'schlecht'}">
          ${esc(WIRKUNG_NAMEN[k] ?? k)} ${(v as number) > 0 ? '+' : ''}${v}</span>`;
      }).join('');
    return `<button class="wahl ereignis-wahl" data-ereignis-wahl="${i}">
      <span class="ereignis-text">${esc(c.text)}</span>
      <span class="wirkungen">${wirkungen || '<span class="schwach">keine unmittelbare Wirkung</span>'}</span>
    </button>`;
  }).join('');

  return `
    <div class="modal">
      <div class="modal-kopf mittig">
        <div class="ereignis-zeichen">${esc(e.icon)}</div>
        <div class="block-titel">Ereignis</div>
        <h2>${esc(e.name)}</h2>
      </div>
      <p class="lede">${esc(e.description)}</p>
      <div class="wahl-liste">${wahlen}</div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Friedensangebot                                                     */
/* ------------------------------------------------------------------ */

export function friedensModal(s: GameState, o: PeaceOffer): string {
  const von = s.countries[o.fromId];
  const gebiete = o.cededProvinces.map((id) => s.provinces[id]?.name).filter(Boolean);

  return `
    <div class="modal">
      <div class="modal-kopf">
        <div class="block-titel">Diplomatische Note</div>
        <h2>Friedensangebot</h2>
        <p class="leise-text">von ${esc(von?.name ?? '?')}</p>
      </div>
      <p class="lede">${esc(o.message)}</p>
      ${gebiete.length ? `<div class="karte-block">
        <div class="block-titel">Gebiete wechseln den Besitzer</div>
        ${gebiete.map((n) => `<div class="zeile"><span class="bez">${esc(n!)}</span></div>`).join('')}
      </div>` : ''}
      ${o.reparations > 0 ? zeile('Reparationen', formatNumber(o.reparations)) : ''}
      ${o.vassalize ? '<p class="gefahr-text">Dieses Angebot macht dich zum Vasallen.</p>' : ''}
      <div class="modal-fuß">
        <button class="ghost" data-frieden="nein">Ablehnen</button>
        <button class="haupt" data-frieden="ja">Annehmen</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Spielende                                                           */
/* ------------------------------------------------------------------ */

export function spielendeModal(s: GameState): string {
  const gewonnen = s.status === 'victory';
  const c = s.countries[s.playerCountryId];
  const rang = rangliste(s);
  const platz = rang.findIndex((r) => r.id === s.playerCountryId) + 1;
  const schlachten = s.battleReports.filter((b) => b.attackerId === s.playerCountryId);
  const siege = schlachten.filter((b) => b.attackerWon).length;

  /* Teilbares Ergebnis.

     Bewusst reiner Text mit Blockzeichen statt eines Bildes: So laesst es
     sich in jede Nachricht einfuegen und bleibt ueberall lesbar - auch dort,
     wo Bilder nicht durchgehen. Die Kurve zeigt das Wachstum des Reiches
     ueber die ganze Partie; sie macht aus einer Zahl eine Geschichte.
     Der Startwert am Ende erlaubt anderen, dieselbe Ausgangslage zu
     spielen und das Ergebnis zu vergleichen. */
  const verlauf = s.history
    .filter((h) => h.countryId === s.playerCountryId)
    .map((h) => h.provinces);
  const kurve = (werte: number[], breite = 14): string => {
    if (werte.length < 2) return '';
    const stufen = '▁▂▃▄▅▆▇█';
    // Auf eine feste Breite eindampfen, damit die Zeile nicht umbricht.
    const schritt = werte.length / breite;
    const punkte: number[] = [];
    for (let i = 0; i < breite; i++) {
      punkte.push(werte[Math.min(werte.length - 1, Math.floor(i * schritt))]);
    }
    const min = Math.min(...punkte);
    const max = Math.max(...punkte);
    const spanne = Math.max(1, max - min);
    return punkte
      .map((v) => stufen[Math.min(7, Math.floor(((v - min) / spanne) * 7.99))])
      .join('');
  };

  const gebieteJetzt = rang[platz - 1]?.provinces ?? 0;
  const gebieteStart = verlauf.length ? verlauf[0] : gebieteJetzt;

  const zusammenfassung = [
    `EMPIRE TACTICS — ${s.scenarioName}`,
    `${c.name} · ${gewonnen ? 'Sieg' : 'Niederlage'} in Runde ${s.turn} (${jahrText(s.year)})`,
    '',
    verlauf.length > 2 ? `Gebiete ${kurve(verlauf)}  ${gebieteStart} → ${gebieteJetzt}` : `Gebiete ${gebieteJetzt}`,
    `Platz ${platz}/${rang.length} · ${siege}/${schlachten.length} Schlachten · ★ ${s.achievements.length}`,
    '',
    `Gleiche Ausgangslage: ${s.scenarioId} #${s.seed}`,
  ].join('\n');

  return `
    <div class="modal gross">
      <div class="modal-kopf mittig">
        ${flaggeSvg(c.flag, c.color, 84, c.emblem)}
        <div class="block-titel">Runde ${s.turn} &middot; ${esc(jahrText(s.year))}</div>
        <h2 class="${gewonnen ? 'sieg' : 'niederlage'}">${gewonnen ? 'Sieg' : 'Niederlage'}</h2>
      </div>
      <p class="lede mittig">${esc(s.statusMessage)}</p>
      <div class="bilanz-gitter">
        <div class="bilanz-feld"><b>${platz}</b><span>Platz von ${rang.length}</span></div>
        <div class="bilanz-feld"><b>${rang[platz - 1]?.provinces ?? 0}</b><span>Gebiete</span></div>
        <div class="bilanz-feld"><b>${siege}/${schlachten.length}</b><span>Schlachten</span></div>
        <div class="bilanz-feld"><b>${s.achievements.length}</b><span>Erfolge</span></div>
      </div>
      ${s.achievements.length ? `<div class="karte-block">
        <div class="block-titel">Errungen</div>
        ${s.achievements.map((a) => `<div class="zeile"><span class="bez">★ ${esc(a.name)}</span>
          <span class="wert">R${a.turn}</span></div>`).join('')}
      </div>` : ''}
      <div class="karte-block">
        <div class="block-titel">Zum Teilen</div>
        <pre class="teil-karte">${esc(zusammenfassung)}</pre>
      </div>
      <div class="modal-fuß">
        <button class="primaer" data-teilen="${esc(zusammenfassung)}">Ergebnis kopieren</button>
        <button class="ghost" data-modal-schliessen>Karte ansehen</button>
        <button class="haupt" data-beenden>Hauptmenü</button>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Hilfe                                                               */
/* ------------------------------------------------------------------ */


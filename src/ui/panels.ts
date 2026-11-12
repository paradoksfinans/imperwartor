/**
 * Die acht Seitenbereiche des Spielbildschirms.
 *
 * Jeder Bereich ist eine reine Funktion: Spielzustand hinein, HTML heraus.
 * Angeklickt wird über Datenattribute, die der Hauptbildschirm gebuendelt
 * auswertet - das spart Hunderte einzelner Ereigniszuordnungen und macht das
 * Neuzeichnen nach jeder Aktion billig.
 */

import type { Country, GameState, MissionLohn, UnitId } from '../core/types';
import {
  BUILDINGS, BUILDING_ORDER, GENERAL_TRAITS, GOVERNMENTS, MAX_TECH_LEVEL,
  RESOURCES, TECH_FIELDS, TECH_ORDER, TERRAIN, UNITS, UNIT_ORDER,
  allianceOf, areAllied, areAtWar, buildingCost, countryArmy, countryPopulation,
  getRelation, governmentOf, hasTreaty, isVassalOf, powerScore, provincesOf,
  regimentsTotal, relationLabel, techCost, techLevelName, vassalsOf,
  verfuegbareEinheiten, armeeKapazitaet,
} from '../core/rules';
import { computeFinances, tradePartnerCount } from '../core/economy';
import { einheitenPreis, maxAushebung } from '../core/actions';
import { DIPLOMACY_OPTIONS, WAR_GOALS, friedensSpielraum, militaryStrengthVisible } from '../core/diplomacy';
import { victoryProgress, rangliste } from '../core/victory';
import { alleErfolge } from '../core/achievements';
import { HERRSCHER_EIGENSCHAFTEN } from '../core/herrscher';
import {
  erledigteMissionen, missionFortschritt, missionStand, offeneMissionen,
} from '../core/missions';
import {
  formatDate, formatNumber, formatPercent, formatPopulation, formatSigned, jahrText,
} from '../core/format';
import { balken, esc, zeile } from './dom';
import { abzeichenSvg } from './heraldry';
import { flaggeSvg } from './flaggen';
import { balkenDiagramm, linienDiagramm } from './charts';
import { AUTOSAVE_SLOT, MANUAL_SLOTS, listSaves, speicherIstDauerhaft } from '../core/save';

export type PanelId =
  | 'ziele' | 'diplomatie' | 'militaer' | 'wirtschaft' | 'forschung'
  | 'inneres' | 'chronik' | 'rangliste' | 'einstellungen';

export interface PanelTab {
  id: PanelId;
  label: string;
  zeichen: string;
}

export const PANEL_TABS: PanelTab[] = [
  { id: 'ziele',         label: 'Ziele',       zeichen: '◎' },
  { id: 'diplomatie',    label: 'Diplomatie',  zeichen: '⚖' },
  { id: 'militaer',      label: 'Militär',    zeichen: '⚔' },
  { id: 'wirtschaft',    label: 'Wirtschaft',  zeichen: '▤' },
  { id: 'forschung',     label: 'Forschung',   zeichen: '⚙' },
  { id: 'inneres',       label: 'Inneres',     zeichen: '⚑' },
  { id: 'chronik',       label: 'Chronik',     zeichen: '≡' },
  { id: 'rangliste',     label: 'Rangliste',   zeichen: '▦' },
  { id: 'einstellungen', label: 'Mehr',        zeichen: '☰' },
];

/** Zusatzangaben, die der Hauptbildschirm hereinreicht. */
export interface PanelKontext {
  /** Aktuell im Diplomatiebereich ausgewaehltes Land. */
  diploZiel: string | null;
  kriegsziel: string;
  thema: 'dunkel' | 'hell';
  tonAn: boolean;
}

/** Feste Farbe je Truppengattung - taucht in Diagrammen und Ringen auf. */
export const GATTUNG_FARBEN: Record<UnitId, string> = {
  infantry:  '#5f93c4',
  archers:   '#4f9f6a',
  cavalry:   '#d6a84e',
  siege:     '#a0795a',
  artillery: '#b06a5a',
  armor:     '#8a7fa8',
  navy:      '#5aa8a8',
};

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

function block(titel: string, inhalt: string): string {
  return `<div class="karte-block"><div class="block-titel">${esc(titel)}</div>${inhalt}</div>`;
}

function leer(text: string): string {
  return `<p class="leer">${esc(text)}</p>`;
}

/** Truppenaufstellung als Reihe kleiner Marken. */
function truppenReihe(r: Record<string, number | undefined>): string {
  const teile = UNIT_ORDER
    .filter((u) => (r[u] ?? 0) > 0)
    .map((u) => `<span class="truppen-chip" title="${esc(UNITS[u].name)}">
        <b>${UNITS[u].kurz}</b>${r[u]}</span>`);
  return teile.length ? `<div class="truppen-reihe">${teile.join('')}</div>`
    : '<span class="schwach">keine Truppen</span>';
}

/* ------------------------------------------------------------------ */
/* Ziele                                                               */
/* ------------------------------------------------------------------ */

/**
 * Zielvorgaben als erste Anlaufstelle.
 *
 * Sie stehen bewusst vor der Diplomatie: Wer das Spiel neu öffnet, soll
 * zuerst lesen, was als Nächstes zu tun ist - nicht eine Länderliste ohne
 * Zusammenhang.
 */
function zielePanel(s: GameState): string {
  const offen = offeneMissionen(s);
  const fertig = erledigteMissionen(s);
  const c = s.countries[s.playerCountryId];

  const lohnText = (l: MissionLohn): string => {
    const namen: Record<string, string> = {
      gold: 'Gold', politicalPower: 'Einfluss', stability: 'Stabilität',
      manpower: 'Reserve', researchPoints: 'Forschung',
    };
    return Object.entries(l as Record<string, number | undefined>)
      .filter(([, v]) => v)
      .map(([k, v]) => `<span class="lohn-marke">+${formatNumber(v as number)} ${namen[k] ?? k}</span>`)
      .join('');
  };

  const karten = offen.map((m) => {
    const stand = missionStand(s, m);
    const anteil = Math.round(missionFortschritt(s, m) * 100);
    return `
      <div class="ziel-karte">
        <div class="ziel-kopf">
          <span class="ziel-name">${esc(m.name)}</span>
          <span class="ziel-stand">${formatNumber(stand)} / ${formatNumber(m.ziel)}</span>
        </div>
        <p class="ziel-text">${esc(m.beschreibung)}</p>
        <div class="balken"><span style="width:${anteil}%"></span></div>
        <div class="ziel-lohn">${lohnText(m.lohn)}</div>
      </div>`;
  }).join('');

  const siegBlock = s.victoryConditions.length ? `
    <div class="karte-block">
      <div class="block-titel">Siegbedingungen</div>
      ${s.victoryConditions.map((b) => `
        <div class="zeile"><span class="bez">${esc(b.description)}</span></div>`).join('')}
    </div>` : '';

  return `
    <div class="karte-block hervor">
      <div class="block-titel">Nächste Schritte</div>
      <p class="leise-text">
        Drei Vorgaben laufen gleichzeitig. Ist eine erfüllt, rückt die
        nächste nach - und die Belohnung fällt sofort an.
      </p>
      ${karten || leer('Keine offenen Vorgaben.')}
    </div>

    ${siegBlock}

    <div class="karte-block">
      <div class="block-titel">Lage auf einen Blick</div>
      ${zeile('Gebiete', String(provincesOf(s, s.playerCountryId).length))}
      ${zeile('Machtkennzahl', formatNumber(powerScore(s, s.playerCountryId)))}
      ${zeile('Stabilität', `${Math.round(c.stability)} / 100`)}
      ${zeile('Erfüllte Vorgaben', String(fertig.length))}
    </div>

    ${fertig.length ? `<div class="karte-block">
      <div class="block-titel">Erreicht</div>
      ${fertig.slice(0, 8).map((m) => `
        <div class="zeile"><span class="bez">✓ ${esc(m.name)}</span>
        <span class="wert">R${m.rundeErledigt ?? '-'}</span></div>`).join('')}
    </div>` : ''}

    ${s.achievements.length ? `<div class="karte-block">
      <div class="block-titel">Erfolge</div>
      ${s.achievements.map((a) => `
        <div class="zeile"><span class="bez">★ ${esc(a.name)}</span>
        <span class="wert">R${a.turn}</span></div>`).join('')}
    </div>` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Diplomatie                                                          */
/* ------------------------------------------------------------------ */

function diplomatiePanel(s: GameState, k: PanelKontext): string {
  const ich = s.playerCountryId;
  const spieler = s.countries[ich];
  const andere = s.countryOrder.filter((id) => id !== ich && s.countries[id].alive);

  const liste = andere.map((id) => {
    const c = s.countries[id];
    const rel = getRelation(s, ich, id);
    const krieg = areAtWar(s, ich, id);
    const bund = areAllied(s, ich, id);
    const vasall = isVassalOf(s, id, ich);
    const marken: string[] = [];
    if (krieg) marken.push('<span class="marke blut">Krieg</span>');
    if (bund) marken.push('<span class="marke laub">Bündnis</span>');
    if (vasall) marken.push('<span class="marke">Vasall</span>');
    if (hasTreaty(s, ich, id, 'trade')) marken.push('<span class="marke">Handel</span>');
    if (hasTreaty(s, ich, id, 'nonAggression')) marken.push('<span class="marke">Pakt</span>');
    if (hasTreaty(s, ich, id, 'truce')) marken.push('<span class="marke">Waffenruhe</span>');

    const farbe = rel > 25 ? 'gut' : rel < -25 ? 'schlecht' : '';
    return `<button class="land-zeile" data-diplo="${esc(id)}"
        aria-pressed="${k.diploZiel === id}">
      ${abzeichenSvg(c.crest, c.color, c.emblem, 24)}
      <span class="land-zeile-text">
        <span class="land-zeile-kopf">
          <b>${esc(c.name)}</b>
          <span class="wert ${farbe}">${rel > 0 ? '+' : ''}${rel}</span>
        </span>
        <span class="marken">${marken.join('') || `<span class="marke leise">${esc(relationLabel(rel))}</span>`}</span>
      </span>
    </button>`;
  }).join('');

  let detail = '';
  const ziel = k.diploZiel ? s.countries[k.diploZiel] : null;
  if (ziel && ziel.alive) {
    const zid = ziel.id;
    const sichtbar = militaryStrengthVisible(s, ich, zid);
    const krieg = areAtWar(s, ich, zid);
    const w = s.wars.find((x) => x.sideA.includes(ich) && x.sideB.includes(zid))
      || s.wars.find((x) => x.sideB.includes(ich) && x.sideA.includes(zid));

    const gruppen: Record<string, string[]> = {
      beziehung: [], vertrag: [], krieg: [], macht: [], verdeckt: [],
    };
    const wissen = spieler.intel?.[zid] ?? 0;
    for (const opt of DIPLOMACY_OPTIONS) {
      const bezahlbar = spieler.politicalPower >= opt.politicalPower && spieler.gold >= opt.gold;
      // Verdeckte Mittel brauchen zusaetzlich Spionagewissen. Der Knopf
      // bleibt sichtbar, aber gesperrt - so erfaehrt man, dass es die
      // Moeglichkeit gibt und was dafuer fehlt.
      const wissenFehlt = opt.wissen !== undefined && wissen < opt.wissen;
      const kosten = [
        opt.politicalPower ? `${opt.politicalPower} EP` : '',
        opt.gold ? `${formatNumber(opt.gold)} G` : '',
      ].filter(Boolean).join(' + ') || 'kostenlos';
      const titel = wissenFehlt
        ? `${opt.hint} Setzt ${opt.wissen} Spionagewissen voraus - vorhanden: ${Math.round(wissen)}.`
        : `${opt.hint} Kosten: ${kosten}`;
      gruppen[opt.gruppe].push(
        `<button class="small" data-diploaktion="${esc(opt.id)}"
           ${bezahlbar && !wissenFehlt ? '' : 'disabled'}
           title="${esc(titel)}">${esc(opt.label)}${wissenFehlt ? ' 🔒' : ''}</button>`,
      );
    }

    const kriegszielWahl = `
      <label class="feldzeile">
        <span class="bez">Kriegsziel</span>
        <select data-kriegsziel>
          ${WAR_GOALS.map((g) => `<option value="${esc(g.id)}"
             ${k.kriegsziel === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
        </select>
      </label>
      <p class="leise-text">${esc(WAR_GOALS.find((g) => g.id === k.kriegsziel)?.hint ?? '')}</p>`;

    let kriegsBlock = '';
    if (w) {
      const aufSeiteA = w.sideA.includes(ich);
      const punkte = aufSeiteA ? w.scoreA : -w.scoreA;
      const spielraum = friedensSpielraum(punkte);
      kriegsBlock = block('Kriegslage', `
        ${balken((punkte + 100) / 2, punkte >= 0 ? 'laub' : 'blut')}
        ${zeile('Kriegsfortschritt', `${punkte > 0 ? '+' : ''}${Math.round(punkte)}`,
    punkte >= 0 ? 'gut' : 'schlecht')}
        ${zeile('Seit Runde', String(w.startTurn))}
        ${zeile('Du kannst fordern',
    spielraum.gebiete > 0
      ? `${spielraum.gebiete} Gebiet${spielraum.gebiete === 1 ? '' : 'e'}`
      : 'noch nichts')}
        ${spielraum.reparationen > 0
    ? zeile('Reparationen', formatNumber(spielraum.reparationen)) : ''}
        ${spielraum.vasall ? zeile('Möglich', 'Vasallisierung', 'gut') : ''}`);
    }

    detail = `
      <div class="karte-block">
        <div class="land-kopf">
          ${flaggeSvg(ziel.flag, ziel.color, 52, ziel.emblem)}
          <div>
            <h3>${esc(ziel.name)}</h3>
            <div class="leise-text">${esc(ziel.ruler)} &middot; ${esc(governmentOf(ziel).name)}</div>
          </div>
        </div>
        <p class="lede">${esc(ziel.description)}</p>
        ${zeile('Gebiete', String(provincesOf(s, zid).length))}
        ${zeile('Heer', sichtbar ? formatNumber(countryArmy(s, zid)) : 'unbekannt',
    sichtbar ? '' : 'schwach')}
        ${zeile('Machtkennzahl', formatNumber(powerScore(s, zid)))}
        ${zeile('Bündnis', esc(allianceOf(s, zid)?.name ?? 'keines'))}
        ${zeile('Aufklärung', `${Math.round(spieler.intel[zid] ?? 0)} %`)}
        ${balken(spieler.intel[zid] ?? 0)}
      </div>
      ${kriegsBlock}
      ${block('Beziehung', `<div class="reihe">${gruppen.beziehung.join('')}</div>`)}
      ${block('Verträge', `<div class="reihe">${gruppen.vertrag.join('')}</div>`)}
      ${block('Macht', `<div class="reihe">${gruppen.macht.join('')}</div>`)}
      ${block('Verdeckte Mittel', `
        <div class="zeile"><span class="bez">Spionagewissen</span>
          <span class="wert">${Math.round(wissen)} / 100</span></div>
        ${balken(wissen)}
        <div class="reihe">${gruppen.verdeckt.join('')}</div>
        <p class="leise-text">Wissen entsteht durch Spione und sinkt mit der Zeit.
        Misslingt eine Operation, schadet das dem Ansehen bei allen Ländern.</p>`)}
      ${block(krieg ? 'Krieg beenden' : 'Krieg beginnen',
    `${krieg ? '' : kriegszielWahl}<div class="reihe">${gruppen.krieg.join('')}</div>`)}`;
  }

  const buendnisse = s.alliances.length
    ? s.alliances.map((a) => `<div class="zeile"><span class="bez">${esc(a.name)}</span>
        <span class="wert">${a.memberIds.length} Mitglieder</span></div>
        <div class="leise-text">${esc(a.memberIds.map((m) => s.countries[m]?.name).join(', '))}</div>`).join('')
    : leer('Es bestehen keine Bündnisse.');

  return `
    ${block('Politische Macht', `
      <div class="gross-wert">${Math.round(spieler.politicalPower)}</div>
      <p class="leise-text">Währung der Diplomatie. Wächst jede Runde mit Stabilität
      und Regierungsform.</p>`)}
    <div class="karte-block">
      <div class="block-titel">Länder</div>
      <div class="land-liste">${liste}</div>
    </div>
    ${detail}
    ${block('Bündnisse', buendnisse)}`;
}

/* ------------------------------------------------------------------ */
/* Militär                                                            */
/* ------------------------------------------------------------------ */

function militaerPanel(s: GameState): string {
  const ich = s.playerCountryId;
  const c = s.countries[ich];
  const gebiete = provincesOf(s, ich);
  const kapazitaet = armeeKapazitaet(s, ich);
  const staerke = countryArmy(s, ich);

  const gattungen = UNIT_ORDER.map((u) => {
    let anzahl = 0;
    for (const p of gebiete) anzahl += p.regiments[u] ?? 0;
    return { u, anzahl };
  }).filter((x) => x.anzahl > 0);

  const verteilung = gattungen.length
    ? balkenDiagramm(gattungen.map((x) => ({
      name: UNITS[x.u].name, wert: x.anzahl, farbe: GATTUNG_FARBEN[x.u],
    })))
    : leer('Du hast keine Truppen.');

  const generaele = Object.values(s.generals).filter((g) => g.countryId === ich);
  const generalListe = generaele.length ? generaele.map((g) => {
    const ort = g.provinceId ? s.provinces[g.provinceId]?.name : null;
    const sterne = '★'.repeat(g.skill) + '☆'.repeat(Math.max(0, 5 - g.skill));
    const eigen = g.traits.map((t) => `<span class="marke" title="${esc(GENERAL_TRAITS[t].beschreibung)}">
        ${esc(GENERAL_TRAITS[t].name)}</span>`).join('');
    return `<div class="general-karte">
      <div class="general-kopf">
        <b>${esc(g.name)}</b>
        <span class="sterne">${sterne}</span>
      </div>
      <div class="leise-text">${ort ? `steht in ${esc(ort)}` : 'ohne Kommando'}
        &middot; ${g.wins} S / ${g.losses} N</div>
      <div class="marken">${eigen}</div>
      ${g.provinceId
    ? `<button class="small ghost" data-general-ab="${esc(g.id)}">Abberufen</button>`
    : '<span class="leise-text">Wähle ein Gebiet und setze ihn dort ein.</span>'}
    </div>`;
  }).join('') : leer('Du hast keine Generäle.');

  const kriege = s.wars.filter((w) => w.sideA.includes(ich) || w.sideB.includes(ich));
  const kriegListe = kriege.length ? kriege.map((w) => {
    const aufA = w.sideA.includes(ich);
    const punkte = aufA ? w.scoreA : -w.scoreA;
    const gegner = (aufA ? w.sideB : w.sideA).map((id) => s.countries[id]?.name).join(', ');
    const freunde = (aufA ? w.sideA : w.sideB).filter((id) => id !== ich)
      .map((id) => s.countries[id]?.name);
    return `<div class="krieg-karte">
      <div class="zeile"><span class="bez">gegen</span><span class="wert">${esc(gegner)}</span></div>
      ${freunde.length ? `<div class="leise-text">mit ${esc(freunde.join(', '))}</div>` : ''}
      ${balken((punkte + 100) / 2, punkte >= 0 ? 'laub' : 'blut')}
      <div class="zeile"><span class="bez">Fortschritt</span>
        <span class="wert ${punkte >= 0 ? 'gut' : 'schlecht'}">${punkte > 0 ? '+' : ''}${Math.round(punkte)}</span></div>
    </div>`;
  }).join('') : leer('Dein Land führt keinen Krieg.');

  const belagerungen = gebiete.filter((p) => p.siege)
    .concat(Object.values(s.provinces).filter((p) => p.siege?.attackerId === ich));
  const einmalig = [...new Map(belagerungen.map((p) => [p.id, p])).values()];
  const belagerungsListe = einmalig.length ? einmalig.map((p) => `
    <div class="zeile"><span class="bez">${esc(p.name)}</span>
      <span class="wert">${Math.round(p.siege!.progress)} %</span></div>
    ${balken(p.siege!.progress, p.siege!.attackerId === ich ? 'laub' : 'blut')}`).join('')
    : leer('Keine Belagerung im Gang.');

  const gebietsListe = gebiete
    .slice()
    .sort((a, b) => regimentsTotal(b.regiments) - regimentsTotal(a.regiments))
    .map((p) => `<button class="land-zeile schmal" data-springe="${esc(p.id)}">
      <span class="land-zeile-text">
        <span class="land-zeile-kopf"><b>${esc(p.name)}</b>
          <span class="wert">${regimentsTotal(p.regiments)}</span></span>
        ${truppenReihe(p.regiments)}
      </span></button>`).join('');

  return `
    ${block('Streitmacht', `
      ${zeile('Einheiten gesamt', formatNumber(staerke))}
      ${zeile('Unterhaltsgrenze', formatNumber(kapazitaet),
    staerke > kapazitaet ? 'schlecht' : 'gut')}
      ${balken((staerke / Math.max(1, kapazitaet)) * 100, staerke > kapazitaet ? 'blut' : 'laub')}
      ${staerke > kapazitaet
    ? '<p class="gefahr-text">Dein Heer ist größer als das Land trägt. Der Unterhalt steigt überproportional.</p>'
    : ''}
      ${zeile('Menschenreserve', formatNumber(c.manpower))}
      ${verteilung}`)}
    ${block('Generäle', generalListe + `
      <button class="small" data-general-werben>Neuen General anwerben (40 EP)</button>`)}
    ${block('Kriege', kriegListe)}
    ${block('Belagerungen', belagerungsListe)}
    ${block('Gebiete', gebietsListe)}`;
}

/* ------------------------------------------------------------------ */
/* Wirtschaft                                                          */
/* ------------------------------------------------------------------ */

function wirtschaftPanel(s: GameState): string {
  const c = s.countries[s.playerCountryId];
  const f = computeFinances(s, s.playerCountryId);

  const haushalt = `
    ${zeile('Steuern', formatNumber(f.taxIncome), 'gut')}
    ${zeile('Handel', formatNumber(f.tradeIncome), 'gut')}
    ${zeile('Unterhalt Heer', '-' + formatNumber(f.armyUpkeep), 'schlecht')}
    ${zeile('Verwaltung', '-' + formatNumber(f.adminCost), 'schlecht')}
    ${zeile('Gebäude', '-' + formatNumber(f.buildingUpkeep), 'schlecht')}
    ${zeile('Forschung', '-' + formatNumber(f.researchSpending), 'schlecht')}
    ${c.debt > 0 ? zeile('Zinsen', '-' + formatNumber(f.interest), 'schlecht') : ''}
    <div class="zierlinie"></div>
    ${zeile('Bilanz', formatSigned(Math.round(f.net)), f.net >= 0 ? 'gut' : 'schlecht')}
    ${c.debt > 0 ? zeile('Schulden', formatNumber(c.debt), 'schlecht') : ''}`;

  const regler = `
    <div class="regler-zeile">
      <span class="bez">Steuersatz</span><span class="wert">${formatPercent(c.taxRate)}</span>
    </div>
    <input type="range" min="0.2" max="0.9" step="0.05" value="${c.taxRate}"
      data-regler="steuer" aria-label="Steuersatz">
    <p class="leise-text">Hohe Steuern bringen sofort Gold und kosten jede Runde Zustimmung.</p>
    <div class="zierlinie"></div>
    <div class="regler-zeile">
      <span class="bez">Forschungsbudget</span><span class="wert">${formatPercent(c.researchBudget)}</span>
    </div>
    <input type="range" min="0" max="0.5" step="0.05" value="${c.researchBudget}"
      data-regler="forschung" aria-label="Forschungsbudget">
    <p class="leise-text">Anteil der Einnahmen, der in die laufende Forschung fließt.</p>`;

  const bau = c.construction.length
    ? c.construction.map((pr) => `${zeile(
      `${BUILDINGS[pr.building].name} in ${s.provinces[pr.provinceId]?.name ?? '?'}`,
      `noch ${pr.turnsLeft}`,
    )}`).join('')
    : leer('Kein Projekt im Bau.');

  const handel = tradePartnerCount(s, s.playerCountryId);

  const verlauf = s.history.filter((h) => h.countryId === s.playerCountryId);
  const diagramm = verlauf.length > 2
    ? linienDiagramm([{
      name: 'Gold', farbe: '#d6a84e',
      werte: verlauf.map((h) => ({ x: h.turn, y: h.gold })),
    }], 520, 200, 'Gold')
    : leer('Nach einigen Runden erscheint hier ein Verlauf.');

  return `
    ${block('Haushalt je Runde', haushalt)}
    ${block('Steuerung', regler)}
    ${block('Handel', `${zeile('Handelspartner', String(handel))}
      <p class="leise-text">Jeder Handelsvertrag erhöht die Einnahmen aus Häfen und Städten.</p>`)}
    ${block('Bauprojekte', bau)}
    ${block('Verlauf', diagramm)}`;
}

/* ------------------------------------------------------------------ */
/* Forschung                                                           */
/* ------------------------------------------------------------------ */

function forschungPanel(s: GameState): string {
  const c = s.countries[s.playerCountryId];
  const f = computeFinances(s, s.playerCountryId);

  let laufend = leer('Kein Projekt gewaehlt. Wähle unten einen Bereich.');
  if (c.research) {
    const r = c.research;
    const anteil = (r.progress / r.cost) * 100;
    const runden = f.researchPoints > 0
      ? Math.ceil((r.cost - r.progress) / f.researchPoints) : null;
    laufend = `
      <div class="gross-wert klein">${esc(techLevelName(r.field, c.tech[r.field] + 1))}</div>
      ${balken(anteil)}
      ${zeile('Fortschritt', `${formatNumber(r.progress)} / ${formatNumber(r.cost)}`)}
      ${zeile('Punkte je Runde', formatNumber(f.researchPoints))}
      ${zeile('Fertig in', runden !== null ? `${runden} Runden` : 'nie - Budget erhöhen',
    runden === null ? 'schlecht' : '')}`;
  }

  const felder = TECH_ORDER.map((id) => {
    const def = TECH_FIELDS[id];
    const stufe = c.tech[id];
    const voll = stufe >= MAX_TECH_LEVEL;
    const laeuft = c.research?.field === id;
    const punkte = Array.from({ length: MAX_TECH_LEVEL }, (_, i) =>
      `<span class="punkt ${i < stufe ? 'voll' : ''}"></span>`).join('');
    return `<div class="karte-block">
      <div class="zeile"><span class="bez"><b>${esc(def.name)}</b></span>
        <span class="wert">${stufe} / ${MAX_TECH_LEVEL}</span></div>
      <div class="punkte-reihe links">${punkte}</div>
      <p class="leise-text">${esc(def.beschreibung)}</p>
      <div class="zeile">
        <span class="bez">${voll ? 'Vollständig erforscht'
    : esc(techLevelName(id, stufe + 1))}</span>
        <button class="small" data-forschung="${esc(id)}" ${voll || laeuft ? 'disabled' : ''}>
          ${laeuft ? 'laeuft' : voll ? '✓' : `${formatNumber(techCost(stufe))} P`}
        </button>
      </div>
    </div>`;
  }).join('');

  const freigeschaltet = verfuegbareEinheiten(c)
    .map((u) => `<span class="truppen-chip"><b>${UNITS[u].kurz}</b>${esc(UNITS[u].name)}</span>`)
    .join('');

  return `
    ${block('Laufendes Projekt', laufend)}
    ${block('Verfügbare Truppengattungen', `<div class="truppen-reihe">${freigeschaltet}</div>
      <p class="leise-text">Höhere Militärtechnik schaltet neue Gattungen frei.</p>`)}
    ${felder}`;
}

/* ------------------------------------------------------------------ */
/* Inneres                                                             */
/* ------------------------------------------------------------------ */

function inneresPanel(s: GameState): string {
  const c = s.countries[s.playerCountryId];
  const reg = governmentOf(c);
  const gebiete = provincesOf(s, s.playerCountryId);
  const unruhig = gebiete.slice().sort((a, b) => b.unrest - a.unrest);
  const vasallen = vassalsOf(s, c.id);

  const lage = `
    ${zeile('Stabilität', `${Math.round(c.stability)} / 100`)}
    ${balken(c.stability, c.stability < 35 ? 'blut' : 'laub')}
    ${zeile('Kriegsmüdigkeit', `${Math.round(c.warExhaustion)} / 100`)}
    ${balken(c.warExhaustion, 'blut')}
    ${zeile('Legitimität', `${Math.round(c.legitimacy)} / 100`)}
    ${balken(c.legitimacy)}
    ${zeile('Bevölkerung', formatPopulation(countryPopulation(s, c.id)))}
    ${zeile('Menschenreserve', formatNumber(c.manpower))}`;

  const unruheListe = unruhig.map((p) => `
    <div class="zeile schmal"><span class="bez">${esc(p.name)}</span>
      <span class="wert ${p.unrest > 55 ? 'schlecht' : ''}">${Math.round(p.unrest)} %</span></div>
    ${balken(p.unrest, p.unrest > 55 ? 'blut' : '')}`).join('');

  const vasallenListe = vasallen.length
    ? vasallen.map((id) => `<div class="zeile"><span class="bez">${esc(s.countries[id].name)}</span>
        <span class="wert">${provincesOf(s, id).length} Gebiete</span></div>`).join('')
    : leer('Du hast keine Vasallen.');

  const r = c.rulerData;
  const sterne = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);
  const herrscherBlock = r ? `
      <div class="herrscher-kopf">
        <div>
          <h3>${esc(r.name)}</h3>
          <div class="leise-text">
            regiert seit ${esc(jahrText(r.regiertSeit))} &middot; ${Math.floor(r.alter)} Jahre
          </div>
        </div>
      </div>
      <div class="herrscher-werte">
        <div><span class="bez">Verwaltung</span><span class="punkte">${sterne(r.verwaltung)}</span></div>
        <div><span class="bez">Diplomatie</span><span class="punkte">${sterne(r.diplomatie)}</span></div>
        <div><span class="bez">Kriegskunst</span><span class="punkte">${sterne(r.kriegskunst)}</span></div>
      </div>
      ${r.traits.length ? `<div class="truppen-reihe">${r.traits.map((t) => `
        <span class="truppen-chip" title="${esc(HERRSCHER_EIGENSCHAFTEN[t].beschreibung)}">
          ${esc(HERRSCHER_EIGENSCHAFTEN[t].name)}</span>`).join('')}</div>` : ''}
      <p class="leise-text">
        Verwaltung hebt Steuern und Stabilität, Diplomatie den Zuwachs an
        Einfluss, Kriegskunst die Schlagkraft aller Heere. Stirbt der
        Herrscher, kostet die Nachfolge Stabilität - in Erbreichen mehr.
      </p>` : '';

  return `
    ${r ? block('Herrscher', herrscherBlock) : ''}
    ${block('Regierung', `
      <div class="land-kopf">
        ${flaggeSvg(c.flag, c.color, 48, c.emblem)}
        <div><h3>${esc(reg.name)}</h3>
        <div class="leise-text">${esc(c.ruler)}</div></div>
      </div>
      <p class="lede">${esc(reg.note)}</p>
      ${zeile('Stabilität je Runde', `+${reg.stabilityPerTurn.toFixed(1)}`)}
      ${zeile('Wirtschaft', `x${reg.economyMod.toFixed(2)}`)}
      ${zeile('Diplomatie', `x${reg.diplomacyMod.toFixed(2)}`)}
      ${zeile('Militär', `x${reg.militaryMod.toFixed(2)}`)}`)}
    ${block('Lage im Inneren', lage)}
    ${block('Vasallen', vasallenListe)}
    ${block('Unruhe in den Gebieten', unruheListe + `
      <p class="leise-text">Ab etwa 55 Prozent können Gebiete abfallen.
      Frisch Erobertes ist besonders gefaehrdet.</p>`)}`;
}

/* ------------------------------------------------------------------ */
/* Chronik                                                             */
/* ------------------------------------------------------------------ */

function chronikPanel(s: GameState): string {
  const meldungen = s.log.length
    ? s.log.slice(0, 80).map((e) => `
      <div class="protokoll-zeile ${esc(e.kind)}">
        <span class="protokoll-runde">R${e.turn}<br>${esc(jahrText(e.year))}</span>
        <span>${esc(e.text)}</span>
      </div>`).join('')
    : leer('Noch keine Meldungen.');

  const kaempfe = s.battleReports.length
    ? s.battleReports.slice(0, 15).map((b) => `
      <button class="land-zeile schmal" data-bericht="${esc(b.id)}">
        <span class="land-zeile-text">
          <span class="land-zeile-kopf">
            <b>${esc(b.provinceName)}</b>
            <span class="wert ${b.attackerWon ? 'gut' : 'schlecht'}">
              ${b.attackerWon ? 'erobert' : 'gehalten'}</span>
          </span>
          <span class="leise-text">R${b.turn} &middot; ${esc(b.attackerName)}
            gegen ${esc(b.defenderName)}</span>
        </span></button>`).join('')
    : leer('Noch kein Kampf.');

  const erfolgeAlle = alleErfolge();
  const erreicht = new Set(s.achievements.map((a) => a.id));
  const erfolgListe = erfolgeAlle.map((a) => `
    <div class="erfolg ${erreicht.has(a.id) ? 'erreicht' : ''}">
      <span class="erfolg-zeichen">${erreicht.has(a.id) ? '★' : '☆'}</span>
      <span><b>${esc(a.name)}</b><br><span class="leise-text">${esc(a.beschreibung)}</span></span>
    </div>`).join('');

  return `
    ${block(`Erfolge (${s.achievements.length} / ${erfolgeAlle.length})`, erfolgListe)}
    ${block('Letzte Kämpfe', kaempfe)}
    ${block('Meldungen', meldungen)}`;
}

/* ------------------------------------------------------------------ */
/* Rangliste                                                           */
/* ------------------------------------------------------------------ */

function ranglistePanel(s: GameState): string {
  const ziele = victoryProgress(s, s.playerCountryId);
  const zielBlock = ziele.length ? ziele.map((z) => `
    <div class="zeile"><span class="bez">${esc(z.condition.description)}</span>
      <span class="wert ${z.fulfilled ? 'gut' : ''}">${z.current} / ${z.target}</span></div>
    ${balken((z.current / Math.max(1, z.target)) * 100, z.fulfilled ? 'laub' : '')}`).join('')
    : leer('Sandkasten - kein festes Spielziel.');

  const rang = rangliste(s);
  const maxMacht = Math.max(1, ...rang.map((r) => r.power));
  const tabelle = rang.map((r, i) => `
    <div class="rang-zeile ${r.id === s.playerCountryId ? 'ich' : ''} ${r.alive ? '' : 'tot'}">
      <span class="rang-nr">${String(i + 1).padStart(2, '0')}</span>
      <span class="legende-farbe" style="background:${esc(r.color)}"></span>
      <span class="rang-name">${esc(r.name)}${r.id === s.playerCountryId ? ' (du)' : ''}
        ${r.alive ? '' : ' †'}</span>
      <span class="rang-balken"><span style="width:${(r.power / maxMacht) * 100}%"></span></span>
      <span class="rang-wert">${formatNumber(r.power)}</span>
    </div>
    <div class="rang-detail">${r.provinces} Gebiete &middot; ${formatNumber(r.army)} Einheiten
      &middot; ${formatNumber(r.gold)} Gold</div>`).join('');

  const verlauf = s.history;
  const laender = rang.slice(0, 5).map((r) => ({
    name: r.name,
    farbe: r.color,
    werte: verlauf.filter((h) => h.countryId === r.id).map((h) => ({ x: h.turn, y: h.provinces })),
  })).filter((r) => r.werte.length > 2);

  const diagramm = laender.length
    ? linienDiagramm(laender, 520, 200, 'Gebiete')
    : leer('Nach einigen Runden erscheint hier ein Verlauf.');

  return `
    ${block('Siegbedingungen', zielBlock)}
    ${block('Machtkennzahl', tabelle)}
    ${block('Verlauf', diagramm)}`;
}

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

function einstellungenPanel(s: GameState, k: PanelKontext): string {
  const staende = listSaves();
  const plaetze = MANUAL_SLOTS.map((slot, i) => {
    const vorhanden = staende.find((e) => e.slot === slot);
    return `<div class="zeile">
      <span class="bez">Platz ${i + 1}${vorhanden
    ? ` – ${esc(vorhanden.scenarioName)}, R${vorhanden.turn}` : ' – leer'}</span>
      <span class="reihe eng">
        <button class="small" data-speichern="${esc(slot)}">Sichern</button>
        <button class="small" data-laden="${esc(slot)}" ${vorhanden ? '' : 'disabled'}>Laden</button>
        <button class="small gefahr" data-loeschen="${esc(slot)}" ${vorhanden ? '' : 'disabled'}>✕</button>
      </span></div>`;
  }).join('');

  const auto = staende.find((e) => e.slot === AUTOSAVE_SLOT);

  return `
    ${block('Darstellung', `
      <div class="reihe">
        <button data-thema="dunkel" aria-pressed="${k.thema === 'dunkel'}">Dunkel</button>
        <button data-thema="hell" aria-pressed="${k.thema === 'hell'}">Hell</button>
      </div>
      <div class="zierlinie"></div>
      <div class="reihe">
        <button data-ton aria-pressed="${k.tonAn}">Toene ${k.tonAn ? 'an' : 'aus'}</button>
      </div>`)}
    ${block('Spielstände', `
      ${speicherIstDauerhaft ? '' :
    '<p class="leise-text">Dieser Rahmen erlaubt keinen dauerhaften Speicher. Die Plätze gelten nur für diese Sitzung - nutze unten das Kopieren als Text.</p>'}
      ${plaetze}
      <div class="zierlinie"></div>
      <div class="zeile"><span class="bez">Automatisch${auto ? ` – R${auto.turn}` : ' – leer'}</span>
        <button class="small" data-laden="${AUTOSAVE_SLOT}" ${auto ? '' : 'disabled'}>Laden</button></div>`)}
    ${block('Mitnehmen', `
      <div class="reihe">
        <button class="small" data-kopieren>In die Zwischenablage</button>
        <button class="small" data-datei-export>Als Datei</button>
        <button class="small" data-datei-import>Datei laden</button>
        <button class="small" data-text-import>Text einfügen</button>
      </div>`)}
    ${block('Partie', `
      <div class="reihe">
        <button class="small" data-hilfe>Spielhilfe</button>
        <button class="small gefahr" data-beenden>Zum Hauptmenü</button>
      </div>`)}
    ${block('Dieses Spiel', `
      ${zeile('Szenario', esc(s.scenarioName))}
      ${zeile('Karte', esc(s.mapId))}
      ${zeile('Runde', `${s.turn} (${esc(formatDate(s.year, s.turn, s.monthsPerTurn))})`)}
      ${zeile('Schwierigkeit', esc(s.difficulty))}
      ${zeile('Gebiete', String(s.provinceOrder.length))}
      ${zeile('Länder', String(s.countryOrder.filter((id) => s.countries[id].alive).length))}`)}`;
}

/* ------------------------------------------------------------------ */
/* Verteiler                                                           */
/* ------------------------------------------------------------------ */

export function panelInhalt(id: PanelId, s: GameState, k: PanelKontext): string {
  switch (id) {
    case 'ziele':         return zielePanel(s);
    case 'diplomatie':    return diplomatiePanel(s, k);
    case 'militaer':      return militaerPanel(s);
    case 'wirtschaft':    return wirtschaftPanel(s);
    case 'forschung':     return forschungPanel(s);
    case 'inneres':       return inneresPanel(s);
    case 'chronik':       return chronikPanel(s);
    case 'rangliste':     return ranglistePanel(s);
    case 'einstellungen': return einstellungenPanel(s, k);
    default:              return '';
  }
}

/* ------------------------------------------------------------------ */
/* Gebietsansicht                                                      */
/* ------------------------------------------------------------------ */

export interface GebietKontext {
  modus: 'none' | 'move' | 'attack';
  zielId: string | null;
  /** Gewaehlte Truppen für Bewegung oder Angriff. */
  auswahl: Record<string, number>;
  /** Gewaehlte Gattung und Menge für die Aushebung. */
  rekrutGattung: UnitId;
  rekrutMenge: number;
}

export function gebietsAnsicht(
  s: GameState, provinceId: string, k: GebietKontext,
  moeglicheZiele: { bewegen: string[]; angreifen: string[] },
  vorschau: { attack: number; defense: number; chance: number; brauchtBelagerung: boolean } | null,
): string {
  const p = s.provinces[provinceId];
  if (!p) return '';
  const ich = s.playerCountryId;
  const c = s.countries[ich];
  const besitzer = p.ownerId ? s.countries[p.ownerId] : null;
  const eigen = p.ownerId === ich;
  const gelaende = TERRAIN[p.terrain];

  const kopf = `
    <div class="gebiets-kopf">
      ${besitzer ? flaggeSvg(besitzer.flag, besitzer.color, 42, besitzer.emblem)
    : '<span class="wappen-leer">—</span>'}
      <div class="gebiets-titel">
        <h3>${p.isCapital ? '★ ' : ''}${esc(p.name)}</h3>
        <div class="leise-text">
          ${esc(besitzer?.name ?? 'Ohne Besitzer')} &middot; ${esc(gelaende.name)}
          ${besitzer && besitzer.id !== ich
    ? ` &middot; ${esc(relationLabel(getRelation(s, ich, besitzer.id)))}` : ''}
          ${besitzer && areAtWar(s, ich, besitzer.id) ? ' &middot; <b class="gefahr-text">im Krieg</b>' : ''}
        </div>
      </div>
      <button class="ghost small" data-gebiet-schliessen>Schließen</button>
    </div>`;

  const kennzahlen = `
    <div class="gebiets-gitter">
      ${zeile('Truppen', String(regimentsTotal(p.regiments)))}
      ${zeile('Bevölkerung', formatPopulation(p.population))}
      ${zeile('Wirtschaft', formatNumber(Math.round(p.economy)))}
      ${zeile('Infrastruktur', String(p.infrastructure))}
      ${zeile('Befestigung', `Stufe ${p.fortification}`)}
      ${zeile('Versorgung', `${Math.round(p.supply)} %`, p.supply < 50 ? 'schlecht' : '')}
      ${zeile('Unruhe', `${Math.round(p.unrest)} %`, p.unrest > 55 ? 'schlecht' : '')}
      ${zeile('Verteidigung', `x${gelaende.defense.toFixed(2)}`)}
      ${zeile('Rohstoff', esc(RESOURCES[p.resource].name))}
      ${zeile('Hafen', p.isPort ? 'ja' : 'nein')}
    </div>
    ${truppenReihe(p.regiments)}`;

  if (!eigen) {
    const belagert = p.siege
      ? `${zeile('Belagerung', `${Math.round(p.siege.progress)} %`)}${balken(p.siege.progress, 'blut')}`
      : '';
    return `${kopf}${kennzahlen}${belagert}
      <p class="leise-text">Dieses Gebiet gehört dir nicht. Angriffe führst du aus einem
      eigenen Nachbargebiet heraus.</p>`;
  }

  /* --- eigenes Gebiet: Aktionen --- */

  const general = Object.values(s.generals)
    .find((g) => g.countryId === ich && g.provinceId === p.id);
  const freieGeneraele = Object.values(s.generals)
    .filter((g) => g.countryId === ich && !g.provinceId);

  const generalBlock = general
    ? `<div class="zeile"><span class="bez">General</span>
        <span class="wert">${esc(general.name)} ${'★'.repeat(general.skill)}</span></div>`
    : freieGeneraele.length
      ? `<div class="zeile"><span class="bez">General entsenden</span>
         <span class="reihe eng">${freieGeneraele.slice(0, 3).map((g) =>
        `<button class="small" data-general-hin="${esc(g.id)}">${esc(g.name.split(' ')[0])}</button>`).join('')}
         </span></div>`
      : '';

  const kannBewegen = moeglicheZiele.bewegen.length > 0 && regimentsTotal(p.regiments) > 0;
  const kannAngreifen = moeglicheZiele.angreifen.length > 0 && regimentsTotal(p.regiments) > 0;

  const aktionen = `
    <div class="aktions-reihe">
      <button data-modus="move" aria-pressed="${k.modus === 'move'}" ${kannBewegen ? '' : 'disabled'}>
        Verlegen</button>
      <button data-modus="attack" aria-pressed="${k.modus === 'attack'}" ${kannAngreifen ? '' : 'disabled'}>
        Angreifen</button>
    </div>`;

  let befehl = '';
  if (k.modus !== 'none') {
    const ziele = k.modus === 'move' ? moeglicheZiele.bewegen : moeglicheZiele.angreifen;
    const zielKnoepfe = ziele.map((id) => {
      const z = s.provinces[id];
      return `<button class="small" data-ziel="${esc(id)}" aria-pressed="${k.zielId === id}">
        ${esc(z.name)} (${regimentsTotal(z.regiments)})</button>`;
    }).join('');

    let truppenWahl = '';
    if (k.zielId) {
      const reihen = UNIT_ORDER.filter((u) => (p.regiments[u] ?? 0) > 0).map((u) => {
        const vorhanden = p.regiments[u] ?? 0;
        const gewaehlt = k.auswahl[u] ?? 0;
        return `<div class="truppen-regler">
          <span class="truppen-name"><b>${UNITS[u].kurz}</b> ${esc(UNITS[u].name)}</span>
          <input type="range" min="0" max="${vorhanden}" value="${gewaehlt}"
            data-truppe="${esc(u)}" aria-label="${esc(UNITS[u].name)}">
          <span class="wert">${gewaehlt} / ${vorhanden}</span>
        </div>`;
      }).join('');

      const schnell = [25, 50, 75, 100].map((pz) =>
        `<button class="small ghost" data-anteil="${pz}">${pz} %</button>`).join('');

      const gesamt = Object.values(k.auswahl).reduce((a, b) => a + b, 0);

      let vorschauBlock = '';
      if (vorschau && k.modus === 'attack') {
        const chance = Math.round(vorschau.chance * 100);
        vorschauBlock = `
          <div class="vorschau">
            <div class="waage">
              <span class="waage-a" style="flex:${Math.max(1, vorschau.attack)}">Angriff ${vorschau.attack.toFixed(0)}</span>
              <span class="waage-d" style="flex:${Math.max(1, vorschau.defense)}">Abwehr ${vorschau.defense.toFixed(0)}</span>
            </div>
            <div class="zeile"><span class="bez">Siegaussicht</span>
              <span class="wert ${chance > 60 ? 'gut' : chance < 40 ? 'schlecht' : ''}">${chance} %</span></div>
            ${vorschau.brauchtBelagerung
    ? '<p class="leise-text">Die Befestigung hält einem Sturm stand. Es beginnt eine Belagerung.</p>'
    : ''}
          </div>`;
      }

      truppenWahl = `
        <div class="zierlinie"></div>
        <div class="reihe eng">${schnell}</div>
        ${reihen}
        ${vorschauBlock}
        <div class="aktions-reihe">
          <button class="haupt" data-ausfuehren ${gesamt < 1 || c.actionPoints < 1 ? 'disabled' : ''}>
            ${k.modus === 'move' ? 'Verlegen' : 'Angriff befehlen'} (${gesamt})
          </button>
          <button class="ghost" data-abbrechen>Abbrechen</button>
        </div>`;
    }

    befehl = `<div class="karte-block">
      <div class="block-titel">${k.modus === 'move' ? 'Ziel der Verlegung' : 'Angriffsziel'}</div>
      <div class="reihe eng">${zielKnoepfe}</div>
      ${truppenWahl}
    </div>`;
  }

  /* Aushebung */
  const gattungen = verfuegbareEinheiten(c);
  const gattungKnoepfe = gattungen.map((u) => {
    const def = UNITS[u];
    const gesperrt = def.naval && !p.isPort;
    return `<button class="small" data-gattung="${esc(u)}"
      aria-pressed="${k.rekrutGattung === u}" ${gesperrt ? 'disabled' : ''}
      title="${esc(def.beschreibung)}"><b>${def.kurz}</b> ${esc(def.name)}</button>`;
  }).join('');

  // Das Maximum muss aus der Spiellogik kommen - Gold, Menschen und Platz
  // begrenzen die Aushebung, nicht die zuletzt gewaehlte Zahl.
  const grenze = maxAushebung(s, ich, p.id, k.rekrutGattung);
  const preis = einheitenPreis(s, p.id, k.rekrutGattung);
  const menge = Math.min(k.rekrutMenge, grenze);
  const gattungDef = UNITS[k.rekrutGattung];

  const rekrutBlock = `<div class="karte-block">
    <div class="block-titel">Aushebung</div>
    <div class="reihe eng">${gattungKnoepfe}</div>
    ${grenze < 1
    ? `<p class="leise-text">${esc(gattungDef.name)} lässt sich hier gerade nicht ausheben
       – es fehlt an Gold, Menschen oder Platz.</p>`
    : `<div class="truppen-regler">
      <span class="truppen-name">Menge</span>
      <input type="range" min="0" max="${grenze}" value="${menge}"
        data-rekrut-menge aria-label="Menge">
      <span class="wert">${menge} / ${grenze}</span>
    </div>
    <div class="reihe eng">
      ${[25, 50, 100].map((pz) => `<button class="small ghost"
        data-rekrut-anteil="${pz}">${pz} %</button>`).join('')}
    </div>
    ${zeile('Kosten', `${formatNumber(menge * preis)} Gold`)}
    ${zeile('Menschen', formatNumber(menge * gattungDef.population))}`}
    <div class="aktions-reihe">
      <button data-rekrutieren ${menge < 1 || c.actionPoints < 1 ? 'disabled' : ''}>
        Ausheben</button>
    </div>
  </div>`;

  /* Ausbau */
  const bauKnoepfe = BUILDING_ORDER.map((b) => {
    const def = BUILDINGS[b];
    const stufe = p.buildings[b] ?? 0;
    const voll = stufe >= def.maxLevel;
    const laeuft = c.construction.some((x) => x.provinceId === p.id && x.building === b);
    const nurHafen = b === 'port' && !p.isPort;
    const kosten = buildingCost(b, stufe, p, s.kostenFaktor);
    const geht = !voll && !laeuft && !nurHafen && c.gold >= kosten;
    return `<button class="small" data-bau="${esc(b)}" ${geht ? '' : 'disabled'}
      title="${esc(def.beschreibung)}">
      ${esc(def.name)} ${stufe}/${def.maxLevel}${voll ? '' : ` · ${formatNumber(kosten)} G`}
    </button>`;
  }).join('');

  const imBau = c.construction.filter((x) => x.provinceId === p.id)
    .map((x) => `<p class="leise-text">Im Bau: ${esc(BUILDINGS[x.building].name)},
      noch ${x.turnsLeft} Runden.</p>`).join('');

  return `${kopf}${kennzahlen}
    <div class="karte-block">${generalBlock}${aktionen}</div>
    ${befehl}${rekrutBlock}
    <div class="karte-block">
      <div class="block-titel">Ausbau</div>
      <div class="reihe eng">${bauKnoepfe}</div>${imBau}
    </div>`;
}

/** Kopfleiste mit den Kennzahlen des Spielerlandes. */
export function kopfleiste(s: GameState): string {
  const c = s.countries[s.playerCountryId];
  const f = computeFinances(s, s.playerCountryId);
  const kriege = s.wars.filter((w) => w.sideA.includes(c.id) || w.sideB.includes(c.id)).length;

  const kennzahl = (wert: string, etikett: string, klasse = '') =>
    `<div class="kennzahl"><span class="wert ${klasse}">${wert}</span>
      <span class="etikett">${esc(etikett)}</span></div>`;

  const punkte = Array.from({ length: c.maxActionPoints }, (_, i) =>
    `<span class="punkt ${i < c.actionPoints ? 'voll' : ''}"></span>`).join('');

  return `
    <div class="kopf-land">
      ${flaggeSvg(c.flag, c.color, 38, c.emblem)}
      <div class="kopf-land-text">
        <b>${esc(c.name)}</b>
        <span class="leise-text">${esc(formatDate(s.year, s.turn, s.monthsPerTurn))}
          &middot; Runde ${s.turn}</span>
      </div>
    </div>
    <div class="kennzahlen">
      ${kennzahl(formatNumber(Math.round(c.gold)), 'Gold', 'messing')}
      ${kennzahl(formatSigned(Math.round(f.net)), 'Bilanz', f.net >= 0 ? 'gut' : 'schlecht')}
      ${kennzahl(formatNumber(countryArmy(s, c.id)), 'Heer')}
      ${kennzahl(String(Math.round(c.stability)), 'Stabil.', c.stability < 35 ? 'schlecht' : '')}
      ${kennzahl(String(Math.round(c.politicalPower)), 'Einfluss')}
      ${kriege ? kennzahl(String(kriege), 'Kriege', 'schlecht') : ''}
      <div class="kennzahl"><span class="punkte-reihe">${punkte}</span>
        <span class="etikett">Aktionen</span></div>
    </div>
    <button class="haupt runde-knopf ${c.actionPoints === 0 ? 'bereit' : ''}"
      data-runde>Runde beenden</button>`;
}

/** Nur für die Laenderauswahl im Aufbaubildschirm. */
export function landVorschau(s: GameState, c: Country): string {
  const g = provincesOf(s, c.id);
  return `
    <div class="land-kopf">
      ${flaggeSvg(c.flag, c.color, 58, c.emblem)}
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="leise-text">${esc(c.ruler)} &middot; ${esc(GOVERNMENTS[c.government].name)}</div>
      </div>
    </div>
    <p class="lede">${esc(c.description)}</p>
    <div class="gebiets-gitter">
      ${zeile('Hauptstadt', esc(s.provinces[c.capitalProvinceId]?.name ?? '?'))}
      ${zeile('Gebiete', String(g.length))}
      ${zeile('Bevölkerung', formatPopulation(countryPopulation(s, c.id)))}
      ${zeile('Heer', formatNumber(countryArmy(s, c.id)))}
      ${zeile('Gold', formatNumber(c.gold))}
      ${zeile('Stabilität', String(Math.round(c.stability)))}
      ${zeile('Machtkennzahl', formatNumber(powerScore(s, c.id)))}
      ${zeile('Militär', `x${c.traits.military.toFixed(2)}`)}
      ${zeile('Wirtschaft', `x${c.traits.economy.toFixed(2)}`)}
      ${zeile('Verteidigung', `x${c.traits.defense.toFixed(2)}`)}
    </div>`;
}

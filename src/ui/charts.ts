/**
 * Kleine Diagramme als SVG.
 *
 * Bewusst ohne Fremdbibliothek: Die paar Linien und Balken, die das Spiel
 * braucht, waeren den Umfang einer Diagrammbibliothek nicht wert - und die
 * Datei soll klein bleiben.
 */

import { formatNumber } from '../core/format';

export interface Reihe {
  name: string;
  farbe: string;
  werte: Array<{ x: number; y: number }>;
}

/** Liniendiagramm mit Achsen und Gitter. */
export function linienDiagramm(
  reihen: Reihe[], breite = 560, hoehe = 220, achseY = '',
): string {
  const sichtbar = reihen.filter((r) => r.werte.length > 1);
  if (!sichtbar.length) {
    return `<p class="leer">Noch keine Daten - spiele einige Runden.</p>`;
  }

  const padL = 46, padR = 12, padT = 12, padB = 26;
  const alle = sichtbar.flatMap((r) => r.werte);
  const xMin = Math.min(...alle.map((p) => p.x));
  const xMax = Math.max(...alle.map((p) => p.x));
  const yMax = Math.max(1, Math.max(...alle.map((p) => p.y)));
  const spanX = Math.max(1, xMax - xMin);

  const px = (x: number) => padL + ((x - xMin) / spanX) * (breite - padL - padR);
  const py = (y: number) => hoehe - padB - (y / yMax) * (hoehe - padT - padB);

  let gitter = '';
  for (let i = 0; i <= 4; i++) {
    const w = (yMax / 4) * i;
    const y = py(w);
    gitter += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${breite - padR}" y2="${y.toFixed(1)}"
      stroke="var(--linie-fein)" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end"
        font-size="10" fill="var(--text-schwach)">${formatNumber(w)}</text>`;
  }

  let linien = '';
  for (const r of sichtbar) {
    const d = r.werte
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`)
      .join(' ');
    linien += `<path d="${d}" fill="none" stroke="${r.farbe}" stroke-width="2.2"
      stroke-linejoin="round" stroke-linecap="round"/>`;
    const letzter = r.werte[r.werte.length - 1];
    linien += `<circle cx="${px(letzter.x).toFixed(1)}" cy="${py(letzter.y).toFixed(1)}"
      r="3" fill="${r.farbe}"/>`;
  }

  const legende = sichtbar.map((r) =>
    `<span class="legende-punkt"><i style="background:${r.farbe}"></i>${r.name}</span>`).join('');

  return `
    <svg viewBox="0 0 ${breite} ${hoehe}" class="diagramm" role="img"
         aria-label="Verlaufsdiagramm ${achseY}">
      ${gitter}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${hoehe - padB}"
        stroke="var(--linie)" stroke-width="1.2"/>
      <line x1="${padL}" y1="${hoehe - padB}" x2="${breite - padR}" y2="${hoehe - padB}"
        stroke="var(--linie)" stroke-width="1.2"/>
      <text x="${padL}" y="${hoehe - 8}" font-size="10" fill="var(--text-schwach)">Runde ${xMin}</text>
      <text x="${breite - padR}" y="${hoehe - 8}" font-size="10" text-anchor="end"
        fill="var(--text-schwach)">Runde ${xMax}</text>
      ${linien}
    </svg>
    <div class="legende">${legende}</div>`;
}

/** Waagerechtes Balkendiagramm für Ranglisten. */
export function balkenDiagramm(
  eintraege: Array<{ name: string; wert: number; farbe: string; hervor?: boolean }>,
  einheit = '',
): string {
  if (!eintraege.length) return '<p class="leer">Keine Daten.</p>';
  const max = Math.max(...eintraege.map((e) => e.wert), 1);
  return `<div class="balken-liste">${eintraege.map((e) => `
    <div class="balken-zeile${e.hervor ? ' hervor' : ''}">
      <span class="balken-name">${e.name}</span>
      <span class="balken-spur">
        <span class="balken-fuell" style="width:${(e.wert / max) * 100}%;background:${e.farbe}"></span>
      </span>
      <span class="balken-wert">${formatNumber(e.wert)}${einheit}</span>
    </div>`).join('')}</div>`;
}

/**
 * Waage für den Kampfvergleich: zeigt auf einen Blick, wie die Kraefte stehen.
 */
export function kraftWaage(angriff: number, verteidigung: number): string {
  const summe = angriff + verteidigung || 1;
  const a = (angriff / summe) * 100;
  const sieger = angriff > verteidigung ? 'Angreifer' : 'Verteidiger';
  return `
    <div class="waage" role="img"
         aria-label="Kräfteverhältnis ${Math.round(a)} zu ${Math.round(100 - a)}">
      <div class="waage-spur">
        <span class="waage-a" style="width:${a}%"></span>
        <span class="waage-d" style="width:${100 - a}%"></span>
      </div>
      <div class="waage-zahlen">
        <span class="a">${angriff.toFixed(0)}</span>
        <span class="mitte">Vorteil: ${sieger}</span>
        <span class="d">${verteidigung.toFixed(0)}</span>
      </div>
    </div>`;
}

/** Ringdiagramm für die Zusammensetzung eines Heeres. */
export function heeresRing(
  teile: Array<{ name: string; wert: number; farbe: string }>, groesse = 110,
): string {
  const summe = teile.reduce((s, t) => s + t.wert, 0);
  if (summe <= 0) return '<p class="leer">Keine Truppen.</p>';
  const r = 42, u = 2 * Math.PI * r;
  let versatz = 0;
  const ringe = teile.filter((t) => t.wert > 0).map((t) => {
    const anteil = t.wert / summe;
    const laenge = anteil * u;
    const el = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${t.farbe}"
      stroke-width="15" stroke-dasharray="${laenge.toFixed(2)} ${(u - laenge).toFixed(2)}"
      stroke-dashoffset="${(-versatz).toFixed(2)}" transform="rotate(-90 50 50)"/>`;
    versatz += laenge;
    return el;
  }).join('');

  const legende = teile.filter((t) => t.wert > 0).map((t) =>
    `<span class="legende-punkt"><i style="background:${t.farbe}"></i>${t.name} ${t.wert}</span>`).join('');

  return `<div class="ring-block">
    <svg viewBox="0 0 100 100" width="${groesse}" height="${groesse}" class="ring">
      ${ringe}
      <text x="50" y="54" text-anchor="middle" font-size="19" font-weight="700"
        fill="var(--text)">${summe}</text>
    </svg>
    <div class="legende senkrecht">${legende}</div>
  </div>`;
}

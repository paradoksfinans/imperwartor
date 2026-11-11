/**
 * Die Karte.
 *
 * Gezeichnet wird unmittelbar als SVG, ohne Zwischenschicht. Bei über 200
 * Gebieten zahlt sich das aus: Beim Verschieben wird nur eine einzige
 * Transformationsangabe geaendert, nicht der Baum neu aufgebaut.
 *
 * Gestaltung: Die Karte soll wie ein Blatt aus einem Atlas wirken - gedeckte
 * Flächen, feine Grenzen, eine Schattierung, die Gebirge spuerbar macht.
 * Farben allein reichen nicht: Bündnis, Krieg und Auswahl werden zusaetzlich
 * durch Muster und Rahmen gekennzeichnet, damit die Karte auch bei
 * Farbfehlsichtigkeit lesbar bleibt.
 */

import type { GameState, Province } from '../core/types';
import {
  TERRAIN, areAllied, areAtWar, getRelation, regimentsTotal,
} from '../core/rules';
import { provinceOutput } from '../core/economy';
import { abdunkeln, aufhellen } from './heraldry';

export type MapFilterId =
  | 'political' | 'diplomatic' | 'economy' | 'population' | 'stability'
  | 'military' | 'supply' | 'terrain' | 'resources' | 'alliances';

export const MAP_FILTERS: Array<{ id: MapFilterId; label: string }> = [
  { id: 'political',  label: 'Politisch' },
  { id: 'diplomatic', label: 'Diplomatie' },
  { id: 'alliances',  label: 'Bündnisse' },
  { id: 'military',   label: 'Militär' },
  { id: 'economy',    label: 'Wirtschaft' },
  { id: 'population', label: 'Bevölkerung' },
  { id: 'stability',  label: 'Unruhe' },
  { id: 'supply',     label: 'Versorgung' },
  { id: 'resources',  label: 'Rohstoffe' },
  { id: 'terrain',    label: 'Gelände' },
];

export type SelectionMode = 'none' | 'move' | 'attack';

export interface MapCallbacks {
  onSelect(provinceId: string): void;
  onLongPress?(provinceId: string): void;
}

interface Transform { x: number; y: number; scale: number; }

const ZIEH_SCHWELLE = 6;

/* ------------------------------------------------------------------ */
/* Farbwahl je Ansicht                                                 */
/* ------------------------------------------------------------------ */

function stufenFarbe(wert: number, von: string, bis: string): string {
  const t = Math.max(0, Math.min(1, wert));
  const h = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(von);
  const [r2, g2, b2] = h(bis);
  const m = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const ROHSTOFF_FARBEN: Record<string, string> = {
  none: '#3f4a55', grain: '#d4b24a', iron: '#8a94a0', timber: '#5d7f4a',
  stone: '#9a9186', gold: '#e3c35a', fish: '#5f9fa8', oil: '#4a4452', horses: '#b07f4a',
};

export function fuellFarbe(state: GameState, p: Province, filter: MapFilterId): string {
  const spieler = state.playerCountryId;
  const besitzer = p.ownerId ? state.countries[p.ownerId] : null;

  switch (filter) {
    case 'political':
      if (!besitzer) return '#3b454f';
      return besitzer.color;

    case 'diplomatic': {
      if (!besitzer) return '#3b454f';
      if (besitzer.id === spieler) return '#3f7fb5';
      if (areAtWar(state, spieler, besitzer.id)) return '#b2403a';
      if (areAllied(state, spieler, besitzer.id)) return '#4f9f6a';
      if (besitzer.overlordId === spieler) return '#6f8fb5';
      const r = getRelation(state, spieler, besitzer.id);
      return stufenFarbe((r + 100) / 200, '#8f4a46', '#4a8f6a');
    }

    case 'alliances': {
      if (!besitzer) return '#3b454f';
      const bund = state.alliances.find((a) => a.memberIds.includes(besitzer.id));
      if (!bund) return '#4a545e';
      const idx = state.alliances.indexOf(bund);
      const paletten = ['#4a7fd4', '#c2564a', '#58a37f', '#d9a441', '#9b7fd4', '#41b0c9'];
      return paletten[idx % paletten.length];
    }

    case 'economy':
      return stufenFarbe(Math.min(1, provinceOutput(p) / 90), '#2f3a44', '#e0c060');

    case 'population':
      return stufenFarbe(Math.min(1, p.population / 4_000_000), '#2f3a44', '#d87f5a');

    case 'stability':
      return stufenFarbe(Math.min(1, p.unrest / 100), '#3f7f5a', '#c2403a');

    case 'military':
      return stufenFarbe(Math.min(1, regimentsTotal(p.regiments) / 40), '#2f3a44', '#d4604a');

    case 'supply':
      return stufenFarbe(p.supply / 100, '#8a3f3a', '#4f9f7a');

    case 'resources':
      return ROHSTOFF_FARBEN[p.resource] ?? '#3f4a55';

    case 'terrain':
      return TERRAIN[p.terrain]?.farbe ?? '#6f7f5f';

    default:
      return '#4a545e';
  }
}

/* ------------------------------------------------------------------ */
/* Die Kartenansicht                                                   */
/* ------------------------------------------------------------------ */

export class MapView {
  readonly element: HTMLElement;
  /** Kennung der dargestellten Karte - der Aufrufer erkennt daran,
      ob er die Ansicht weiterverwenden darf oder neu bauen muss. */
  readonly kartenId: string;
  private welt!: SVGGElement;
  private flaechenEbene!: SVGGElement;
  private kennzeichenEbene!: SVGGElement;
  private pfeilEbene!: SVGGElement;
  private beschriftungEbene!: SVGGElement;
  /** Alle Landflächen als eine Gruppe - erzeugt den Küstensaum. */
  private kuestenEbene!: SVGGElement;
  /** Je Land eine Gruppe - erzeugt die Staatsgrenzen. */
  private grenzEbene!: SVGGElement;
  /** Kurzlebige Eroberungsblitze. Eigene Ebene, weil die Kennzeichenebene
      bei jedem Zeichnen geleert wird und die Animation sonst abbräche. */
  private blitzEbene!: SVGGElement;
  /** Besitzstand beim letzten Grenzaufbau, um unnötige Arbeit zu sparen. */
  private grenzStand = '';
  /**
   * Enger Ausschnitt um das tatsächliche Land.
   *
   * Die Kartendateien bringen einen grosszügigen Rahmen mit, in dem das Land
   * oft nur zwei Drittel der Fläche einnimmt. Auf einem Telefon ist das
   * verschenkter Platz, deshalb wird der Ausschnitt beim Aufbau einmal eng
   * um die Gebiete gelegt. Alle Zoomrechnungen beziehen sich darauf.
   */
  private sichtfeld = { x: 0, y: 0, w: 1000, h: 1000 };
  /** Letzter bekannter Besitzer je Gebiet - erkennt Eroberungen. */
  private letzterBesitz = new Map<string, string | null>();

  private flaechen = new Map<string, SVGPolygonElement>();
  private beschriftungen = new Map<string, SVGGElement>();

  private transform: Transform = { x: 0, y: 0, scale: 1 };
  private zeiger = new Map<number, { x: number; y: number }>();
  private letzteMitte: { x: number; y: number } | null = null;
  private letzterAbstand = 0;
  private ziehWeg = 0;

  private state: GameState;
  private filter: MapFilterId = 'political';
  private ausgewaehlt: string | null = null;
  private hervorgehoben = new Set<string>();
  private modus: SelectionMode = 'none';
  private cb: MapCallbacks;
  private breiten = new Map<string, number>();
  private beobachter: ResizeObserver | null = null;
  /** true, sobald der Nutzer die Ansicht selbst veraendert hat. */
  private selbstBewegt = false;

  constructor(state: GameState, cb: MapCallbacks) {
    this.state = state;
    this.kartenId = state.mapId;
    this.cb = cb;
    this.element = document.createElement('div');
    this.element.className = 'karte';
    this.baueGeruest();
    this.baueFlaechen();
    this.zeichne();

    /* Im Konstruktor steht das Element noch nicht im Dokument und hat
       deshalb keine Größe. Erst wenn eine echte Breite vorliegt, lässt
       sich sinnvoll einpassen - danach nur noch bei Groessenwechsel. */
    if (typeof ResizeObserver !== 'undefined') {
      this.beobachter = new ResizeObserver(() => {
        const r = this.element.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        // Solange niemand selbst gezoomt oder geschoben hat, bleibt die
        // Karte eingepasst - auch wenn sich die Flaeche noch einmal
        // aendert, etwa weil die Kopfleiste umbricht.
        if (!this.selbstBewegt) {
          this.einpassen();
          this.zeichne();
        } else {
          this.beschriftungAktualisieren();
        }
      });
      this.beobachter.observe(this.element);
    } else {
      window.setTimeout(() => { this.einpassen(); this.zeichne(); }, 0);
    }
  }

  /* ---------------- Aufbau ---------------- */

  private baueGeruest(): void {
    const ns = 'http://www.w3.org/2000/svg';
    this.berechneSichtfeld();
    const svg = document.createElementNS(ns, 'svg');
    const sf = this.sichtfeld;
    svg.setAttribute('viewBox', `${sf.x} ${sf.y} ${sf.w} ${sf.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.classList.add('karte-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Karte des Spielgebiets');

    // Muster und Verlaeufe
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = `
      <!-- Meer: Tiefenverlauf mit feiner Wellenstruktur -->
      <linearGradient id="meer" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#17252f"/>
        <stop offset="0.55" stop-color="#101d27"/>
        <stop offset="1" stop-color="#0b1620"/>
      </linearGradient>
      <pattern id="p-wellen" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M0 13 q6.5 -4 13 0 t13 0" fill="none"
              stroke="rgba(126,178,200,.07)" stroke-width="1"/>
        <path d="M0 26 q6.5 -4 13 0 t13 0" fill="none"
              stroke="rgba(126,178,200,.045)" stroke-width="1"/>
      </pattern>

      <!-- Küstensaum: weicher Lichtrand, wo Land auf Wasser trifft -->
      <filter id="küste" x="-12%" y="-12%" width="124%" height="124%">
        <feMorphology operator="dilate" radius="2.4" in="SourceAlpha" result="dick"/>
        <feGaussianBlur in="dick" stdDeviation="5" result="weich"/>
        <feFlood flood-color="#5f93c4" flood-opacity="0.34" result="farbe"/>
        <feComposite in="farbe" in2="weich" operator="in" result="saum"/>
        <feMerge><feMergeNode in="saum"/></feMerge>
      </filter>

      <!-- Innenschatten: gibt den Flächen Wölbung statt Papierflachheit -->
      <filter id="wölbung" x="-6%" y="-6%" width="112%" height="112%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b"/>
        <feOffset in="b" dx="0" dy="2.5" result="o"/>
        <feComposite in="SourceAlpha" in2="o" operator="out" result="rand"/>
        <feFlood flood-color="#000" flood-opacity="0.4" result="dunkel"/>
        <feComposite in="dunkel" in2="rand" operator="in"/>
      </filter>

      <!-- Geländetexturen: Muster statt Farbe allein -->
      <pattern id="t-gebirge" width="22" height="18" patternUnits="userSpaceOnUse">
        <path d="M2 15 L7 5 L12 15 M10 15 L15 8 L20 15" fill="none"
              stroke="rgba(255,255,255,.30)" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M2 15 L7 5 L12 15 M10 15 L15 8 L20 15" fill="none"
              stroke="rgba(0,0,0,.22)" stroke-width="1.3" stroke-linejoin="round"
              transform="translate(0.8,1)"/>
      </pattern>
      <pattern id="t-wald" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M5 13 L5 10 M5 10 L2.5 10 L5 4.5 L7.5 10 Z" fill="rgba(0,0,0,.2)"
              stroke="rgba(255,255,255,.18)" stroke-width=".8"/>
        <path d="M12 15 L12 12.5 M12 12.5 L10 12.5 L12 8 L14 12.5 Z" fill="rgba(0,0,0,.16)"
              stroke="rgba(255,255,255,.14)" stroke-width=".7"/>
      </pattern>
      <pattern id="t-wüste" width="17" height="13" patternUnits="userSpaceOnUse">
        <path d="M1 9 q4 -3.5 8 0 t8 0" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1"/>
        <path d="M1 4 q4 -3 8 0" fill="none" stroke="rgba(255,255,255,.12)" stroke-width=".8"/>
      </pattern>
      <pattern id="t-sumpf" width="15" height="13" patternUnits="userSpaceOnUse">
        <path d="M2 7 h5 M9 11 h4 M4 11 h2" stroke="rgba(255,255,255,.2)" stroke-width="1.2"
              stroke-linecap="round"/>
      </pattern>
      <pattern id="t-steppe" width="14" height="14" patternUnits="userSpaceOnUse">
        <path d="M3 11 q1 -4 2 -5 M8 12 q1 -3.5 2 -4.5" fill="none"
              stroke="rgba(255,255,255,.17)" stroke-width="1"/>
      </pattern>
      <pattern id="t-stadt" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect x="3" y="6" width="3" height="5" fill="rgba(255,255,255,.22)"/>
        <rect x="8" y="4" width="3" height="7" fill="rgba(255,255,255,.17)"/>
      </pattern>
      <!-- Schattierung für Höhenwirkung: Licht von oben links -->
      <linearGradient id="relief" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.28"/>
      </linearGradient>
      <!-- Muster: Krieg -->
      <pattern id="p-krieg" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="none"/>
        <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,.5)" stroke-width="2.5"/>
      </pattern>
      <!-- Muster: Bündnis -->
      <pattern id="p-bund" width="9" height="9" patternUnits="userSpaceOnUse">
        <circle cx="4.5" cy="4.5" r="1.7" fill="rgba(255,255,255,.45)"/>
      </pattern>
      <!-- Muster: Vasall -->
      <pattern id="p-vasall" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,.38)" stroke-width="1.6"/>
      </pattern>
      <!-- Muster: Belagerung -->
      <pattern id="p-belagert" width="7" height="7" patternUnits="userSpaceOnUse">
        <path d="M0 7 L7 0" stroke="rgba(255,90,70,.75)" stroke-width="2"/>
      </pattern>
      <!-- Leuchten für die Auswahl -->
      <filter id="leuchten" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="b1"/>
        <feGaussianBlur stdDeviation="2" result="b2"/>
        <feMerge>
          <feMergeNode in="b1"/><feMergeNode in="b2"/><feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Staatsgrenze: Ring um die Vereinigung aller Gebiete eines Landes.
           Der Umweg über einen Filter ist Absicht. Die Gebietsformen stammen
           aus getrennten Zuschnitten, ihre Kanten liegen nicht Punkt auf Punkt
           aufeinander - geteilte Kanten liessen sich also nicht zuverlässig
           berechnen. Eine Verdickung der Deckkraft minus der Deckkraft selbst
           ergibt den Umriss der Vereinigung, ganz ohne Geometrie. -->
      <filter id="staatsgrenze" x="-10%" y="-10%" width="120%" height="120%">
        <feMorphology operator="dilate" radius="2.1" in="SourceAlpha" result="dick"/>
        <feComposite in="dick" in2="SourceAlpha" operator="out" result="ring"/>
        <feFlood flood-color="#f2f7fb" flood-opacity="0.5" result="farbe"/>
        <feComposite in="farbe" in2="ring" operator="in"/>
      </filter>

      <!-- Dieselbe Technik, kräftiger: Umriss des eigenen Reiches -->
      <filter id="eigengrenze" x="-14%" y="-14%" width="128%" height="128%">
        <feMorphology operator="dilate" radius="3" in="SourceAlpha" result="dick"/>
        <feComposite in="dick" in2="SourceAlpha" operator="out" result="ring"/>
        <feFlood flood-color="#ffd98a" flood-opacity="0.95" result="farbe"/>
        <feComposite in="farbe" in2="ring" operator="in" result="linie"/>
        <feGaussianBlur in="linie" stdDeviation="2.5" result="schein"/>
        <feMerge><feMergeNode in="schein"/><feMergeNode in="linie"/></feMerge>
      </filter>

      <!-- Gitternetz des Meeres: gibt der Fläche Massstab -->
      <pattern id="p-gitter" width="120" height="120" patternUnits="userSpaceOnUse">
        <path d="M120 0 V120 M0 120 H120" fill="none"
              stroke="rgba(118,166,196,.055)" stroke-width="1"/>
      </pattern>

      <!-- Schimmer für frisch erobertes Gebiet -->
      <radialGradient id="eroberung">
        <stop offset="0" stop-color="#ffe6a8" stop-opacity="0.85"/>
        <stop offset="0.6" stop-color="#ffc24d" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#ffb020" stop-opacity="0"/>
      </radialGradient>
      <marker id="pfeilspitze" viewBox="0 0 10 10" refX="8" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
      </marker>
    `;
    svg.appendChild(defs);

    const welt = document.createElementNS(ns, 'g');
    welt.classList.add('welt');

    // Meeresgrund: Tiefenverlauf, darüber Gitternetz und Wellen.
    // Drei dünne Lagen wirken ruhiger als eine kräftige.
    const { w: vw, h: vh } = this.sichtfeld;
    for (const fuellung of ['url(#meer)', 'url(#p-gitter)', 'url(#p-wellen)']) {
      const lage = document.createElementNS(ns, 'rect');
      lage.setAttribute('x', '-2000'); lage.setAttribute('y', '-2000');
      lage.setAttribute('width', String(vw + 4000));
      lage.setAttribute('height', String(vh + 4000));
      lage.setAttribute('fill', fuellung);
      welt.appendChild(lage);
    }

    // Küstensaum: alle Landflächen als eine Gruppe, der Filter arbeitet auf
    // deren gemeinsamer Deckkraft und zeichnet dadurch nur die Aussenkante
    // des Landes nach - nicht jede Gebietsgrenze.
    this.kuestenEbene = document.createElementNS(ns, 'g');
    this.kuestenEbene.setAttribute('pointer-events', 'none');
    this.kuestenEbene.setAttribute('filter', 'url(#küste)');
    welt.appendChild(this.kuestenEbene);

    this.flaechenEbene = document.createElementNS(ns, 'g');
    this.kennzeichenEbene = document.createElementNS(ns, 'g');
    this.kennzeichenEbene.setAttribute('pointer-events', 'none');
    this.pfeilEbene = document.createElementNS(ns, 'g');
    this.pfeilEbene.setAttribute('pointer-events', 'none');
    this.beschriftungEbene = document.createElementNS(ns, 'g');
    this.beschriftungEbene.setAttribute('pointer-events', 'none');

    this.grenzEbene = document.createElementNS(ns, 'g');
    this.grenzEbene.setAttribute('pointer-events', 'none');
    this.blitzEbene = document.createElementNS(ns, 'g');
    this.blitzEbene.setAttribute('pointer-events', 'none');

    welt.appendChild(this.flaechenEbene);
    welt.appendChild(this.kennzeichenEbene);
    welt.appendChild(this.grenzEbene);
    welt.appendChild(this.blitzEbene);
    welt.appendChild(this.pfeilEbene);
    welt.appendChild(this.beschriftungEbene);
    svg.appendChild(welt);

    this.welt = welt;
    this.element.appendChild(svg);

    this.bedienung();
    this.zoomKnoepfe();
  }

  /** Legt den Ausschnitt eng um alle Gebiete, mit etwas Luft am Rand. */
  private berechneSichtfeld(): void {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pid of this.state.provinceOrder) {
      for (const paar of this.state.provinces[pid].points.split(' ')) {
        const k = paar.indexOf(',');
        if (k < 0) continue;
        const x = +paar.slice(0, k);
        const y = +paar.slice(k + 1);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!Number.isFinite(minX)) {
      const [x, y, w, h] = this.state.viewBox.split(' ').map(Number);
      this.sichtfeld = { x, y, w, h };
      return;
    }
    const luft = Math.max(maxX - minX, maxY - minY) * 0.03;
    this.sichtfeld = {
      x: minX - luft,
      y: minY - luft,
      w: (maxX - minX) + luft * 2,
      h: (maxY - minY) + luft * 2,
    };
  }

  private baueFlaechen(): void {
    const ns = 'http://www.w3.org/2000/svg';
    for (const pid of this.state.provinceOrder) {
      const p = this.state.provinces[pid];
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', p.points);
      poly.setAttribute('data-province', pid);
      poly.classList.add('gebiet');
      poly.addEventListener('click', () => {
        if (this.ziehWeg > ZIEH_SCHWELLE) return;
        this.cb.onSelect(pid);
      });
      this.flaechenEbene.appendChild(poly);
      this.flaechen.set(pid, poly);

      // Dieselbe Form noch einmal für den Küstensaum. Sie ist rein dekorativ,
      // nimmt keine Klicks an und ändert sich nie wieder.
      const saum = document.createElementNS(ns, 'polygon');
      saum.setAttribute('points', p.points);
      saum.setAttribute('fill', '#000');
      this.kuestenEbene.appendChild(saum);

      // Kantenlaenge für die Beschriftungsdichte merken
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const paar of p.points.split(' ')) {
        const k = paar.indexOf(',');
        if (k < 0) continue;
        const x = +paar.slice(0, k); const y = +paar.slice(k + 1);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      this.breiten.set(pid, Number.isFinite(minX) ? Math.min(maxX - minX, maxY - minY) : 0);
    }
  }

  /* ---------------- Bedienung: Verschieben und Zoomen ---------------- */

  private bedienung(): void {
    const el = this.element;

    el.addEventListener('pointerdown', (e) => {
      // Der Zeiger wird bewusst noch nicht eingefangen: Wer das hier tut,
      // leitet das spaetere Klickereignis auf die Karte um - ein Fingertipp
      // auf ein Gebiet kaeme dann nie an dessen Handler an.
      this.zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.zeiger.size === 1) {
        this.letzteMitte = { x: e.clientX, y: e.clientY };
        this.ziehWeg = 0;
      }
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.zeiger.has(e.pointerId)) return;
      this.zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.zeiger.size === 1 && this.letzteMitte) {
        const dx = e.clientX - this.letzteMitte.x;
        const dy = e.clientY - this.letzteMitte.y;
        this.ziehWeg += Math.hypot(dx, dy);
        this.letzteMitte = { x: e.clientX, y: e.clientY };
        if (this.ziehWeg > ZIEH_SCHWELLE) {
          this.selbstBewegt = true;
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          this.transform.x += dx;
          this.transform.y += dy;
          this.anwenden();
        }
        return;
      }

      if (this.zeiger.size >= 2) {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        const [a, b] = [...this.zeiger.values()];
        const abstand = Math.hypot(a.x - b.x, a.y - b.y);
        const mitte = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.letzterAbstand > 0) {
          const faktor = abstand / this.letzterAbstand;
          this.zoomUm(faktor, mitte);
        }
        this.letzterAbstand = abstand;
        this.ziehWeg = 99;
      }
    });

    const ende = (e: PointerEvent) => {
      this.zeiger.delete(e.pointerId);
      if (this.zeiger.size < 2) this.letzterAbstand = 0;
      if (this.zeiger.size === 0) this.letzteMitte = null;
    };
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointercancel', ende);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      this.zoomUm(e.deltaY < 0 ? 1.12 : 1 / 1.12, {
        x: e.clientX - r.left, y: e.clientY - r.top,
      }, true);
    }, { passive: false });
  }

  private zoomKnoepfe(): void {
    const box = document.createElement('div');
    box.className = 'karte-regler';
    const mach = (zeichen: string, titel: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = zeichen;
      b.title = titel;
      b.setAttribute('aria-label', titel);
      b.addEventListener('click', fn);
      box.appendChild(b);
    };
    mach('+', 'Hineinzoomen', () => this.zoomMitte(1.3));
    mach('−', 'Herauszoomen', () => this.zoomMitte(1 / 1.3));
    mach('⌂', 'Ansicht zurücksetzen', () => {
      this.selbstBewegt = false;
      this.einpassen();
      this.zeichne();
    });
    this.element.appendChild(box);
  }

  private zoomUm(faktor: number, punkt: { x: number; y: number }, relativ = false): void {
    this.selbstBewegt = true;
    const r = this.element.getBoundingClientRect();
    const px = relativ ? punkt.x : punkt.x - r.left;
    const py = relativ ? punkt.y : punkt.y - r.top;
    const neu = Math.max(0.4, Math.min(14, this.transform.scale * faktor));
    const echterFaktor = neu / this.transform.scale;
    this.transform.x = px - (px - this.transform.x) * echterFaktor;
    this.transform.y = py - (py - this.transform.y) * echterFaktor;
    this.transform.scale = neu;
    this.anwenden();
    this.beschriftungAktualisieren();
  }

  private zoomMitte(faktor: number): void {
    const r = this.element.getBoundingClientRect();
    this.zoomUm(faktor, { x: r.width / 2, y: r.height / 2 }, true);
  }

  private anwenden(): void {
    this.welt.setAttribute(
      'transform',
      `translate(${this.transform.x} ${this.transform.y}) scale(${this.transform.scale})`,
    );
  }

  /**
   * Setzt die Ansicht so, dass die Landmasse den Bildschirm füllt.
   *
   * Nicht die Zeichenflaeche wird eingepasst, sondern der tatsaechliche
   * Inhalt: Eine Karte mit viel Wasser am Rand wuerde sonst winzig in der
   * Mitte stehen, besonders auf hohen Telefonbildschirmen.
   */
  /**
   * Zeigt das Reich eines Landes mit etwas Umland.
   *
   * Beim Spielstart die ganze Karte einzupassen ist wenig hilfreich: Das
   * eigene Reich liegt dann irgendwo am Rand und man sucht erst einmal.
   * Hier wird auf die eigenen Gebiete gezoomt, aber so weit herausgehalten,
   * dass die Nachbarn sichtbar bleiben - die sind schliesslich der Grund,
   * warum man hinschaut.
   */
  zeigeReich(countryId: string): void {
    const eigene = this.state.provinceOrder
      .filter((id) => this.state.provinces[id]?.ownerId === countryId);
    if (!eigene.length) { this.einpassen(); return; }
    this.einpassen(eigene, 2.4);
    /* Als eigene Bewegung merken: Die Groessenueberwachung passt die Karte
       sonst beim naechsten Messvorgang wieder auf das Ganze ein und der
       Blick aufs eigene Reich waere sofort wieder weg. */
    this.selbstBewegt = true;
  }

  einpassen(nurGebiete?: string[], ausschnittLuft = 1): void {
    const r = this.element.getBoundingClientRect();
    const { w: vw, h: vh } = this.sichtfeld;
    if (!r.width || !r.height || !vw || !vh) {
      this.transform = { x: 0, y: 0, scale: 1 };
      this.anwenden();
      return;
    }

    // Umgrenzung aller Gebiete - in Koordinaten der Zeichenflaeche
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of nurGebiete ?? this.state.provinceOrder) {
      const punkte = this.state.provinces[id]?.points;
      if (!punkte) continue;
      for (const paar of punkte.split(' ')) {
        const k = paar.indexOf(',');
        if (k < 0) continue;
        const x = +paar.slice(0, k);
        const y = +paar.slice(k + 1);
        if (Number.isNaN(x) || Number.isNaN(y)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
      this.transform = { x: 0, y: 0, scale: 1 };
      this.anwenden();
      return;
    }

    /* Wichtig: Der Transform der Weltgruppe wirkt im Koordinatensystem der
       Zeichenflaeche, nicht in Bildschirmpixeln. Deshalb wird die sichtbare
       Flaeche zuerst in Zeichenkoordinaten umgerechnet. */
    const basis = Math.min(r.width / vw, r.height / vh);   // Pixel je Einheit
    const sichtbarB = r.width / basis;
    const sichtbarH = r.height / basis;

    // Mit Umland: der Ausschnitt wird gegenueber dem Reich vergroessert.
    const inhaltB = (maxX - minX) * ausschnittLuft;
    const inhaltH = (maxY - minY) * ausschnittLuft;
    const rand = 0.94;
    const faktor = Math.max(0.5, Math.min(
      (sichtbarB * rand) / inhaltB,
      (sichtbarH * rand) / inhaltH,
    ));

    /* Wegen xMidYMid liegt die Mitte der sichtbaren Flaeche in der Mitte des
       Ausschnitts - und der beginnt nicht bei null, sondern bei sichtfeld.x/y.
       Dieser Versatz muss mitgerechnet werden, sonst rutscht die Karte um ihn
       aus dem Bild. */
    const sf = this.sichtfeld;
    const mitteX = sf.x + sf.w / 2;
    const mitteY = sf.y + sf.h / 2;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    this.transform = {
      scale: faktor,
      x: mitteX - cx * faktor,
      y: mitteY - cy * faktor,
    };
    this.anwenden();
    this.beschriftungAktualisieren();
  }

  /** Führt die Ansicht auf ein Gebiet. */
  zeigeAuf(provinceId: string): void {
    const p = this.state.provinces[provinceId];
    if (!p) return;
    this.selbstBewegt = true;
    const r = this.element.getBoundingClientRect();
    const sf = this.sichtfeld;
    const basis = Math.min(r.width / sf.w, r.height / sf.h);
    const ziel = Math.max(this.transform.scale, 2.2);
    this.transform.scale = ziel;
    // SVG-Koordinate in Bildschirmkoordinate umrechnen. Der Ausschnitt
    // beginnt nicht bei null, sein Versatz muss abgezogen werden.
    const sx = ((p.center[0] - sf.x) * basis) * ziel;
    const sy = ((p.center[1] - sf.y) * basis) * ziel;
    this.transform.x = r.width / 2 - sx;
    this.transform.y = r.height / 2 - sy;
    this.anwenden();
    this.beschriftungAktualisieren();
  }

  /* ---------------- Zustand setzen ---------------- */

  setState(state: GameState): void { this.state = state; }
  setFilter(f: MapFilterId): void { this.filter = f; this.zeichne(); }
  getFilter(): MapFilterId { return this.filter; }

  setAuswahl(id: string | null, modus: SelectionMode, ziele: string[]): void {
    this.ausgewaehlt = id;
    this.modus = modus;
    this.hervorgehoben = new Set(ziele);
    this.zeichne();
  }

  /* ---------------- Zeichnen ---------------- */

  zeichne(): void {
    const s = this.state;
    const spieler = s.playerCountryId;

    for (const pid of s.provinceOrder) {
      const p = s.provinces[pid];
      const poly = this.flaechen.get(pid);
      if (!poly) continue;

      /* Besitzwechsel sichtbar machen.
         Zwischen zwei Runden verschiebt die KI still Grenzen. Ohne ein
         kurzes Aufleuchten merkt der Spieler nicht, was ihm genommen wurde
         oder was ein Verbündeter gewonnen hat. */
      const vorher = this.letzterBesitz.get(pid);
      const jetzt = p.ownerId ?? null;
      if (vorher !== undefined && vorher !== jetzt) this.blitzeAuf(pid, jetzt);
      this.letzterBesitz.set(pid, jetzt);

      poly.setAttribute('fill', fuellFarbe(s, p, this.filter));

      const besitzer = p.ownerId ? s.countries[p.ownerId] : null;
      const eigen = p.ownerId === spieler;
      const klassen = ['gebiet'];
      if (eigen) klassen.push('eigen');
      if (this.ausgewaehlt === pid) klassen.push('gewaehlt');
      if (this.hervorgehoben.has(pid)) {
        klassen.push(this.modus === 'attack' ? 'ziel-angriff' : 'ziel-bewegen');
      }
      if (p.siege) klassen.push('belagert');
      poly.setAttribute('class', klassen.join(' '));

      // Rahmenfarbe: Besitzer erkennbar machen, auch in Sachansichten
      if (this.filter === 'political' || this.filter === 'diplomatic' || this.filter === 'alliances') {
        poly.setAttribute('stroke', besitzer ? abdunkeln(besitzer.color, 0.55) : '#2a333c');
      } else {
        poly.setAttribute('stroke', 'rgba(10,16,22,.75)');
      }
    }

    this.zeichneGrenzen();
    this.zeichneKennzeichen();
    this.beschriftungAktualisieren();
  }

  /**
   * Staatsgrenzen.
   *
   * Ohne sie zerfällt die Karte optisch in lauter gleichwertige Kästchen:
   * die Grenze zwischen zwei Bundesländern sieht aus wie die zwischen zwei
   * Reichen. Jedes Land bekommt deshalb eine eigene Gruppe, auf der ein
   * Filter den Umriss der Vereinigung zieht. Das eigene Reich wird dabei
   * golden hervorgehoben.
   *
   * Der Aufbau ist teuer, aber nur nötig, wenn sich der Besitzstand ändert -
   * also nach Eroberungen, nicht bei jedem Zeichnen.
   */
  private zeichneGrenzen(): void {
    const s = this.state;
    if (this.filter !== 'political' && this.filter !== 'diplomatic'
      && this.filter !== 'alliances') {
      if (this.grenzStand !== 'aus') {
        this.grenzEbene.textContent = '';
        this.grenzStand = 'aus';
      }
      return;
    }

    const stand = this.filter + '|'
      + s.provinceOrder.map((pid) => s.provinces[pid].ownerId ?? '-').join(',');
    if (stand === this.grenzStand) return;
    this.grenzStand = stand;

    const ns = 'http://www.w3.org/2000/svg';
    this.grenzEbene.textContent = '';

    const nachLand = new Map<string, string[]>();
    for (const pid of s.provinceOrder) {
      const besitzer = s.provinces[pid].ownerId;
      if (!besitzer) continue;
      const liste = nachLand.get(besitzer);
      if (liste) liste.push(pid);
      else nachLand.set(besitzer, [pid]);
    }

    for (const [landId, gebiete] of nachLand) {
      const gruppe = document.createElementNS(ns, 'g');
      gruppe.setAttribute(
        'filter',
        landId === s.playerCountryId ? 'url(#eigengrenze)' : 'url(#staatsgrenze)',
      );
      for (const pid of gebiete) {
        const form = document.createElementNS(ns, 'polygon');
        form.setAttribute('points', s.provinces[pid].points);
        form.setAttribute('fill', '#000');
        gruppe.appendChild(form);
      }
      this.grenzEbene.appendChild(gruppe);
    }
  }

  /**
   * Lässt ein Gebiet kurz aufleuchten, wenn es den Besitzer gewechselt hat.
   *
   * Die Form wird dafür einmalig verdoppelt und nach dem Ablauf wieder
   * entfernt - so bleibt die eigentliche Fläche unberührt und das Leuchten
   * stört weder Klicks noch das nächste Zeichnen.
   */
  private blitzeAuf(pid: string, neuerBesitzer: string | null): void {
    const p = this.state.provinces[pid];
    if (!p) return;
    const ns = 'http://www.w3.org/2000/svg';
    const blitz = document.createElementNS(ns, 'polygon');
    blitz.setAttribute('points', p.points);
    blitz.setAttribute('class', 'eroberungs-blitz');
    const farbe = neuerBesitzer === this.state.playerCountryId
      ? '#ffd98a'
      : neuerBesitzer ? aufhellen(this.state.countries[neuerBesitzer]?.color ?? '#fff', 0.5)
        : '#9fb4c4';
    blitz.setAttribute('fill', farbe);
    blitz.setAttribute('stroke', farbe);
    blitz.setAttribute('stroke-width', '3');
    this.blitzEbene.appendChild(blitz);
    window.setTimeout(() => blitz.remove(), 1600);
  }

  /** Schattierung, Muster für Krieg/Bündnis/Vasall, Hauptstadtzeichen. */
  private zeichneKennzeichen(): void {
    const ns = 'http://www.w3.org/2000/svg';
    const s = this.state;
    const spieler = s.playerCountryId;
    this.kennzeichenEbene.textContent = '';

    for (const pid of s.provinceOrder) {
      const p = s.provinces[pid];

      // Hoehenschattierung: macht Gebirge und Huegel sichtbar
      const relief = TERRAIN[p.terrain]?.relief ?? 0;
      if (relief > 0.15) {
        const schatten = document.createElementNS(ns, 'polygon');
        schatten.setAttribute('points', p.points);
        schatten.setAttribute('fill', 'url(#relief)');
        schatten.setAttribute('opacity', String(Math.min(0.85, relief)));
        this.kennzeichenEbene.appendChild(schatten);
      }

      // Muster für diplomatische Lage - zusaetzlich zur Farbe
      let muster: string | null = null;
      if (p.siege) muster = 'p-belagert';
      else if (p.ownerId && p.ownerId !== spieler) {
        if (areAtWar(s, spieler, p.ownerId)) muster = 'p-krieg';
        else if (s.countries[p.ownerId].overlordId === spieler) muster = 'p-vasall';
        else if (areAllied(s, spieler, p.ownerId)) muster = 'p-bund';
      }
      if (muster && (this.filter === 'political' || this.filter === 'diplomatic')) {
        const m = document.createElementNS(ns, 'polygon');
        m.setAttribute('points', p.points);
        m.setAttribute('fill', `url(#${muster})`);
        this.kennzeichenEbene.appendChild(m);
      }
    }
  }

  /**
   * Beschriftungen.
   *
   * Zwei Regeln halten die Karte lesbar: Die Schrift wird gegen die
   * Vergroesserung gerechnet, bleibt also auf dem Bildschirm gleich gross.
   * Und ein Name erscheint erst, wenn sein Gebiet dafür Platz bietet.
   */
  private beschriftungAktualisieren(): void {
    const ns = 'http://www.w3.org/2000/svg';
    const s = this.state;
    const z = this.transform.scale || 1;
    const r = this.element.getBoundingClientRect();
    const sf = this.sichtfeld;
    const grundZoom = Math.min(r.width / sf.w, r.height / sf.h) || 0.25;
    const wirksam = z * grundZoom;

    this.beschriftungEbene.textContent = '';
    this.beschriftungen.clear();

    for (const pid of s.provinceOrder) {
      const p = s.provinces[pid];
      const breite = (this.breiten.get(pid) ?? 0) * wirksam;
      const gewaehlt = this.ausgewaehlt === pid;
      const staerke = regimentsTotal(p.regiments);
      const zeigeName = gewaehlt || breite > 44;
      /* Plaketten brauchen mehr Platz als blosse Ziffern. Damit die Karte
         beim Herauszoomen nicht zum Perlenteppich wird, erscheinen kleine
         Garnisonen erst später - grosse Heere bleiben dagegen früh sichtbar,
         denn sie sind die strategisch wichtige Information. */
      const zeigeZahl = gewaehlt
        || breite > 30
        || (staerke >= 5 && breite > 20)
        || (staerke >= 12 && breite > 13);
      if (!zeigeName && !zeigeZahl) continue;

      const g = document.createElementNS(ns, 'g');
      const [cx, cy] = p.center;
      const nameGroesse = 13 / z;
      const zahlGroesse = 15 / z;
      const abstand = 12 / z;
      const strich = 3.5 / z;

      if (zeigeName) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', String(cx));
        t.setAttribute('y', String(cy - abstand));
        t.setAttribute('font-size', String(nameGroesse));
        t.setAttribute('stroke-width', String(strich));
        t.setAttribute('class', 'gebiet-name');
        t.textContent = (p.isCapital ? '★ ' : '') + p.name;
        g.appendChild(t);
      }

      /* Truppenstärke als Plakette.
         Eine blosse Ziffer verschwindet auf hellem Gelb und flimmert auf
         gemusterten Flächen. Die dunkle Kapsel darunter macht sie auf jedem
         Untergrund gleich gut lesbar und zeigt zugleich über ihren Rand, wem
         das Heer gehört. */
      const truppen = staerke;
      if (zeigeZahl && truppen > 0) {
        const ziffern = String(truppen);
        const my = zeigeName ? cy + abstand : cy + abstand / 2;
        const hoehe = zahlGroesse * 1.32;
        const breiteKapsel = Math.max(hoehe * 1.15, zahlGroesse * (0.66 * ziffern.length + 0.72));
        const besitzerFarbe = p.ownerId ? s.countries[p.ownerId]?.color : null;

        const kapsel = document.createElementNS(ns, 'rect');
        kapsel.setAttribute('x', String(cx - breiteKapsel / 2));
        kapsel.setAttribute('y', String(my - hoehe * 0.74));
        kapsel.setAttribute('width', String(breiteKapsel));
        kapsel.setAttribute('height', String(hoehe));
        kapsel.setAttribute('rx', String(hoehe / 2));
        kapsel.setAttribute('class', 'truppen-kapsel');
        if (besitzerFarbe) kapsel.setAttribute('stroke', aufhellen(besitzerFarbe, 0.35));
        kapsel.setAttribute('stroke-width', String(1.4 / z));
        g.appendChild(kapsel);

        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', String(cx));
        t.setAttribute('y', String(my));
        t.setAttribute('font-size', String(zahlGroesse * 0.88));
        t.setAttribute('class', 'gebiet-truppen');
        t.textContent = ziffern;
        g.appendChild(t);
      }

      // Belagerungszeichen
      if (p.siege && breite > 20) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', String(cx));
        t.setAttribute('y', String(cy + abstand * 2.4));
        t.setAttribute('font-size', String(11 / z));
        t.setAttribute('stroke-width', String(strich));
        t.setAttribute('class', 'gebiet-name belagerung');
        t.textContent = `Belagert ${Math.round(p.siege.progress)} %`;
        g.appendChild(t);
      }

      this.beschriftungEbene.appendChild(g);
      this.beschriftungen.set(pid, g);
    }
  }

  /* ---------------- Angriffs- und Bewegungspfeile ---------------- */

  /** Zeigt einen Pfeil von einem Gebiet zum anderen. */
  zeigePfeil(vonId: string, nachId: string, art: 'move' | 'attack'): void {
    const ns = 'http://www.w3.org/2000/svg';
    const a = this.state.provinces[vonId];
    const b = this.state.provinces[nachId];
    if (!a || !b) return;

    const g = document.createElementNS(ns, 'g');
    g.setAttribute('class', `pfeil ${art}`);

    // Leichter Bogen statt gerader Linie - wirkt wie eine Marschlinie.
    const mx = (a.center[0] + b.center[0]) / 2;
    const my = (a.center[1] + b.center[1]) / 2;
    const dx = b.center[0] - a.center[0];
    const dy = b.center[1] - a.center[1];
    const laenge = Math.hypot(dx, dy) || 1;
    const bogen = Math.min(40, laenge * 0.22);
    const kx = mx - (dy / laenge) * bogen;
    const ky = my + (dx / laenge) * bogen;

    const pfad = document.createElementNS(ns, 'path');
    pfad.setAttribute('d', `M ${a.center[0]} ${a.center[1]} Q ${kx} ${ky} ${b.center[0]} ${b.center[1]}`);
    pfad.setAttribute('marker-end', 'url(#pfeilspitze)');
    pfad.setAttribute('stroke-width', String(3.5 / this.transform.scale));
    g.appendChild(pfad);
    this.pfeilEbene.appendChild(g);

    // Der Pfeil verschwindet von selbst.
    window.setTimeout(() => g.remove(), 2200);
  }

  pfeileLoeschen(): void { this.pfeilEbene.textContent = ''; }

  /** Lässt ein Gebiet kurz aufleuchten - etwa nach einer Eroberung. */
  blitz(provinceId: string, farbe = '#ffd98a'): void {
    const poly = this.flaechen.get(provinceId);
    if (!poly) return;
    const alt = poly.getAttribute('fill') ?? '#000';
    poly.setAttribute('fill', farbe);
    window.setTimeout(() => poly.setAttribute('fill', alt), 420);
  }
}

/**
 * Prueft, ob sich jedes Spielgebiet einer echten Verwaltungseinheit in den
 * Natural-Earth-Daten zuordnen laesst.
 *
 * Die Spielkarten wurden seinerzeit aus denselben Daten erzeugt, aber stark
 * vergroebert. Die Namen blieben dabei erhalten - ueber sie lassen sich die
 * feinen Umrisse zurueckholen, ohne die Gebietskennungen anzufassen. Das ist
 * entscheidend: Alle Szenarien verweisen auf diese Kennungen.
 *
 * Aufruf: node tools/zuordnung.mjs <ordner-mit-natural-earth>
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

const NE = process.argv[2] ?? '/home/claude/ne-daten';
const KARTEN = path.join(import.meta.dirname, '..', 'src', 'data', 'maps');

/** Vereinheitlicht Namen: Gross/Klein, Akzente, Beiwerk. */
export function schluessel(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function ladeEinheiten(ordner = NE) {
  const a1 = JSON.parse(readFileSync(
    path.join(ordner, 'ne_10m_admin_1_states_provinces.geojson'), 'utf8'));
  const a0 = JSON.parse(readFileSync(
    path.join(ordner, 'ne_10m_admin_0_countries.geojson'), 'utf8'));
  return { a1: a1.features, a0: a0.features };
}

/**
 * Baut ein Namensverzeichnis.
 *
 * Eine Einheit ist unter mehreren Namen erreichbar: dem englischen, dem
 * ortsueblichen, dem deutschen und etwaigen Nebenformen. Die Spielkarten
 * mischen diese Schreibweisen, deshalb wird jede eingetragen.
 */
/**
 * Liest ein Merkmal unabhaengig von der Schreibweise des Feldnamens.
 *
 * Natural Earth fuehrt die Felder der Verwaltungseinheiten klein
 * ("name", "admin"), die der Staaten aber gross ("NAME", "ADMIN"). Daran
 * ist die Zuordnung der Weltkarte zunaechst stillschweigend gescheitert.
 */
export function feld(p, name) {
  return p[name] ?? p[name.toUpperCase()] ?? null;
}

export function baueVerzeichnis(merkmale) {
  const v = new Map();
  const eintrag = (k, f) => { if (k && !v.has(k)) v.set(k, f); };
  for (const f of merkmale) {
    const p = f.properties;
    const g = (n) => feld(p, n);
    for (const n of [g('name'), g('name_en'), g('name_de'), g('name_local'), g('name_alt'),
      g('gn_name'), g('woe_name'), g('admin'), g('geounit'), g('sovereignt'),
      g('brk_name'), g('formal_en'), g('name_long'), g('name_sort'), g('subunit')]) {
      if (!n) continue;
      // name_alt fuehrt mehrere Formen mit senkrechtem Strich.
      for (const teil of String(n).split('|')) eintrag(schluessel(teil), f);
    }
  }
  return v;
}

/** Sucht eine Einheit, erst innerhalb des Staates, dann weltweit. */
export function finde(name, land, proStaat, weltweit) {
  const k = schluessel(name);
  if (land) {
    const inStaat = proStaat.get(schluessel(land));
    const t = inStaat?.streng.get(k) ?? inStaat?.weit.get(k);
    if (t) return t;
  }
  return weltweit.get(k) ?? null;
}

/**
 * Namensverzeichnis je Staat, in zwei Schaerfegraden.
 *
 * "streng" enthaelt nur die eigentlichen Namen einer Einheit, "weit" auch
 * Nebenformen wie name_alt oder gn_name. Die Trennung ist noetig: Bei
 * spanischen Provinzen fuehrt Natural Earth unter den Nebenformen den Namen
 * der uebergeordneten Region mit. Ohne sie traf "Andalucía" die Provinz
 * Cádiz statt der ganzen Region - und auf der Karte fehlten sieben Achtel
 * Andalusiens.
 */
export function baueProStaat(merkmale) {
  const proStaat = new Map();
  for (const f of merkmale) {
    const p = f.properties;
    const g = (n) => feld(p, n);
    const staat = schluessel(g('admin') ?? g('geonunit'));
    if (!proStaat.has(staat)) proStaat.set(staat, { streng: new Map(), weit: new Map() });
    const v = proStaat.get(staat);
    const eintragen = (ziel, namen) => {
      for (const n of namen) {
        if (!n) continue;
        for (const teil of String(n).split('|')) {
          const k = schluessel(teil);
          if (k && !ziel.has(k)) ziel.set(k, f);
        }
      }
    };
    eintragen(v.streng, [g('name'), g('name_en'), g('name_de'), g('name_local')]);
    eintragen(v.weit, [g('name'), g('name_en'), g('name_de'), g('name_local'),
      g('name_alt'), g('gn_name'), g('woe_name')]);
  }
  return proStaat;
}

/* ------------------------------------------------------------------ */

if (import.meta.filename === process.argv[1]) {
  const { a1, a0 } = ladeEinheiten();
  const proStaat = baueProStaat(a1);
  const welt1 = baueVerzeichnis(a1);
  const welt0 = baueVerzeichnis(a0);

  for (const datei of ['europadetail', 'mittelmeer', 'vorderasien', 'welt']) {
    const karte = JSON.parse(readFileSync(path.join(KARTEN, datei + '.json'), 'utf8'));
    const fehlt = [];
    let gut = 0;
    for (const p of karte.provinces) {
      const treffer = p.land
        ? finde(p.name, p.land, proStaat, welt1)
        : (welt0.get(schluessel(p.name)) ?? welt1.get(schluessel(p.name)));
      if (treffer) gut++;
      else fehlt.push(`${p.id} ${p.name}${p.land ? ' (' + p.land + ')' : ''}`);
    }
    console.log(`${datei.padEnd(14)} ${String(gut).padStart(4)}/${karte.provinces.length} zugeordnet`);
    if (fehlt.length) console.log('   fehlt:', fehlt.join(' | '));
  }
}

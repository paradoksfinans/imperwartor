/**
 * Setzt historische Hauptstädte in den Szenarien.
 *
 * Bisher wählte der Aufbau das wirtschaftsstärkste Gebiet eines Landes.
 * Das ergab Unsinn: Grossbritanniens Hauptstadt lag in Nordirland,
 * Frankreichs in Hauts-de-France, Italiens im Aostatal. In einem
 * Geschichtsspiel faellt so etwas sofort auf und kostet Vertrauen.
 *
 * Gewaehlt wird deshalb ueber die tatsaechlichen Koordinaten der Stadt: Die
 * Projektion der Karte wird nachgerechnet und das Gebiet genommen, das den
 * Punkt enthaelt - ersatzweise das naechstgelegene. Namensraten scheitert,
 * weil die Gebiete nach Verwaltungseinheiten heissen, nicht nach Staedten.
 *
 * Aufruf: node tools/hauptstaedte.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WURZEL = path.join(import.meta.dirname, '..');

/** Rahmen und Groesse, mit denen die Karten erzeugt wurden. */
const KARTEN = {
  europadetail: { bbox: [-11.0, 35.0, 42.0, 70.0], w: 1500, h: 1200 },
  mittelmeer:   { bbox: [-10.0, 27.0, 48.0, 50.0], w: 1600, h: 900 },
  vorderasien:  { bbox: [20.0, 24.0, 75.0, 46.0], w: 1600, h: 800 },
};

/** Mercator wie im Kartenwerkzeug. */
function mercator(lon, lat) {
  const b = Math.max(-82, Math.min(82, lat));
  return [lon * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + (b * Math.PI / 180) / 2))];
}

function projektor(karte) {
  const { bbox, w, h } = karte;
  const [minx, miny] = mercator(bbox[0], bbox[1]);
  const [maxx, maxy] = mercator(bbox[2], bbox[3]);
  const rand = 12;
  const s = Math.min((w - 2 * rand) / (maxx - minx), (h - 2 * rand) / (maxy - miny));
  const offx = rand + (w - 2 * rand - (maxx - minx) * s) / 2;
  const offy = rand + (h - 2 * rand - (maxy - miny) * s) / 2;
  return (lon, lat) => {
    const [x, y] = mercator(lon, lat);
    return [offx + (x - minx) * s, offy + (maxy - y) * s];
  };
}

function punkte(p) {
  return p.points.split(' ').map((paar) => {
    const k = paar.indexOf(',');
    return [Number(paar.slice(0, k)), Number(paar.slice(k + 1))];
  });
}

function imPolygon(x, y, ecken) {
  let drin = false;
  for (let i = 0, j = ecken.length - 1; i < ecken.length; j = i++) {
    const [xi, yi] = ecken[i];
    const [xj, yj] = ecken[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

/** Stadt je Land und Szenario. Laender ohne Eintrag bleiben unveraendert. */
const STAEDTE = {
  europa_1914: {
    deutsches_reich:        ['Berlin', 13.40, 52.52],
    frankreich:             ['Paris', 2.35, 48.86],
    grossbritannien:        ['London', -0.13, 51.51],
    russisches_reich:       ['Sankt Petersburg', 30.31, 59.94],
    oesterreich_ungarn:     ['Wien', 16.37, 48.21],
    italien:                ['Rom', 12.50, 41.90],
    osmanisches_reich:      ['Konstantinopel', 28.98, 41.01],
    spanien:                ['Madrid', -3.70, 40.42],
    serbien:                ['Belgrad', 20.46, 44.79],
    rumaenien:              ['Bukarest', 26.10, 44.43],
    bulgarien:              ['Sofia', 23.32, 42.70],
    griechenland:           ['Athen', 23.73, 37.98],
    skandinavien:           ['Stockholm', 18.07, 59.33],
    daenemark:              ['Kopenhagen', 12.57, 55.68],
    niederlande:            ['Amsterdam', 4.90, 52.37],
    belgien:                ['Brüssel', 4.35, 50.85],
    schweiz:                ['Bern', 7.45, 46.95],
  },
  antike_200v: {
    rom:          ['Rom', 12.50, 41.90],
    karthago:     ['Karthago', 10.32, 36.86],
    makedonien:   ['Pella', 22.52, 40.76],
    ptolemaeer:   ['Alexandria', 29.92, 31.20],
    seleukiden:   ['Antiochia', 36.16, 36.20],
    pergamon:     ['Pergamon', 27.18, 39.12],
    iberer:       ['Numantia', -2.44, 41.81],
    gallier:      ['Bibracte', 4.04, 46.92],
    illyrer:      ['Skodra', 19.51, 42.07],
  },
  seldschuken_1071: {
    seldschuken:    ['Isfahan', 51.67, 32.65],
    byzanz:         ['Konstantinopel', 28.98, 41.01],
    fatimiden:      ['Kairo', 31.24, 30.04],
    karachaniden:   ['Samarkand', 66.98, 39.65],
    ghaznawiden:    ['Ghazni', 68.42, 33.55],
    georgien:       ['Tiflis', 44.80, 41.72],
    araber:         ['Damaskus', 36.30, 33.51],
  },
};

/* Gebiete, deren Sammelname die enthaltene Hauptstadt verdeckt. */
const UMBENENNEN = {
  europadetail: {
    eu201: 'Petersburg',   // Sammelgebiet, enthält Sankt Petersburg
    eu166: 'Belgrad',
    eu155: 'Bukarest',
  },
  vorderasien: {
    vo16: 'Isfahan',
    vo59: 'Kairo',
    vo33: 'Damaskus',
  },
  mittelmeer: {
    mi88: 'Alexandria',
  },
};

const kartenGeaendert = new Set();
const kartenDaten = new Map();
let geaendert = 0;

for (const [szenarioId, zuordnung] of Object.entries(STAEDTE)) {
  const szPfad = path.join(WURZEL, 'src/data/scenarios', `${szenarioId}.json`);
  const sz = JSON.parse(await readFile(szPfad, 'utf8'));
  const karte = KARTEN[sz.mapId];
  if (!karte) { console.log(`  ${szenarioId}: Karte ${sz.mapId} unbekannt, übersprungen`); continue; }

  const kPfad = path.join(WURZEL, 'src/data/maps', `${sz.mapId}.json`);
  if (!kartenDaten.has(sz.mapId)) {
    kartenDaten.set(sz.mapId, JSON.parse(await readFile(kPfad, 'utf8')));
  }
  const k = kartenDaten.get(sz.mapId);
  const nachId = new Map(k.provinces.map((p) => [p.id, p]));
  const proj = projektor(karte);

  for (const land of sz.countries) {
    const eintrag = zuordnung[land.id];
    if (!eintrag) continue;
    const [stadt, lon, lat] = eintrag;
    const [zx, zy] = proj(lon, lat);

    /* Reihenfolge der Suche:
       1. Ein Gebiet, das genauso heisst wie die Stadt. Stadtstaaten wie
          Berlin oder Hamburg sind eigene, winzige Gebiete - der Punkt faellt
          sonst leicht in das umgebende Land.
       2. Das Gebiet, das den Punkt enthaelt.
       3. Das naechstgelegene. */
    const schlicht = (x) => x.toLowerCase()
      .replace(/[áàâä]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i')
      .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/[^a-z]/g, '');
    let nameTreffer = null;
    let treffer = null;
    let naechste = null;
    let bestAbstand = Infinity;
    for (const pid of land.provinces) {
      const p = nachId.get(pid);
      if (!p) continue;
      if (!nameTreffer && schlicht(p.name) === schlicht(stadt)) nameTreffer = p;
      if (!treffer && imPolygon(zx, zy, punkte(p))) treffer = p;
      const d = (p.center[0] - zx) ** 2 + (p.center[1] - zy) ** 2;
      if (d < bestAbstand) { bestAbstand = d; naechste = p; }
    }
    const ziel = nameTreffer ?? treffer ?? naechste;
    if (!ziel) continue;

    /* Einige Gebiete sind beim Kartenbau aus mehreren Verwaltungseinheiten
       verschmolzen und tragen den Namen der groessten davon. Enthalten sie
       eine Hauptstadt, ist dieser Name irrefuehrend - dann wird nach der
       Stadt benannt, wie es die uebrigen Gebiete auch tun. */
    if (UMBENENNEN[sz.mapId]?.[ziel.id]) {
      const neuerName = UMBENENNEN[sz.mapId][ziel.id];
      if (ziel.name !== neuerName) {
        console.log(`  ${szenarioId} Karte: "${ziel.name}" heißt jetzt "${neuerName}"`);
        ziel.name = neuerName;
        kartenGeaendert.add(sz.mapId);
      }
    }

    const alt = nachId.get(land.capital)?.name ?? '?';
    if (land.capital !== ziel.id) {
      land.capital = ziel.id;
      geaendert++;
      console.log(`  ${szenarioId} ${land.name}: ${alt} -> ${ziel.name} (${stadt}`
        + `${treffer ? '' : ', nächstgelegen'})`);
    }
  }

  await writeFile(szPfad, JSON.stringify(sz, null, 2) + '\n', 'utf8');
}

for (const mapId of kartenGeaendert) {
  const kPfad = path.join(WURZEL, 'src/data/maps', `${mapId}.json`);
  await writeFile(kPfad, JSON.stringify(kartenDaten.get(mapId), null, 2) + '\n', 'utf8');
  console.log(`  Karte ${mapId} neu geschrieben.`);
}

console.log(`\n${geaendert} Hauptstädte berichtigt.`);

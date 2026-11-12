/**
 * Trägt in jedes Szenario die Flagge je Land ein.
 *
 * Die Zuordnung steht hier und nicht in den Szenariodateien von Hand, weil
 * sie so an einer Stelle nachprüfbar ist: Welches Land führt wann welche
 * Flagge? Dieselbe Nation taucht in mehreren Szenarien auf und führt dort
 * verschiedene Flaggen - Frankreich 1500 die Lilien, Frankreich 1914 die
 * Trikolore -, deshalb ist der Schlüssel Szenario *und* Land.
 *
 * Das Werkzeug prüft beide Richtungen: Jede eingetragene Flagge muss es
 * geben, und jedes Land muss eine zugewiesen bekommen. Fehlt eine, sagt es
 * das, statt stillschweigend den Platzhalter zu nehmen.
 *
 * Aufruf: node tools/flaggen-zuordnen.mjs [--pruefen]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WURZEL = path.join(import.meta.dirname, '..');
const SZENARIEN = path.join(WURZEL, 'src', 'data', 'scenarios');
const NUR_PRUEFEN = process.argv.includes('--pruefen');

/** Szenario -> Land -> Flaggenkennung. */
const ZUORDNUNG = {
  antike_200v: {
    rom: 'rom_spqr', karthago: 'karthago_tanit', seleukiden: 'seleukiden_anker',
    ptolemaeer: 'ptolemaeer_adler', makedonien: 'makedonien_sonne',
    pergamon: 'pergamon_schlange', iberer: 'iberer_stier',
    gallier: 'gallier_eber', illyrer: 'illyrer_schiff',
  },
  kalifat_750: {
    abbasiden: 'abbasiden_schwarz', byzanz: 'byzanz_tetragramm',
    franken: 'franken_lilien', chasaren: 'chasaren_tamga',
    uiguren: 'uiguren_sonne', tang: 'tang_sonne', tibet: 'tibet_berg',
    asturien: 'asturien_kreuz',
  },
  seldschuken_1071: {
    seldschuken: 'seldschuken_bogen', byzanz: 'byzanz_tetragramm',
    fatimiden: 'fatimiden_weiss', karachaniden: 'karachaniden_mond',
    ghaznawiden: 'ghaznawiden_schwert', georgien: 'georgien_kreuz',
    araber: 'araber_emirate',
  },
  mongolen_1240: {
    mongolen: 'mongolen_tug', rus_fuerstentuemer: 'rus_fuersten',
    song: 'song_drache', delhi: 'delhi_mond', ayyubiden: 'ayyubiden_gelb',
    byzanz_nikaia: 'byzanz_tetragramm', hre: 'hre_doppeladler',
    ungarn: 'ungarn_arpaden',
  },
  neuzeit_1500: {
    osmanen: 'osmanen_1500', safawiden: 'safawiden_sonne',
    spanien: 'spanien_burgund', portugal: 'portugal_kreuz',
    frankreich: 'frankreich_lilien', hre: 'hre_doppeladler',
    moskau: 'moskau_adler', mogul_timuriden: 'timuriden_ringe',
    ming: 'ming_drache', usbeken: 'usbeken_mond',
  },
  europa_1914: {
    deutsches_reich: 'de_kaiserreich', oesterreich_ungarn: 'at_ungarn',
    russisches_reich: 'ru_kaiserreich', frankreich: 'fr_trikolore',
    grossbritannien: 'gb_union', italien: 'it_trikolore',
    osmanisches_reich: 'tr_osmanen', serbien: 'rs_serbien',
    rumaenien: 'ro_rumaenien', bulgarien: 'bg_bulgarien',
    griechenland: 'gr_griechenland', spanien: 'es_spanien',
    skandinavien: 'se_schweden', daenemark: 'dk_daenemark',
    niederlande: 'nl_niederlande', belgien: 'be_belgien', schweiz: 'ch_schweiz',
  },
  welt_1914: {
    britisches_empire: 'gb_union', frankreich: 'fr_trikolore',
    deutsches_reich: 'de_kaiserreich', russisches_reich: 'ru_kaiserreich',
    vereinigte_staaten: 'us_sternenbanner', japan: 'jp_japan',
    oesterreich_ungarn: 'at_ungarn', osmanisches_reich: 'tr_osmanen',
    china: 'cn_fuenffarben', italien: 'it_trikolore',
  },
};

/* Aurelia ist erfunden; alle drei Szenarien teilen sich dieselben Länder. */
const AURELIA = {
  nordreich: 'au_nordreich', westmark: 'au_westmark', ostbund: 'au_ostbund',
  suedallianz: 'au_suedallianz', zentralrepublik: 'au_zentralrepublik',
  kuestenliga: 'au_kuestenliga', hochtal: 'au_hochtal',
  steppenkhanat: 'au_steppenkhanat', sonnenreich: 'au_sonnenreich',
  freistaedte: 'au_freistaedte',
};
for (const s of ['aurelia_aufbruch', 'aurelia_brand', 'aurelia_sandkasten']) {
  ZUORDNUNG[s] = AURELIA;
}

/* Welche Flaggen gibt es überhaupt? Aus der Quelle gelesen, damit ein
   Tippfehler hier sofort auffällt statt erst im Spiel. */
const quelle = await readFile(path.join(WURZEL, 'src', 'ui', 'flaggen.ts'), 'utf8');
const nachObjekt = quelle.slice(quelle.indexOf('export const FLAGGEN'));
const VORHANDEN = new Set(
  // Flaggen stehen teils ausgeschrieben (f(...)), teils als Kurzform
  // (quer(...), laengs(...)) oder als Verweis - deshalb jeder Schlüssel
  // auf oberster Ebene des Objekts, nicht nur die ausgeschriebenen.
  [...nachObjekt.matchAll(/^ {2}([a-z_0-9]+):/gm)].map((m) => m[1]),
);

let fehler = 0;
let geschrieben = 0;

for (const [szenario, laender] of Object.entries(ZUORDNUNG)) {
  const datei = path.join(SZENARIEN, szenario + '.json');
  const daten = JSON.parse(await readFile(datei, 'utf8'));

  for (const c of daten.countries) {
    const flagge = laender[c.id];
    if (!flagge) {
      console.log(`  FEHL ${szenario}: "${c.id}" (${c.name}) hat keine Flagge`);
      fehler++;
      continue;
    }
    if (!VORHANDEN.has(flagge)) {
      console.log(`  FEHL ${szenario}/${c.id}: Flagge "${flagge}" gibt es nicht`);
      fehler++;
      continue;
    }
    c.flag = flagge;
  }

  /* Eingetragene Flaggen ohne passendes Land - meist ein alter Name. */
  const ids = new Set(daten.countries.map((c) => c.id));
  for (const id of Object.keys(laender)) {
    if (!ids.has(id)) {
      console.log(`  FEHL ${szenario}: "${id}" steht in der Zuordnung, aber nicht im Szenario`);
      fehler++;
    }
  }

  if (!NUR_PRUEFEN && !fehler) {
    await writeFile(datei, JSON.stringify(daten, null, 1) + '\n', 'utf8');
    geschrieben++;
  }
}

const ungenutzt = [...VORHANDEN].filter(
  (f) => !Object.values(ZUORDNUNG).some((l) => Object.values(l).includes(f)),
);
if (ungenutzt.length) {
  console.log(`\nHinweis: ${ungenutzt.length} Flagge(n) gezeichnet, aber von keinem Land geführt:`);
  console.log('  ' + ungenutzt.join(', '));
}

console.log(fehler === 0
  ? `\nok  ${Object.keys(ZUORDNUNG).length} Szenarien zugeordnet${geschrieben ? `, ${geschrieben} geschrieben` : ''}`
  : `\n${fehler} Fehler - nichts geschrieben.`);
process.exit(fehler === 0 ? 0 : 1);

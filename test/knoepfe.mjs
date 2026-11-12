/**
 * Findet tote Knöpfe.
 *
 * Die Oberfläche verbindet HTML und Verhalten über Datenattribute: Das
 * Gerüst schreibt `data-irgendwas`, der Zuhörer fragt `[data-irgendwas]`.
 * Stimmen die beiden nicht überein, passiert beim Tippen schlicht nichts -
 * und weder der Übersetzer noch die Typprüfung merken etwas davon. Genau so
 * war der Schließen-Knopf monatelang tot: Das HTML schrieb
 * `data-gebiet-schließen`, gehört wurde auf `data-gebiet-schliessen`.
 *
 * Diese Prüfung stellt beide Seiten gegenüber:
 *   - geschrieben, aber nirgends gehört  -> der Knopf tut nichts
 *   - gehört, aber nirgends geschrieben  -> toter Zuhörer, meist ein Tippfehler
 *
 * Nicht jedes Attribut braucht einen Zuhörer: Manche dienen nur dem
 * Aussehen oder werden über `dataset` gelesen. Die stehen unten namentlich.
 *
 * Aufruf: node test/knoepfe.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const QUELLE = path.join(import.meta.dirname, '..', 'src');

/** Attribute ohne eigenen Zuhörer, mit Begründung. */
const OHNE_ZUHOERER = new Set([
  'data-thema',        // nur Umschalter fürs Aussehen
  'data-sheet-zu',     // über dataset gelesen
  'data-einstieg-aus', // s.u., über dataset
  'data-einstieg-weiter',
]);

async function alleDateien(ordner) {
  const out = [];
  for (const e of await readdir(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) out.push(...await alleDateien(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const dateien = await alleDateien(QUELLE);

/** attribut -> Fundstellen */
const geschrieben = new Map();
const gehoert = new Map();

const merke = (karte, name, ort) => {
  if (!karte.has(name)) karte.set(name, []);
  karte.get(name).push(ort);
};

for (const datei of dateien) {
  const text = await readFile(datei, 'utf8');
  const zeilen = text.split('\n');
  zeilen.forEach((zeile, i) => {
    const ort = `${path.relative(QUELLE, datei)}:${i + 1}`;

    /* Geschrieben: im HTML steht `data-xyz` oder `data-xyz="..."`.
       Nur innerhalb von Zeichenketten - sonst faengt man Selektoren mit. */
    for (const m of zeile.matchAll(/(?<![[\w-])data-([a-zA-Z0-9äöüßÄÖÜ-]+)(?=[\s=>])/g)) {
      // Selektoren sehen aus wie [data-x] und werden unten erfasst.
      if (zeile.slice(0, m.index).endsWith('[')) continue;
      merke(geschrieben, 'data-' + m[1], ort);
    }

    /* Gehört: `[data-xyz]` als Selektor. */
    for (const m of zeile.matchAll(/\[data-([a-zA-Z0-9äöüßÄÖÜ-]+)[\]=]/g)) {
      merke(gehoert, 'data-' + m[1], ort);
    }

    /* Geschrieben: über setAttribute statt im HTML. */
    for (const m of zeile.matchAll(/setAttribute\(\s*['"`](data-[a-zA-Z0-9-]+)['"`]/g)) {
      merke(geschrieben, m[1], ort);
    }

    /* Gehört: als Zeichenkette übergeben - attr(ziel, 'data-xyz'),
       getAttribute('data-xyz'), closest('[data-xyz]') ist oben schon drin. */
    for (const m of zeile.matchAll(/['"`](data-[a-zA-Z0-9äöüßÄÖÜ-]+)['"`]/g)) {
      merke(gehoert, m[1], ort);
    }

    /* Gehört: `dataset.xyzAbc` -> data-xyz-abc */
    for (const m of zeile.matchAll(/dataset\.([a-zA-Z0-9]+)/g)) {
      const name = 'data-' + m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      merke(gehoert, name, ort);
    }
  });
}

let fehler = 0;

const tot = [...geschrieben.keys()]
  .filter((a) => !gehoert.has(a) && !OHNE_ZUHOERER.has(a))
  .sort();
if (tot.length) {
  console.log('Geschrieben, aber nirgends gehört - diese Knöpfe tun nichts:');
  for (const a of tot) {
    console.log(`  FEHL ${a}`);
    for (const o of geschrieben.get(a).slice(0, 3)) console.log(`         ${o}`);
    fehler++;
  }
} else {
  console.log('ok   jedes geschriebene Datenattribut hat einen Zuhörer');
}

const leer = [...gehoert.keys()].filter((a) => !geschrieben.has(a)).sort();
if (leer.length) {
  console.log('\nGehört, aber nirgends geschrieben - toter Zuhörer:');
  for (const a of leer) {
    console.log(`  FEHL ${a}`);
    for (const o of gehoert.get(a).slice(0, 3)) console.log(`         ${o}`);
    fehler++;
  }
} else {
  console.log('ok   jeder Zuhörer hat ein passendes Attribut');
}

/* Nicht-ASCII in Attributnamen ist immer ein Versehen aus der
   Umlaut-Nachbearbeitung - Attributnamen bleiben englisch-schlicht. */
const umlaute = [...geschrieben.keys(), ...gehoert.keys()]
  .filter((a) => /[^\x20-\x7E]/.test(a));
if (umlaute.length) {
  console.log('\nUmlaut im Attributnamen (gehört da nicht hin):');
  for (const a of new Set(umlaute)) { console.log(`  FEHL ${a}`); fehler++; }
} else {
  console.log('ok   keine Umlaute in Attributnamen');
}

console.log(fehler === 0 ? '\nAlles verdrahtet.' : `\n${fehler} Fund(e).`);
process.exit(fehler === 0 ? 0 : 1);

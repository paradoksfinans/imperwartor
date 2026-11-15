/**
 * Benennt die Gebiete der Europakarte auf 1914 und auf Deutsch um.
 *
 * Die Umrisse stammen aus heutigen Verwaltungsgrenzen, und mit ihnen kamen
 * die heutigen Namen: "Dnipropetrovs'k", "Warmian-Masurian", "Kiev City",
 * dazu nichtssagende englische Kürzel wie "North East" oder "South West".
 * In einem Szenario von 1914 steht das quer zur Sache, und in einer
 * deutschen Oberfläche doppelt.
 *
 * Zwei Regeln, nach denen hier umbenannt wird:
 *
 *   1. **Deutsch, wo es einen gebräuchlichen deutschen Namen gibt.**
 *      Kiew, Pilsen, Istrien, Peloponnes, Großpolen - keine Erfindungen,
 *      sondern die Namen, unter denen diese Landschaften im Deutschen
 *      geführt werden.
 *   2. **Landschaft statt Verwaltungseinheit.** "North East" ist kein Name,
 *      sondern eine Statistikkennung. Northumberland ist einer.
 *
 * Bewusst *nicht* angetastet werden die Besitzverhältnisse. Dass die Karte
 * Elsaß-Lothringen bei Frankreich führt, ist eine Frage des Szenarios, nicht
 * der Beschriftung - das wäre hier stillschweigend Geschichte umzuschreiben.
 *
 * Das Werkzeug meckert, wenn ein Name in der Tabelle steht, den es auf der
 * Karte nicht gibt: So fällt ein Tippfehler sofort auf, statt wirkungslos
 * zu bleiben.
 *
 * Aufruf: node tools/gebietsnamen.mjs [--pruefen]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TABELLEN } from './gebietsnamen-tabelle.mjs';

const MAPS = path.join(import.meta.dirname, '..', 'src', 'data', 'maps');
const NUR_PRUEFEN = process.argv.includes('--pruefen');

/* Die Tabelle liegt in einer eigenen Datei, weil tools/karten.mjs sie
   ebenfalls braucht - dort fuer den Weg zurueck zu den Rohdaten. */

let fehlerGesamt = 0;

for (const [karteId, NAMEN] of Object.entries(TABELLEN)) {
  const datei = path.join(MAPS, karteId + '.json');
  const karte = JSON.parse(await readFile(datei, 'utf8'));
  const vorhanden = new Set(karte.provinces.map((p) => p.name));

  /* Das Werkzeug muss sich mehrfach aufrufen lassen: Nach dem ersten Lauf
     trägt die Karte die neuen Namen, die alten gibt es dann nicht mehr.
     Ein Eintrag gilt deshalb als in Ordnung, wenn entweder der alte Name
     noch da ist (dann wird umbenannt) oder der neue bereits (dann ist
     nichts zu tun). Erst wenn keines von beidem zutrifft, ist es ein
     echter Tippfehler. */
  let fehler = 0;
  for (const [alt, neu] of Object.entries(NAMEN)) {
    if (!vorhanden.has(alt) && !vorhanden.has(neu)) {
      console.log(`  FEHL ${karteId}: "${alt}" - weder alter noch neuer Name ist auf der Karte`);
      fehler++;
    }
  }

  let geaendert = 0;
  for (const p of karte.provinces) {
    const neu = NAMEN[p.name];
    if (neu && neu !== p.name) { p.name = neu; geaendert++; }
  }

  /* Zwei Gebiete mit demselben Namen sind auf der Karte nicht zu
     unterscheiden - und in den Zielvorgaben erst recht nicht. */
  const gezaehlt = new Map();
  for (const p of karte.provinces) gezaehlt.set(p.name, (gezaehlt.get(p.name) ?? 0) + 1);
  for (const [n, z] of gezaehlt) {
    if (z > 1) { console.log(`  FEHL ${karteId}: "${n}" kommt ${z}-mal vor`); fehler++; }
  }

  /* Was danach noch modern oder nach Verwaltung aussieht, soll auffallen. */
  const verdaechtig = karte.provinces.map((p) => p.name)
    .filter((n) => /\b(City|Oblast|Region|Province|County|and the|North|South|East|West)\b|'|\./.test(n));
  if (verdaechtig.length) {
    console.log(`  Hinweis ${karteId}: ${verdaechtig.length} Name(n) wirken noch modern: ${verdaechtig.join(', ')}`);
  }

  if (!fehler && !NUR_PRUEFEN) {
    await writeFile(datei, JSON.stringify(karte) + '\n', 'utf8');
  }
  console.log(fehler === 0
    ? `  ok   ${karteId.padEnd(14)} ${geaendert} von ${karte.provinces.length} umbenannt${NUR_PRUEFEN ? ' (nur geprüft)' : ''}`
    : `  ${fehler} Fehler in ${karteId} - nicht geschrieben.`);
  fehlerGesamt += fehler;
}

process.exit(fehlerGesamt === 0 ? 0 : 1);

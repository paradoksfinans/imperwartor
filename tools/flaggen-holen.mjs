/**
 * Holt die echten Flaggen aus dem Paket "flag-icons" ins Spiel.
 *
 * Die Flaggen waren bisher aus Bausteinen nachgebaut - Streifen, Kreuze,
 * Sterne. Bei einer Trikolore faellt das nicht auf, bei allem mit einem
 * Wappen schon. Dieses Werkzeug nimmt stattdessen die echten Zeichnungen,
 * wo es sie gibt, und laesst nur dort nachbauen, wo es keine gibt:
 * untergegangene Reiche, mittelalterliche Banner, erfundene Laender.
 *
 * Flaggen selbst sind keine geschuetzten Werke - sie sind Hoheitszeichen.
 * Das Paket steht unter der MIT-Lizenz; sie liegt mit im Repository.
 *
 * Zwei Dinge muessen dabei umgerechnet werden:
 *
 *   1. **Das Seitenverhaeltnis.** Das Paket zeichnet alles in 640x480
 *      (4:3), das Spiel in 60x40 (3:2). Alle Flaggen im Spiel haben
 *      dieselbe Form, sonst saehe eine Liste aus wie ein Setzkasten.
 *      Die Zeichnung wird also leicht gestaucht. Das ist sichtbar
 *      einheitlicher als die echten Verhaeltnisse, die von 1:2 (Katar)
 *      bis 1:1 (Schweiz) reichen.
 *
 *   2. **Die Kennungen.** Viele Flaggen bringen eigene Verlaeufe und
 *      Masken mit, und zwar unter Namen wie "a" oder "b". Stehen zwei
 *      Flaggen auf derselben Seite, greift die zweite auf die Definition
 *      der ersten zu und wird falsch gezeichnet. Jede Kennung bekommt
 *      deshalb das Laenderkuerzel vorangestellt.
 *
 * Aufruf: node tools/flaggen-holen.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const WURZEL = path.join(import.meta.dirname, '..');
const QUELLE = path.join(WURZEL, 'node_modules', 'flag-icons', 'flags', '4x3');
const ZIEL = path.join(WURZEL, 'src', 'ui', 'flaggen-echt.ts');

/**
 * Welche Flagge des Spiels welches Original bekommt.
 *
 * Nur dort eingetragen, wo die heutige Flagge auch die des Szenarios ist.
 * Das Deutsche Kaiserreich fuehrte Schwarz-Weiss-Rot und nicht die heutige
 * Trikolore; es fehlt hier deshalb und bleibt gezeichnet. Dasselbe gilt
 * fuer Oesterreich-Ungarn, die Sowjetunion, Preussen und alles Aeltere.
 */
const ZUORDNUNG = {
  /* Seit 1794 unveraendert. */
  fr_trikolore: 'fr',
  /* Seit 1801 unveraendert - in allen Szenarien ab 1618 richtig. */
  gb_union: 'gb',
  /* Das Koenigreich fuehrte zusaetzlich das savoyische Wappen in der
     Mitte; Feld und Farben stimmen. */
  it_trikolore: 'it',
  se_schweden: 'se',
  dk_daenemark: 'dk',
  nl_niederlande: 'nl',
  be_belgien: 'be',
  gr_griechenland: 'gr',
  ch_schweiz: 'ch',
  pl_polen: 'pl',
  ro_rumaenien: 'ro',
  bg_bulgarien: 'bg',
  finnland_kreuz: 'fi',
  jp_japan: 'jp',
  us_sternenbanner: 'us',
  /* Weiss-Blau-Rot, seit Peter dem Grossen und bis 1917. */
  ru_kaiserreich: 'ru',
  tuerkei_mond: 'tr',
  portugal_1911: 'pt',
  ungarn_trikolore: 'hu',
  norwegen: 'no',
};

/** Groesse im Spiel. Muss zu B und H in flaggen.ts passen. */
const B = 60;
const H = 40;
/** Groesse im Paket. */
const QB = 640;
const QH = 480;

const eintraege = [];
let gesamt = 0;

for (const [kennung, code] of Object.entries(ZUORDNUNG)) {
  let roh;
  try {
    roh = await readFile(path.join(QUELLE, code + '.svg'), 'utf8');
  } catch {
    console.log(`  FEHL ${kennung}: ${code}.svg gibt es nicht`);
    continue;
  }

  /* Nur den Inhalt, ohne die aeussere Huelle - das Spiel bringt seine
     eigene mit, samt Eckenrundung und Rahmen. */
  const auf = roh.indexOf('>', roh.indexOf('<svg'));
  const zu = roh.lastIndexOf('</svg>');
  let inhalt = roh.slice(auf + 1, zu).trim();

  /* Kennungen eindeutig machen. */
  inhalt = inhalt
    .replace(/id="([^"]+)"/g, (_, n) => `id="${code}-${n}"`)
    .replace(/url\(#([^)]+)\)/g, (_, n) => `url(#${code}-${n})`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_, a, n) => `${a}="#${code}-${n}"`);

  /* Kommentare und ueberfluessige Leerzeichen raus - das spart in der
     fertigen Datei mehr, als man denkt. */
  inhalt = inhalt.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').trim();

  gesamt += inhalt.length;
  eintraege.push({ kennung, code, inhalt });
}

eintraege.sort((a, b) => a.kennung.localeCompare(b.kennung));

const sx = (B / QB).toFixed(6);
const sy = (H / QH).toFixed(6);

const datei = `/**
 * Die echten Flaggen - unveraendert aus dem Paket "flag-icons".
 *
 * ERZEUGT von tools/flaggen-holen.mjs. Nicht von Hand aendern: Beim
 * naechsten Lauf ist jede Aenderung wieder weg. Wer eine Flagge
 * hinzufuegen will, traegt sie dort in ZUORDNUNG ein.
 *
 * Jede Zeichnung steht im Rahmen 640x480 des Pakets. Der Faktor unten
 * rechnet sie auf die ${B}x${H} des Spiels um - alle Flaggen im Spiel haben
 * dieselbe Form, damit eine Liste von Laendern nicht aussieht wie ein
 * Setzkasten.
 *
 * Flaggen sind Hoheitszeichen und als solche frei. Das Paket selbst steht
 * unter der MIT-Lizenz.
 */

/** Rechnet den Rahmen des Pakets auf den des Spiels um. */
export const ECHT_SKALIERUNG = 'scale(${sx} ${sy})';

/** Spielkennung -> Inhalt der echten Flagge, ohne aeussere Huelle. */
export const ECHTE_FLAGGEN: Record<string, string> = {
${eintraege.map((e) => `  // ${e.code}.svg\n  ${e.kennung}: ${JSON.stringify(e.inhalt)},`).join('\n')}
};
`;

await writeFile(ZIEL, datei, 'utf8');
console.log(`${eintraege.length} echte Flaggen eingebettet, ${(gesamt / 1024).toFixed(1)} kB Zeichnung`);
for (const e of eintraege) {
  console.log(`  ${e.kennung.padEnd(22)} <- ${e.code}.svg  ${(e.inhalt.length / 1024).toFixed(1)} kB`);
}

/**
 * Stellt deutsche Umlaute und das Eszett in den Anzeigetexten her.
 *
 * Warum nicht einfach "ae" -> "ä" ersetzen: im Quelltext stehen Bezeichner
 * (gewaehltesGebiet), CSS-Klassen (messing), englische Woerter (class, press)
 * und Eigennamen (Bissau, Israel) mit denselben Buchstabenfolgen. Ein blindes
 * Ersetzen zerstoert sie.
 *
 * Deshalb drei Sicherungen:
 *   1. Ein ausdrueckliches Woerterbuch - nur was hier steht, wird geaendert.
 *   2. Nur innerhalb von Zeichenketten, die ein Leerzeichen enthalten oder
 *      gross beginnen. Bezeichner und Klassennamen tun das nie.
 *   3. Jedes Wort, das in styles.css als Klasse oder in einem data-Attribut
 *      vorkommt, wird aus dem Woerterbuch entfernt.
 *
 * Aufruf: node test/umlaute.mjs [--pruefen]
 */

import { readFile, writeFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const nurPruefen = process.argv.includes('--pruefen');

/* ------------------------------------------------------------------ */
/* Woerterbuch                                                         */
/* ------------------------------------------------------------------ */

/** Grundformen. Gross-/Kleinschreibung wird automatisch mitgefuehrt. */
const WOERTER = {
  // ä
  aecker: 'äcker', aegaeis: 'ägäis', aegypten: 'ägypten', aerzte: 'ärzte',
  anfuehrer: 'anführer', anhaenger: 'anhänger', anhoerung: 'anhörung',
  arbeitskraeftemangel: 'arbeitskräftemangel', aufklaerung: 'aufklärung',
  aufstaende: 'aufstände', auslaendisches: 'ausländisches',
  beitraege: 'beiträge', belagerungsgeraet: 'belagerungsgerät',
  bundeslaender: 'bundesländer', daempft: 'dämpft', daenemark: 'dänemark',
  eisenbahnplaene: 'eisenbahnpläne', entlaesst: 'entlässt',
  erklaeren: 'erklären', erklaert: 'erklärt', ertraege: 'erträge',
  fabrikstaedten: 'fabrikstädten', faellt: 'fällt', fernkaempfer: 'fernkämpfer',
  flaeche: 'fläche', flaechen: 'flächen', flaechenbrand: 'flächenbrand',
  flugblaetter: 'flugblätter', freistaedte: 'freistädte',
  gebaeude: 'gebäude', gebietsveraenderung: 'gebietsveränderung',
  gelaende: 'gelände', gelaendetexturen: 'geländetexturen',
  generaele: 'generäle', generalitaet: 'generalität',
  generalstaebe: 'generalstäbe', geraet: 'gerät', graeben: 'gräben',
  haefen: 'häfen', haelt: 'hält', haendeln: 'händeln', haenden: 'händen',
  haendler: 'händler', haendlern: 'händlern', haengt: 'hängt',
  haeuptlinge: 'häuptlinge', haeuptlingsrat: 'häuptlingsrat',
  hafenstaedten: 'hafenstädten', hauptstaedte: 'hauptstädte',
  hundertjaehrigen: 'hundertjährigen', jaehrliche: 'jährliche',
  kaempfe: 'kämpfe', kaempfen: 'kämpfen', kanaele: 'kanäle',
  kapitaene: 'kapitäne', klaeren: 'klären',
  konstruktionsplaene: 'konstruktionspläne',
  kriegserklaerung: 'kriegserklärung', laender: 'länder', laenge: 'länge',
  laenger: 'länger', laesst: 'lässt', laeuft: 'läuft',
  maechte: 'mächte', maenner: 'männer', maerkten: 'märkten',
  militaer: 'militär', militaerisch: 'militärisch',
  militaerische: 'militärische', militaerregierung: 'militärregierung',
  militaersklaven: 'militärsklaven', militaertechnik: 'militärtechnik',
  mittelmaechte: 'mittelmächte', naechstes: 'nächstes',
  nachbarlaendern: 'nachbarländern', plaene: 'pläne', plaetze: 'plätze',
  praesident: 'präsident', praesidentin: 'präsidentin',
  ptolemaeisches: 'ptolemäisches', raeume: 'räume', raeumen: 'räumen',
  raeumt: 'räumt', reiterverbaende: 'reiterverbände',
  reiterverbaenden: 'reiterverbänden', rumaenien: 'rumänien',
  schlagkraeftig: 'schlagkräftig', spaet: 'spät', spaeter: 'später',
  staedte: 'städte', staedten: 'städten', staemme: 'stämme',
  staende: 'stände', streitgespraech: 'streitgespräch',
  tatsaechlich: 'tatsächlich', traege: 'träge', traegt: 'trägt',
  ungeklaert: 'ungeklärt', veraendern: 'verändern', verbaende: 'verbände',
  verschaerfen: 'verschärfen', verstaerken: 'verstärken',
  verstaerkt: 'verstärkt', vervielfaeltigen: 'vervielfältigen',
  vertraege: 'verträge', volkszaehlung: 'volkszählung',
  waechst: 'wächst', waehlbar: 'wählbar', waehle: 'wähle',
  waehlen: 'wählen', waehrend: 'während', waehrung: 'währung',
  wehrfaehige: 'wehrfähige', zaeh: 'zäh', zaehere: 'zähere',
  zaehlt: 'zählt', abschaetzen: 'abschätzen', aechten: 'ächten',
  aendern: 'ändern', ausgewaehlt: 'ausgewählt', draengen: 'drängen',
  europaeischen: 'europäischen', gewaehlt: 'gewählt',
  gewaehren: 'gewähren', gewaehrt: 'gewährt', geschwaecht: 'geschwächt',
  gestaerkt: 'gestärkt', regelmaessig: 'regelmäßig',
  schwaecher: 'schwächer', schwaechere: 'schwächere',
  schwaecheres: 'schwächeres', staerker: 'stärker',
  staerkere: 'stärkere', staerkste: 'stärkste', staerkt: 'stärkt',
  heeresstaerke: 'heeresstärke', truppenstaerke: 'truppenstärke',
  kraefteverhaeltnis: 'kräfteverhältnis',
  kraefteverhaeltnisse: 'kräfteverhältnisse',
  verhaeltnis: 'verhältnis', verlaessliche: 'verlässliche',
  verlaesslich: 'verlässlich', unabhaengig: 'unabhängig',
  unabhaengiger: 'unabhängiger', unabhaengigkeit: 'unabhängigkeit',
  uneingeschraenkte: 'uneingeschränkte',
  uneingeschraenkter: 'uneingeschränkter',
  einschraenken: 'einschränken', erhaelt: 'erhält', zusaetzliche: 'zusätzliche',
  vorraete: 'vorräte', aufstaenden: 'aufständen',

  // ö
  befoerdern: 'befördern', bevoelkerung: 'bevölkerung',
  bevoelkerungswachstum: 'bevölkerungswachstum', boersen: 'börsen',
  empoerung: 'empörung', erdoel: 'erdöl', erdoels: 'erdöls',
  erhoeht: 'erhöht', erhoehen: 'erhöhen', erhoehter: 'erhöhter',
  foederation: 'föderation', foerdern: 'fördern',
  franzoesische: 'französische', gehoert: 'gehört', geloescht: 'gelöscht',
  goetter: 'götter', goettliche: 'göttliche', hoechste: 'höchste',
  hoechsten: 'höchsten', hoechstens: 'höchstens', hoehe: 'höhe',
  hoeher: 'höher', hoehere: 'höhere', hoehenwirkung: 'höhenwirkung',
  hungersnoete: 'hungersnöte', koenig: 'könig', koenigin: 'königin',
  koenigreich: 'königreich', koennen: 'können', kuestenvoelker: 'küstenvölker',
  loeschen: 'löschen', loest: 'löst', moeglich: 'möglich',
  oeffentlich: 'öffentlich', oeffnen: 'öffnen', oegedei: 'ögedei',
  oesterreich: 'österreich', oesterreichisch: 'österreichisch',
  ploendern: 'plündern', roemische: 'römische', roemisches: 'römisches',
  soeldner: 'söldner', soeldnerheeren: 'söldnerheeren',
  soeldnerkompanie: 'söldnerkompanie', turkvoelker: 'turkvölker',
  unversoehnlich: 'unversöhnlich', veroeffentlichen: 'veröffentlichen',
  verschwoerung: 'verschwörung', vertroesten: 'vertrösten',
  vielvoelkerstaat: 'vielvölkerstaat', woelbung: 'wölbung',
  zoegerlich: 'zögerlich', zoelle: 'zölle', zerstoert: 'zerstört',

  // ü
  bluete: 'blüte', bogenschuetzen: 'bogenschützen', bruechige: 'brüchige',
  buendnis: 'bündnis', buendnispartner: 'bündnispartner',
  buendnisse: 'bündnisse', buergermeisterrat: 'bürgermeisterrat',
  buerokratie: 'bürokratie', dafuer: 'dafür', darueber: 'darüber',
  demuetigung: 'demütigung', draufgaenger: 'draufgänger',
  duerre: 'dürre', durchfuehren: 'durchführen', einfuegen: 'einfügen',
  einfuehren: 'einführen', erfuellen: 'erfüllen', erfuellt: 'erfüllt',
  erschoepft: 'erschöpft', erschuettert: 'erschüttert',
  fruehe: 'frühe', fuehrung: 'führung', fuehren: 'führen',
  fuehrend: 'führend', fuehrenden: 'führenden', fuehrender: 'führender',
  fuehrst: 'führst', fuehrt: 'führt', fuellen: 'füllen', fuellt: 'füllt',
  fuenfzig: 'fünfzig', fuer: 'für', fuersten: 'fürsten',
  fuerstentuemer: 'fürstentümer', fuerstliche: 'fürstliche',
  friedensfuehler: 'friedensfühler', gefluechtete: 'geflüchtete',
  gefuerchtet: 'gefürchtet', gegenueber: 'gegenüber',
  gegenueberstehen: 'gegenüberstehen', gegruendet: 'gegründet',
  geschuetze: 'geschütze', gestuetzt: 'gestützt', gewuerzhandel: 'gewürzhandel',
  goektuerken: 'göktürken', grubenunglueck: 'grubenunglück',
  gruenden: 'gründen', gruendlich: 'gründlich', gruendung: 'gründung',
  gueltiger: 'gültiger', guenstig: 'günstig', guenstigere: 'günstigere',
  guetern: 'gütern', hauptmenue: 'hauptmenü', hochgeruestet: 'hochgerüstet',
  juengere: 'jüngere', kriegsmuedigkeit: 'kriegsmüdigkeit',
  kuehl: 'kühl', kuendigen: 'kündigen', kuenftig: 'künftig',
  kuerzen: 'kürzen', kueste: 'küste', kuesten: 'küsten',
  kuestenliga: 'küstenliga', kuestensaum: 'küstensaum',
  luettich: 'lüttich', luftbruecke: 'luftbrücke', muenzwesen: 'münzwesen',
  nuechtern: 'nüchtern', populaerer: 'populärer', pruefen: 'prüfen',
  raedelsfuehrer: 'rädelsführer', ruecken: 'rücken',
  rueckeroberung: 'rückeroberung', rueckgrat: 'rückgrat',
  schuetzen: 'schützen', schuetzt: 'schützt', stuerzt: 'stürzt',
  stuetzpunkt: 'stützpunkt', stuetzt: 'stützt', sued: 'süd',
  suedallianz: 'südallianz', suedosten: 'südosten',
  tuerkische: 'türkische', tuerkischen: 'türkischen', ueben: 'üben',
  ueber: 'über', ueberfallen: 'überfallen', ueberfordert: 'überfordert',
  ueberlassen: 'überlassen', ueberlaeufers: 'überläufers',
  ueberlieferten: 'überlieferten', uebernehmen: 'übernehmen',
  uebernimmt: 'übernimmt', uebernommen: 'übernommen',
  ueberproportional: 'überproportional', ueberreichen: 'überreichen',
  ueberschuss: 'überschuss', uebersee: 'übersee',
  ueberseehandel: 'überseehandel', ueberstanden: 'überstanden',
  uebersetzerwerkstatt: 'übersetzerwerkstatt', uebertragung: 'übertragung',
  unterdruecken: 'unterdrücken', verbuendet: 'verbündet',
  verbuendete: 'verbündete', verbuendeten: 'verbündeten',
  verdraengt: 'verdrängt', verfuegbar: 'verfügbar',
  verfuegbare: 'verfügbare', verschuetteten: 'verschütteten',
  verteidigungsbuendnis: 'verteidigungsbündnis',
  voruebergehend: 'vorübergehend', wueste: 'wüste',
  wuestenreich: 'wüstenreich', zuenfte: 'zünfte', zurueck: 'zurück',
  zurueckgehen: 'zurückgehen', zurueckgekehrt: 'zurückgekehrt',
  zurueckgezogen: 'zurückgezogen', zurueckhaltung: 'zurückhaltung',
  zurueckholen: 'zurückholen', zuruecksetzen: 'zurücksetzen',
  zurueckstellen: 'zurückstellen', zurueckziehen: 'zurückziehen',
  zunaechst: 'zunächst', ausfuehren: 'ausführen', ausruesten: 'ausrüsten',
  zweckbuendnis: 'zweckbündnis', fluechtlinge: 'flüchtlinge',
  fluesse: 'flüsse', zugestaendnisse: 'zugeständnisse',
  legitimitaet: 'legitimität', neutralitaet: 'neutralität',
  stabilitaet: 'stabilität', vollstaendig: 'vollständig',
  vollstaendige: 'vollständige', weiterkaempfen: 'weiterkämpfen',
  spielstaende: 'spielstände', siegaussichten: 'siegaussichten',

  // ß
  gross: 'groß', grosse: 'große', grossen: 'großen', grosser: 'großer',
  grossem: 'großem', groesse: 'größe', groesser: 'größer',
  groessere: 'größere', groesseren: 'größeren', groesste: 'größte',
  groesstes: 'größtes', anfangsgroesse: 'anfangsgröße',
  grossfuerstentum: 'großfürstentum', grosskhan: 'großkhan',
  grossmacht: 'großmacht', grossmaechte: 'großmächte',
  grossreederin: 'großreederin', grosszuegig: 'großzügig',
  grossseldschukisches: 'großseldschukisches',
  zweitgroesstes: 'zweitgrößtes', strasse: 'straße', strassen: 'straßen',
  heerstrasse: 'heerstraße', karawanenstrasse: 'karawanenstraße',
  seidenstrasse: 'seidenstraße', aussenpolitik: 'außenpolitik',
  aussergewoehnlich: 'außergewöhnlich', schliessen: 'schließen',
  erschliessen: 'erschließen', erschliessung: 'erschließung',
  fliesst: 'fließt', erschiesst: 'erschießt', stossen: 'stoßen',
  zusammenstoss: 'zusammenstoß', massnahme: 'maßnahme',
  fuss: 'fuß', fussvolk: 'fußvolk',
};

/** Woerter, die trotz Treffer unveraendert bleiben (Eigennamen, Technik). */
const TABU = new Set([
  'messing', 'klasse', 'presse', 'kassen', 'wasser', 'mauern', 'feuer',
  'israel', 'venezuela', 'mozambique', 'bissau', 'russia', 'hessen',
  'manuel', 'emanuel', 'thessalia', 'teuer', 'neue', 'neuen', 'neues',
  'neuer', 'lassen', 'dessen', 'muss', 'dass', 'wissen', 'bauen',
]);

/* ------------------------------------------------------------------ */
/* Dateien einsammeln                                                  */
/* ------------------------------------------------------------------ */

function dateien(wurzel, endungen) {
  const raus = [];
  (function geh(d) {
    for (const e of readdirSync(d)) {
      const p = path.join(d, e);
      if (statSync(p).isDirectory()) geh(p);
      else if (endungen.some((x) => p.endsWith(x))) raus.push(p);
    }
  })(wurzel);
  return raus;
}

/* ------------------------------------------------------------------ */
/* Schutz: Klassennamen und Attribute aus dem Woerterbuch nehmen       */
/* ------------------------------------------------------------------ */

const css = await readFile('src/ui/styles.css', 'utf8');
const geschuetzt = new Set();
for (const m of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) geschuetzt.add(m[1].toLowerCase());
for (const m of css.matchAll(/--([a-zA-Z][\w-]*)/g)) geschuetzt.add(m[1].toLowerCase());
for (const datei of dateien('src', ['.ts'])) {
  const t = await readFile(datei, 'utf8');
  for (const m of t.matchAll(/data-([a-zA-Z][\w-]*)/g)) geschuetzt.add(m[1].toLowerCase());
}

let entfernt = [];
for (const w of Object.keys(WOERTER)) {
  if (geschuetzt.has(w) || TABU.has(w)) {
    entfernt.push(w);
    delete WOERTER[w];
  }
}
if (entfernt.length) console.log('geschuetzt, nicht ersetzt:', entfernt.join(', '));

/* ------------------------------------------------------------------ */
/* Ersetzen                                                            */
/* ------------------------------------------------------------------ */

const muster = new RegExp(`\\b(${Object.keys(WOERTER).join('|')})\\b`, 'gi');

/** Uebertraegt die Gross-/Kleinschreibung des Originals auf den Ersatz. */
function wieOriginal(original, ersatz) {
  if (original === original.toUpperCase() && original.length > 1) {
    return ersatz.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return ersatz[0].toUpperCase() + ersatz.slice(1);
  }
  return ersatz;
}

function ersetzeText(s) {
  return s.replace(muster, (treffer) => {
    const ersatz = WOERTER[treffer.toLowerCase()];
    return ersatz ? wieOriginal(treffer, ersatz) : treffer;
  });
}

/** Nur Anzeigetexte: mit Leerzeichen oder gross beginnend. */
function istAnzeigetext(s) {
  return s.includes(' ') || (/^[A-ZÄÖÜ]/.test(s) && s.length > 2);
}

let geaendert = 0;

/**
 * Laeuft Zeichen fuer Zeichen durch den Quelltext und ersetzt nur in
 * Zeichenketten und Kommentaren.
 *
 * Ein Regex reicht dafuer nicht: Template-Literale koennen `${...}` mit
 * weiteren Zeichenketten darin enthalten. Ein Regex verschluckt dann Code
 * und benennt Variablen um - genau so wurde beim ersten Versuch aus
 * "zurueckgezogen" eine halb umbenannte Variable.
 */
function ersetzeInQuelltext(quelle) {
  let raus = '';
  let i = 0;
  // Verschachtelung der Template-Literale: jede Ebene merkt sich, ob wir
  // gerade im Text oder in einem ${...}-Ausdruck stehen.
  const stapel = [];

  const inAusdruck = () => stapel.length > 0 && stapel[stapel.length - 1].tiefe > 0;

  while (i < quelle.length) {
    const z = quelle[i];
    const zwei = quelle.slice(i, i + 2);

    // Innerhalb eines Template-Literals, aber in einem ${...}: wie Code.
    if (stapel.length && !inAusdruck()) {
      // Textteil eines Template-Literals
      let text = '';
      while (i < quelle.length) {
        if (quelle[i] === '\\') { text += quelle.slice(i, i + 2); i += 2; continue; }
        if (quelle[i] === '`') break;
        if (quelle.slice(i, i + 2) === '${') break;
        text += quelle[i];
        i++;
      }
      raus += istAnzeigetext(text) ? ersetzeText(text) : text;
      if (quelle[i] === '`') { raus += '`'; i++; stapel.pop(); }
      else if (quelle.slice(i, i + 2) === '${') {
        raus += '${'; i += 2;
        stapel[stapel.length - 1].tiefe = 1;
      }
      continue;
    }

    if (zwei === '//') {
      const ende = quelle.indexOf('\n', i);
      const bis = ende === -1 ? quelle.length : ende;
      raus += ersetzeText(quelle.slice(i, bis));
      i = bis;
      continue;
    }
    if (zwei === '/*') {
      const ende = quelle.indexOf('*/', i + 2);
      const bis = ende === -1 ? quelle.length : ende + 2;
      raus += ersetzeText(quelle.slice(i, bis));
      i = bis;
      continue;
    }
    if (z === "'" || z === '"') {
      let j = i + 1;
      let text = '';
      while (j < quelle.length && quelle[j] !== z) {
        if (quelle[j] === '\\') { text += quelle.slice(j, j + 2); j += 2; continue; }
        if (quelle[j] === '\n') break;
        text += quelle[j];
        j++;
      }
      if (quelle[j] === z) {
        raus += z + (istAnzeigetext(text) ? ersetzeText(text) : text) + z;
        i = j + 1;
      } else { raus += z; i++; }
      continue;
    }
    if (z === '`') {
      raus += '`'; i++;
      stapel.push({ tiefe: 0 });
      continue;
    }
    // Innerhalb von ${...}: Klammern zaehlen, um das Ende zu finden.
    if (inAusdruck()) {
      if (z === '{') stapel[stapel.length - 1].tiefe++;
      else if (z === '}') {
        stapel[stapel.length - 1].tiefe--;
        if (stapel[stapel.length - 1].tiefe === 0) { raus += '}'; i++; continue; }
      }
    }
    raus += z;
    i++;
  }
  return raus;
}

for (const datei of dateien('src', ['.ts'])) {
  const alt = await readFile(datei, 'utf8');
  const neu = ersetzeInQuelltext(alt);
  if (neu !== alt) {
    geaendert++;
    if (!nurPruefen) await writeFile(datei, neu, 'utf8');
    console.log('  ' + datei);
  }
}

/* JSON: nur Werte bekannter Anzeigefelder. */
const ANZEIGEFELDER = new Set([
  'name', 'description', 'beschreibung', 'ruler', 'text', 'hint', 'label',
  'title', 'note', 'kurz', 'statusMessage',
]);

for (const datei of dateien('src/data', ['.json'])) {
  const roh = await readFile(datei, 'utf8');
  const daten = JSON.parse(roh);
  let treffer = 0;
  (function geh(o) {
    if (Array.isArray(o)) { o.forEach(geh); return; }
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string' && ANZEIGEFELDER.has(k) && istAnzeigetext(v)) {
          const neu = ersetzeText(v);
          if (neu !== v) { o[k] = neu; treffer++; }
        } else geh(v);
      }
    }
  })(daten);
  if (treffer) {
    geaendert++;
    if (!nurPruefen) {
      await writeFile(datei, JSON.stringify(daten, null, 2) + '\n', 'utf8');
    }
    console.log(`  ${datei} (${treffer})`);
  }
}

/* index.html */
{
  const alt = await readFile('index.html', 'utf8');
  const neu = alt.replace(/>([^<>]+)</g, (ganz, text) =>
    istAnzeigetext(text) ? '>' + ersetzeText(text) + '<' : ganz);
  if (neu !== alt) {
    geaendert++;
    if (!nurPruefen) await writeFile('index.html', neu, 'utf8');
    console.log('  index.html');
  }
}

console.log(nurPruefen
  ? `\n${geaendert} Dateien wuerden geaendert (Probelauf).`
  : `\n${geaendert} Dateien geaendert.`);

/**
 * Baut Szenariodateien aus lesbaren Beschreibungen.
 *
 * Ein Szenario im fertigen Format besteht aus Gebietskennungen: "eu127",
 * "vo16". Die kann niemand nachprüfen - ob Böhmen 1618 wirklich bei
 * Habsburg lag, sieht man einer Liste von Kennungen nicht an. Deshalb wird
 * ein Szenario hier über Gebiets*namen* beschrieben, und dieses Werkzeug
 * setzt sie in Kennungen um.
 *
 * Was dabei geprüft wird - jeder dieser Fehler wäre im Spiel sonst
 * entweder unsichtbar oder ein Absturz:
 *   - Gebietsname gibt es auf der Karte nicht (Tippfehler)
 *   - zwei Länder beanspruchen dasselbe Gebiet
 *   - die Hauptstadt gehört dem Land gar nicht
 *   - die Flagge ist nicht gezeichnet
 *   - ein Land hat kein einziges Gebiet
 *   - ein Land ist von seinen übrigen Gebieten abgeschnitten
 *
 * Nicht vergebene Gebiete bleiben herrenlos. Das ist Absicht und kein
 * Versäumnis: 1618 war Mitteleuropa ein Flickenteppich aus Hunderten
 * Kleinterritorien, und die alle einzeln zu führen hieße, das Spiel
 * unspielbar zu machen.
 *
 * Aufruf: node tools/szenario.mjs [kennung ...] [--pruefen]
 *         ohne Kennung werden alle Beschreibungen unter tools/szenarien
 *         gebaut.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const WURZEL = path.join(import.meta.dirname, '..');
const BESCHREIBUNGEN = path.join(import.meta.dirname, 'szenarien');
const KARTEN = path.join(WURZEL, 'src', 'data', 'maps');
const ZIEL = path.join(WURZEL, 'src', 'data', 'scenarios');

const args = process.argv.slice(2);
const NUR_PRUEFEN = args.includes('--pruefen');
const GEWAEHLT = args.filter((a) => !a.startsWith('--'));

/* Welche Flaggen sind gezeichnet? */
const flaggenQuelle = await readFile(path.join(WURZEL, 'src', 'ui', 'flaggen.ts'), 'utf8');
const FLAGGEN = new Set(
  [...flaggenQuelle.slice(flaggenQuelle.indexOf('export const FLAGGEN'))
    .matchAll(/^ {2}([a-z_0-9]+):/gm)].map((m) => m[1]),
);

const kartenZwischen = new Map();
async function karteLaden(id) {
  if (!kartenZwischen.has(id)) {
    kartenZwischen.set(id, JSON.parse(await readFile(path.join(KARTEN, id + '.json'), 'utf8')));
  }
  return kartenZwischen.get(id);
}

/**
 * Verteilt die Truppen eines Landes auf seine Gebiete.
 *
 * Jedes Gebiet bekommt wenigstens eine Einheit - ein völlig leeres Gebiet
 * fällt beim ersten Windstoß und sieht auf der Karte aus wie ein Fehler.
 * Darüber hinaus stehen die Schwerpunkte dort, wo sie historisch standen:
 * die Hauptstadt und die genannten Aufmarschräume.
 */
function heerVerteilen(land, idsNachName) {
  const heer = {};
  for (const name of land.gebiete) heer[idsNachName.get(name)] = 1;

  const schwer = land.heer?.schwerpunkte ?? {};
  for (const [name, zahl] of Object.entries(schwer)) {
    heer[idsNachName.get(name)] = zahl;
  }
  const hs = idsNachName.get(land.hauptstadt);
  heer[hs] = land.heer?.hauptstadt ?? Math.max(heer[hs] ?? 1, 8);
  return heer;
}

/** Hängen alle Gebiete eines Landes zusammen? Rein beratend. */
function inselnZaehlen(ids, karte) {
  const nachbarn = new Map(karte.provinces.map((p) => [p.id, p.neighbors ?? []]));
  const offen = new Set(ids);
  let inseln = 0;
  while (offen.size) {
    inseln++;
    const stapel = [offen.values().next().value];
    offen.delete(stapel[0]);
    while (stapel.length) {
      for (const n of nachbarn.get(stapel.pop()) ?? []) {
        if (offen.has(n)) { offen.delete(n); stapel.push(n); }
      }
    }
  }
  return inseln;
}

async function bauen(datei) {
  const mod = await import(path.join(BESCHREIBUNGEN, datei));
  const b = mod.default;
  const karte = await karteLaden(b.mapId);

  const idsNachName = new Map();
  for (const p of karte.provinces) {
    if (idsNachName.has(p.name)) {
      console.log(`  WARN ${b.id}: "${p.name}" kommt auf der Karte mehrfach vor`);
    }
    idsNachName.set(p.name, p.id);
  }

  let fehler = 0;
  const meckern = (t) => { console.log(`  FEHL ${b.id}: ${t}`); fehler++; };

  const vergeben = new Map();   // Gebietsname -> Land
  const countries = [];

  for (const land of b.laender) {
    if (!land.gebiete?.length) meckern(`"${land.id}" hat kein Gebiet`);
    if (land.flag && !FLAGGEN.has(land.flag)) meckern(`"${land.id}": Flagge "${land.flag}" ist nicht gezeichnet`);

    for (const name of land.gebiete) {
      if (!idsNachName.has(name)) { meckern(`"${land.id}": Gebiet "${name}" gibt es auf ${b.mapId} nicht`); continue; }
      const schon = vergeben.get(name);
      if (schon) meckern(`"${name}" ist an "${schon}" und "${land.id}" zugleich vergeben`);
      vergeben.set(name, land.id);
    }

    if (!land.gebiete.includes(land.hauptstadt)) {
      meckern(`"${land.id}": Hauptstadt "${land.hauptstadt}" gehört dem Land nicht`);
    }

    const ids = land.gebiete.map((n) => idsNachName.get(n)).filter(Boolean);
    if (ids.length > 1) {
      const inseln = inselnZaehlen(ids, karte);
      if (inseln > 1) {
        console.log(`  Hinweis ${b.id}: "${land.id}" liegt in ${inseln} getrennten Teilen`);
      }
    }

    countries.push({
      id: land.id,
      name: land.name,
      color: land.color,
      pattern: land.pattern ?? 'solid',
      emblem: land.emblem ?? land.name[0],
      ruler: land.ruler,
      government: land.government ?? 'monarchy',
      personality: land.personality ?? 'balanced',
      capital: idsNachName.get(land.hauptstadt),
      provinces: ids,
      gold: land.gold ?? 600,
      stability: land.stability ?? 55,
      politicalPower: land.politicalPower ?? 25,
      tech: land.tech ?? { military: 1, economy: 1, administration: 1, logistics: 1, defense: 1 },
      armies: heerVerteilen(land, idsNachName),
      traits: land.traits ?? { military: 1, economy: 1, defense: 1, research: 1, trade: 1 },
      description: land.description,
      flag: land.flag,
    });
  }

  /* Siegbedingungen: Die Hauptstädte stammen aus den Ländern selbst, damit
     sie nicht von Hand nachgezogen werden müssen, wenn sich etwas ändert. */
  const hauptstaedte = countries.map((c) => c.capital);
  const gebrauchteGebiete = b.sieg?.gebiete
    ?? Math.round(vergeben.size * 0.6);
  const victoryConditions = [
    {
      type: 'provinces',
      value: gebrauchteGebiete,
      description: `Beherrsche ${gebrauchteGebiete} der ${karte.provinces.length} Gebiete.`,
    },
    {
      type: 'capitals',
      value: b.sieg?.hauptstaedte ?? 3,
      targets: hauptstaedte,
      description: `Erobere ${['', 'eine', 'zwei', 'drei', 'vier', 'fünf'][b.sieg?.hauptstaedte ?? 3]} fremde Hauptstädte.`,
    },
  ];

  const szenario = {
    id: b.id,
    name: b.name,
    description: b.description,
    mapId: b.mapId,
    startYear: b.startYear,
    endYear: b.endYear,
    monthsPerTurn: b.monthsPerTurn ?? 12,
    sandbox: false,
    provinceOverrides: b.provinceOverrides ?? {},
    countries,
    relations: (b.beziehungen ?? []).map(([a, c, value]) => ({ a, b: c, value })),
    /* Bündnisse sind benannte Blöcke mit einem Anführer, nicht blosse
       Paare: Die Oberfläche zeigt sie unter ihrem historischen Namen,
       und die Rechenlogik braucht den Anführer für Beistandsfragen. */
    alliances: (b.buendnisse ?? []).map((al) => ({
      id: al.id,
      name: al.name,
      leaderId: al.fuehrer,
      memberIds: [...al.mitglieder],
    })),
    wars: (b.kriege ?? []).map(([sideA, sideB]) => ({ sideA, sideB })),
    events: b.events ?? [],
    victoryConditions,
  };

  /* Verweise in Beziehungen, Bündnissen und Kriegen müssen Länder treffen. */
  const bekannt = new Set(countries.map((c) => c.id));
  for (const r of szenario.relations) {
    for (const s of [r.a, r.b]) if (!bekannt.has(s)) meckern(`Beziehung nennt unbekanntes Land "${s}"`);
  }
  for (const w of szenario.wars) {
    for (const s of [...w.sideA, ...w.sideB]) if (!bekannt.has(s)) meckern(`Krieg nennt unbekanntes Land "${s}"`);
  }
  for (const a of szenario.alliances) {
    if (!a.id || !a.name) meckern('Bündnis ohne Kennung oder Namen');
    if (!a.memberIds.includes(a.leaderId)) {
      meckern(`Bündnis "${a.id}": Anführer "${a.leaderId}" ist kein Mitglied`);
    }
    for (const s of a.memberIds) {
      if (!bekannt.has(s)) meckern(`Bündnis "${a.id}" nennt unbekanntes Land "${s}"`);
    }
  }

  if (fehler) return { id: b.id, fehler };

  if (!NUR_PRUEFEN) {
    await writeFile(path.join(ZIEL, b.id + '.json'), JSON.stringify(szenario, null, 1) + '\n', 'utf8');
  }
  const herrenlos = karte.provinces.length - vergeben.size;
  console.log(`  ok   ${b.id.padEnd(22)} ${countries.length} Länder, `
    + `${vergeben.size}/${karte.provinces.length} Gebiete vergeben, ${herrenlos} herrenlos`);
  return { id: b.id, fehler: 0 };
}

const dateien = (await readdir(BESCHREIBUNGEN))
  .filter((d) => d.endsWith('.mjs'))
  .filter((d) => !GEWAEHLT.length || GEWAEHLT.includes(d.replace('.mjs', '')));

if (!dateien.length) {
  console.log('Keine Beschreibung gefunden.');
  process.exit(1);
}

let fehler = 0;
for (const d of dateien.sort()) fehler += (await bauen(d)).fehler;

console.log(fehler === 0
  ? `\n${dateien.length} Szenario(s) ${NUR_PRUEFEN ? 'geprüft' : 'geschrieben'}.`
  : `\n${fehler} Fehler - betroffene Szenarien nicht geschrieben.`);
process.exit(fehler === 0 ? 0 : 1);

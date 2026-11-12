/**
 * Erzeugt die Spielkarten neu - mit feinen Umrissen und echter Topologie.
 *
 * Ausgangslage: Die bisherigen Karten hatten rund 21 Punkte je Gebiet und
 * teilten sich nur zehn Prozent ihrer Kanten. Daher die eckigen Formen - und
 * daher auch, dass Staatsgrenzen bisher ueber einen Bildfilter (feMorphology)
 * angedeutet werden mussten statt gezeichnet zu werden. Der Filter ist teuer:
 * er rastert bei jeder Bewegung die ganze Flaeche neu.
 *
 * Dieses Werkzeug holt die Umrisse aus den Natural-Earth-Daten zurueck, aus
 * denen die Karten urspruenglich entstanden sind, und baut daraus eine
 * Topologie:
 *
 *   - Gemeinsame Grenzlinien werden genau einmal gespeichert ("Boegen").
 *   - Jedes Gebiet ist eine Folge von Boegen, vorwaerts oder rueckwaerts.
 *   - Zu jedem Bogen ist bekannt, welche Gebiete links und rechts liegen.
 *
 * Damit passen benachbarte Gebiete pixelgenau aneinander, und eine
 * Staatsgrenze ist schlicht die Menge der Boegen, deren beide Seiten
 * verschiedenen Besitzern gehoeren - scharf in jeder Zoomstufe und ohne
 * Filter.
 *
 * Entscheidend: Die Gebietskennungen bleiben unveraendert. Alle Szenarien
 * verweisen darauf. Geaendert wird nur die Geometrie.
 *
 * Aufruf: node tools/karten.mjs [ordner-mit-natural-earth]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pkg from 'polygon-clipping';
import {
  baueProStaat, baueVerzeichnis, feld, ladeEinheiten, schluessel,
} from './zuordnung.mjs';

const { union } = pkg;

const NE = process.argv[2] ?? '/home/claude/ne-daten';
const KARTEN = path.join(import.meta.dirname, '..', 'src', 'data', 'maps');

/**
 * Nachhilfe fuer Namen, die sich nicht von selbst finden.
 *
 * Die Spielkarten benutzen teils andere Schreibweisen als Natural Earth.
 * Rechts steht entweder ein Name einer Einheit oder, mit "region:", die
 * Gruppe mehrerer Einheiten.
 */
const NACHHILFE = {
  'Spain|Foral de Navarra': 'Navarra',
  'Spain|Valenciana': 'region:Comunidad Valenciana',
  'Syria|Damaskus': 'Dimashq',
  'Egypt|Kairo': 'Al Qahirah',
  'Russia|Petersburg': 'Sankt-Peterburg',
  'Bosnia and Herz.|Bosnia and Herz.': 'region:Federation of B&H',
};

/* ------------------------------------------------------------------ */
/* Zuordnung: Spielgebiet -> eine oder mehrere Einheiten               */
/* ------------------------------------------------------------------ */

function baueRegionen(merkmale) {
  const r = new Map();
  for (const f of merkmale) {
    const staat = schluessel(f.properties.admin);
    const reg = schluessel(f.properties.region);
    if (!reg) continue;
    const k = staat + '|' + reg;
    if (!r.has(k)) r.set(k, []);
    r.get(k).push(f);
    // Auch ohne Staat erreichbar, falls die Karte keinen angibt.
    if (!r.has(reg)) r.set(reg, []);
    r.get(reg).push(f);
  }
  return r;
}

function ordneZu(p, kram) {
  const { proStaat, welt1, welt0, regionen } = kram;

  const hilfe = NACHHILFE[`${p.land}|${p.name}`];
  if (hilfe) {
    if (hilfe.startsWith('region:')) {
      const k = schluessel(p.land) + '|' + schluessel(hilfe.slice(7));
      const g = regionen.get(k) ?? regionen.get(schluessel(hilfe.slice(7)));
      if (g?.length) return g;
    } else {
      const inStaat = proStaat.get(schluessel(p.land));
      const t = inStaat?.streng.get(schluessel(hilfe)) ?? inStaat?.weit.get(schluessel(hilfe))
        ?? welt1.get(schluessel(hilfe));
      if (t) return [t];
    }
  }

  const imStaat = p.land ? proStaat.get(schluessel(p.land)) : null;

  /* 1. Eine Gruppe von Einheiten, deren "region" so heisst - also etwa
        franzoesische Departements zu einer Region oder spanische Provinzen
        zu einer autonomen Gemeinschaft. Das kommt vor dem Einzeltreffer:
        Natural Earth fuehrt bei manchen Provinzen den Regionsnamen als
        Nebenform mit, und dann gewaenne sonst eine einzelne Provinz gegen
        die ganze Region. */
  const regK = (p.land ? schluessel(p.land) + '|' : '') + schluessel(p.name);
  const gruppe = regionen.get(regK) ?? (p.land ? null : regionen.get(schluessel(p.name)));
  if (gruppe && gruppe.length > 1) return gruppe;

  // 2. Eine Einheit, die wirklich so heisst.
  const streng = imStaat?.streng.get(schluessel(p.name));
  if (streng) return [streng];
  if (gruppe?.length) return gruppe;

  // 3. Eine Einheit, die so genannt wird.
  const weit = imStaat?.weit.get(schluessel(p.name));
  if (weit) return [weit];

  // 4. Weltweit suchen - zuerst Staaten, dann Verwaltungseinheiten.
  const t0 = welt0.get(schluessel(p.name));
  if (t0) return [t0];
  const t1 = welt1.get(schluessel(p.name));
  if (t1) return [t1];
  return null;
}

/* ------------------------------------------------------------------ */
/* Abbildung der Kugel auf die Zeichenflaeche                          */
/* ------------------------------------------------------------------ */

/**
 * Mercator.
 *
 * Beide Richtungen muessen in derselben Einheit herauskommen, sonst stimmt
 * das Seitenverhaeltnis nicht. Der Laengengrad geht deshalb ins Bogenmass -
 * mit Grad gegen die natuerliche Mercator-Breite gerechnet, kam hier
 * zunaechst ein Verhaeltnis von 83:1 heraus und Europa lag als Strich auf
 * der Karte.
 */
const mercX = (lon) => (lon * Math.PI) / 180;

const mercY = (lat) => {
  const b = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + b / 2));
};

function ringe(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates;
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat();
  return [];
}

/**
 * Flaechenschwerpunkt einer Punktfolge.
 *
 * Der blosse Mittelwert aller Punkte taugt hier nicht: An zerkluefteten
 * Kuesten sitzen viel mehr Punkte als im glatten Binnenland, und der
 * Mittelwert wandert dadurch zur Kueste. Der Flaechenschwerpunkt haengt
 * dagegen nicht davon ab, wie dicht die Punkte liegen - nur so sind alte
 * und neue Umrisse vergleichbar.
 */
/** Vorzeichenbehaftete Flaeche - das Vorzeichen gibt die Umlaufrichtung. */
function flaecheVonRing(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return a / 2;
}

function flaechenSchwerpunkt(pts) {
  let a = 0; let cx = 0; let cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    a += f;
    cx += (pts[j][0] + pts[i][0]) * f;
    cy += (pts[j][1] + pts[i][1]) * f;
  }
  if (Math.abs(a) < 1e-12) {
    let sx = 0; let sy = 0;
    for (const [x, y] of pts) { sx += x; sy += y; }
    return { x: sx / pts.length, y: sy / pts.length, flaeche: 0 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a), flaeche: Math.abs(a / 2) };
}

/** Schwerpunkt einer Einheit in Laengengrad und gestreckter Breite. */
function schwerpunktGrad(merkmale) {
  let gx = 0; let gy = 0; let gesamt = 0;
  let glat = 0;
  for (const f of merkmale) {
    for (const ring of ringe(f.geometry)) {
      const pts = ring
        .filter(([lo, la]) => Number.isFinite(lo) && Number.isFinite(la))
        .map(([lo, la]) => [mercX(lo), mercY(la)]);
      if (pts.length < 3) continue;
      const s = flaechenSchwerpunkt(pts);
      const roh = flaechenSchwerpunkt(ring.map(([lo, la]) => [lo, la]));
      gx += s.x * s.flaeche; gy += s.y * s.flaeche; gesamt += s.flaeche;
      glat += roh.y * s.flaeche;
    }
  }
  return gesamt > 0
    ? { lon: gx / gesamt, my: gy / gesamt, lat: glat / gesamt }
    : null;
}


/** Flaechenschwerpunkt eines alten Umrisses auf der Zeichenflaeche. */
function schwerpunktAlt(points) {
  const pts = String(points ?? '').split(' ').map((paar) => {
    const i = paar.indexOf(',');
    return i < 0 ? null : [+paar.slice(0, i), +paar.slice(i + 1)];
  }).filter((q) => q && Number.isFinite(q[0]) && Number.isFinite(q[1]));
  if (pts.length < 3) return null;
  const s = flaechenSchwerpunkt(pts);
  return { x: s.x, y: s.y };
}

/**
 * Rechnet die Abbildung aus der vorhandenen Karte zurueck.
 *
 * Die alte Karte ist grob, aber sie weiss, wo welches Gebiet liegt. Zu jedem
 * Gebiet gibt es damit ein Paar: der Schwerpunkt des alten Umrisses auf der
 * Zeichenflaeche und der echte Schwerpunkt auf der Kugel. Aus vielen solchen
 * Paaren ergibt sich die Abbildung durch Ausgleichsrechnung.
 *
 * Der Nutzen geht ueber die Abbildung hinaus: Wer nach der Anpassung weit
 * danebenliegt, ist falsch zugeordnet. Genau so fallen die beiden Gebiete
 * auf, die in der Europakarte "Bouvet Island" und "Khanty-Mansiy" heissen -
 * Altlasten der fruheren Erzeugung, deren echte Geometrie im Suedatlantik
 * beziehungsweise in Westsibirien liegt.
 */
function passeAbbildungAn(paare) {
  /* Nicht jede Karte ist in Mercator gezeichnet. Die Weltkarte des Spiels
     folgt offenbar einer Abbildung, die den Breitengrad gerade abtraegt -
     bei Mercator lagen Kanada, Norwegen und die Vereinigten Staaten so weit
     daneben, dass sie als falsch zugeordnet ausgeschieden waeren. Deshalb
     werden beide Masse angepasst und das bessere genommen. */
  const mitMass = (mass) => passeEineAn(paare.map((q) => ({ ...q, m: mass(q) })));
  const kandidaten = [
    { name: 'mercator', mass: (q) => q.my, ab: null },
    { name: 'gerade', mass: (q) => q.lat, ab: null },
  ];
  for (const k of kandidaten) k.ab = mitMass(k.mass);
  kandidaten.sort((a, b) => a.ab.rest - b.ab.rest);
  const sieger = kandidaten[0];
  const ab = sieger.ab;
  return {
    x: ab.x,
    y: (lat) => ab.yRoh(sieger.mass({ my: mercY(lat), lat })),
    yRoh: ab.yRoh,
    fehlerVon: (q) => Math.hypot(ab.x(q.lonGrad) - q.x, ab.yRoh(sieger.mass(q)) - q.y),
    art: sieger.name,
    rest: ab.rest,
  };
}

function passeEineAn(paare) {
  const gerade = (xs, ys) => {
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let oben = 0; let unten = 0;
    for (let i = 0; i < n; i++) { oben += (xs[i] - mx) * (ys[i] - my); unten += (xs[i] - mx) ** 2; }
    const a = unten ? oben / unten : 1;
    return { a, b: my - a * mx };
  };

  /* In mehreren Runden anpassen und dabei jeweils die schlechtesten acht
     Prozent weglassen. Sonst zoegen einzelne falsch zugeordnete Gebiete die
     ganze Abbildung schief. */
  let menge = paare;
  let lx = gerade(menge.map((q) => q.mx), menge.map((q) => q.x));
  let ly = gerade(menge.map((q) => q.m), menge.map((q) => q.y));
  for (let runde = 0; runde < 4; runde++) {
    const mitFehler = menge.map((q) => ({
      q, f: Math.hypot(lx.a * q.mx + lx.b - q.x, ly.a * q.m + ly.b - q.y),
    })).sort((u, v) => u.f - v.f);
    menge = mitFehler.slice(0, Math.max(10, Math.floor(mitFehler.length * 0.92))).map((u) => u.q);
    lx = gerade(menge.map((q) => q.mx), menge.map((q) => q.x));
    ly = gerade(menge.map((q) => q.m), menge.map((q) => q.y));
  }

  const fehler = paare
    .map((q) => Math.hypot(lx.a * q.mx + lx.b - q.x, ly.a * q.m + ly.b - q.y))
    .sort((a, b) => a - b);

  return {
    x: (lon) => lx.a * mercX(lon) + lx.b,
    /** Fuer ein bereits ausgerechnetes Breitenmass. */
    yRoh: (m) => ly.a * m + ly.b,
    /** Mittlerer Restfehler - entscheidet, welche Abbildung gewinnt. */
    rest: fehler[Math.floor(fehler.length / 2)],
  };
}

/* ------------------------------------------------------------------ */
/* Vereinfachen, ohne die Nachbarschaft zu zerreissen                  */
/* ------------------------------------------------------------------ */

/**
 * Dreht einen Ring in eine einheitliche Umlaufrichtung.
 *
 * Natural Earth haelt die Umlaufrichtung nicht durchgaengig gleich. Fuers
 * Zeichnen ist das egal, fuers Verschmelzen nicht.
 */
function gleicheRichtung(pts) {
  return flaecheVonRing(pts) < 0 ? [...pts].reverse() : pts;
}

/**
 * Vereinfacht alle Ringe so, dass benachbarte Gebiete lueckenlos bleiben.
 *
 * Das ist der heikle Punkt der ganzen Umstellung. Vereinfachte man jedes
 * Gebiet fuer sich, entstuenden an den gemeinsamen Grenzen Spalte und
 * Ueberlappungen - der klassische Fehler. Der erste Anlauf hier ging ueber
 * eine Topologie aus gemeinsamen Boegen; die zerbrach an uneinheitlichen
 * Daten und liess hunderte Ringe offen.
 *
 * Dieser Weg kommt ohne Topologie aus und nutzt zwei Eigenschaften:
 *
 *   - Alle Punkte liegen auf demselben Gitter. Was bei Natural Earth
 *     derselbe Punkt ist, ist danach auch hier derselbe Punkt.
 *   - Ob ein Punkt wegfaellt, haengt nur von ihm und seinen beiden direkten
 *     Nachbarn ab, ueber den Abstand zur Verbindungslinie. Dieses Mass ist
 *     richtungsunabhaengig: Zwei Gebiete, die ihre gemeinsame Grenze
 *     gegenlaeufig durchlaufen, entscheiden deshalb gleich.
 *
 * Punkte, an denen mehr als zwei Einheiten zusammenstossen, bleiben immer
 * erhalten. Dort unterscheiden sich die Nachbarn je nach Gebiet, und nur
 * dort koennte die Entscheidung auseinandergehen.
 */
function vereinfacheGemeinsam(alleRinge, toleranz) {
  const schl = ([x, y]) => `${x},${y}`;

  // Wie viele verschiedene Ringe beruehren einen Punkt?
  const zaehler = new Map();
  for (const ring of alleRinge) {
    const schon = new Set();
    for (const q of ring) {
      const k = schl(q);
      if (schon.has(k)) continue;
      schon.add(k);
      zaehler.set(k, (zaehler.get(k) ?? 0) + 1);
    }
  }
  const geschuetzt = (q) => (zaehler.get(schl(q)) ?? 0) > 2;

  const abstand = (a, b, c) => {
    const dx = c[0] - a[0]; const dy = c[1] - a[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-12) return Math.hypot(b[0] - a[0], b[1] - a[1]);
    return Math.abs(dy * b[0] - dx * b[1] + c[0] * a[1] - c[1] * a[0]) / l;
  };

  return alleRinge.map((ring) => {
    const n = ring.length;
    if (n <= 8) return ring;
    const aktiv = new Uint8Array(n).fill(1);

    /* Der entscheidende Punkt: Gemessen wird nicht gegen die beiden
       uebrig gebliebenen Nachbarn allein, sondern gegen alle
       urspruenglichen Punkte dazwischen. Sonst bliebe zwar jeder einzelne
       Schritt innerhalb der Toleranz, die Fehler summierten sich aber ueber
       die Durchgaenge auf und eine sanfte Kuestenrundung wuerde am Ende zur
       Geraden - genau das ist mir hier erst passiert. */
    const vorherige = (i) => { let k = (i - 1 + n) % n; while (!aktiv[k]) k = (k - 1 + n) % n; return k; };
    const naechste = (i) => { let k = (i + 1) % n; while (!aktiv[k]) k = (k + 1) % n; return k; };

    const passt = (a, b) => {
      const A = ring[a]; const B = ring[b];
      for (let k = (a + 1) % n; k !== b; k = (k + 1) % n) {
        if (abstand(A, ring[k], B) >= toleranz) return false;
      }
      return true;
    };

    let geaendert = true;
    let uebrig = n;
    while (geaendert && uebrig > 8) {
      geaendert = false;
      for (let i = 0; i < n; i++) {
        if (!aktiv[i] || geschuetzt(ring[i])) continue;
        if (uebrig <= 8) break;
        const a = vorherige(i); const b = naechste(i);
        if (a === b) continue;
        aktiv[i] = 0;
        if (passt(a, b)) { geaendert = true; uebrig--; } else { aktiv[i] = 1; }
      }
    }
    const raus = ring.filter((_, i) => aktiv[i]);
    return raus.length >= 4 ? raus : ring;
  });
}

/* ------------------------------------------------------------------ */
/* Verschmelzen mehrerer Einheiten zu einem Gebiet                     */
/* ------------------------------------------------------------------ */

/**
 * Vereinigt die Einheiten eines Gebiets zu dessen Umriss.
 *
 * Gemacht wird das von polygon-clipping - eine erprobte Umsetzung der
 * Mengenoperationen auf Vielecken. Von Hand ist das eine erstaunlich
 * fehlertraechtige Angelegenheit, und hier hat Genauigkeit Vorrang vor
 * Eigenbau.
 */
function vereinige(ringeDesGebiets) {
  if (ringeDesGebiets.length === 1) return ringeDesGebiets;
  try {
    const stuecke = ringeDesGebiets.map((r) => [[...r, r[0]]]);
    const v = union(stuecke[0], ...stuecke.slice(1));
    const raus = [];
    for (const poly of v) {
      for (const ring of poly) {
        const pts = ring.slice(0, -1);
        if (pts.length >= 3) raus.push(pts);
      }
    }
    return raus.length ? raus : ringeDesGebiets;
  } catch {
    // Lieber die Einzelteile zeichnen als gar nichts.
    return ringeDesGebiets;
  }
}

/**
 * Ein Punkt, der sicher im Gebiet liegt - fuer Beschriftung und Pfeile.
 *
 * Der Flaechenschwerpunkt liegt bei geschwungenen Formen gern ausserhalb,
 * etwa bei einem Kuestenbogen oder einem u-foermigen Gebiet. Dann wird ueber
 * ein grobes Raster der Punkt mit dem groessten Abstand zum Rand gesucht;
 * fuer eine Beschriftung genuegt das.
 */
function innenPunkt(ringe2) {
  const gross = ringe2.reduce(
    (a, b) => (Math.abs(flaecheVonRing(b)) > Math.abs(flaecheVonRing(a)) ? b : a),
  );
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const [x, y] of gross) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const drin = (px, py) => {
    let d = false;
    for (let i = 0, j = gross.length - 1; i < gross.length; j = i++) {
      const [xi, yi] = gross[i]; const [xj, yj] = gross[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) d = !d;
    }
    return d;
  };

  const s = flaechenSchwerpunkt(gross);
  if (drin(s.x, s.y)) return [+s.x.toFixed(1), +s.y.toFixed(1)];

  let bester = [s.x, s.y]; let besterAbstand = -1;
  const schritte = 22;
  for (let i = 1; i < schritte; i++) {
    for (let j = 1; j < schritte; j++) {
      const px = minX + ((maxX - minX) * i) / schritte;
      const py = minY + ((maxY - minY) * j) / schritte;
      if (!drin(px, py)) continue;
      let nah = Infinity;
      for (const [x, y] of gross) {
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < nah) nah = d;
      }
      if (nah > besterAbstand) { besterAbstand = nah; bester = [px, py]; }
    }
  }
  return [+bester[0].toFixed(1), +bester[1].toFixed(1)];
}

/* ------------------------------------------------------------------ */
/* Kompakte Ablage                                                     */
/* ------------------------------------------------------------------ */

/* Muss Zeichen fuer Zeichen zu src/core/koordinaten.ts passen.
   test/koordinaten.mjs laesst beide gegeneinander laufen. */
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function kodiereZahl(n) {
  let v = n < 0 ? -2 * n - 1 : 2 * n;
  let raus = '';
  for (;;) {
    const teil = v & 31;
    v = Math.floor(v / 32);
    raus += ZEICHEN[v > 0 ? teil | 32 : teil];
    if (v === 0) return raus;
  }
}

/** Ring als Folge von Unterschieden - siehe src/core/koordinaten.ts. */
function kodiereRing(punkte, teiler) {
  let raus = '';
  let lx = 0; let ly = 0;
  for (const [x, y] of punkte) {
    const gx = Math.round(x * teiler);
    const gy = Math.round(y * teiler);
    raus += kodiereZahl(gx - lx) + kodiereZahl(gy - ly);
    lx = gx; ly = gy;
  }
  return raus;
}

/* ------------------------------------------------------------------ */
/* Grenzlinien                                                         */
/* ------------------------------------------------------------------ */

/**
 * Zieht die Grenzlinien aus den noch unvereinfachten Umrissen.
 *
 * Warum nicht aus den fertigen Umrissen? Weil das Vereinfachen die beiden
 * Seiten einer Grenze nicht ganz gleich behandelt: Nachbarn durchlaufen ihre
 * gemeinsame Grenze gegenlaeufig, und dadurch faellt mal hier, mal dort ein
 * Punkt anders weg. Gemessen blieben so nur 15 Prozent der Kanten wirklich
 * gemeinsam - zu wenig, um daraus Linien zu bauen.
 *
 * Vor dem Vereinfachen liegen dagegen alle Punkte auf demselben Gitter und
 * stammen aus derselben Quelle; dort stimmen die Kanten exakt ueberein. Die
 * Linien werden deshalb hier gebildet, einmal zusammenhaengend verkettet und
 * erst danach vereinfacht - jede Linie genau einmal.
 *
 * Das Ergebnis traegt zu jeder Linie die beiden angrenzenden Gebiete. Liegt
 * nur eines an, ist es Kueste. Damit kann das Spiel Staatsgrenzen als echte
 * Linien zeichnen statt sie ueber einen Bildfilter anzudeuten - scharf in
 * jeder Zoomstufe und ungleich billiger.
 */
function zieheGrenzen(teile, toleranz) {
  const schl = ([x, y]) => `${x},${y}`;

  /* 1. Jede Kante einmal, mit den anliegenden Gebieten. */
  const kanten = new Map();
  for (const t of teile) {
    for (const ring of t.ringe) {
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = schl(ring[i]);
        const b = schl(ring[(i + 1) % n]);
        if (a === b) continue;
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        const e = kanten.get(k);
        if (e) {
          e.anzahl++;
          if (!e.wer.includes(t.gebiet)) e.wer.push(t.gebiet);
        } else {
          kanten.set(k, {
            von: a < b ? a : b, nach: a < b ? b : a, wer: [t.gebiet], anzahl: 1,
          });
        }
      }
    }
  }

  /* 2. Kanten mit gleicher Nachbarschaft zu Linienzuegen verketten. */
  const nachGruppe = new Map();
  for (const e of kanten.values()) {
    /* Eine Kante, die zweimal vom selben Gebiet benutzt wird, liegt mitten
       darin - etwa die Grenze zweier Departements innerhalb einer Region.
       Sie ist weder Kueste noch Staatsgrenze und faellt weg. */
    if (e.anzahl >= 2 && e.wer.length === 1) continue;
    const g = [...e.wer].sort().join('|');
    if (!nachGruppe.has(g)) nachGruppe.set(g, []);
    nachGruppe.get(g).push(e);
  }

  const linien = [];
  for (const [g, liste] of nachGruppe) {
    const wer = g.split('|');
    // Von jedem Punkt aus: welche Kanten haengen daran?
    const anPunkt = new Map();
    for (const e of liste) {
      for (const q of [e.von, e.nach]) {
        if (!anPunkt.has(q)) anPunkt.set(q, []);
        anPunkt.get(q).push(e);
      }
    }
    const benutzt = new Set();

    /* Erst an den Enden anfangen (Punkte mit genau einer Kante), damit
       offene Zuege ganz durchlaufen werden; der Rest sind Ringe. */
    const anfaenge = [...anPunkt.entries()]
      .filter(([, v]) => v.length === 1).map(([q]) => q)
      .concat([...anPunkt.keys()]);

    for (const start of anfaenge) {
      for (;;) {
        const erste = (anPunkt.get(start) ?? []).find((e) => !benutzt.has(e));
        if (!erste) break;
        const zug = [start];
        let hier = start;
        let kante = erste;
        for (;;) {
          benutzt.add(kante);
          const weiter = kante.von === hier ? kante.nach : kante.von;
          zug.push(weiter);
          hier = weiter;
          const naechste = (anPunkt.get(hier) ?? []).filter((e) => !benutzt.has(e));
          // An einer Gabelung aufhoeren - sonst entstehen Zickzacklinien.
          if (naechste.length !== 1) break;
          [kante] = naechste;
        }
        if (zug.length >= 2) {
          const pts = zug.map((q) => {
            const i = q.indexOf(',');
            return [+q.slice(0, i), +q.slice(i + 1)];
          });
          linien.push({ wer, pts: vereinfacheZug(pts, toleranz) });
        }
      }
    }
  }
  return linien;
}

/** Douglas-Peucker auf einem Linienzug. Endpunkte bleiben stehen. */
function vereinfacheZug(punkte, toleranz) {
  if (punkte.length <= 2) return punkte;
  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1; behalten[punkte.length - 1] = 1;
  const stapel = [[0, punkte.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop();
    if (b - a < 2) continue;
    const [ax, ay] = punkte[a]; const [bx, by] = punkte[b];
    const dx = bx - ax; const dy = by - ay;
    const laenge = Math.hypot(dx, dy);
    let schlimmste = 0; let wo = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = punkte[i];
      const d = laenge < 1e-12
        ? Math.hypot(px - ax, py - ay)
        : Math.abs(dy * px - dx * py + bx * ay - by * ax) / laenge;
      if (d > schlimmste) { schlimmste = d; wo = i; }
    }
    if (schlimmste > toleranz && wo > 0) {
      behalten[wo] = 1;
      stapel.push([a, wo], [wo, b]);
    }
  }
  return punkte.filter((_, i) => behalten[i]);
}

/**
 * Setzt die Umrisse eines Gebiets aus seinen Grenzlinien zusammen.
 *
 * Damit entstehen Flaeche und Grenze aus demselben Material. Das ist nicht
 * nur sparsam - es ist auch der einzige Weg, auf dem die gezeichnete Grenze
 * genau auf der Kante der Flaeche liegt. Werden beide getrennt vereinfacht,
 * laufen sie um Haaresbreite auseinander, und an den Raendern blitzt das
 * Meer durch.
 */
function ringeAusLinien(linien) {
  const schl = ([x, y]) => `${x},${y}`;
  const anPunkt = new Map();
  for (const l of linien) {
    for (const q of [schl(l.pts[0]), schl(l.pts[l.pts.length - 1])]) {
      if (!anPunkt.has(q)) anPunkt.set(q, []);
      anPunkt.get(q).push(l);
    }
  }

  const benutzt = new Set();
  const ringe2 = [];
  let offen = 0;

  for (const start of linien) {
    if (benutzt.has(start)) continue;
    const pts = [];
    let l = start;
    let vorwaerts = true;
    const anfang = schl(start.pts[0]);
    for (let schutz = 0; schutz <= linien.length; schutz++) {
      benutzt.add(l);
      const folge = vorwaerts ? l.pts : [...l.pts].reverse();
      for (const q of folge) {
        const letzte = pts[pts.length - 1];
        if (letzte && letzte[0] === q[0] && letzte[1] === q[1]) continue;
        pts.push(q);
      }
      const ende = schl(folge[folge.length - 1]);
      if (ende === anfang) break;
      const weiter = (anPunkt.get(ende) ?? []).find((k) => !benutzt.has(k));
      if (!weiter) { offen++; break; }
      vorwaerts = schl(weiter.pts[0]) === ende;
      l = weiter;
    }
    while (pts.length > 1
      && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    if (pts.length >= 3) ringe2.push(pts);
  }
  return { ringe: ringe2, offen };
}

/* ------------------------------------------------------------------ */
/* Luecken schliessen                                                  */
/* ------------------------------------------------------------------ */

/**
 * Verteilt die uebrigen Verwaltungseinheiten auf die Spielgebiete.
 *
 * Die Spielkarten haben fuer manche Laender weniger Gebiete als es dort
 * Verwaltungseinheiten gibt: Die Tuerkei hat im Spiel vier Gebiete, in
 * Wirklichkeit 81 Provinzen; die Schweiz eines statt 26 Kantonen. Naehme man
 * nur die gleichnamige Einheit, blieben drei Viertel des Landes als Loch auf
 * der Karte stehen.
 *
 * Deshalb bekommt jede nicht zugeordnete Einheit das Spielgebiet, dessen
 * eigene Einheiten ihr am naechsten liegen - bevorzugt im selben Staat. Das
 * hat einen angenehmen Nebeneffekt: Auch die so entstandenen Innengrenzen
 * folgen echten Verwaltungsgrenzen, nicht gedachten Linien.
 */
function verteileRest(zugeordnet, alleEinheiten, landVonGebiet, ab, hoechstAbstand) {
  const schonVergeben = new Set();
  for (const liste of zugeordnet.values()) for (const f of liste) schonVergeben.add(f);

  /* Zu jedem Spielgebiet die Schwerpunkte seiner Einheiten merken. */
  const anker = [];
  for (const [id, liste] of zugeordnet) {
    for (const f of liste) {
      const s = schwerpunktGrad([f]);
      if (s) {
        anker.push({
          id, x: ab.x((s.lon * 180) / Math.PI), y: ab.y(s.lat),
          land: landVonGebiet.get(id),
        });
      }
    }
  }
  if (!anker.length) return zugeordnet;

  const dazu = new Map();
  for (const f of alleEinheiten) {
    if (schonVergeben.has(f)) continue;
    const s = schwerpunktGrad([f]);
    if (!s) continue;
    const x = ab.x((s.lon * 180) / Math.PI);
    const y = ab.y(s.lat);
    const staat = schluessel(feld(f.properties, 'admin'));

    let bestes = null; let besteStrecke = Infinity;
    for (const a of anker) {
      const d = Math.hypot(a.x - x, a.y - y)
        // Gleicher Staat wird bevorzugt: Eine Einheit gehoert eher zum
        // Nachbargebiet im eigenen Land als ueber die Grenze.
        * (schluessel(a.land ?? '') === staat ? 1 : 3.5);
      if (d < besteStrecke) { besteStrecke = d; bestes = a.id; }
    }
    if (!bestes || besteStrecke > hoechstAbstand) continue;
    if (!dazu.has(bestes)) dazu.set(bestes, []);
    dazu.get(bestes).push(f);
  }

  const raus = new Map();
  for (const [id, liste] of zugeordnet) raus.set(id, [...liste, ...(dazu.get(id) ?? [])]);
  return raus;
}

/* ------------------------------------------------------------------ */
/* Hauptlauf                                                           */
/* ------------------------------------------------------------------ */

/**
 * Je Karte: wie fein darf es sein?
 *
 * "toleranz" ist der groesste Fehler in Zeichenflaechen-Einheiten, den das
 * Vereinfachen machen darf - bei einer 1500 Einheiten breiten Flaeche
 * entspricht 0,3 etwa einem funftel Pixel in der Uebersicht und bleibt bis
 * weit ins Hineinzoomen unsichtbar. "gitter" ist die Feinheit der Rundung,
 * auf der Nachbarn gemeinsame Punkte finden. "kleinsteInsel" ist die
 * Flaeche, unter der eine Insel wegfaellt - sonst frisst die norwegische
 * Schaerenkueste die halbe Datei.
 */
/** Wie viele ganzzahlige Schritte auf eine Einheit der Zeichenflaeche
    kommen. 8 heisst: Rasterfehler hoechstens ein Sechzehntel - deutlich
    feiner als alles, was man je zu sehen bekommt. */
const TEILER = 8;

const NUR = process.env.NUR_KARTE;
const TOL = process.env.TOLERANZ ? Number(process.env.TOLERANZ) : null;
const GIT = process.env.GITTER ? Number(process.env.GITTER) : null;

const EINSTELLUNG = {
  europadetail: { toleranz: 0.12, gitter: 64, kleinsteInsel: 0.7 },
  mittelmeer: { toleranz: 0.12, gitter: 64, kleinsteInsel: 0.7 },
  vorderasien: { toleranz: 0.12, gitter: 64, kleinsteInsel: 0.7 },
  welt: { toleranz: 0.35, gitter: 32, kleinsteInsel: 1.5 },
};

const { a1, a0 } = ladeEinheiten(NE);
const kram = {
  proStaat: baueProStaat(a1),
  welt1: baueVerzeichnis(a1),
  welt0: baueVerzeichnis(a0),
  regionen: baueRegionen(a1),
};

for (const [name, roh] of Object.entries(EINSTELLUNG)) {
  if (NUR && name !== NUR) continue;
  const einst = { ...roh, ...(TOL === null ? {} : { toleranz: TOL }), ...(GIT === null ? {} : { gitter: GIT }) };
  const datei = path.join(KARTEN, name + '.json');
  const karte = JSON.parse(readFileSync(datei, 'utf8'));

  /* 1. Jedes Spielgebiet einer oder mehreren echten Einheiten zuordnen */
  const zugeordnet = new Map();
  const ohne = [];
  for (const p of karte.provinces) {
    const t = ordneZu(p, kram);
    if (t && t.length) zugeordnet.set(p.id, t);
    else ohne.push(p.id + ' ' + p.name);
  }

  /* 2. Abbildung aus der alten Karte zurueckrechnen */
  const [, , vbBreite] = karte.viewBox.split(' ').map(Number);
  const paare = [];
  const altMitte = new Map();
  for (const p of karte.provinces) {
    const t = zugeordnet.get(p.id);
    if (!t) continue;
    const neu = schwerpunktGrad(t);
    const alt = schwerpunktAlt(p.points);
    if (!neu || !alt) continue;
    altMitte.set(p.id, alt);
    paare.push({
      id: p.id, mx: neu.lon, my: neu.my, lat: neu.lat,
      lonGrad: (neu.lon * 180) / Math.PI, x: alt.x, y: alt.y,
    });
  }
  const ab = passeAbbildungAn(paare);

  /* 2b. Wer nach der Anpassung weit danebenliegt, ist falsch zugeordnet
         und behaelt seinen alten Umriss. */
  const schwelle = vbBreite * 0.22;
  const unglaubwuerdig = new Set(
    paare.filter((q) => ab.fehlerVon(q) > schwelle).map((q) => q.id),
  );
  const glaubwuerdig = new Map();
  for (const [id, merkmale] of zugeordnet) {
    if (unglaubwuerdig.has(id)) continue;
    glaubwuerdig.set(id, merkmale);
  }

  /* 2c. Luecken schliessen: alles, was keinem Gebiet zugeordnet ist, geht
         an das naechstgelegene. */
  const landVonGebiet = new Map(karte.provinces.map((p) => [p.id, p.land]));
  const zugeschnitten = verteileRest(
    glaubwuerdig, karte.provinces.some((p) => p.land) ? a1 : a0,
    landVonGebiet, ab, vbBreite * 0.2,
  );
  if (process.env.UMFANG) {
    let a = Infinity; let b = -Infinity; let c = Infinity; let d = -Infinity;
    const wo = {};
    for (const [id, fs] of zugeschnitten) {
      for (const f of fs) for (const r of ringe(f.geometry)) for (const [lo, la] of r) {
        if (lo < a) { a = lo; wo.westen = id; }
        if (lo > b) { b = lo; wo.osten = id; }
        if (la < c) { c = la; wo.sueden = id; }
        if (la > d) { d = la; wo.norden = id; }
      }
    }
    console.log(`   Umfang lon ${a.toFixed(1)}..${b.toFixed(1)} lat ${c.toFixed(1)}..${d.toFixed(1)}`,
      JSON.stringify(wo));
  }

  /* 3. Auf die Zeichenflaeche bringen und aufs Gitter runden */
  const runde = (v) => Math.round(v * einst.gitter) / einst.gitter;
  const teile = [];
  for (const p of karte.provinces) {
    const t = zugeschnitten.get(p.id);
    if (!t) continue;
    const erwartet = altMitte.get(p.id);
    const eigene = [];
    for (const f of t) {
      for (const ring of ringe(f.geometry)) {
        /* Einzelne Einheiten schleppen weit entfernte Gebiete mit: unter
           einer norwegischen Region haengt Spitzbergen, unter einer
           franzoesischen Guayana. Was weit weg vom alten Ort des Gebiets
           liegt, gehoert nicht dazu. */
        if (erwartet && ring.length >= 3) {
          const s2 = flaechenSchwerpunkt(ring.map(([lo, la]) => [ab.x(lo), ab.y(la)]));
          if (Math.hypot(s2.x - erwartet.x, s2.y - erwartet.y) > vbBreite * 0.25) continue;
        }
        const pts = [];
        for (const [lo, la] of ring) {
          const q = [runde(ab.x(lo)), runde(ab.y(la))];
          const letzte = pts[pts.length - 1];
          if (letzte && letzte[0] === q[0] && letzte[1] === q[1]) continue;
          pts.push(q);
        }
        while (pts.length > 1
          && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        if (pts.length < 3) continue;
        eigene.push(gleicheRichtung(pts));
      }
    }
    if (!eigene.length) {
      if (process.env.WARUM) console.log('   keine Ringe fuer', p.id, p.name,
        '| unglaubwuerdig:', unglaubwuerdig.has(p.id),
        '| Einheiten:', (zugeschnitten.get(p.id) ?? []).length);
      continue;
    }
    /* Kleine Inseln kosten viele Punkte und sind kaum zu sehen. Der
       groesste Ring bleibt aber immer - sonst verschwaenden ganze
       Kleinstaaten wie Bremen oder Belgien von der Karte. */
    eigene.sort((a, b) => Math.abs(flaecheVonRing(b)) - Math.abs(flaecheVonRing(a)));
    const behalten = eigene.filter(
      (r, i) => i === 0 || Math.abs(flaecheVonRing(r)) >= einst.kleinsteInsel,
    );
    teile.push({ gebiet: p.id, ringe: behalten });
  }

  /* 3b. Grenzlinien aus den noch unvereinfachten Umrissen ziehen */
  const linien = zieheGrenzen(teile, einst.toleranz * 1.4);

  /* 4. Gemeinsam vereinfachen - ueber alle Gebiete hinweg, damit die
        Grenzen zueinander passen */
  const flach = [];
  const herkunft = [];
  for (const t of teile) {
    for (const r of t.ringe) { flach.push(r); herkunft.push(t.gebiet); }
  }
  const schlank = vereinfacheGemeinsam(flach, einst.toleranz);

  const nachGebiet = new Map();
  schlank.forEach((r, i) => {
    const id = herkunft[i];
    if (!nachGebiet.has(id)) nachGebiet.set(id, []);
    nachGebiet.get(id).push(r);
  });

  /* 5. Umrisse bilden - bevorzugt aus den Grenzlinien */
  const linienJeGebiet = new Map();
  for (const l of linien) {
    for (const w of l.wer) {
      if (!linienJeGebiet.has(w)) linienJeGebiet.set(w, []);
      linienJeGebiet.get(w).push(l);
    }
  }

  let punkteGesamt = 0;
  let ausLinien = 0;
  const verloren = [];
  const neueProvinzen = karte.provinces.map((p) => {
    const rs = nachGebiet.get(p.id);
    if (!rs) { verloren.push(p.id + ' ' + p.name + ' (keine Ringe)'); return p; }

    let vereint = null;
    const meine = linienJeGebiet.get(p.id);
    if (meine?.length) {
      const z = ringeAusLinien(meine);
      // Nur nehmen, wenn alles aufgegangen ist und die Flaeche stimmt.
      const flaeche = z.ringe.reduce((a, r) => a + Math.abs(flaecheVonRing(r)), 0);
      const soll = rs.reduce((a, r) => a + Math.abs(flaecheVonRing(r)), 0);
      if (!z.offen && z.ringe.length && flaeche > soll * 0.8 && flaeche < soll * 1.25) {
        vereint = z.ringe;
        ausLinien++;
      }
    }
    if (!vereint) vereint = vereinige(rs);
    vereint = vereint
      .sort((a, b) => Math.abs(flaecheVonRing(b)) - Math.abs(flaecheVonRing(a)))
      .filter((r, i) => i === 0 || Math.abs(flaecheVonRing(r)) >= einst.kleinsteInsel);
    if (!vereint.length) { verloren.push(p.id + ' ' + p.name + ' (Vereinigung leer)'); return p; }
    for (const r of vereint) punkteGesamt += r.length;
    const { points, ...rest } = p;
    void points;
    return {
      ...rest,
      rings: vereint.map((r) => kodiereRing(r, TEILER)),
      center: innenPunkt(vereint),
    };
  });

  /* Linienzuege ablegen: "a" und "b" sind die anliegenden Gebiete, bei
     Kueste fehlt "b". */
  const ausgabe = { ...karte, ringTeiler: TEILER, provinces: neueProvinzen };
  writeFileSync(datei, JSON.stringify(ausgabe), 'utf8');

  const kb = (Buffer.byteLength(JSON.stringify(ausgabe)) / 1024).toFixed(0);
  console.log(`${name.padEnd(14)} ${zugeordnet.size}/${karte.provinces.length} zugeordnet`
    + ` | Punkte ${punkteGesamt} (${(punkteGesamt / karte.provinces.length).toFixed(0)}/Gebiet)`
    + ` | aus Linien ${ausLinien}/${karte.provinces.length}`
    + ` | ${kb} kB | ${ab.art}, Rest ${ab.rest.toFixed(1)}`
    + (verloren.length ? ` | OHNE GEOMETRIE ${verloren.length}` : ''));
  if (verloren.length) console.log('   ohne Geometrie:', verloren.slice(0, 12).join(' | '));
  if (ohne.length) console.log('   nicht zugeordnet:', ohne.join(' | '));
}

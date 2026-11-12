/**
 * Das Handbuch.
 *
 * Das Spiel hat Haushalt, Forschung, Diplomatie, verdeckte Mittel, Vasallen,
 * Herrscher, Generäle und sieben Truppengattungen. Die bisherige Hilfe fasste
 * das in neun Stichpunkten zusammen - das reichte, um zu ahnen, dass es
 * Regeln gibt, nicht um sie zu kennen.
 *
 * Zwei Festlegungen, die diesem Handbuch zugrunde liegen:
 *
 * **Die Zahlen werden gelesen, nicht abgeschrieben.** Was eine Reiterei
 * kostet, wie viel ein Markt bringt, ab welcher Stufe es Panzer gibt - das
 * steht in src/core/rules.ts, und von dort holt dieses Handbuch es sich.
 * Ein abgeschriebener Wert wäre beim ersten Ausgleich der Wirtschaft falsch,
 * ohne dass es jemandem auffiele. Ein Handbuch, das lügt, ist schlimmer als
 * keines.
 *
 * **Es erklärt, warum, nicht nur was.** Dass Reiterei im Gebirge schwach
 * ist, kann man einer Tabelle entnehmen. Dass man deshalb vor einem Feldzug
 * in die Berge umrüstet, nicht. Die Kapitel sagen jeweils, welche
 * Entscheidung aus der Regel folgt.
 */

import {
  UNITS, UNIT_ORDER, BUILDINGS, BUILDING_ORDER, TECH_FIELDS, TECH_ORDER,
  TERRAIN, GOVERNMENTS, GENERAL_TRAITS, RESOURCES,
  BASIS_AKTIONSPUNKTE, VERWALTUNG_JE_GEBIET, SCHULDZINS, MAX_TECH_LEVEL,
  techCost, buildingCost,
} from '../core/rules';
import { DIPLOMACY_OPTIONS, WAR_GOALS } from '../core/diplomacy';
import { HERRSCHER_EIGENSCHAFTEN } from '../core/herrscher';
import { PLAENE } from '../core/missions';
import { esc } from './dom';

export interface HandbuchKapitel {
  id: string;
  titel: string;
  gruppe: string;
  /** Ein Satz für die Übersicht - was in diesem Kapitel beantwortet wird. */
  frage: string;
  inhalt(): string;
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

const p = (text: string) => `<p>${text}</p>`;
const h = (text: string) => `<h4>${esc(text)}</h4>`;

/** Hervorgehobener Merksatz - das, was man behalten soll. */
const merke = (text: string) => `<div class="hb-merke">${text}</div>`;

/** Tabelle. Kopfzeile als Zeichenketten, Zeilen als bereits fertiges HTML. */
function tabelle(kopf: string[], zeilen: string[][], klasse = ''): string {
  return `<div class="hb-tabelle-rahmen"><table class="hb-tabelle ${klasse}">
    <thead><tr>${kopf.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${zeilen.map((z) => `<tr>${z.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/** Liste aus Begriff und Erklärung. */
function begriffe(eintraege: Array<[string, string]>): string {
  return `<dl class="hb-begriffe">${eintraege
    .map(([b, e]) => `<dt>${esc(b)}</dt><dd>${e}</dd>`).join('')}</dl>`;
}

/* ------------------------------------------------------------------ */
/* Kapitel                                                             */
/* ------------------------------------------------------------------ */

export const KAPITEL: HandbuchKapitel[] = [

  /* ---------------- Grundlagen ---------------- */
  {
    id: 'ueberblick', gruppe: 'Grundlagen', titel: 'Worum es geht',
    frage: 'Was für ein Spiel ist das, und was soll ich darin tun?',
    inhalt: () => h('Ein Land führen, nicht Schlachten gewinnen')
      + p('Du übernimmst ein Land zu einem bestimmten Zeitpunkt der Geschichte - '
        + 'mit den Grenzen, dem Heer und den Nachbarn, die es damals hatte. Von da an '
        + 'ist alles offen.')
      + p('Das Spiel läuft in Runden. In jeder Runde verfügst du über eine Handvoll '
        + 'Handlungen: Truppen ausheben, verlegen, angreifen, bauen, forschen, verhandeln. '
        + 'Dann beenden die anderen Länder ihre Runde, Einnahmen fließen, Ereignisse treten ein, '
        + 'und es geht von vorn los.')
      + h('Was dieses Spiel anders macht')
      + p('<b>Es gibt keine Schlachtanimation.</b> Jeder Kampf ist eine Rechnung, und '
        + 'du siehst sie vorher. Bevor du angreifst, steht da, mit welcher Stärke du '
        + 'rechnest, was das Gelände ausmacht, was die Befestigung kostet und wie die '
        + 'Aussichten stehen. Hinterher kannst du jeden Posten nachlesen.')
      + p('<b>Es gibt keinen verborgenen Zufall im Kampf.</b> Wer verliert, hat sich '
        + 'verrechnet oder zu wenig mitgebracht - nicht Pech gehabt. Zufall steckt in '
        + 'den Ereignissen, nicht in der Schlacht.')
      + merke('Wenn du nicht weiterweißt: Tippe ein eigenes Gebiet an. Alles, was dort '
        + 'möglich ist, steht unten im Blatt.'),
  },
  {
    id: 'runde', gruppe: 'Grundlagen', titel: 'Der Ablauf einer Runde',
    frage: 'Was passiert, wenn ich "Runde beenden" drücke?',
    inhalt: () => h('Deine Runde')
      + p(`Du hast <b>Aktionspunkte</b> - zu Beginn ${BASIS_AKTIONSPUNKTE}, mehr durch `
        + 'Verwaltungsforschung. Jede Aktion kostet einen Punkt:')
      + begriffe([
        ['Ausheben', 'Neue Truppen in einem Gebiet aufstellen.'],
        ['Verlegen', 'Truppen in ein benachbartes eigenes Gebiet bewegen.'],
        ['Angreifen', 'Ein benachbartes feindliches Gebiet angreifen.'],
        ['Bauen', 'Ein Bauwerk beginnen oder ausbauen.'],
      ])
      + p('Nicht alles kostet Punkte: Forschung lenken, Steuern setzen, Panels ansehen '
        + 'und die meisten diplomatischen Schritte laufen über Gold und Einfluss, nicht '
        + 'über Aktionen.')
      + h('Was nach dem Rundenende geschieht')
      + p('In dieser Reihenfolge, und jeder Schritt ist im Chronik-Panel nachlesbar:')
      + tabelle(['Schritt', 'Was passiert'], [
        ['1. Die anderen Länder', 'Jedes handelt nach seiner Art - greift an, baut, verhandelt.'],
        ['2. Einnahmen', 'Steuern und Handel fließen, Unterhalt und Verwaltung gehen ab.'],
        ['3. Bauwerke', 'Was fertig wird, wird wirksam.'],
        ['4. Forschung', 'Punkte sammeln sich an; ist eine Stufe voll, steigt sie.'],
        ['5. Belagerungen', 'Laufende Belagerungen rücken voran oder fallen.'],
        ['6. Unruhe und Stabilität', 'Gebiete beruhigen sich oder gären weiter.'],
        ['7. Herrscher', 'Der Herrscher altert; manchmal stirbt er.'],
        ['8. Ereignisse', 'Ein Ereignis kann eintreten und verlangt eine Entscheidung.'],
        ['9. Ziele', 'Erfüllte Ziele werden belohnt, neue rücken nach.'],
      ])
      + merke('Beende die Runde nicht, solange du noch Aktionspunkte hast und etwas '
        + 'Sinnvolles damit anfangen kannst. Sie verfallen.'),
  },
  {
    id: 'karte', gruppe: 'Grundlagen', titel: 'Die Karte lesen',
    frage: 'Was bedeuten die Linien, Farben, Muster und Zahlen?',
    inhalt: () => h('Grenzen')
      + begriffe([
        ['Goldene Umrandung', 'Dein Reich. Alles darin gehört dir.'],
        ['Weiße Linie', 'Staatsgrenze zwischen zwei Ländern.'],
        ['Dünne Linie', 'Innere Grenze zwischen Gebieten desselben Landes.'],
        ['Heller Saum an der Küste', 'Nur Zierde - er trennt Land von Meer.'],
      ])
      + h('Farben und Muster')
      + p('Die Farbe eines Gebiets ist die Farbe seines Besitzers. Darüber liegen '
        + 'Muster, die dein Verhältnis zu diesem Besitzer anzeigen:')
      + begriffe([
        ['Schrägstreifen', 'Ihr seid im Krieg.'],
        ['Punkte', 'Ihr seid verbündet.'],
        ['Gitter', 'Dieses Land ist dein Vasall.'],
        ['Kreuzschraffur', 'Das Gebiet wird gerade belagert.'],
      ])
      + h('Zahlen auf der Karte')
      + p('Der kleine dunkle Kreis mit einer Zahl ist die Truppenstärke in diesem Gebiet. '
        + 'Bei kleinen Gebieten erscheint sie erst, wenn du hineinzoomst - sonst würde die '
        + 'Karte zur Zahlentapete. Ein Stern markiert die Hauptstadt.')
      + h('Ansichten')
      + p('Unten am Rand kannst du umschalten, was die Karte einfärbt: Politisch '
        + '(wer besitzt was), Diplomatie, Bündnisse, Militär, Wirtschaft, Bevölkerung, '
        + 'Unruhe, Versorgung, Rohstoffe, Gelände. Die Geländeansicht vor einem Feldzug '
        + 'anzusehen, lohnt sich fast immer.')
      + merke('Zwei Finger zoomen, ein Finger verschiebt. Mit dem Haus-Knopf springst du '
        + 'zurück auf dein Reich.'),
  },
  {
    id: 'bedienung', gruppe: 'Grundlagen', titel: 'Bedienung',
    frage: 'Welche Gesten, Tasten und Speicherwege gibt es?',
    inhalt: () => h('Am Telefon')
      + begriffe([
        ['Tippen', 'Gebiet wählen. Das Blatt unten zeigt seine Werte und Aktionen.'],
        ['Zwei Finger', 'Zoomen.'],
        ['Ziehen', 'Karte verschieben.'],
        ['Leiste unten', 'Zwischen Ziele, Diplomatie, Militär, Wirtschaft, Forschung und Innerem wechseln.'],
      ])
      + h('Am Rechner')
      + tabelle(['Taste', 'Wirkung'], [
        ['<kbd>Esc</kbd>', 'Fenster schließen, Auswahl aufheben, Modus abbrechen'],
        ['<kbd>Leertaste</kbd>', 'Runde beenden'],
        ['Mausrad', 'Zoomen'],
        ['Ziehen', 'Karte verschieben'],
      ])
      + h('Speichern')
      + p('Das Spiel sichert nach jeder Runde von selbst. Daneben gibt es drei '
        + 'Speicherplätze unter "Mehr". Dort kannst du einen Spielstand auch als Text '
        + 'in die Zwischenablage legen oder als Datei herunterladen - und auf einem '
        + 'anderen Gerät wieder einlesen.')
      + merke('Alles bleibt auf deinem Gerät. Es gibt keinen Server, kein Konto und '
        + 'keine Übertragung.'),
  },

  /* ---------------- Land und Wirtschaft ---------------- */
  {
    id: 'gebiete', gruppe: 'Land und Wirtschaft', titel: 'Gebiete und Gelände',
    frage: 'Was unterscheidet ein Gebiet vom anderen?',
    inhalt: () => h('Was ein Gebiet ausmacht')
      + begriffe([
        ['Bevölkerung', 'Grundlage für Steuern und für die Zahl der Soldaten, die du ausheben kannst.'],
        ['Wirtschaftsleistung', 'Was es an Gold einbringt. Steigt durch Markt und Straßen.'],
        ['Gelände', 'Verändert Kampfkraft, Wirtschaft und Versorgung - siehe unten.'],
        ['Befestigung', 'Wie schwer es zu nehmen ist.'],
        ['Unruhe', 'Wie zufrieden die Bevölkerung mit dir ist.'],
        ['Rohstoff', 'Manche Gebiete haben einen - er wirkt auf Wirtschaft oder Heer.'],
      ])
      + h('Geländearten')
      + tabelle(['Gelände', 'Wirtschaft', 'Verteidigung', 'Bewegung'],
        Object.values(TERRAIN).map((t: any) => [
          esc(t.name),
          `&times;${t.economy?.toFixed(2) ?? '1.00'}`,
          `&times;${t.defense?.toFixed(2) ?? '1.00'}`,
          `&times;${t.movement?.toFixed(2) ?? '1.00'}`,
        ]))
      + h('Rohstoffe')
      + begriffe(Object.values(RESOURCES).map((r: any) =>
        [`${r.zeichen} ${r.name}`, esc(r.wirkung)] as [string, string]))
      + merke('Ein Bergland bringt wenig Gold und ist schwer zu nehmen. Eine Ebene ist '
        + 'reich und offen. Danach richtet sich, wo du angreifst und wo du baust.'),
  },
  {
    id: 'wirtschaft', gruppe: 'Land und Wirtschaft', titel: 'Einnahmen und Ausgaben',
    frage: 'Woher kommt mein Gold, und wohin geht es?',
    inhalt: () => h('Einnahmen')
      + begriffe([
        ['Steuern', 'Aus Bevölkerung und Wirtschaftsleistung aller Gebiete. Der Steuersatz ist einstellbar.'],
        ['Handel', 'Aus Häfen, Straßen und Handelsabkommen mit anderen Ländern.'],
        ['Tribut', 'Von Vasallen und aus erzwungenen Zahlungen.'],
      ])
      + h('Ausgaben')
      + begriffe([
        ['Heeresunterhalt', 'Jede Einheit kostet jede Runde. Reiterei und Panzer kosten ein Vielfaches des Fußvolks.'],
        ['Verwaltung', `Etwa ${VERWALTUNG_JE_GEBIET} Gold je Gebiet, und der Satz steigt, `
          + 'je größer das Reich wird. Verwaltungsforschung senkt ihn.'],
        ['Bauunterhalt', 'Jedes Bauwerk kostet laufend.'],
        ['Zinsen', `Wer ins Minus gerät, zahlt ${Math.round(SCHULDZINS * 100)} % Zinsen je Runde.`],
      ])
      + h('Warum Ausdehnung teuer ist')
      + p('Das ist die wichtigste Zahl des Spiels: <b>Die Verwaltungskosten wachsen '
        + 'schneller als die Einnahmen.</b> Ein Reich, das doppelt so groß ist, bringt '
        + 'nicht doppelt so viel ein - es kostet mehr als doppelt so viel. Wer immer '
        + 'weiter erobert, ohne Verwaltung zu erforschen und Märkte zu bauen, geht '
        + 'an seinen eigenen Eroberungen zugrunde.')
      + merke('Die Bilanz oben im Kopf ist die Zahl, die du im Auge behalten musst. '
        + 'Fällt sie dauerhaft ins Minus, hast du ein paar Runden, bis es wehtut.')
      + h('Steuersatz')
      + p('Unter "Inneres" stellst du ihn ein. Hohe Steuern bringen Gold und treiben '
        + 'die Unruhe hoch, niedrige beruhigen und kosten. Nach einer Eroberung lohnt '
        + 'es sich oft, die Steuern eine Weile zu senken.'),
  },
  {
    id: 'bauwerke', gruppe: 'Land und Wirtschaft', titel: 'Bauwerke',
    frage: 'Was kann ich bauen, was kostet es, und was bringt es?',
    inhalt: () => h('Die sieben Bauwerke')
      + p('Gebaut wird je Gebiet. Die Kosten steigen mit jeder Stufe, und reichere '
        + 'Gebiete bauen teurer als arme.')
      + tabelle(['Bauwerk', 'Stufen', 'Erste Stufe', 'Dauer', 'Unterhalt', 'Wirkung'],
        BUILDING_ORDER.map((id) => {
          const b = BUILDINGS[id];
          return [
            `<b>${esc(b.name)}</b>`,
            String(b.maxLevel),
            `${Math.round(buildingCost(id, 0))} G`,
            `${b.buildTurns} Runden`,
            `${b.upkeep} G`,
            esc(b.beschreibung) + (b.needsPort ? ' <i>(nur an der Küste)</i>' : ''),
          ];
        }))
      + h('Was zuerst?')
      + p('<b>Markt und Straßen</b> zahlen sich über die Zeit aus und sind in reichen '
        + 'Gebieten am wirksamsten. <b>Festungen</b> gehören an die Grenze, nicht ins '
        + 'Hinterland. Eine <b>Akademie</b> lohnt erst, wenn der Haushalt sie trägt - '
        + 'sie bringt nichts Unmittelbares. Ein <b>Speicher</b> in unruhigem Land ist '
        + 'oft billiger als eine Festung.')
      + merke('Baue zuerst dort, wo die Wirtschaftsleistung schon hoch ist. Zwölf '
        + 'Prozent von viel sind mehr als zwölf Prozent von wenig.'),
  },
  {
    id: 'forschung', gruppe: 'Land und Wirtschaft', titel: 'Forschung',
    frage: 'Welche Forschungsgebiete gibt es und was bringen sie?',
    inhalt: () => h('Fünf Gebiete, je acht Stufen')
      + p('Forschungspunkte sammeln sich jede Runde an - aus Wirtschaftsleistung und '
        + 'Akademien. Du legst fest, in welches Gebiet sie fließen.')
      + tabelle(['Gebiet', 'Wirkung'],
        TECH_ORDER.map((id) => [`<b>${esc(TECH_FIELDS[id].name)}</b>`,
          esc(TECH_FIELDS[id].beschreibung)]))
      + h('Was die Stufen kosten')
      + tabelle(['Stufe', 'Kosten'],
        Array.from({ length: Math.min(MAX_TECH_LEVEL, 8) }, (_, i) =>
          [String(i + 1), `${techCost(i)} Punkte`]))
      + h('Die Stufen im Kriegswesen')
      + p('Neue Truppengattungen hängen allein an dieser Leiste:')
      + tabelle(['Stufe', 'Name', 'Schaltet frei'],
        TECH_FIELDS.military.stufen.map((s, i) => {
          const neu = UNIT_ORDER.filter((u) => UNITS[u].techLevel === i)
            .map((u) => UNITS[u].name);
          return [String(i), esc(s), neu.length ? `<b>${neu.map(esc).join(', ')}</b>` : '&ndash;'];
        }))
      + merke('Verwaltung ist die unauffälligste und oft wichtigste Leiste: Sie senkt '
        + 'die Kosten des ganzen Reiches und gibt zusätzliche Aktionspunkte.'),
  },
  {
    id: 'stabilitaet', gruppe: 'Land und Wirtschaft', titel: 'Stabilität und Unruhe',
    frage: 'Warum fällt Land von mir ab?',
    inhalt: () => h('Zwei verschiedene Dinge')
      + begriffe([
        ['Stabilität', 'Ein Wert für das ganze Land. Hoch bedeutet: Der Staat funktioniert. '
          + 'Niedrig bedeutet Aufstände, Einnahmeverluste und schlechtere Diplomatie.'],
        ['Unruhe', 'Ein Wert je Gebiet. Hoch bedeutet: Dieses Gebiet will nicht zu dir gehören.'],
      ])
      + h('Was Unruhe treibt')
      + p('Frisch erobertes Land ist immer unruhig - das legt sich mit der Zeit. Dazu '
        + 'kommen hohe Steuern, fremde Kultur, Krieg, schlechte Versorgung und fremde '
        + 'Agenten, die gezielt aufwiegeln.')
      + merke('Ab etwa 55 Prozent Unruhe kann ein Gebiet abfallen. Dann gehört es dir '
        + 'nicht mehr, und du musst es zurückerobern.')
      + h('Was hilft')
      + begriffe([
        ['Zeit', 'Der stärkste Hebel. Unruhe sinkt von allein, wenn nichts Neues dazukommt.'],
        ['Niedrige Steuern', 'Wirkt schnell und kostet Gold.'],
        ['Speicher und Verwaltung', 'Wirken dauerhaft.'],
        ['Truppen im Gebiet', 'Hält nieder, löst aber nichts.'],
        ['Ein gerechter Herrscher', 'Senkt die Unruhe im ganzen Reich schneller.'],
      ])
      + p('<b>Der häufigste Anfängerfehler:</b> Weitererobern, während im Rücken drei '
        + 'Gebiete gären. Nach einem Feldzug ein, zwei Runden nichts tun ist oft der '
        + 'schnellste Weg nach vorn.'),
  },

  /* ---------------- Heer und Krieg ---------------- */
  {
    id: 'heer', gruppe: 'Heer und Krieg', titel: 'Truppengattungen',
    frage: 'Welche Einheiten gibt es und wofür taugen sie?',
    inhalt: () => h('Die sieben Gattungen')
      + p('Angriff und Abwehr sind Faktoren: 1,0 ist der Normalwert. Die Kosten sind '
        + 'einmalig, der Unterhalt fällt jede Runde an.')
      + tabelle(['Gattung', 'Angriff', 'Abwehr', 'Kosten', 'Unterhalt', 'Ab Stufe', 'Belagerung'],
        UNIT_ORDER.map((id) => {
          const u = UNITS[id];
          return [
            `<b>${esc(u.name)}</b>`,
            u.attack.toFixed(2), u.defense.toFixed(2),
            `${u.gold} G`, `${u.upkeep.toFixed(1)} G`,
            String(u.techLevel), u.siegePower.toFixed(1),
          ];
        }))
      + h('Wofür man sie nimmt')
      + begriffe(UNIT_ORDER.map((id) =>
        [UNITS[id].name, esc(UNITS[id].beschreibung)] as [string, string]))
      + h('Gelände entscheidet mit')
      + p('Jede Gattung wirkt in manchem Gelände besser, in anderem schlechter. Das '
        + 'sind keine Feinheiten - Reiterei verliert im Gebirge mehr als die Hälfte '
        + 'ihrer Kraft:')
      + tabelle(['Gattung', 'Stark in', 'Schwach in'],
        UNIT_ORDER.map((id) => {
          const tb = UNITS[id].terrainBonus ?? {};
          const nm = (k: string) => (TERRAIN as any)[k]?.name ?? k;
          const stark = Object.entries(tb).filter(([, v]) => (v as number) > 1.05)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([k, v]) => `${nm(k)} &times;${(v as number).toFixed(2)}`);
          const schwach = Object.entries(tb).filter(([, v]) => (v as number) < 0.95)
            .sort((a, b) => (a[1] as number) - (b[1] as number))
            .map(([k, v]) => `${nm(k)} &times;${(v as number).toFixed(2)}`);
          return [`<b>${esc(UNITS[id].name)}</b>`,
            stark.length ? stark.join(', ') : '&ndash;',
            schwach.length ? schwach.join(', ') : '&ndash;'];
        }))
      + merke('Eine gemischte Aufstellung schlägt fast immer eine einseitige. Reine '
        + 'Reiterei ist in der Ebene überwältigend und vor einer Bergfestung wertlos.'),
  },
  {
    id: 'kampf', gruppe: 'Heer und Krieg', titel: 'Wie ein Kampf gerechnet wird',
    frage: 'Woraus setzt sich das Ergebnis zusammen?',
    inhalt: () => h('Die Rechnung steht vorher da')
      + p('Wenn du einen Angriff anmeldest, zeigt dir das Spiel die vollständige '
        + 'Aufstellung beider Seiten, bevor du bestätigst. Nichts davon ist verborgen, '
        + 'und nichts wird ausgewürfelt.')
      + h('Die Faktoren, der Reihe nach')
      + tabelle(['Faktor', 'Was er tut'], [
        ['Truppenstärke', 'Zahl der Einheiten je Gattung, mit ihren Angriffs- und Abwehrwerten.'],
        ['Gelände', 'Der Geländefaktor der jeweiligen Gattung im Zielgebiet.'],
        ['Verteidigungsvorteil', 'Das Gelände des Verteidigers wirkt zusätzlich auf dessen Abwehr.'],
        ['Befestigung', 'Erhöht die Abwehr erheblich. Ohne Belagerungsgerät kaum zu überwinden.'],
        ['Forschung', 'Kriegswesen beim Angreifer, Befestigung beim Verteidiger.'],
        ['General', 'Ein General auf einer Seite verschiebt das Ergebnis spürbar.'],
        ['Versorgung', 'Schlecht versorgte Truppen kämpfen deutlich schwächer.'],
        ['Herrscher', 'Ein Eroberer greift besser an, ein Vorsichtiger verteidigt besser.'],
      ])
      + h('Nach der Schlacht')
      + p('Beide Seiten verlieren Einheiten - der Verlierer mehr. Gewinnt der Angreifer '
        + 'und war das Gebiet nicht befestigt, nimmt er es sofort. War es befestigt, '
        + 'beginnt eine Belagerung. Der vollständige Bericht mit allen Posten liegt '
        + 'danach in der Chronik.')
      + merke('Wenn die Vorschau knapp aussieht, ist sie es. Hol eine Einheit mehr, '
        + 'warte eine Runde auf Verstärkung oder greife woanders an.'),
  },
  {
    id: 'belagerung', gruppe: 'Heer und Krieg', titel: 'Befestigung und Belagerung',
    frage: 'Wie nehme ich eine Festung?',
    inhalt: () => h('Befestigungsstufen')
      + p('Jedes Gebiet hat eine Befestigungsstufe - aus dem Gelände, aus gebauten '
        + 'Festungen und aus der Befestigungsforschung. Je höher sie ist, desto mehr '
        + 'zählt die Abwehr des Verteidigers.')
      + h('Wann eine Belagerung beginnt')
      + p('Gewinnst du den Kampf um ein befestigtes Gebiet, fällt es nicht sofort. '
        + 'Stattdessen beginnt eine Belagerung, die über mehrere Runden läuft. Wie '
        + 'schnell sie vorankommt, hängt an der <b>Belagerungskraft</b> deiner Truppen - '
        + 'der letzten Spalte in der Truppentabelle.')
      + tabelle(['Gattung', 'Belagerungskraft'],
        UNIT_ORDER.filter((id) => UNITS[id].siegePower >= 1.4)
          .sort((a, b) => UNITS[b].siegePower - UNITS[a].siegePower)
          .map((id) => [`<b>${esc(UNITS[id].name)}</b>`, UNITS[id].siegePower.toFixed(1)]))
      + p('Fußvolk allein belagert mit Faktor 1,0 - das dauert sehr lange. '
        + 'Belagerungsgerät und Artillerie sind drei- bis viermal so schnell.')
      + h('Was eine Belagerung bricht')
      + p('Der Verteidiger kann die Belagerung aufheben, indem er sie von außen '
        + 'angreift. Verlierst du dabei, war die ganze Zeit umsonst. Decke eine '
        + 'Belagerung deshalb ab, wenn feindliche Verbände in der Nähe stehen.')
      + merke('Nimm Belagerungsgerät mit, bevor du losziehst. Es nachträglich '
        + 'heranzuführen kostet Runden, in denen dein Heer vor der Mauer verhungert.'),
  },
  {
    id: 'generaele', gruppe: 'Heer und Krieg', titel: 'Generäle',
    frage: 'Was bringt ein General und wo setze ich ihn ein?',
    inhalt: () => h('Was sie tun')
      + p('Ein General steht in einem Gebiet und wirkt auf jeden Kampf, der dort '
        + 'ausgetragen wird - im Angriff wie in der Abwehr. Mit jeder Schlacht sammelt '
        + 'er Erfahrung und wird besser.')
      + h('Eigenschaften')
      + tabelle(['Eigenschaft', 'Wirkung'],
        Object.values(GENERAL_TRAITS).map((t: any) =>
          [`<b>${esc(t.name)}</b>`, esc(t.beschreibung ?? t.hint ?? '')]))
      + merke('Ein General gehört dorthin, wo die Entscheidung fällt - nicht in die '
        + 'ruhige Provinz. Er ist der einzige Vorteil, der sich im Spielverlauf von '
        + 'allein vergrößert.'),
  },
  {
    id: 'versorgung', gruppe: 'Heer und Krieg', titel: 'Versorgung',
    frage: 'Warum kämpfen meine Truppen plötzlich schlechter?',
    inhalt: () => h('Jedes Gebiet hängt an der Hauptstadt')
      + p('Versorgung fließt von der Hauptstadt über zusammenhängendes eigenes Gebiet. '
        + 'Was abgeschnitten wird - weil ein Gebiet dazwischen verlorengeht -, verliert '
        + 'Versorgung, und die Truppen dort werden schwach.')
      + h('Was die Versorgung verbessert')
      + begriffe([
        ['Straßen', 'Tragen Versorgung weiter ins Land.'],
        ['Logistikforschung', 'Erhöht die Reichweite insgesamt.'],
        ['Speicher', 'Hält die Versorgung im Gebiet oben.'],
        ['Geschlossenes Gebiet', 'Der wirksamste Hebel überhaupt.'],
      ])
      + merke('Ein langer dünner Vorstoß ins feindliche Land sieht auf der Karte gut '
        + 'aus und ist militärisch meist ein Fehler: Die Spitze steht ohne Versorgung '
        + 'da und ist mit einem Gegenstoß abgeschnitten.')
      + p('Schalte vor einem Feldzug einmal auf die Versorgungsansicht um. Sie zeigt '
        + 'dir sofort, wie weit dein Arm reicht.'),
  },

  /* ---------------- Politik ---------------- */
  {
    id: 'diplomatie', gruppe: 'Politik', titel: 'Diplomatie und Einfluss',
    frage: 'Was kann ich mit anderen Ländern aushandeln?',
    inhalt: () => h('Einfluss ist die Währung')
      + p('Fast jeder diplomatische Schritt kostet <b>Einfluss</b>, manche zusätzlich '
        + 'Gold. Einfluss wächst jede Runde nach - aus Stabilität, Verwaltung und der '
        + 'Begabung deines Herrschers. Er ist knapp, und das ist Absicht: Du kannst '
        + 'nicht mit allen gleichzeitig verhandeln.')
      + h('Das Verhältnis')
      + p('Zu jedem Land steht ein Wert zwischen -100 und +100. Er entscheidet, ob ein '
        + 'Angebot angenommen wird. Er verändert sich durch deine Schritte, durch '
        + 'gemeinsame Gegner, durch Grenzreibungen und durch das, was du anderen antust - '
        + 'wer ein Land überfällt, sinkt bei allen.')
      + h('Alle Schritte im Überblick')
      + tabelle(['Schritt', 'Einfluss', 'Gold', 'Wirkung'],
        DIPLOMACY_OPTIONS.filter((o) => o.gruppe !== 'verdeckt').map((o) => [
          `<b>${esc(o.label)}</b>`,
          String(o.politicalPower), o.gold ? String(o.gold) : '&ndash;',
          esc(o.hint),
        ]))
      + merke('Ohne Kriegserklärung gibt es keinen Angriff. Wer schnell erobern will, '
        + 'muss den Krieg erklären - und zahlt dafür mit dem Ansehen bei allen anderen.'),
  },
  {
    id: 'buendnisse', gruppe: 'Politik', titel: 'Bündnisse und Vasallen',
    frage: 'Was bringt ein Verbündeter, und was ein Vasall?',
    inhalt: () => h('Bündnisse')
      + p('Ein Bündnis verpflichtet beide Seiten zum Beistand. Wird dein Partner '
        + 'angegriffen, kannst du in den Krieg gerufen werden - und umgekehrt. Das ist '
        + 'eine ernste Bindung: Ein Bündnis mit einem streitsüchtigen Nachbarn zieht '
        + 'dich in dessen Kriege.')
      + p('Das <b>Verteidigungsbündnis</b> ist die schwächere Form: Beistand nur, wenn '
        + 'einer angegriffen wird, nicht wenn er selbst angreift. Für die meisten Lagen '
        + 'die klügere Wahl.')
      + h('Vasallen')
      + p('Ein Vasall bleibt ein eigenes Land, folgt dir aber außenpolitisch und zahlt '
        + 'Tribut. Du bekommst seine Stärke, ohne seine Verwaltungskosten zu tragen - '
        + 'das ist der entscheidende Unterschied zur Eroberung.')
      + merke('Für ein großes Reich ist ein Vasall oft wertvoller als annektiertes Land: '
        + 'Er zahlt, zählt militärisch mit und treibt deine Verwaltungskosten nicht hoch.')
      + h('Unabhängigkeitsgarantie')
      + p('Du erklärst, dass ein Angriff auf ein drittes Land dich auf den Plan ruft. '
        + 'Ein wirksames Mittel, um einen schwachen Pufferstaat vor einem starken '
        + 'Nachbarn zu bewahren - ohne eigenes Zutun, solange die Drohung glaubhaft ist.'),
  },
  {
    id: 'verdeckt', gruppe: 'Politik', titel: 'Verdeckte Mittel',
    frage: 'Was kann ich tun, ohne Krieg zu erklären?',
    inhalt: () => h('Erst wissen, dann handeln')
      + p('Verdeckte Schritte setzen <b>Spionagewissen</b> über das Zielland voraus. '
        + 'Das bekommst du, indem du Spione entsendest; es verfällt mit der Zeit wieder, '
        + 'wenn du nicht nachlegst.')
      + tabelle(['Mittel', 'Nötiges Wissen', 'Einfluss', 'Gold', 'Wirkung'],
        DIPLOMACY_OPTIONS.filter((o) => o.gruppe === 'verdeckt').map((o) => [
          `<b>${esc(o.label)}</b>`,
          o.wissen ? `${o.wissen} %` : '&ndash;',
          String(o.politicalPower), o.gold ? String(o.gold) : '&ndash;',
          esc(o.hint),
        ]))
      + h('Das Risiko')
      + p('Jeder verdeckte Schritt kann auffliegen. Wer erwischt wird, verliert '
        + 'Ansehen - und zwar nicht nur beim Ziel, sondern bei allen Ländern. Eine '
        + 'aufgedeckte Sabotage kann ein Bündnisgefüge zum Einsturz bringen.')
      + merke('Verdeckte Mittel sind für die Lage gedacht, in der ein Krieg zu teuer '
        + 'wäre: einen überlegenen Gegner zermürben, bevor man ihn angeht.'),
  },
  {
    id: 'herrscher', gruppe: 'Politik', titel: 'Herrscher',
    frage: 'Was ändert sich, wenn mein Herrscher stirbt?',
    inhalt: () => h('Jedes Land hat einen')
      + p('Dein Herrscher hat ein Alter, Begabungen und ein bis zwei Eigenschaften. '
        + 'Sie wirken auf das ganze Reich - auf Wirtschaft, Krieg, Diplomatie und '
        + 'Baukosten.')
      + h('Die Eigenschaften')
      + tabelle(['Eigenschaft', 'Wirkung'],
        Object.values(HERRSCHER_EIGENSCHAFTEN).map((e) =>
          [`<b>${esc(e.name)}</b>`, esc(e.beschreibung)]))
      + h('Thronwechsel')
      + p('Herrscher altern und sterben. Der Nachfolger hat andere Eigenschaften - '
        + 'manchmal bessere, manchmal schlechtere. Ein Thronwechsel ist ein Einschnitt: '
        + 'Ein Reich, das unter einem Eroberer aufgebaut wurde, kann unter einem '
        + 'Kränklichen schnell ins Rutschen kommen.')
      + merke('Sieh beim Spielstart unter "Inneres" nach, was dein Herrscher kann. '
        + 'Ein Baumeister legt eine andere Eröffnung nahe als ein Eroberer.'),
  },
  {
    id: 'regierung', gruppe: 'Politik', titel: 'Regierungsformen',
    frage: 'Was macht meine Regierungsform aus?',
    inhalt: () => h('Die Formen')
      + p('Die Regierungsform steht beim Szenario fest und ergibt sich aus der '
        + 'Geschichte des Landes. Du kannst sie nicht wechseln - sie ist eine '
        + 'Ausgangslage, mit der du umgehen musst.')
      + tabelle(['Form', 'Stabilität', 'Wirtschaft', 'Militär', 'Diplomatie', 'Aktionen'],
        Object.values(GOVERNMENTS).map((g) => [
          `<b>${esc(g.name)}</b>`,
          `+${g.stabilityPerTurn.toFixed(1)}`,
          `&times;${g.economyMod.toFixed(2)}`,
          `&times;${g.militaryMod.toFixed(2)}`,
          `&times;${g.diplomacyMod.toFixed(2)}`,
          g.actionBonus ? `+${g.actionBonus}` : '&ndash;',
        ]))
      + h('Was das im Spiel bedeutet')
      + begriffe(Object.values(GOVERNMENTS).map((g) =>
        [g.name, esc(g.note)] as [string, string]))
      + merke('Ein Stammesbund kämpft gut und verwaltet schlecht - er muss früh '
        + 'zuschlagen. Eine Demokratie wird mit der Zeit stärker und verträgt keinen '
        + 'langen Krieg. Die Regierungsform legt nahe, wie schnell du spielen solltest.'),
  },

  /* ---------------- Ziel des Spiels ---------------- */
  {
    id: 'ziele', gruppe: 'Ziel des Spiels', titel: 'Ziele',
    frage: 'Was sind diese drei Vorgaben unter "Ziele"?',
    inhalt: () => h('Drei auf einmal')
      + p('Es laufen immer drei Vorgaben gleichzeitig. Jede hat eine Belohnung - Gold, '
        + 'Einfluss, Stabilität oder Forschung. Ist eine erfüllt, fällt die Belohnung '
        + 'sofort an, und eine neue rückt nach.')
      + p('Sie sind kein Zwang. Du musst keine davon erfüllen, und du verlierst nichts, '
        + 'wenn du sie liegen lässt. Sie sind ein Vorschlag, was sich als Nächstes '
        + 'lohnen könnte - besonders am Anfang, wenn man vor der Karte sitzt und nicht '
        + 'weiß, wo man anfangen soll.')
      + h('Die Arten von Vorgaben')
      + tabelle(['Art', 'Worum es geht'],
        PLAENE.map((pl) => [`<b>${esc(pl.name)}</b>`,
          // %z% ist der Platzhalter für die Zielzahl, die erst im Spiel
          // feststeht - sie hängt an deinem Reich zum Zeitpunkt der Vergabe.
          esc(pl.beschreibung.replace('%z%', 'einige'))]))
      + merke('Wenn du nicht weißt, was du tun sollst: Sieh unter "Ziele" nach. Das ist '
        + 'genau wofür sie da sind.'),
  },
  {
    id: 'krieg_frieden', gruppe: 'Ziel des Spiels', titel: 'Krieg und Frieden',
    frage: 'Wie erkläre ich Krieg, und wie komme ich wieder heraus?',
    inhalt: () => h('Kriegsziele')
      + p('Wer Krieg erklärt, legt ein Ziel fest. Es bestimmt, was du im Frieden '
        + 'fordern kannst - und wie teuer die Kriegserklärung an Ansehen ist.')
      + tabelle(['Kriegsziel', 'Bedeutung'],
        WAR_GOALS.map((w) => [`<b>${esc(w.name)}</b>`, esc(w.hint)]))
      + h('Kriegsfortschritt')
      + p('Während des Krieges läuft ein Wert mit, der zeigt, wer vorn liegt. Er steigt '
        + 'durch gewonnene Schlachten und eroberte Gebiete. Was du im Frieden fordern '
        + 'kannst, hängt allein daran: Wer vorn liegt, darf Land verlangen; wer hinten '
        + 'liegt, muss froh sein, mit leeren Händen davonzukommen.')
      + h('Kriegsmüdigkeit')
      + p('Ein langer Krieg zehrt: Die Stabilität sinkt, die Unruhe steigt, und '
        + 'irgendwann kostet der Krieg mehr, als der Gewinn wert ist. Das trifft auch '
        + 'den, der gewinnt.')
      + merke('Schließe Frieden, solange du vorn liegst. Der häufigste Weg, ein '
        + 'gewonnenes Spiel zu verlieren, ist ein Krieg, den man zu lange führt.'),
  },
  {
    id: 'ereignisse', gruppe: 'Ziel des Spiels', titel: 'Ereignisse',
    frage: 'Woher kommen diese Fenster mit Entscheidungen?',
    inhalt: () => h('Was sie sind')
      + p('Zwischen den Runden tritt gelegentlich ein Ereignis ein - eine Missernte, '
        + 'ein Thronstreit, ein Angebot von Söldnern, ein wissenschaftlicher Durchbruch. '
        + 'Die meisten sind an Zeit und Lage gebunden: Eine Kontinentalsperre gibt es '
        + 'nur bei Napoleon, eine Reformation nur in der Frühen Neuzeit.')
      + h('Die Entscheidung')
      + p('Du hast meist zwei oder drei Möglichkeiten, und keine ist umsonst. Die '
        + 'Wirkungen stehen jeweils dabei - du entscheidest mit offenen Karten, nicht '
        + 'auf gut Glück.')
      + merke('Ereignisse sind der einzige echte Zufall im Spiel. Der Kampf ist es '
        + 'nicht.'),
  },
  {
    id: 'sieg', gruppe: 'Ziel des Spiels', titel: 'Sieg und Niederlage',
    frage: 'Wann ist das Spiel vorbei?',
    inhalt: () => h('Siegbedingungen')
      + p('Jedes Szenario nennt zwei Bedingungen - eine über die Zahl der Gebiete, eine '
        + 'über fremde Hauptstädte. Sie stehen im Ziele-Panel unten. Erfüllst du eine '
        + 'davon, hast du gewonnen.')
      + h('Niederlage')
      + p('Du verlierst, wenn du dein letztes Gebiet verlierst. Solange dir eines '
        + 'bleibt, bist du im Spiel.')
      + h('Das Endjahr')
      + p('Jedes Szenario hat ein Endjahr. Ist es erreicht, ohne dass jemand gesiegt '
        + 'hat, endet die Partie, und es zählt die Machtkennzahl.')
      + h('Am Ende')
      + p('Du bekommst eine Übersicht mit dem Verlauf deines Reiches, die sich teilen '
        + 'lässt - einschließlich der Angabe, welches Szenario und welche Ausgangslage '
        + 'es war. Wer die gleiche Zahl eingibt, bekommt dieselbe Startaufstellung und '
        + 'kann es besser machen.'),
  },
];

export const HANDBUCH_GRUPPEN = [...new Set(KAPITEL.map((k) => k.gruppe))];

/* ------------------------------------------------------------------ */
/* Darstellung                                                         */
/* ------------------------------------------------------------------ */

export function handbuchKapitel(id: string): HandbuchKapitel {
  return KAPITEL.find((k) => k.id === id) ?? KAPITEL[0];
}

/**
 * Baut das Handbuch.
 *
 * Links die Kapitelliste nach Gruppen, rechts der Inhalt. Am Telefon
 * rutscht die Liste über den Inhalt - deshalb steht dort zuerst ein
 * Zurück-Knopf zur Übersicht statt einer dauerhaft sichtbaren Liste.
 */
export function handbuchModal(aktivId: string, uebersicht = false): string {
  const aktiv = handbuchKapitel(aktivId);

  const liste = HANDBUCH_GRUPPEN.map((g) => `
    <div class="hb-gruppe">
      <div class="hb-gruppe-titel">${esc(g)}</div>
      ${KAPITEL.filter((k) => k.gruppe === g).map((k) => `
        <button class="hb-eintrag${k.id === aktiv.id ? ' aktiv' : ''}"
            data-handbuch-kapitel="${esc(k.id)}">
          <span class="hb-eintrag-titel">${esc(k.titel)}</span>
          <span class="hb-eintrag-frage">${esc(k.frage)}</span>
        </button>`).join('')}
    </div>`).join('');

  const nr = KAPITEL.indexOf(aktiv);
  const vor = KAPITEL[nr - 1];
  const zurueck = KAPITEL[nr + 1];

  return `
    <div class="modal handbuch${uebersicht ? ' zeigt-liste' : ''}">
      <div class="hb-kopf">
        <div>
          <div class="block-titel">Handbuch</div>
          <h2>${esc(aktiv.titel)}</h2>
        </div>
        <button class="ghost small" data-modal-schliessen>Schließen</button>
      </div>
      <div class="hb-koerper">
        <nav class="hb-liste">${liste}</nav>
        <div class="hb-inhalt">
          <button class="ghost small hb-zur-liste" data-handbuch-liste>&larr; Alle Kapitel</button>
          <p class="hb-frage">${esc(aktiv.frage)}</p>
          ${aktiv.inhalt()}
          <div class="hb-blaettern">
            ${vor ? `<button class="ghost small" data-handbuch-kapitel="${esc(vor.id)}">&larr; ${esc(vor.titel)}</button>` : '<span></span>'}
            ${zurueck ? `<button class="ghost small" data-handbuch-kapitel="${esc(zurueck.id)}">${esc(zurueck.titel)} &rarr;</button>` : '<span></span>'}
          </div>
        </div>
      </div>
    </div>`;
}

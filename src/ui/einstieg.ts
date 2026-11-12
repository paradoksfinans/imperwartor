/**
 * Geführter Einstieg.
 *
 * Das Spiel hat Haushalt, Forschung, Diplomatie, verdeckte Mittel, Vasallen
 * und sieben Truppengattungen. Wer es zum ersten Mal öffnet, sieht vor allem
 * eine bunte Karte und weiss nicht, wo er anfangen soll - und legt es wieder
 * weg. Dieser Einstieg führt durch genau eine Runde: Gebiet wählen, Truppen
 * ausheben, angreifen, Runde beenden. Danach kennt man die Schleife, in der
 * alles Weitere steckt.
 *
 * Er reagiert auf echte Handlungen statt nur auf "Weiter"-Klicks: Wer die
 * verlangte Sache tut, kommt voran. Das prägt sich besser ein als ein
 * Textfenster, das man wegklickt.
 */

const SPEICHER_SCHLUESSEL = 'imperwartor:einstieg-erledigt';

export type EinstiegEreignis =
  | 'gebiet-gewaehlt'
  | 'eigenes-gebiet-gewaehlt'
  | 'rekrutiert'
  | 'angriff-gestartet'
  | 'bewegt'
  | 'runde-beendet'
  | 'ausbau'
  /* Eine Meldung je Tafel: Die Kennung der Tafel ist die des Schritts,
     damit nicht für jede neue Tafel eine eigene Abfrage nötig wird. */
  | `panel-${string}`;

export interface EinstiegSchritt {
  id: string;
  titel: string;
  text: string;
  /** Wodurch der Schritt von selbst weitergeht. */
  durch?: EinstiegEreignis;
  /** Beschriftung des Knopfes, wenn man auch ohne Handlung weiterkommt. */
  weiter?: string;
}

const SCHRITTE: EinstiegSchritt[] = [
  {
    id: 'willkommen',
    titel: 'Dein Reich',
    text: 'Die golden umrandeten Gebiete gehören dir. Weiße Linien trennen '
      + 'fremde Staaten, dünne Linien deren innere Gebiete. Zwei Finger '
      + 'zoomen, ein Finger verschiebt.',
    weiter: 'Verstanden',
  },
  {
    id: 'karte',
    titel: 'Was die Karte dir sagt',
    text: 'Die Farbe eines Gebiets ist die seines Besitzers. Schrägstreifen '
      + 'bedeuten Krieg, Punkte ein Bündnis, ein Gitter einen Vasallen. Der '
      + 'dunkle Kreis mit einer Zahl ist die Truppenstärke, der Stern die '
      + 'Hauptstadt.',
    weiter: 'Weiter',
  },
  {
    id: 'gebiet',
    titel: 'Ein Gebiet wählen',
    text: 'Tippe eines deiner Gebiete an - also eines innerhalb der goldenen '
      + 'Umrandung. Unten öffnet sich dann seine Verwaltung.',
    durch: 'eigenes-gebiet-gewaehlt',
  },
  {
    id: 'gebietswerte',
    titel: 'Was dort steht',
    text: 'Bevölkerung und Wirtschaftsleistung bestimmen, was das Gebiet '
      + 'einbringt. Das Gelände entscheidet mit, wer hier gewinnt. Die Unruhe '
      + 'sagt dir, ob die Bevölkerung zu dir hält - über 55 Prozent kann ein '
      + 'Gebiet abfallen.',
    weiter: 'Weiter',
  },
  {
    id: 'rekrutieren',
    titel: 'Truppen ausheben',
    text: 'Jedes Gebiet stellt Soldaten. Wähle unten eine Gattung und hebe '
      + 'Truppen aus. Fußvolk ist billig und hält Gelände, Reiterei ist in '
      + 'der Ebene überlegen und im Gebirge fast wertlos.',
    durch: 'rekrutiert',
    weiter: 'Später',
  },
  {
    id: 'bauen',
    titel: 'Etwas bauen',
    text: 'Im selben Blatt kannst du bauen. Ein Markt hebt die Wirtschafts'
      + 'leistung, Straßen tragen die Versorgung weiter, eine Festung macht '
      + 'das Gebiet schwer zu nehmen. Bauwerke brauchen mehrere Runden.',
    durch: 'ausbau',
    weiter: 'Später',
  },
  {
    id: 'angriff',
    titel: 'Angreifen oder verlegen',
    text: 'Mit "Verlegen" werden erreichbare eigene Gebiete grün '
      + 'hervorgehoben, mit "Angreifen" feindliche rot. Vor jedem Angriff '
      + 'siehst du die vollständige Rechnung - ohne verborgenen Zufall. '
      + 'Ist "Angreifen" grau, führst du noch keinen Krieg: Ohne '
      + 'Kriegserklärung gibt es keinen Angriff.',
    durch: 'angriff-gestartet',
    weiter: 'Später',
  },
  {
    id: 'wirtschaft',
    titel: 'Die Bilanz',
    text: 'Öffne "Wirtschaft". Dort steht, woher dein Gold kommt und wohin es '
      + 'geht. Merke dir eine Zahl: Die Verwaltungskosten wachsen schneller '
      + 'als die Einnahmen. Wer immer weiter erobert, geht an den eigenen '
      + 'Eroberungen zugrunde.',
    durch: 'panel-wirtschaft',
    weiter: 'Später',
  },
  {
    id: 'forschung',
    titel: 'Forschung lenken',
    text: 'Unter "Forschung" legst du fest, wohin deine Punkte fließen. '
      + 'Kriegswesen schaltet neue Truppengattungen frei, Verwaltung senkt '
      + 'die Kosten des ganzen Reiches und gibt dir mehr Aktionen je Runde.',
    durch: 'panel-forschung',
    weiter: 'Später',
  },
  {
    id: 'diplomatie',
    titel: 'Mit den Nachbarn reden',
    text: 'Unter "Diplomatie" verhandelst du. Einfluss ist dabei die Währung, '
      + 'und er ist knapp. Wichtig: Ohne Kriegserklärung gibt es keinen '
      + 'Angriff auf fremdes Land.',
    durch: 'panel-diplomatie',
    weiter: 'Später',
  },
  {
    id: 'ziele',
    titel: 'Wohin die Reise geht',
    text: 'Unter "Ziele" stehen drei Vorgaben mit Belohnung. Sie sind kein '
      + 'Zwang - sie zeigen dir, was sich als Nächstes lohnt, wenn du nicht '
      + 'weißt, wo du anfangen sollst. Öffne sie einmal.',
    durch: 'panel-ziele',
    weiter: 'Später',
  },
  {
    id: 'runde',
    titel: 'Die Runde beenden',
    text: 'Jetzt sind die anderen Länder dran: Einnahmen, Forschung, '
      + 'Angriffe, Ereignisse. Tippe oben rechts auf "Runde beenden".',
    durch: 'runde-beendet',
  },
  {
    id: 'fertig',
    titel: 'Das war die Schleife',
    text: 'Mehr ist es im Kern nicht: wirtschaften, aufbauen, verhandeln, '
      + 'zuschlagen, Runde beenden. Alles Übrige steht im Handbuch - unter '
      + '"Mehr" findest du es, mit einem Kapitel zu jeder Regel. Viel Erfolg.',
    weiter: 'Losspielen',
  },
];

let laufend = false;
let stelle = 0;

/** War der Einstieg schon einmal durch oder wurde er abgebrochen? */
export function einstiegErledigt(): boolean {
  try {
    return window.localStorage.getItem(SPEICHER_SCHLUESSEL) === '1';
  } catch {
    // Ohne Speicher (abgeschotteter Rahmen) lieber einmal zu viel zeigen
    // als den Einstieg ganz zu verschlucken.
    return false;
  }
}

function merkeErledigt(): void {
  try {
    window.localStorage.setItem(SPEICHER_SCHLUESSEL, '1');
  } catch {
    /* kein Speicher - dann eben nur für diese Sitzung */
  }
}

export function einstiegStarten(): void {
  laufend = true;
  stelle = 0;
}

export function einstiegLaeuft(): boolean {
  return laufend;
}

export function einstiegJetzt(): EinstiegSchritt | null {
  return laufend ? SCHRITTE[stelle] ?? null : null;
}

export function einstiegFortschritt(): { schritt: number; gesamt: number } {
  return { schritt: stelle + 1, gesamt: SCHRITTE.length };
}

/** Geht einen Schritt weiter. Gibt true, wenn sich etwas geändert hat. */
export function einstiegWeiter(): boolean {
  if (!laufend) return false;
  stelle++;
  if (stelle >= SCHRITTE.length) {
    laufend = false;
    merkeErledigt();
  }
  return true;
}

export function einstiegAbbrechen(): void {
  laufend = false;
  merkeErledigt();
}

/**
 * Meldet eine Handlung des Spielers.
 * Gibt true zurück, wenn der Einstieg dadurch weitergerückt ist - dann muss
 * die Oberfläche neu gezeichnet werden.
 */
export function einstiegEreignis(e: EinstiegEreignis): boolean {
  const jetzt = einstiegJetzt();
  if (!jetzt?.durch) return false;
  if (jetzt.durch !== e) return false;
  return einstiegWeiter();
}

/** Baut die Einblendung. Leerer Text, wenn gerade nichts zu zeigen ist. */
export function einstiegHtml(obenAnschlagen = false): string {
  const s = einstiegJetzt();
  if (!s) return '';
  const { schritt, gesamt } = einstiegFortschritt();
  const punkte = Array.from({ length: gesamt }, (_, i) =>
    `<span class="einstieg-punkt ${i < schritt ? 'voll' : ''}"></span>`).join('');

  return `
    <div class="einstieg${obenAnschlagen ? ' oben' : ''}" role="dialog" aria-label="Einführung">
      <div class="einstieg-kopf">
        <span class="einstieg-marke">Einführung ${schritt}/${gesamt}</span>
        <button class="ghost small" data-einstieg-aus>Überspringen</button>
      </div>
      <h3>${s.titel}</h3>
      <p>${s.text}</p>
      <div class="einstieg-fuss">
        <div class="einstieg-punkte">${punkte}</div>
        ${s.weiter
    ? `<button class="primaer small" data-einstieg-weiter>${s.weiter}</button>`
    : '<span class="einstieg-warte">Führe den Schritt aus</span>'}
      </div>
    </div>`;
}

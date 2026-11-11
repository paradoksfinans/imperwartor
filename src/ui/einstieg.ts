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
  | 'panel-ziele'
  | 'runde-beendet'
  | 'ausbau';

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
    id: 'gebiet',
    titel: 'Ein Gebiet wählen',
    text: 'Tippe eines deiner Gebiete an - also eines innerhalb der goldenen '
      + 'Umrandung. Unten öffnet sich dann seine Verwaltung.',
    durch: 'eigenes-gebiet-gewaehlt',
  },
  {
    id: 'rekrutieren',
    titel: 'Truppen ausheben',
    text: 'Jedes Gebiet stellt Soldaten. Wähle unten eine Gattung und hebe '
      + 'Truppen aus. Fußvolk ist billig und hält Gelände, Reiterei ist '
      + 'schnell, Artillerie bricht Befestigungen.',
    durch: 'rekrutiert',
    weiter: 'Später',
  },
  {
    id: 'angriff',
    titel: 'Angreifen oder verlegen',
    text: 'Mit "Angreifen" werden erreichbare feindliche Gebiete rot '
      + 'hervorgehoben, mit "Verlegen" eigene grün. Vor jedem Angriff siehst '
      + 'du die Rechnung - ohne Zufall, aber mit allen Faktoren.',
    durch: 'angriff-gestartet',
    weiter: 'Später',
  },
  {
    id: 'ziele',
    titel: 'Wohin die Reise geht',
    text: 'Unter "Ziele" stehen drei Vorgaben mit Belohnung. Sie zeigen dir, '
      + 'was sich als Nächstes lohnt. Öffne sie einmal.',
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
      + 'zuschlagen, Runde beenden. Alles Weitere - Diplomatie, Forschung, '
      + 'Spionage, Vasallen - findest du in der Leiste. Viel Erfolg.',
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

/**
 * Dezente Toene, vollständig im Browser erzeugt.
 *
 * Bewusst ohne Audiodateien: Das Spiel bleibt eine einzige HTML-Datei, und
 * jede eingebettete Klangdatei waere größer als der gesamte uebrige Code.
 * Die Toene sind kurze Huellkurven auf wenigen Sinus- und Dreieckswellen -
 * eher ein Anschlag auf Holz als eine Melodie.
 */

type TonId =
  | 'klick' | 'runde' | 'marsch' | 'bau' | 'fehler'
  | 'krieg' | 'frieden' | 'sieg' | 'sieg-klein' | 'verlust'
  | 'niederlage' | 'start';

let kontext: AudioContext | null = null;
let an = true;

/** Der Tonapparat darf erst nach einer Nutzergeste starten. */
function hol(): AudioContext | null {
  if (!an) return null;
  try {
    if (!kontext) {
      const Ctor = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      kontext = new Ctor();
    }
    if (kontext.state === 'suspended') void kontext.resume();
    return kontext;
  } catch {
    return null;
  }
}

export function setzeTon(wert: boolean): void {
  an = wert;
}

interface Note {
  /** Tonhoehe in Hertz. */
  f: number;
  /** Beginn in Sekunden nach dem Anschlag. */
  t: number;
  /** Dauer in Sekunden. */
  d: number;
  /** Lautstaerke 0 bis 1. */
  v?: number;
  form?: OscillatorType;
}

const STUECKE: Record<TonId, Note[]> = {
  klick:        [{ f: 420, t: 0, d: 0.05, v: 0.12 }],
  runde:        [{ f: 320, t: 0, d: 0.1, v: 0.16 }, { f: 480, t: 0.08, d: 0.14, v: 0.14 }],
  marsch:       [{ f: 240, t: 0, d: 0.08, v: 0.14, form: 'triangle' },
    { f: 300, t: 0.06, d: 0.1, v: 0.12, form: 'triangle' }],
  bau:          [{ f: 180, t: 0, d: 0.07, v: 0.16, form: 'square' },
    { f: 240, t: 0.07, d: 0.09, v: 0.1, form: 'triangle' }],
  fehler:       [{ f: 200, t: 0, d: 0.12, v: 0.14, form: 'sawtooth' },
    { f: 150, t: 0.08, d: 0.14, v: 0.12, form: 'sawtooth' }],
  krieg:        [{ f: 150, t: 0, d: 0.22, v: 0.2, form: 'sawtooth' },
    { f: 112, t: 0.16, d: 0.3, v: 0.18, form: 'sawtooth' }],
  frieden:      [{ f: 392, t: 0, d: 0.16, v: 0.13 }, { f: 523, t: 0.13, d: 0.2, v: 0.12 },
    { f: 659, t: 0.26, d: 0.26, v: 0.1 }],
  'sieg-klein': [{ f: 523, t: 0, d: 0.09, v: 0.14 }, { f: 784, t: 0.08, d: 0.14, v: 0.12 }],
  verlust:      [{ f: 240, t: 0, d: 0.14, v: 0.14, form: 'triangle' },
    { f: 170, t: 0.12, d: 0.2, v: 0.12, form: 'triangle' }],
  sieg:         [{ f: 523, t: 0, d: 0.14, v: 0.16 }, { f: 659, t: 0.13, d: 0.14, v: 0.15 },
    { f: 784, t: 0.26, d: 0.18, v: 0.15 }, { f: 1046, t: 0.42, d: 0.42, v: 0.14 }],
  niederlage:   [{ f: 330, t: 0, d: 0.2, v: 0.15, form: 'triangle' },
    { f: 262, t: 0.18, d: 0.22, v: 0.14, form: 'triangle' },
    { f: 196, t: 0.38, d: 0.5, v: 0.13, form: 'triangle' }],
  start:        [{ f: 262, t: 0, d: 0.12, v: 0.13 }, { f: 392, t: 0.11, d: 0.14, v: 0.12 },
    { f: 523, t: 0.24, d: 0.3, v: 0.12 }],
};

export function spieleTon(id: TonId): void {
  const ctx = hol();
  if (!ctx) return;
  const stueck = STUECKE[id];
  if (!stueck) return;

  const jetzt = ctx.currentTime;
  for (const note of stueck) {
    try {
      const osz = ctx.createOscillator();
      const huelle = ctx.createGain();
      osz.type = note.form ?? 'sine';
      osz.frequency.value = note.f;

      const start = jetzt + note.t;
      const laut = note.v ?? 0.12;
      // Weiche Flanken - harte Einsaetze klingen nach Fehler statt nach Absicht.
      huelle.gain.setValueAtTime(0.0001, start);
      huelle.gain.exponentialRampToValueAtTime(laut, start + 0.012);
      huelle.gain.exponentialRampToValueAtTime(0.0001, start + note.d);

      osz.connect(huelle).connect(ctx.destination);
      osz.start(start);
      osz.stop(start + note.d + 0.02);
    } catch {
      /* Ein fehlgeschlagener Ton darf das Spiel nie stoeren. */
    }
  }
}

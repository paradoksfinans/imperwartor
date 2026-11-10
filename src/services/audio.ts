/**
 * Dezente Klänge, vollständig per WebAudio erzeugt - ohne externe Dateien.
 * Das Spiel funktioniert auch ohne Ton vollständig.
 */
export type SoundId =
  | 'click'
  | 'endTurn'
  | 'battleWin'
  | 'battleLose'
  | 'conquer'
  | 'war'
  | 'peace'
  | 'event'
  | 'achievement'
  | 'victory'
  | 'defeat';

let context: AudioContext | null = null;
let enabled = true;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

function tone(options: ToneOptions): void {
  const ctx = getContext();
  if (!ctx) return;
  const start = ctx.currentTime + (options.delay ?? 0);
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = options.type ?? 'sine';
  oscillator.frequency.setValueAtTime(options.frequency, start);
  if (options.sweepTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.sweepTo),
      start + options.duration
    );
  }
  const peak = options.gain ?? 0.07;
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
  oscillator.connect(gainNode).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + options.duration + 0.05);
}

const PATTERNS: Record<SoundId, ToneOptions[]> = {
  click: [{ frequency: 420, duration: 0.07, type: 'triangle', gain: 0.045 }],
  endTurn: [
    { frequency: 300, duration: 0.14, type: 'sine' },
    { frequency: 420, duration: 0.18, type: 'sine', delay: 0.1 }
  ],
  battleWin: [
    { frequency: 392, duration: 0.14, type: 'triangle' },
    { frequency: 523, duration: 0.18, type: 'triangle', delay: 0.12 },
    { frequency: 659, duration: 0.22, type: 'triangle', delay: 0.26 }
  ],
  battleLose: [
    { frequency: 330, duration: 0.18, type: 'sawtooth', gain: 0.05 },
    { frequency: 220, duration: 0.26, type: 'sawtooth', gain: 0.05, delay: 0.14 }
  ],
  conquer: [
    { frequency: 523, duration: 0.12, type: 'square', gain: 0.045 },
    { frequency: 698, duration: 0.2, type: 'square', gain: 0.045, delay: 0.1 }
  ],
  war: [
    { frequency: 160, duration: 0.3, type: 'sawtooth', gain: 0.06, sweepTo: 90 },
    { frequency: 200, duration: 0.3, type: 'sawtooth', gain: 0.05, delay: 0.16, sweepTo: 110 }
  ],
  peace: [
    { frequency: 523, duration: 0.2, type: 'sine' },
    { frequency: 659, duration: 0.3, type: 'sine', delay: 0.16 }
  ],
  event: [{ frequency: 740, duration: 0.14, type: 'triangle', gain: 0.05 }],
  achievement: [
    { frequency: 659, duration: 0.12, type: 'triangle' },
    { frequency: 880, duration: 0.14, type: 'triangle', delay: 0.11 },
    { frequency: 1046, duration: 0.26, type: 'triangle', delay: 0.23 }
  ],
  victory: [
    { frequency: 523, duration: 0.18, type: 'triangle' },
    { frequency: 659, duration: 0.18, type: 'triangle', delay: 0.17 },
    { frequency: 784, duration: 0.2, type: 'triangle', delay: 0.34 },
    { frequency: 1046, duration: 0.4, type: 'triangle', delay: 0.53 }
  ],
  defeat: [
    { frequency: 392, duration: 0.24, type: 'sine', gain: 0.055 },
    { frequency: 294, duration: 0.3, type: 'sine', gain: 0.055, delay: 0.2 },
    { frequency: 196, duration: 0.5, type: 'sine', gain: 0.055, delay: 0.42 }
  ]
};

export function playSound(id: SoundId): void {
  if (!enabled) return;
  const pattern = PATTERNS[id];
  if (!pattern) return;
  try {
    for (const options of pattern) tone(options);
  } catch {
    /* Ton ist optional. */
  }
}

/**
 * Kleine Helfer für die Oberflaeche.
 */

/**
 * Maskiert Text für die Ausgabe als HTML.
 *
 * Wichtig, weil Spielstände importiert werden können: Ein Laendername aus
 * einer fremden Datei darf kein Markup einschleusen. Jeder dynamische Text
 * läuft durch diese Funktion.
 */
export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, klasse?: string, html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** Ereignisse gebuendelt behandeln - spart Hunderte einzelner Zuordnungen. */
export function delegiere(
  wurzel: HTMLElement, auswahl: string,
  fn: (ziel: HTMLElement, ereignis: Event) => void,
  typ = 'click',
): void {
  wurzel.addEventListener(typ, (e) => {
    const ziel = (e.target as HTMLElement)?.closest(auswahl) as HTMLElement | null;
    if (ziel && wurzel.contains(ziel)) fn(ziel, e);
  });
}

export function zeile(bez: string, wert: string, klasse = ''): string {
  return `<div class="zeile"><span class="bez">${esc(bez)}</span>
    <span class="wert ${klasse}">${wert}</span></div>`;
}

export function balken(anteil: number, klasse = ''): string {
  const w = Math.max(0, Math.min(100, anteil));
  return `<div class="balken ${klasse}"><span style="width:${w}%"></span></div>`;
}

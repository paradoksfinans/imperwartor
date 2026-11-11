/** Einheitliche Zahlen- und Datumsdarstellung. */

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('de-DE');
}

export function formatSigned(n: number): string {
  const v = Math.round(n);
  return v > 0 ? `+${formatNumber(v)}` : formatNumber(v);
}

export function formatPopulation(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mio.`;
  if (n >= 1_000) return `${Math.round(n / 1000)} Tsd.`;
  return formatNumber(n);
}

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** Vorchristliche Jahre nicht als negative Zahl anzeigen. */
export function jahrText(year: number): string {
  return year < 0 ? `${Math.abs(year)} v. Chr.` : String(year);
}

const MONATE = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function formatDate(year: number, turn: number, monthsPerTurn: number): string {
  if (monthsPerTurn >= 12) return jahrText(year);
  const monat = ((turn - 1) * monthsPerTurn) % 12;
  return `${MONATE[monat]} ${jahrText(year)}`;
}

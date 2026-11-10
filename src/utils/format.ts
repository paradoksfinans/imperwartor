/** Formatierungshilfen für die Oberfläche. */

const numberFormatter = new Intl.NumberFormat('de-DE');

export function formatNumber(value: number): string {
  return numberFormatter.format(Math.round(value));
}

export function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return rounded >= 0 ? `+${formatNumber(rounded)}` : formatNumber(rounded);
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)} %`;
}

export function formatFactor(value: number): string {
  return `x${value.toFixed(2)}`;
}

/** Dezimalzahl in deutscher Schreibweise, z. B. 1,59. */
export function formatDecimal(value: number, digits = 2): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

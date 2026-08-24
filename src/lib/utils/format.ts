const MAN = 10_000;

/** 4,300,000 -> "430万円" — the only salary unit shown to candidates. */
export function formatManYen(yen: number | null | undefined): string {
  if (yen === null || yen === undefined) return "—";
  return `${Math.round(yen / MAN).toLocaleString("ja-JP")}万円`;
}

export function formatManRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low === null || low === undefined || high === null || high === undefined) return "—";
  return `${Math.round(low / MAN).toLocaleString("ja-JP")}〜${Math.round(
    high / MAN,
  ).toLocaleString("ja-JP")}万円`;
}

export function formatUpliftRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low === null || low === undefined || high === null || high === undefined) return "—";
  const clampedLow = Math.max(0, Math.round(low / MAN));
  const clampedHigh = Math.max(0, Math.round(high / MAN));
  if (clampedHigh <= 0) return "現在の年収が市場水準に近い状態です";
  return `+${clampedLow.toLocaleString("ja-JP")}〜${clampedHigh.toLocaleString("ja-JP")}万円`;
}

export function formatYen(yen: number | null | undefined): string {
  if (yen === null || yen === undefined) return "—";
  return `${Math.round(yen).toLocaleString("ja-JP")}円`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

export function formatRiskRewardRatio(
  value: number | null | undefined,
  options?: {
    decimals?: number;
    placeholder?: string;
    includeSign?: boolean;
  },
): string {
  const decimals = options?.decimals ?? 2;
  const placeholder = options?.placeholder ?? 'N/A';
  const includeSign = options?.includeSign ?? false;

  if (!Number.isFinite(value)) return placeholder;

  const absolute = Math.abs(value as number);
  const rounded = Number(absolute.toFixed(decimals));
  const formattedNumber = rounded.toFixed(decimals).replace(/\.?0+$/, '');
  const rrDisplay = `1:${formattedNumber} RR`;

  if (includeSign && (value as number) < 0) {
    return `-${rrDisplay}`;
  }
  return rrDisplay;
}

export function parseRiskRewardValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^n\/a$/i.test(normalized)) return null;

  const withoutRRSuffix = normalized.replace(/\s*RR$/i, '').trim();

  // Ratio string, e.g. "1:1", "1:2.50", "-1:0.75", with or without "RR".
  const ratioMatch = withoutRRSuffix.match(/^([+-]?\d*\.?\d+)\s*:\s*([+-]?\d*\.?\d+)$/);
  if (ratioMatch) {
    const left = Number(ratioMatch[1]);
    const right = Number(ratioMatch[2]);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left === 0) return null;
    const sign = left < 0 || right < 0 ? -1 : 1;
    return sign * (Math.abs(right) / Math.abs(left));
  }

  // "1.15 RR" format.
  const rrNumeric = Number(withoutRRSuffix);
  if (Number.isFinite(rrNumeric)) return rrNumeric;

  // Legacy "2.50R" format.
  const stripped = normalized.toUpperCase().endsWith('R')
    ? normalized.slice(0, -1).trim()
    : normalized;

  const numeric = Number(stripped);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

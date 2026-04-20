export const SCANNER_COLOR_STORAGE_KEY = 'flyxa_scanner_colors';

export type ScannerColorKey =
  | 'supplyStopZone'
  | 'targetDemandZone'
  | 'entryZone'
  | 'neutralZone';

export interface ScannerColorConfig {
  hex: string;
  opacity: number;
}

export interface ScannerColorProfile {
  supplyStopZone: ScannerColorConfig;
  targetDemandZone: ScannerColorConfig;
  entryZone: ScannerColorConfig;
  neutralZone: ScannerColorConfig;
}

const SCANNER_COLOR_KEYS: ScannerColorKey[] = [
  'supplyStopZone',
  'targetDemandZone',
  'entryZone',
  'neutralZone',
];

const DEFAULT_SCANNER_COLORS: ScannerColorProfile = {
  supplyStopZone: { hex: '#C0392B', opacity: 100 },
  targetDemandZone: { hex: '#1A6B5A', opacity: 100 },
  entryZone: { hex: '#E67E22', opacity: 100 },
  neutralZone: { hex: '#7F8C8D', opacity: 100 },
};

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) {
    return 100;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeHexInput(value: string): string | null {
  const match = value.trim().match(/^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/);
  if (!match) {
    return null;
  }

  const raw = match[1].toUpperCase();
  if (raw.length === 3) {
    return `#${raw.split('').map(ch => `${ch}${ch}`).join('')}`;
  }

  return `#${raw}`;
}

function sanitizeColorConfig(
  value: unknown,
  fallback: ScannerColorConfig
): ScannerColorConfig {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }

  const entry = value as { hex?: unknown; opacity?: unknown };
  const normalizedHex = typeof entry.hex === 'string'
    ? normalizeHexInput(entry.hex)
    : null;
  const opacity = typeof entry.opacity === 'number'
    ? clampOpacity(entry.opacity)
    : fallback.opacity;

  return {
    hex: normalizedHex ?? fallback.hex,
    opacity,
  };
}

function sanitizeColorProfile(value: unknown): ScannerColorProfile {
  if (!value || typeof value !== 'object') {
    return getDefaultScannerColors();
  }

  const rawProfile = value as Record<string, unknown>;

  return {
    supplyStopZone: sanitizeColorConfig(rawProfile.supplyStopZone, DEFAULT_SCANNER_COLORS.supplyStopZone),
    targetDemandZone: sanitizeColorConfig(rawProfile.targetDemandZone, DEFAULT_SCANNER_COLORS.targetDemandZone),
    entryZone: sanitizeColorConfig(rawProfile.entryZone, DEFAULT_SCANNER_COLORS.entryZone),
    neutralZone: sanitizeColorConfig(rawProfile.neutralZone, DEFAULT_SCANNER_COLORS.neutralZone),
  };
}

export function getDefaultScannerColors(): ScannerColorProfile {
  return {
    supplyStopZone: { ...DEFAULT_SCANNER_COLORS.supplyStopZone },
    targetDemandZone: { ...DEFAULT_SCANNER_COLORS.targetDemandZone },
    entryZone: { ...DEFAULT_SCANNER_COLORS.entryZone },
    neutralZone: { ...DEFAULT_SCANNER_COLORS.neutralZone },
  };
}

export function getScannerColors(): ScannerColorProfile {
  if (typeof window === 'undefined') {
    return getDefaultScannerColors();
  }

  try {
    const raw = localStorage.getItem(SCANNER_COLOR_STORAGE_KEY);
    if (!raw) {
      return getDefaultScannerColors();
    }
    return sanitizeColorProfile(JSON.parse(raw));
  } catch {
    return getDefaultScannerColors();
  }
}

export function saveScannerColors(profile: ScannerColorProfile): ScannerColorProfile {
  const normalizedProfile = sanitizeColorProfile(profile);
  if (typeof window === 'undefined') {
    return normalizedProfile;
  }

  try {
    localStorage.setItem(SCANNER_COLOR_STORAGE_KEY, JSON.stringify(normalizedProfile));
  } catch {
    // Ignore write failures (e.g. private mode quota) and keep in-memory value.
  }

  return normalizedProfile;
}

export function updateScannerColor(
  profile: ScannerColorProfile,
  key: ScannerColorKey,
  update: Partial<ScannerColorConfig>
): ScannerColorProfile {
  return sanitizeColorProfile({
    ...profile,
    [key]: {
      ...profile[key],
      ...update,
    },
  });
}

export function withScannerColorContext(
  scannerContext?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...(scannerContext ?? {}),
    scanner_colors: getScannerColors(),
  };
}

export function formatScannerColorValue(color: ScannerColorConfig): string {
  if (color.opacity >= 100) {
    return color.hex;
  }

  const normalizedHex = normalizeHexInput(color.hex);
  if (!normalizedHex) {
    return color.hex;
  }

  const red = Number.parseInt(normalizedHex.slice(1, 3), 16);
  const green = Number.parseInt(normalizedHex.slice(3, 5), 16);
  const blue = Number.parseInt(normalizedHex.slice(5, 7), 16);
  const alpha = Math.max(0, Math.min(1, color.opacity / 100));
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

export function isValidScannerHex(value: string): boolean {
  return normalizeHexInput(value) !== null;
}

export function normalizeScannerHex(value: string): string | null {
  return normalizeHexInput(value);
}

export const SCANNER_COLOR_ORDER = [...SCANNER_COLOR_KEYS];

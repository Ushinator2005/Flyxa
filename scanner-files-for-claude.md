# Trade Scanner Context Bundle
Generated for Claude review.

## File: frontend/src/components/scanner/ScreenshotImportModal.tsx
```ts
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock3, Expand, ImagePlus, Sparkles, Wand2, X, Upload } from 'lucide-react';
import TradeForm from './TradeForm.js';
import { Trade } from '../../types/index.js';
import { aiApi } from '../../services/api.js';
import { lookupContract } from '../../constants/futuresContracts.js';
import { useAppSettings } from '../../contexts/AppSettingsContext.js';

const DRAFT_KEY = 'tw_scanner_draft';
const DRAFT_IMAGE_KEY = 'tw_scanner_draft_image';

const SYMBOL_MAP: Record<string, string> = {
  NQM26:'NQ',NQH26:'NQ',NQU26:'NQ',NQZ26:'NQ',
  ESM26:'ES',ESH26:'ES',ESU26:'ES',ESZ26:'ES',
  MNQM26:'MNQ',MNQH26:'MNQ',MNQU26:'MNQ',MNQZ26:'MNQ',
  MESM26:'MES',MESH26:'MES',MESU26:'MES',MESZ26:'MES',
};

function resolveSymbol(raw: string): string {
  return SYMBOL_MAP[raw.toUpperCase()] ?? raw.toUpperCase();
}

function normalizeResolvedSymbol(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const normalized = resolveSymbol(raw.trim());
  return ['UNKNOWN', 'UNKWN', 'N/A', 'NA', 'NONE', 'NULL'].includes(normalized) ? null : normalized;
}

function inferSymbolFromFileName(fileName: string): string | null {
  const upper = fileName.toUpperCase();
  const match = upper.match(/(?:^|[^A-Z0-9])(MNQ|MES|NQ|ES|MYM|YM|M2K|RTY|CL|MCL|GC|SI|6E)(?=[^A-Z0-9]|$)/);
  return match ? match[1] : null;
}

interface CropPreset {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ComponentBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  count: number;
}

interface ScannerContext {
  direction_hint?: 'Long' | 'Short';
  chart_left_ratio?: number;
  chart_right_ratio?: number;
  box_left_ratio?: number;
  box_right_ratio?: number;
  entry_line_ratio?: number;
  stop_line_ratio?: number;
  target_line_ratio?: number;
  red_box?: Omit<ComponentBounds, 'count'>;
  green_box?: Omit<ComponentBounds, 'count'>;
}

const DEFAULT_FOCUS_CROPS: CropPreset[] = [
  { name: 'header-focus', x: 0.00, y: 0.00, width: 0.34, height: 0.12 },
  { name: 'trade-box-focus', x: 0.46, y: 0.10, width: 0.30, height: 0.72 },
  { name: 'entry-window-focus', x: 0.40, y: 0.16, width: 0.22, height: 0.62 },
  { name: 'exit-path-focus', x: 0.46, y: 0.16, width: 0.24, height: 0.62 },
  { name: 'price-label-focus', x: 0.78, y: 0.00, width: 0.22, height: 1.00 },
  { name: 'entry-label-focus', x: 0.83, y: 0.40, width: 0.17, height: 0.08 },
  { name: 'stop-label-focus', x: 0.83, y: 0.28, width: 0.17, height: 0.08 },
  { name: 'target-label-focus', x: 0.83, y: 0.52, width: 0.17, height: 0.08 },
];

const ACCOUNT_STATUS_STYLES = {
  Eval: 'border-blue-400/30 bg-blue-500/10 text-blue-300',
  Funded: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  Live: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  Blown: 'border-red-400/30 bg-red-500/10 text-red-300',
} as const;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load chart image for scanner crops'));
    };
    image.src = objectUrl;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string, sourceType: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Failed to create scanner crop'));
        return;
      }

      resolve(new File([blob], fileName, { type: sourceType || 'image/png' }));
    }, sourceType || 'image/png', 0.95);
  });
}

async function buildUploadImage(image: HTMLImageElement, fileName: string): Promise<File> {
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth || image.width));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare scanner upload image');
  }

  context.drawImage(image, 0, 0, width, height);

  return canvasToFile(canvas, fileName.replace(/\.[^.]+$/, '') + '.webp', 'image/webp');
}

function clampRatio(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function isGreenOverlay(r: number, g: number, b: number): boolean {
  return g > r + 6 && b > r + 2 && g > 140 && b > 140;
}

function isRedOverlay(r: number, g: number, b: number): boolean {
  return r > g + 12 && r > b + 6 && r > 150;
}

function findLargestComponent(mask: Uint8Array, width: number, height: number): ComponentBounds | null {
  const visited = new Uint8Array(mask.length);
  let best: ComponentBounds | null = null;
  const queue = new Int32Array(mask.length);

  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    let head = 0;
    let tail = 0;
    visited[index] = 1;
    queue[tail++] = index;

    let count = 0;
    let xMin = width;
    let xMax = 0;
    let yMin = height;
    let yMax = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);

      count++;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      neighbors.forEach(next => {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) {
          return;
        }

        const nextX = next % width;
        if (Math.abs(nextX - x) > 1) {
          return;
        }

        visited[next] = 1;
        queue[tail++] = next;
      });
    }

    if (!best || count > best.count) {
      best = { xMin, xMax, yMin, yMax, count };
    }
  }

  return best;
}

function toRatioBounds(bounds: ComponentBounds, width: number, height: number): Omit<ComponentBounds, 'count'> {
  return {
    xMin: bounds.xMin / width,
    xMax: bounds.xMax / width,
    yMin: bounds.yMin / height,
    yMax: bounds.yMax / height,
  };
}

function inferChartPaneBounds(boxLeftRatio: number, boxRightRatio: number): { left: number; right: number } {
  if (boxRightRatio <= 0.48) {
    return { left: 0, right: 0.5 };
  }

  if (boxLeftRatio >= 0.52) {
    return { left: 0.5, right: 1 };
  }

  return { left: 0, right: 1 };
}

function detectTradeBoxContext(image: HTMLImageElement): ScannerContext | null {
  const targetWidth = Math.min(640, image.naturalWidth || image.width);
  const scale = targetWidth / (image.naturalWidth || image.width);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const redMask = new Uint8Array(width * height);
  const greenMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x > width * 0.88) {
        continue;
      }

      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const pixelIndex = y * width + x;

      if (isRedOverlay(r, g, b)) {
        redMask[pixelIndex] = 1;
      }

      if (isGreenOverlay(r, g, b)) {
        greenMask[pixelIndex] = 1;
      }
    }
  }

  const redBox = findLargestComponent(redMask, width, height);
  const greenBox = findLargestComponent(greenMask, width, height);

  if (!redBox || !greenBox || redBox.count < 200 || greenBox.count < 200) {
    return null;
  }

  const boxLeftRatio = Math.min(redBox.xMin, greenBox.xMin) / width;
  const boxRightRatio = Math.max(redBox.xMax, greenBox.xMax) / width;
  const chartPane = inferChartPaneBounds(boxLeftRatio, boxRightRatio);
  const redCenterY = (redBox.yMin + redBox.yMax) / 2;
  const greenCenterY = (greenBox.yMin + greenBox.yMax) / 2;
  const directionHint =
    redCenterY < greenCenterY
      ? 'Short'
      : greenCenterY < redCenterY
        ? 'Long'
        : undefined;

  let entryLineRatio: number | undefined;
  let stopLineRatio: number | undefined;
  let targetLineRatio: number | undefined;
  if (directionHint === 'Long') {
    entryLineRatio = greenBox.yMax / height;
    stopLineRatio = redBox.yMax / height;
    targetLineRatio = greenBox.yMin / height;
  } else if (directionHint === 'Short') {
    entryLineRatio = redBox.yMax / height;
    stopLineRatio = redBox.yMin / height;
    targetLineRatio = greenBox.yMax / height;
  }

  return {
    direction_hint: directionHint,
    chart_left_ratio: chartPane.left,
    chart_right_ratio: chartPane.right,
    box_left_ratio: boxLeftRatio,
    box_right_ratio: boxRightRatio,
    entry_line_ratio: entryLineRatio,
    stop_line_ratio: stopLineRatio,
    target_line_ratio: targetLineRatio,
    red_box: toRatioBounds(redBox, width, height),
    green_box: toRatioBounds(greenBox, width, height),
  };
}

function buildDynamicFocusCrops(scannerContext: ScannerContext | null): CropPreset[] {
  if (!scannerContext?.box_left_ratio || !scannerContext.box_right_ratio) {
    return DEFAULT_FOCUS_CROPS;
  }

  const chartLeft = scannerContext.chart_left_ratio ?? 0;
  const chartRight = scannerContext.chart_right_ratio ?? 1;
  const chartWidth = Math.max(0.22, chartRight - chartLeft);
  const left = scannerContext.box_left_ratio;
  const right = scannerContext.box_right_ratio;
  const boxWidth = Math.max(0.08, right - left);
  const top = Math.min(scannerContext.red_box?.yMin ?? 0.18, scannerContext.green_box?.yMin ?? 0.18);
  const bottom = Math.max(scannerContext.red_box?.yMax ?? 0.78, scannerContext.green_box?.yMax ?? 0.78);
  const boxHeight = Math.max(0.22, bottom - top);
  const entryLine = scannerContext.entry_line_ratio ?? (top + boxHeight / 2);
  const stopLine = scannerContext.stop_line_ratio ?? top;
  const targetLine = scannerContext.target_line_ratio ?? bottom;
  const labelCrop = (name: string, yCenter: number): CropPreset => ({
    name,
    x: clampRatio(chartRight - chartWidth * 0.17, chartLeft, 0.9),
    y: clampRatio(yCenter - 0.045),
    width: clampRatio(chartWidth * 0.17, 0.1, 0.18),
    height: 0.09,
  });

  return [
    {
      name: 'header-focus',
      x: chartLeft,
      y: 0.00,
      width: clampRatio(chartWidth * 0.42, 0.24, 0.42),
      height: 0.12,
    },
    {
      name: 'trade-box-focus',
      x: clampRatio(left - boxWidth * 0.25, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.18),
      width: clampRatio(boxWidth * 1.7, 0.18, chartRight - clampRatio(left - boxWidth * 0.25, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.35, 0.30, 0.78),
    },
    {
      name: 'entry-window-focus',
      x: clampRatio(left - boxWidth * 0.45, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.15),
      width: clampRatio(boxWidth * 1.2, 0.16, chartRight - clampRatio(left - boxWidth * 0.45, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.2, 0.32, 0.74),
    },
    {
      name: 'exit-path-focus',
      x: clampRatio(left - boxWidth * 0.10, chartLeft, chartRight - 0.12),
      y: clampRatio(top - boxHeight * 0.15),
      width: clampRatio(boxWidth * 1.55, 0.18, chartRight - clampRatio(left - boxWidth * 0.10, chartLeft, chartRight - 0.12)),
      height: clampRatio(boxHeight * 1.2, 0.32, 0.74),
    },
    {
      name: 'price-label-focus',
      x: clampRatio(chartRight - chartWidth * 0.22, chartLeft, 0.86),
      y: 0.00,
      width: clampRatio(chartWidth * 0.22, 0.14, 0.22),
      height: 1.00,
    },
    labelCrop('entry-label-focus', entryLine),
    labelCrop('stop-label-focus', stopLine),
    labelCrop('target-label-focus', targetLine),
  ];
}

async function buildScannerAssets(file: File): Promise<{
  focusImages: File[];
  scannerContext: ScannerContext | null;
  uploadImage: File;
}> {
  const image = await loadImage(file);
  const sourceType = file.type || 'image/png';
  const scannerContext = detectTradeBoxContext(image);
  const focusCrops = buildDynamicFocusCrops(scannerContext);
  const focusImages = await Promise.all(focusCrops.map(async crop => {
    const sx = Math.max(0, Math.floor(image.width * crop.x));
    const sy = Math.max(0, Math.floor(image.height * crop.y));
    const sw = Math.max(1, Math.floor(image.width * crop.width));
    const sh = Math.max(1, Math.floor(image.height * crop.height));
    const boundedWidth = Math.min(sw, image.width - sx);
    const boundedHeight = Math.min(sh, image.height - sy);

    const canvas = document.createElement('canvas');
    canvas.width = boundedWidth;
    canvas.height = boundedHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare scanner crop canvas');
    }

    context.drawImage(
      image,
      sx,
      sy,
      boundedWidth,
      boundedHeight,
      0,
      0,
      boundedWidth,
      boundedHeight
    );

    return canvasToFile(canvas, `${crop.name}-${file.name}`, sourceType);
  }));

  const uploadImage = await buildUploadImage(image, file.name);

  return { focusImages, scannerContext, uploadImage };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Trade>) => Promise<void>;
  editTrade?: Trade | null;
  prefillTrade?: Partial<Trade> | null;
}

export default function ScreenshotImportModal({ isOpen, onClose, onSave, editTrade, prefillTrade }: Props) {
  const { accounts, getDefaultTradeAccountId, isTradeAccountAllocatable, resolveTradeAccountId } = useAppSettings();
  const getInitialTradeAccountId = useCallback(() => {
    const baseTrade = editTrade ?? prefillTrade ?? null;
    if (baseTrade?.accountId || baseTrade?.account_id || baseTrade?.id) {
      return resolveTradeAccountId(baseTrade);
    }

    return getDefaultTradeAccountId();
  }, [editTrade, getDefaultTradeAccountId, prefillTrade, resolveTradeAccountId]);
  const getInitialContractSize = useCallback(
    () => String(Math.max(1, Number(editTrade?.contract_size ?? prefillTrade?.contract_size ?? 1))),
    [editTrade?.contract_size, prefillTrade?.contract_size]
  );

  const [scanning, setScanning]           = useState(false);
  const [scanError, setScanError]         = useState('');
  const [warnings, setWarnings]           = useState<string[]>([]);
  const [scanEvidence, setScanEvidence]   = useState<string>('');
  const [formData, setFormData]           = useState<Partial<Trade> | null>(() => {
    if (editTrade) return editTrade;
    if (prefillTrade) return prefillTrade;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) { const { data } = JSON.parse(saved); return data ?? null; }
    } catch { /* ignore */ }
    return null;
  });
  const [aiFields, setAiFields]           = useState<Set<string>>(new Set());
  const [imagePreview, setImagePreview]   = useState<string | null>(() => {
    if (editTrade) return editTrade.screenshot_url ?? null;
    try { return localStorage.getItem(DRAFT_IMAGE_KEY) ?? null; } catch { return null; }
  });
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [isDragging, setIsDragging]       = useState(false);
  const [saving, setSaving]              = useState(false);
  const [contractInputValue, setContractInputValue] = useState(() => getInitialContractSize());
  const [tradeAccountId, setTradeAccountId] = useState(() => getInitialTradeAccountId());

  const [currentDate, setCurrentDate] = useState(() => editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
  const [currentTime, setCurrentTime] = useState(() => editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountById = useMemo(() => new Map(accounts.map(account => [account.id, account] as const)), [accounts]);
  const existingTradeAccountId = editTrade ? resolveTradeAccountId(editTrade) : null;
  const selectedTradeAccount = accountById.get(tradeAccountId);
  const selectedTradeAccountIsAllocatable = tradeAccountId ? isTradeAccountAllocatable(tradeAccountId) : false;
  const hasAllocatableAccount = useMemo(
    () => accounts.some(account => isTradeAccountAllocatable(account.id)),
    [accounts, isTradeAccountAllocatable]
  );
  const selectedTradeAccountStatusClass = selectedTradeAccount
    ? ACCOUNT_STATUS_STYLES[selectedTradeAccount.status]
    : null;

  const getFallbackScanDate = () => new Date().toISOString().split('T')[0];
  const getFallbackScanTime = () =>
    new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');
    if (editTrade) {
      setImagePreview(editTrade.screenshot_url ?? null);
    } else {
      try { setImagePreview(localStorage.getItem(DRAFT_IMAGE_KEY) ?? null); } catch { setImagePreview(null); }
    }
    setContractInputValue(getInitialContractSize());
    setTradeAccountId(getInitialTradeAccountId());
    setAiFields(new Set());
    setWarnings([]);
    setScanEvidence('');
    setScanError('');

    if (editTrade) {
      setFormData(editTrade);
      return;
    }

    if (prefillTrade) {
      setFormData(prefillTrade);
    }
  }, [editTrade, getInitialContractSize, getInitialTradeAccountId, isOpen, prefillTrade]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const reset = () => {
    setFormData(editTrade ?? prefillTrade ?? null);
    setAiFields(new Set());
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_IMAGE_KEY);
    setImagePreview(editTrade?.screenshot_url ?? null);
    setFullscreenPreview(false);
    setScanError('');
    setWarnings([]);
    setScanEvidence('');
    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');
    setContractInputValue(getInitialContractSize());
    setTradeAccountId(getInitialTradeAccountId());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = useCallback(() => {
    setFormData(editTrade ?? prefillTrade ?? null);
    setAiFields(new Set());
    setImagePreview(editTrade?.screenshot_url ?? null);
    setFullscreenPreview(false);
    setScanError('');
    setWarnings([]);
    setScanEvidence('');
    setCurrentDate(editTrade?.trade_date ?? prefillTrade?.trade_date ?? '');
    setCurrentTime(editTrade?.trade_time ?? prefillTrade?.trade_time ?? '');
    setContractInputValue(getInitialContractSize());
    setTradeAccountId(getInitialTradeAccountId());
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [editTrade, getInitialContractSize, getInitialTradeAccountId, onClose, prefillTrade]);

  const handleImageSelected = useCallback(async (file: File) => {
    setScanError('');
    setWarnings([]);
    setScanning(true);

    const reader = new FileReader();
    reader.onload = e => {
      const preview = e.target?.result as string;
      setImagePreview(preview);
      if (!editTrade) {
        try { localStorage.setItem(DRAFT_IMAGE_KEY, preview); } catch { /* quota exceeded â€” skip */ }
      }
    };
    reader.readAsDataURL(file);

    try {
      const scanDate = currentDate || getFallbackScanDate();
      const scanTime = currentTime || getFallbackScanTime();
      const { focusImages, scannerContext, uploadImage } = await buildScannerAssets(file);
      const extracted = await aiApi.scanChart(
        uploadImage,
        scanDate,
        scanTime,
        focusImages,
        scannerContext ? scannerContext as unknown as Record<string, unknown> : undefined
      );
      const w: string[] = Array.isArray(extracted.warnings) ? extracted.warnings : [];
      const fields = new Set<string>();
      const baseTrade = editTrade ?? prefillTrade ?? formData ?? null;
      const mapped: Partial<Trade> = {
        ...baseTrade,
        accountId: tradeAccountId || getDefaultTradeAccountId(),
        trade_date: currentDate || undefined,
        trade_time: currentTime || undefined,
        contract_size: Math.max(1, Number(formData?.contract_size ?? prefillTrade?.contract_size ?? editTrade?.contract_size ?? 1)),
      };
      const resolvedSymbol = normalizeResolvedSymbol(extracted.symbol) ?? inferSymbolFromFileName(file.name);
      if (resolvedSymbol) {
        mapped.symbol = resolvedSymbol;
        if (normalizeResolvedSymbol(extracted.symbol)) {
          fields.add('symbol');
        }
      }
      if (extracted.direction)  { mapped.direction = extracted.direction as 'Long'|'Short'; fields.add('direction'); }
      if (extracted.entry_price){ mapped.entry_price = Number(extracted.entry_price); fields.add('entry_price');
        const inst = lookupContract(mapped.symbol ?? '');
        if (inst) mapped.point_value = inst.point_value;
      }
      if (extracted.sl_price)   { mapped.sl_price = Number(extracted.sl_price); fields.add('sl_price'); }
      if (extracted.tp_price)   { mapped.tp_price = Number(extracted.tp_price); fields.add('tp_price'); }
      if (extracted.exit_reason){
        const r = extracted.exit_reason as 'TP'|'SL';
        mapped.exit_reason = r; fields.add('exit_reason');
        mapped.exit_price = r === 'TP' ? Number(extracted.tp_price ?? 0) : Number(extracted.sl_price ?? 0);
      }

      if (extracted.trade_length_seconds){ mapped.trade_length_seconds = Number(extracted.trade_length_seconds); fields.add('trade_length_seconds'); }
      if (extracted.candle_count)     mapped.candle_count = Number(extracted.candle_count);
      if (extracted.timeframe_minutes) mapped.timeframe_minutes = Number(extracted.timeframe_minutes);

      setAiFields(fields);
      setFormData(mapped);
      setWarnings(w);
      setScanEvidence(extracted.first_touch_evidence ?? '');
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: mapped }));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan image');
    } finally {
      setScanning(false);
    }
  }, [currentDate, currentTime, editTrade?.contract_size, formData?.contract_size, getDefaultTradeAccountId, prefillTrade?.contract_size, tradeAccountId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImageSelected(file);
  }, [handleImageSelected]);

  const handleSave = async (data: Partial<Trade>) => {
    if (!tradeAccountId || !selectedTradeAccount) {
      alert('Select an account before saving this trade.');
      return;
    }

    if (!selectedTradeAccountIsAllocatable && tradeAccountId !== existingTradeAccountId) {
      alert(`${selectedTradeAccount.name} is marked as Blown and cannot be allocated to a trade.`);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...data,
        accountId: tradeAccountId || getDefaultTradeAccountId(),
        screenshot_url: imagePreview ?? editTrade?.screenshot_url ?? undefined,
      });
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(DRAFT_IMAGE_KEY);
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save trade');
    } finally {
      setSaving(false);
    }
  };

  const topInputClass = 'input-field h-12 border border-amber-400/70 bg-slate-950/80 shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_0_18px_rgba(245,158,11,0.14)]';
  const hasPreviewImage = Boolean(imagePreview);
  const reviewSectionTitle = editTrade ? 'Review screenshot' : 'Import screenshot';
  const reviewSectionCopy = editTrade
    ? 'View the journaled chart in fullscreen, or upload a replacement screenshot and rescan this trade.'
    : 'Scan a TradingView chart, then review the extracted trade details before saving.';
  const handleContractSizeChange = (value: string) => {
    setContractInputValue(value);

    if (value === '') {
      setFormData(current => ({
        ...(current ?? {}),
        contract_size: undefined,
      }));
      return;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    setFormData(current => ({
      ...(current ?? {}),
      contract_size: parsedValue,
    }));
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (fullscreenPreview) {
        setFullscreenPreview(false);
        return;
      }

      handleClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenPreview, handleClose, isOpen]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 p-4 md:p-6">
        <button
          type="button"
          aria-label="Close trade modal"
          onClick={handleClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <div className="relative mx-auto h-full max-w-[1400px]">
          <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-700/70 bg-slate-900/95 shadow-[0_32px_120px_rgba(2,6,23,0.58)]">
            <div className="flex items-center justify-between border-b border-slate-700/80 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">{editTrade ? 'Edit Trade' : 'Add Trade'}</h2>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 text-slate-400 transition hover:border-slate-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5">
              <div className="flex min-h-full flex-col gap-5">

        {/* Trade date/time + warnings */}
        <div className="rounded-2xl border border-slate-700/60 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Trade Date/Time</p>
              <h3 className="text-lg font-semibold text-slate-100">Add the trade anchor anytime before you save</h3>
              <p className="text-sm text-slate-400">You can fill these before, during, or after the scan. Saving still requires both fields.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <CalendarDays size={14} />
                  Trade Date
                </span>
                <input
                  type="date"
                  className={topInputClass}
                  value={currentDate}
                  onChange={e => setCurrentDate(e.target.value)}
                  required
                />
              </label>
              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <Clock3 size={14} />
                  Trade Time
                </span>
                <input
                  type="time"
                  className={topInputClass}
                  value={currentTime}
                  onChange={e => setCurrentTime(e.target.value)}
                  required
                />
              </label>
            </div>
          </div>
        </div>

        {scanEvidence && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300/80">AI Scan Note</p>
            <p className="mt-1 text-sm text-blue-200">{scanEvidence}</p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 space-y-1.5">
            {warnings.map((w, i) => <p key={i} className="text-yellow-400 text-xs">âš  {w}</p>)}
          </div>
        )}

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">

          {/* Left: image upload / preview */}
          <div className="min-w-0">
            <div className="flex flex-col gap-4 rounded-[28px] border border-slate-700/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.78))] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.32)]">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Chart Scanner</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-100">{reviewSectionTitle}</h3>
                  <p className="mt-1 text-sm text-slate-400">{reviewSectionCopy}</p>
                </div>
                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-300">
                  <Wand2 size={18} />
                </div>
              </div>

              {hasPreviewImage ? (
                <div className="relative overflow-hidden rounded-[24px] border border-slate-700/60 bg-slate-950/90 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]">
                  <div className="aspect-[4/3] w-full bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_48%)] p-3">
                    <button
                      type="button"
                      onClick={() => setFullscreenPreview(true)}
                      className="h-full w-full"
                    >
                      <img src={imagePreview!} alt="Chart" className="h-full w-full rounded-2xl object-contain" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullscreenPreview(true)}
                    className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    <Expand size={12} />
                    Fullscreen
                  </button>
                  {!editTrade && (
                    <button onClick={reset} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-600/80 bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">
                      <X size={12} />
                      Clear
                    </button>
                  )}
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/78 backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-blue-500/20 bg-slate-900/80 px-6 py-5">
                        <div className="h-9 w-9 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-blue-200">Analysing with Flyxa</p>
                          <p className="text-xs text-slate-400">Reading levels, entry anchor, and first-touch path</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!scanning && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-slate-600/80 bg-slate-950/90 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-blue-400/50 hover:text-white">
                      <ImagePlus size={13} />
                      {editTrade ? 'Upload New Screenshot' : 'Replace Screenshot'}
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`group relative overflow-hidden rounded-[24px] border border-dashed cursor-pointer transition-all flex flex-col items-center justify-center px-6 py-16 select-none ${
                    isDragging
                      ? 'border-blue-400 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_18px_45px_rgba(37,99,235,0.16)]'
                      : 'border-slate-600/80 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.78))] hover:border-blue-400/60 hover:bg-blue-500/8'
                  }`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`mb-4 rounded-2xl border p-4 transition-all ${isDragging ? 'border-blue-400/50 bg-blue-500/20 text-blue-200' : 'border-slate-600/70 bg-slate-900/70 text-slate-300 group-hover:border-blue-400/40 group-hover:text-blue-200'}`}>
                    <Upload size={28} />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-100">{isDragging ? 'Drop chart to start scan' : 'Drop chart screenshot here'}</h4>
                  <p className="text-slate-500 text-xs">or click to browse Â· PNG Â· JPG Â· WebP</p>
                  <p className="text-slate-600 text-xs mt-3">
                    {editTrade ? 'Upload a screenshot to inspect or rescan this trade' : 'Or fill in the form manually â†’'}
                  </p>
                </div>
              )}

              {scanError && (
                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{scanError}</div>
              )}

              <div className="rounded-[24px] border border-slate-700/60 bg-slate-950/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.04)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {editTrade ? 'Trade Details' : 'Entry Details'}
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label">Account</label>
                    <select
                      className="input-field h-11"
                      value={tradeAccountId}
                      onChange={e => setTradeAccountId(e.target.value)}
                    >
                      {accounts.map(account => (
                        <option
                          key={account.id}
                          value={account.id}
                          disabled={account.status === 'Blown' && account.id !== tradeAccountId}
                        >
                          {account.name}{account.status === 'Blown' ? ' (Blown)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedTradeAccount && selectedTradeAccountStatusClass && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${selectedTradeAccountStatusClass}`}>
                          {selectedTradeAccount.status}
                        </span>
                        {!selectedTradeAccountIsAllocatable && tradeAccountId !== existingTradeAccountId && (
                          <span className="text-xs text-red-300">
                            Blown accounts can&apos;t be allocated to new trades.
                          </span>
                        )}
                      </div>
                    )}
                    {!hasAllocatableAccount && (
                      <p className="mt-2 text-xs text-red-300">
                        Every account is marked as Blown right now. Change one account status before saving a trade.
                      </p>
                    )}
                  </div>
                  <label className="label">Contracts</label>
                  <input
                    type="number"
                    min={1}
                    className="input-field h-11"
                    value={contractInputValue}
                    onChange={e => handleContractSizeChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              {aiFields.size > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-400/8 px-4 py-3 text-sm text-blue-200">
                  <Sparkles size={14} />
                  {aiFields.size} fields auto-extracted â€” review and save
                </div>
              )}
            </div>
          </div>

          {/* Right: form */}
          <div className="min-w-0">
            <div className="rounded-[28px] border border-slate-700/60 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.72))] p-4 shadow-[0_24px_60px_rgba(2,6,23,0.32)] md:p-5">
              <TradeForm
                initialData={formData || undefined}
                aiFields={aiFields}
                tradeDate={currentDate}
                tradeTime={currentTime}
                showContractsField={false}
                onSubmit={handleSave}
                onCancel={handleClose}
                isLoading={saving}
              />
            </div>
          </div>
        </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fullscreenPreview && imagePreview && (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Close trade screenshot"
            onClick={() => setFullscreenPreview(false)}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, rgba(15, 23, 42, 0.16) 0%, rgba(2, 6, 23, 0.78) 68%, rgba(2, 6, 23, 0.92) 100%)',
            }}
          />

          <button
            type="button"
            onClick={() => setFullscreenPreview(false)}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-600/80 bg-slate-950/90 text-slate-300 shadow-[0_12px_28px_rgba(2,6,23,0.34)] transition hover:border-slate-500 hover:text-white"
          >
            <X size={18} />
          </button>

          <div className="absolute inset-[24px] flex items-center justify-center md:inset-[32px]">
            <img
              src={imagePreview}
              alt="Trade screenshot fullscreen"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

```

## File: frontend/src/services/api.ts
```ts
import { createClient } from '@supabase/supabase-js';
import { Trade, RiskSettings, ExtractedTradeData } from '../types/index.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const API_URL = import.meta.env.VITE_API_URL as string || 'http://localhost:3001';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class ApiService {
  private async getHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  private async getAuthHeader(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? `Bearer ${session.access_token}` : '';
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, { headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const headers = await this.getHeaders();
    const response = await fetch(`${API_URL}${path}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `Request failed: ${response.status}`);
    }
  }
}

export const api = new ApiService();

export const tradesApi = {
  getAll: () => api.get<Trade[]>('/api/trades'),
  create: (data: Partial<Trade>) => api.post<Trade>('/api/trades', data),
  update: (id: string, data: Partial<Trade>) => api.put<Trade>(`/api/trades/${id}`, data),
  delete: (id: string) => api.delete(`/api/trades/${id}`),
};

export const analyticsApi = {
  getSummary: () => api.get('/api/analytics/summary'),
  getDailyPnL: () => api.get('/api/analytics/daily-pnl'),
  getEquityCurve: () => api.get('/api/analytics/equity-curve'),
  getBySession: () => api.get('/api/analytics/by-session'),
  getByInstrument: () => api.get('/api/analytics/by-instrument'),
  getByConfluence: () => api.get('/api/analytics/by-confluence'),
  getByDayOfWeek: () => api.get('/api/analytics/by-day-of-week'),
  getByTimeOfDay: () => api.get('/api/analytics/by-time-of-day'),
  getMonthlyHeatmap: (year: number, month: number) =>
    api.get(`/api/analytics/monthly-heatmap?year=${year}&month=${month}`),
  getAdvanced: () => api.get('/api/analytics/advanced'),
};

export const aiApi = {
  scanChart: (
    file: File,
    entryDate: string,
    entryTime: string,
    focusImages: File[] = [],
    scannerContext?: Record<string, unknown>
  ) => {
    const formData = new FormData();
    formData.append('image', file);
    focusImages.forEach(image => formData.append('focusImages', image));
    if (scannerContext) {
      formData.append('scannerContext', JSON.stringify(scannerContext));
    }
    formData.append('entryDate', entryDate);
    formData.append('entryTime', entryTime);
    return api.postFormData<ExtractedTradeData & { warnings?: string[] }>('/api/ai/scan', formData);
  },
  analyzeTradeById: (tradeId: string) => api.post(`/api/ai/trade-analysis/${tradeId}`, {}),
  analyzePatterns: () => api.post('/api/ai/patterns', {}),
  weeklyReport: (weekStart: string, weekEnd: string) =>
    api.post('/api/ai/weekly-report', { weekStart, weekEnd }),
  psychologyReport: () => api.post('/api/ai/psychology-report', {}),
  playbookCheck: (tradeId: string) => api.post(`/api/ai/playbook-check/${tradeId}`, {}),
  flyxaChat: (
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => api.post<{ reply: string }>('/api/ai/flyxa-chat', { question, history }),
};

export const riskApi = {
  getSettings: () => api.get<RiskSettings>('/api/risk/settings'),
  updateSettings: (data: Partial<RiskSettings>) => api.put<RiskSettings>('/api/risk/settings', data),
  getDailyStatus: () => api.get('/api/risk/daily-status'),
};

export const psychologyApi = {
  getAll: () => api.get('/api/psychology'),
  create: (data: Record<string, unknown>) => api.post('/api/psychology', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/psychology/${id}`, data),
  delete: (id: string) => api.delete(`/api/psychology/${id}`),
  getMindsetChart: () => api.get('/api/psychology/mindset-chart'),
};

export const playbookApi = {
  getAll: () => api.get('/api/playbook'),
  create: (data: Record<string, unknown>) => api.post('/api/playbook', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/playbook/${id}`, data),
  delete: (id: string) => api.delete(`/api/playbook/${id}`),
};

export const journalApi = {
  getAll: () => api.get('/api/journal'),
  getById: (id: string) => api.get(`/api/journal/${id}`),
  create: (data: Record<string, unknown>) => api.post('/api/journal', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/api/journal/${id}`, data),
  delete: (id: string) => api.delete(`/api/journal/${id}`),
};

export const marketDataApi = {
  getChart: (symbol: string, interval: string, range: string) =>
    api.get<Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>(
      `/api/market-data/chart?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
    ),
};

```

## File: backend/src/routes/ai.ts
```ts
import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../services/supabase';
import {
  analyzeChartImage,
  analyzeIndividualTrade,
  analyzePatterns,
  generateWeeklyReport,
  generatePsychologyReport,
  compareTradeToPlaybook,
  answerFlyxaQuestion,
} from '../services/claude';
import { AuthenticatedRequest, Trade } from '../types/index';

const router = Router();

function getFocusImageLabel(file: Express.Multer.File, index: number): string {
  const name = file.originalname || '';
  const match = name.match(/^(header-focus|trade-box-focus|entry-window-focus|exit-path-focus|price-label-focus|entry-label-focus|stop-label-focus|target-label-focus)-/i);
  return match ? match[1].toLowerCase() : `focus_${index + 1}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10mb
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /flyxa-chat
router.post('/flyxa-chat', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const question = typeof req.body.question === 'string' ? req.body.question : '';
    const history = Array.isArray(req.body.history)
      ? req.body.history
          .filter((message: unknown): message is { role: 'user' | 'assistant'; content: string } => (
            !!message &&
            typeof message === 'object' &&
            ('role' in message) &&
            ('content' in message) &&
            ((message as { role?: unknown }).role === 'user' || (message as { role?: unknown }).role === 'assistant') &&
            typeof (message as { content?: unknown }).content === 'string'
          ))
      : [];

    if (!question.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }

    const reply = await answerFlyxaQuestion(question, history);
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

// POST /scan â€” analyze chart image
router.post('/scan', authMiddleware, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'focusImages', maxCount: 8 },
]), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFile = uploadedFiles?.image?.[0];
    const focusImages = uploadedFiles?.focusImages ?? [];

    if (!imageFile) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    const { entryDate, entryTime } = req.body;
    if (!entryDate || !entryTime) {
      res.status(400).json({ error: 'entryDate and entryTime are required' });
      return;
    }

    let scannerContext: Record<string, unknown> | undefined;
    if (typeof req.body.scannerContext === 'string') {
      try {
        scannerContext = JSON.parse(req.body.scannerContext) as Record<string, unknown>;
      } catch {
        scannerContext = undefined;
      }
    }

    const base64Image = imageFile.buffer.toString('base64');
    const mimeType = imageFile.mimetype;
    const focusImagePayloads = focusImages.map((file, index) => ({
      base64Image: file.buffer.toString('base64'),
      mimeType: file.mimetype,
      label: getFocusImageLabel(file, index),
    }));

    const extractedData = await analyzeChartImage(base64Image, mimeType, entryDate, entryTime, focusImagePayloads, scannerContext);
    res.json(extractedData);
  } catch (err) {
    next(err);
  }
});

// POST /trade-analysis/:tradeId
router.post('/trade-analysis/:tradeId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tradeId } = req.params;

    const { data: trade, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .eq('user_id', req.userId!)
      .single();

    if (error || !trade) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    const analysis = await analyzeIndividualTrade(trade as Trade);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

// POST /patterns
router.post('/patterns', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.body;

    let query = supabase
      .from('trades')
      .select('*')
      .eq('user_id', req.userId!)
      .order('trade_date', { ascending: true });

    if (startDate) query = query.gte('trade_date', startDate);
    if (endDate) query = query.lte('trade_date', endDate);

    const { data: trades, error } = await query;
    if (error) throw error;

    if (!trades || trades.length === 0) {
      res.json({ analysis: 'No trades found for the selected period.' });
      return;
    }

    const analysis = await analyzePatterns(trades as Trade[]);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

// POST /weekly-report
router.post('/weekly-report', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { weekStart, weekEnd } = req.body;
    if (!weekStart || !weekEnd) {
      res.status(400).json({ error: 'weekStart and weekEnd are required' });
      return;
    }

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', req.userId!)
      .gte('trade_date', weekStart)
      .lte('trade_date', weekEnd)
      .order('trade_date', { ascending: true });

    if (error) throw error;

    const report = await generateWeeklyReport((trades || []) as Trade[], weekStart, weekEnd);
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /psychology-report
router.post('/psychology-report', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [tradesResult, psychResult] = await Promise.all([
      supabase
        .from('trades')
        .select('*')
        .eq('user_id', req.userId!)
        .order('trade_date', { ascending: true }),
      supabase
        .from('psychology_logs')
        .select('*')
        .eq('user_id', req.userId!)
        .order('date', { ascending: true }),
    ]);

    if (tradesResult.error) throw tradesResult.error;
    if (psychResult.error) throw psychResult.error;

    const report = await generatePsychologyReport(
      (tradesResult.data || []) as Trade[],
      psychResult.data || []
    );
    res.json({ report });
  } catch (err) {
    next(err);
  }
});

// POST /playbook-check/:tradeId
router.post('/playbook-check/:tradeId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { tradeId } = req.params;

    const [tradeResult, playbookResult] = await Promise.all([
      supabase
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .eq('user_id', req.userId!)
        .single(),
      supabase
        .from('playbook_entries')
        .select('*')
        .eq('user_id', req.userId!),
    ]);

    if (tradeResult.error || !tradeResult.data) {
      res.status(404).json({ error: 'Trade not found' });
      return;
    }

    if (playbookResult.error) throw playbookResult.error;

    const analysis = await compareTradeToPlaybook(
      tradeResult.data as Trade,
      playbookResult.data || []
    );
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
});

export default router;

```

## File: backend/src/services/claude.ts
```ts
import Anthropic from '@anthropic-ai/sdk';
import { Trade, ExtractedTradeData } from '../types/index';
import dotenv from 'dotenv';
import { inflateSync } from 'zlib';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';
const MODEL_TEMPERATURE = 0;
const EXIT_CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const MANUAL_READING_PROCESS = `Read the chart in this exact order:

0. If the screenshot contains more than one chart or comparison pane, ONLY analyse the chart that contains the colored risk/reward box. Ignore every other chart, even if it shows correlated price action.

1. Read the symbol and timeframe from the top-left label of the chart that contains the risk/reward box.
   - The timeframe is the small interval value immediately beside the symbol/ticker in the top-left TradingView header.
   - Example: "MNQM6 Â· 1 Â· CME" means timeframe_minutes = 1.
   - Example: "NQ1! Â· 5" means timeframe_minutes = 5.
   - Use the header number/text next to the ticker only.
   - Do NOT infer timeframe from candle spacing, the x-axis, how long the trade lasts, or how many candles fit on screen.
   - If the header uses hour notation like 1H or 4H, convert it to minutes.

2. Identify the P&L box: the semi-transparent overlay of TWO colored zones on the chart.
   - TEAL (mint/cyan green) zone = profit target area
   - PINK (light red/rose) zone = stop loss risk area

3. CRITICAL â€” Identify the three price levels attached to the P&L box boundaries:
   - GREY pill/box label on the right-side price axis = entry price. On the right axis you will see several colored pill-shaped labels: a GREEN one (live price â€” ignore it), a RED one (stop loss), and a GREY one (entry). The GREY pill label is at the boundary between the pink and teal zones. Read the number printed inside that grey pill exactly â€” it is the entry price. Do not read axis gridline text, do not interpolate between gridlines. The grey pill label is the same style as the red and green pills, just grey colored.
   - RED label on the right-side price axis = stop loss (the OUTERMOST far edge of the pink zone â€” the edge furthest from entry, NOT any intermediate level inside the pink zone).
   - The TAKE PROFIT is the OUTERMOST far edge of the teal zone (the edge furthest from entry).

   HOW TO FIND THE TAKE PROFIT:
   a. Locate the teal box. Find its ABSOLUTE outermost edge (top edge for Long, bottom edge for Short). That is the TP level â€” it is the boundary where the teal box ends.
   b. Trace that outermost edge horizontally to the right-axis price scale to read the price.
   c. IGNORE any dashed lines, horizontal lines, or colored markers drawn INSIDE the teal box body â€” those are NOT the TP. The TP is only at the outermost boundary of the teal box itself.
   d. IGNORE any horizontal lines drawn on the chart that cross the chart area but do not coincide with the actual outer edge of the teal box.
   e. There may be a small teal/green label AT THAT OUTERMOST EDGE â€” use it if visible.
   f. NEVER use the live/current-price label as the TP. The live price label is the topmost or bottom-most floating green label that shows the most recent market price â€” it is NOT attached to the P&L box and will be at a very different price from the teal box edge. If a green label is far outside the P&L box range, it is the live price â€” ignore it.
   g. If target-label-focus is attached, that crop is centered on the TP level. If you see a green label aligned with the teal box OUTER edge in that crop, use it as tp_price even if it resembles the live/current-price label.

4. Confirm direction from box layout:
   - Long: teal zone ABOVE entry, pink zone BELOW entry â†’ tp_price > entry_price
   - Short: pink zone ABOVE entry, teal zone BELOW entry â†’ tp_price < entry_price
   If your identified tp_price is outside the visible teal box, you have the wrong label â€” re-read step 3.
   If tp_price equals an intermediate level inside the teal zone rather than its outermost edge, you have the wrong label â€” re-read step 3.

5. Read the entry time from the x-axis using the left edge of the P&L box.
6. Starting at the entry candle, move candle by candle to decide whether stop loss or take profit is touched first.
7. Count candles to the exit candle and calculate trade_length_seconds from the timeframe.

Do not invent labels that are not visible. Prefer the single most likely journal-ready answer.
Never use a second chart pane to decide exit order for the primary trade.`;
const FIRST_TOUCH_RULE = `The first touch decides the outcome.
- Stop scanning as soon as either stop loss or take profit is hit.
- Ignore any later move after the first touch.
- If price hits stop first and later reaches target, the correct result is still SL.
- If price hits target first and later reaches stop, the correct result is still TP.
- Sanity check: the exit candle must actually reach the exact TP or SL price level within its high/low. If no candle within the trade window has a wick that reaches the TP level, the outcome is SL (or inconclusive) â€” do not claim TP was hit unless a candle clearly reaches that price.`;

type ExitConfidence = typeof EXIT_CONFIDENCE_VALUES[number];
type ImageMimeType = typeof VALID_MIME_TYPES[number];

interface ChartImageInput {
  base64Image: string;
  mimeType: ImageMimeType;
  label: string;
}

interface ExitVerificationResult {
  exit_reason: 'TP' | 'SL' | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_confidence: ExitConfidence | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
}

interface LevelTouchSanityResult {
  stop_touched: boolean | null;
  target_touched: boolean | null;
  first_touch: 'TP' | 'SL' | null;
  evidence: string | null;
}

interface ExactPriceRead {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
}

interface HeaderIdentityRead {
  symbol: string | null;
  timeframe_minutes: number | null;
}

interface ScannerContext {
  direction_hint?: 'Long' | 'Short';
  chart_left_ratio?: number;
  chart_right_ratio?: number;
  box_left_ratio?: number;
  box_right_ratio?: number;
  entry_line_ratio?: number;
  stop_line_ratio?: number;
  target_line_ratio?: number;
  red_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
  green_box?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

interface DecodedImageData {
  width: number;
  height: number;
  data: Uint8Array;
}

interface DeterministicExitCheck {
  exit_reason: 'TP' | 'SL' | null;
  evidence: string | null;
}

function parseJsonObject(rawText: string): Record<string, unknown> {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngImage(base64Image: string): DecodedImageData | null {
  const buffer = Buffer.from(base64Image, 'base64');
  const signature = '89504e470d0a1a0a';

  if (buffer.length < 8 || buffer.subarray(0, 8).toString('hex') !== signature) {
    return null;
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlaceMethod = 0;
  const idatChunks: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkLength;

    if (chunkDataEnd + 4 > buffer.length) {
      return null;
    }

    const chunkData = buffer.subarray(chunkDataStart, chunkDataEnd);

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
      interlaceMethod = chunkData[12];
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = chunkDataEnd + 4;
  }

  if (!width || !height || bitDepth !== 8 || interlaceMethod !== 0 || ![2, 6].includes(colorType) || idatChunks.length === 0) {
    return null;
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));

  if (inflated.length < height * (stride + 1)) {
    return null;
  }

  const raw = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y++) {
    const filterType = inflated[inputOffset++];
    const rowStart = y * stride;

    for (let x = 0; x < stride; x++) {
      const rawByte = inflated[inputOffset++];
      const left = x >= bytesPerPixel ? raw[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[rowStart + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[rowStart + x - stride - bytesPerPixel] : 0;

      let value = rawByte;
      if (filterType === 1) value = (rawByte + left) & 0xff;
      else if (filterType === 2) value = (rawByte + up) & 0xff;
      else if (filterType === 3) value = (rawByte + Math.floor((left + up) / 2)) & 0xff;
      else if (filterType === 4) value = (rawByte + paethPredictor(left, up, upLeft)) & 0xff;

      raw[rowStart + x] = value;
    }
  }

  if (colorType === 6) {
    return {
      width,
      height,
      data: new Uint8Array(raw),
    };
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
    rgba[j] = raw[i];
    rgba[j + 1] = raw[i + 1];
    rgba[j + 2] = raw[i + 2];
    rgba[j + 3] = 255;
  }

  return { width, height, data: rgba };
}

function isDarkPricePixel(r: number, g: number, b: number, a: number): boolean {
  return a > 180 && r < 120 && g < 120 && b < 120;
}

function getColumnPriceExtents(
  data: Uint8Array,
  width: number,
  x: number,
  yStart: number,
  yEnd: number
): { minY: number; maxY: number } | null {
  const runs: Array<{ start: number; end: number }> = [];
  let runStart: number | null = null;

  for (let y = yStart; y < yEnd; y++) {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    const isDark = isDarkPricePixel(r, g, b, a);

    if (isDark && runStart === null) {
      runStart = y;
      continue;
    }

    if (!isDark && runStart !== null) {
      if (y - runStart >= 3) {
        runs.push({ start: runStart, end: y - 1 });
      }
      runStart = null;
    }
  }

  if (runStart !== null && yEnd - runStart >= 3) {
    runs.push({ start: runStart, end: yEnd - 1 });
  }

  if (!runs.length) {
    return null;
  }

  return {
    minY: Math.min(...runs.map(run => run.start)),
    maxY: Math.max(...runs.map(run => run.end)),
  };
}

function detectDeterministicExitFromDecodedImage(
  image: DecodedImageData | null,
  scannerContext?: ScannerContext
): DeterministicExitCheck | null {
  const context = scannerContext;
  if (
    !image ||
    !context ||
    context.stop_line_ratio === undefined ||
    context.target_line_ratio === undefined ||
    context.box_left_ratio === undefined
  ) {
    return null;
  }

  const { width, height, data } = image;
  const inferredDirection =
    context.direction_hint ??
    (context.stop_line_ratio < context.target_line_ratio ? 'Short' : 'Long');
  const searchStartX = Math.max(0, Math.floor(width * context.box_left_ratio) + 2);
  const searchEndX = Math.max(searchStartX + 1, Math.floor(width * 0.88));
  const searchMinY = Math.floor(height * 0.08);
  const searchMaxY = Math.floor(height * 0.92);
  const stopY = Math.floor(height * context.stop_line_ratio);
  const targetY = Math.floor(height * context.target_line_ratio);
  const tolerance = 2;

  let firstStopX: number | null = null;
  let firstTargetX: number | null = null;

  for (let x = searchStartX; x < searchEndX; x++) {
    const columnExtents = getColumnPriceExtents(data, width, x, searchMinY, searchMaxY);
    if (!columnExtents) {
      continue;
    }

    const { minY: columnMinY, maxY: columnMaxY } = columnExtents;
    if (inferredDirection === 'Short') {
      if (firstStopX === null && columnMinY <= stopY + tolerance) {
        firstStopX = x;
      }
      if (firstTargetX === null && columnMaxY >= targetY - tolerance) {
        firstTargetX = x;
      }
    } else {
      if (firstStopX === null && columnMaxY >= stopY - tolerance) {
        firstStopX = x;
      }
      if (firstTargetX === null && columnMinY <= targetY + tolerance) {
        firstTargetX = x;
      }
    }
  }

  if (firstStopX === null && firstTargetX === null) {
    return null;
  }

  if (firstStopX !== null && firstTargetX === null) {
    return {
      exit_reason: 'SL',
      evidence: 'Price reached the stop-loss level before the take-profit level.',
    };
  }

  if (firstTargetX !== null && firstStopX === null) {
    return {
      exit_reason: 'TP',
      evidence: 'Price reached the take-profit level before the stop-loss level.',
    };
  }

  if (firstStopX !== null && firstTargetX !== null) {
    if (Math.abs(firstStopX - firstTargetX) <= 3) {
      return null;
    }

    const stopFirst = firstStopX < firstTargetX;
    return {
      exit_reason: stopFirst ? 'SL' : 'TP',
      evidence: stopFirst
        ? 'Price touched the stop-loss before the take-profit.'
        : 'Price touched the take-profit before the stop-loss.',
    };
  }

  return null;
}

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function normalizeScannedSymbol(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase().trim();
  const cleaned = normalized
    .replace(/[|:,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rootCleaned = cleaned.replace(/[FGHJKMNQUVXZ]\d{1,2}$/i, '');
  const invalidValues = new Set([
    'UNKNOWN',
    'UNKWN',
    'N/A',
    'NA',
    'NONE',
    'NULL',
    'FUTURES',
    'MICRO',
    'E-MINI',
    'EMINI',
    'MICRO FUTURES',
    'NASDAQ FUTURES',
    'S&P FUTURES',
    'TRADINGVIEW',
  ]);

  if (invalidValues.has(rootCleaned)) {
    return null;
  }

  const explicitTickerPatterns: Array<[RegExp, string]> = [
    [/\bMNQ[A-Z]?\d{1,2}\b/, 'MNQ'],
    [/\bMES[A-Z]?\d{1,2}\b/, 'MES'],
    [/\bMYM[A-Z]?\d{1,2}\b/, 'MYM'],
    [/\bM2K[A-Z]?\d{1,2}\b/, 'M2K'],
    [/\bMCL[A-Z]?\d{1,2}\b/, 'MCL'],
    [/\bMGC[A-Z]?\d{1,2}\b/, 'MGC'],
    [/\bMBT[A-Z]?\d{1,2}\b/, 'MBT'],
    [/\bMET[A-Z]?\d{1,2}\b/, 'MET'],
    [/\bNQ[A-Z]?\d{1,2}\b/, 'NQ'],
    [/\bES[A-Z]?\d{1,2}\b/, 'ES'],
    [/\bYM[A-Z]?\d{1,2}\b/, 'YM'],
    [/\bRTY[A-Z]?\d{1,2}\b/, 'RTY'],
    [/\bCL[A-Z]?\d{1,2}\b/, 'CL'],
    [/\bGC[A-Z]?\d{1,2}\b/, 'GC'],
    [/\bSI[A-Z]?\d{1,2}\b/, 'SI'],
    [/\bZB[A-Z]?\d{1,2}\b/, 'ZB'],
    [/\bZN[A-Z]?\d{1,2}\b/, 'ZN'],
    [/\bZF[A-Z]?\d{1,2}\b/, 'ZF'],
    [/\b6E[A-Z]?\d{1,2}\b/, '6E'],
    [/\b6B[A-Z]?\d{1,2}\b/, '6B'],
    [/\b6J[A-Z]?\d{1,2}\b/, '6J'],
    [/\bBTC[A-Z]?\d{0,2}\b/, 'BTC'],
    [/\bETH[A-Z]?\d{0,2}\b/, 'ETH'],
  ];

  for (const [pattern, ticker] of explicitTickerPatterns) {
    if (pattern.test(cleaned)) {
      return ticker;
    }
  }

  if (cleaned.includes('MICRO NASDAQ') || cleaned.includes('MICRO E-MINI NASDAQ') || cleaned.includes('MICRO NASDAQ-100')) {
    return 'MNQ';
  }

  if (cleaned.includes('NASDAQ')) {
    return cleaned.includes('MICRO') ? 'MNQ' : 'NQ';
  }

  if (cleaned.includes('MICRO S&P') || cleaned.includes('MICRO SP')) {
    return 'MES';
  }

  if (cleaned.includes('S&P') || cleaned.includes('SP 500') || cleaned.includes('E-MINI S&P') || cleaned.includes('E MINI S&P')) {
    return cleaned.includes('MICRO') ? 'MES' : 'ES';
  }

  return invalidValues.has(rootCleaned) ? null : rootCleaned;
}

function parseNullableTime(value: unknown): string | null {
  const normalized = parseNullableString(value);
  return normalized && /^\d{2}:\d{2}$/.test(normalized) ? normalized : null;
}

function parseNullableDirection(value: unknown): 'Long' | 'Short' | null {
  return value === 'Long' || value === 'Short' ? value : null;
}

function parseNullableExitReason(value: unknown): 'TP' | 'SL' | null {
  return value === 'TP' || value === 'SL' ? value : null;
}

function parseNullablePnLResult(value: unknown): 'Win' | 'Loss' | null {
  return value === 'Win' || value === 'Loss' ? value : null;
}

function parseNullableExitConfidence(value: unknown): ExitConfidence | null {
  return typeof value === 'string' && EXIT_CONFIDENCE_VALUES.includes(value as ExitConfidence)
    ? (value as ExitConfidence)
    : null;
}

function parseNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function pickFirstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function appendWarning(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

function buildEntryTimeHint(extractedEntryTime: string | null): string {
  return extractedEntryTime
    ? `Use the screenshot's entry time of ${extractedEntryTime} only if it matches the x-axis.`
    : 'Do not use any fallback clock time to decide the outcome. Read the entry candle from the left edge of the risk/reward box on the screenshot.';
}

function formatScannerContext(scannerContext?: ScannerContext): string {
  if (!scannerContext) {
    return 'No geometric trade-box detection metadata was available.';
  }

  return `Detected trade-box geometry from image processing:
- direction_hint: ${scannerContext.direction_hint ?? 'unknown'}
- chart_left_ratio: ${scannerContext.chart_left_ratio ?? 'unknown'}
- chart_right_ratio: ${scannerContext.chart_right_ratio ?? 'unknown'}
- box_left_ratio: ${scannerContext.box_left_ratio ?? 'unknown'}
- box_right_ratio: ${scannerContext.box_right_ratio ?? 'unknown'}
- entry_line_ratio: ${scannerContext.entry_line_ratio ?? 'unknown'}
- stop_line_ratio: ${scannerContext.stop_line_ratio ?? 'unknown'}
- target_line_ratio: ${scannerContext.target_line_ratio ?? 'unknown'}
- red_box: ${scannerContext.red_box ? JSON.stringify(scannerContext.red_box) : 'unknown'}
- green_box: ${scannerContext.green_box ? JSON.stringify(scannerContext.green_box) : 'unknown'}

Use this geometry as a strong anchor for which chart pane contains the trade, where the risk/reward box starts, and whether the setup is long or short.`;
}

function describeImageLabel(label: string): string {
  switch (label) {
    case 'full_chart':
      return 'the full chart for overall candle sequence, x-axis timing, and confirmation';
    case 'header-focus':
      return 'a zoomed crop of the top-left chart header for symbol and timeframe; the timeframe is the interval immediately beside the ticker';
    case 'trade-box-focus':
      return 'a zoomed crop around the trade box for direction, entry edge, and price movement';
    case 'entry-window-focus':
      return 'a tight crop around the left edge of the trade box and the first candles after entry; use this as the primary first-touch view';
    case 'exit-path-focus':
      return 'a focused crop covering the immediate candles after entry and the full path to the first likely exit touch';
    case 'price-label-focus':
      return 'a zoomed crop of the right-side price labels; use this for the exact entry, stop, and target numbers';
    case 'entry-label-focus':
      return 'a tight crop centered on the entry price label; use this as the primary source for entry_price';
    case 'stop-label-focus':
      return 'a tight crop centered on the stop-loss label; use this as the primary source for sl_price';
    case 'target-label-focus':
      return 'a tight crop centered on the take-profit label; use this as the primary source for tp_price';
    default:
      return 'an additional focused crop of the chart';
  }
}

function selectImagesByLabels(images: ChartImageInput[], labels: string[]): ChartImageInput[] {
  const allowedLabels = new Set(labels);
  const selected = images.filter(image => allowedLabels.has(image.label));

  if (selected.length > 0) {
    return selected;
  }

  return images.filter(image => image.label === 'full_chart');
}

function hasValidLevelStructure(direction: 'Long' | 'Short' | null, entry: number | null, stop: number | null, target: number | null): boolean {
  if (!direction || entry === null || stop === null || target === null) {
    return false;
  }

  return direction === 'Long'
    ? stop < entry && entry < target
    : target < entry && entry < stop;
}

function normalizeExitConfidence(...values: Array<ExitConfidence | null>): ExitConfidence | null {
  if (values.includes('high')) return 'high';
  if (values.includes('medium')) return 'medium';
  if (values.includes('low')) return 'low';
  return null;
}

function pickMostCommonString<T extends string>(...values: Array<T | null | undefined>): T | null {
  const counts = new Map<T, number>();

  values.forEach(value => {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: T | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function countVotes(...values: Array<'TP' | 'SL' | null>): { TP: number; SL: number } {
  return values.reduce((acc, value) => {
    if (value === 'TP' || value === 'SL') {
      acc[value] += 1;
    }
    return acc;
  }, { TP: 0, SL: 0 });
}

function pickMostCommonNumber(...values: Array<number | null>): number | null {
  const counts = new Map<number, number>();

  values.forEach(value => {
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  });

  let bestValue: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function chooseConsensusNumber(...values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (normalized.length === 0) {
    return null;
  }

  const mostCommon = pickMostCommonNumber(...normalized);
  if (mostCommon !== null) {
    return mostCommon;
  }

  const sorted = [...normalized].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function inferDirectionFromLevels(entry: number | null, stop: number | null, target: number | null): 'Long' | 'Short' | null {
  if (entry === null || stop === null || target === null) {
    return null;
  }

  if (stop < entry && entry < target) {
    return 'Long';
  }

  if (target < entry && entry < stop) {
    return 'Short';
  }

  return null;
}

function uniqueNumbers(values: Array<number | null | undefined>): number[] {
  return Array.from(
    new Set(
      values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    )
  );
}

function repairTradeStructure(
  direction: 'Long' | 'Short' | null,
  entry: number | null,
  stop: number | null,
  target: number | null,
  labeledCandidates: {
    entries: Array<number | null | undefined>;
    stops: Array<number | null | undefined>;
    targets: Array<number | null | undefined>;
  }
): {
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  sl_price: number | null;
  tp_price: number | null;
} {
  const resolvedDirection = direction ?? inferDirectionFromLevels(entry, stop, target);

  if (hasValidLevelStructure(resolvedDirection, entry, stop, target)) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const entryCandidates = uniqueNumbers(labeledCandidates.entries);
  const stopCandidates = uniqueNumbers(labeledCandidates.stops);
  const targetCandidates = uniqueNumbers(labeledCandidates.targets);
  const allCandidates = uniqueNumbers([...entryCandidates, ...stopCandidates, ...targetCandidates]);

  if (!resolvedDirection || allCandidates.length < 3) {
    return {
      direction: resolvedDirection,
      entry_price: entry,
      sl_price: stop,
      tp_price: target,
    };
  }

  const sortedAll = [...allCandidates].sort((a, b) => a - b);
  const minCandidate = sortedAll[0];
  const maxCandidate = sortedAll[sortedAll.length - 1];
  const interiorCandidates = sortedAll.filter(value => value > minCandidate && value < maxCandidate);

  const preferredEntry = chooseConsensusNumber(entry, ...entryCandidates);
  const preferredStop = chooseConsensusNumber(stop, ...stopCandidates);
  const preferredTarget = chooseConsensusNumber(target, ...targetCandidates);

  if (resolvedDirection === 'Long') {
    const repairedStop = stopCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredStop ?? minCandidate;
    const repairedTarget = [...targetCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredTarget ?? maxCandidate;
    const repairedEntry = entryCandidates.find(value => value > repairedStop && value < repairedTarget)
      ?? preferredEntry
      ?? interiorCandidates[0]
      ?? sortedAll[Math.floor(sortedAll.length / 2)];

    return {
      direction: 'Long',
      entry_price: repairedEntry,
      sl_price: repairedStop,
      tp_price: repairedTarget,
    };
  }

  const repairedStop = [...stopCandidates].reverse().find(value => value > (preferredEntry ?? Number.NEGATIVE_INFINITY)) ?? preferredStop ?? maxCandidate;
  const repairedTarget = targetCandidates.find(value => value < (preferredEntry ?? Number.POSITIVE_INFINITY)) ?? preferredTarget ?? minCandidate;
  const repairedEntry = entryCandidates.find(value => value > repairedTarget && value < repairedStop)
    ?? preferredEntry
    ?? interiorCandidates[interiorCandidates.length - 1]
    ?? sortedAll[Math.floor(sortedAll.length / 2)];

  return {
    direction: 'Short',
    entry_price: repairedEntry,
    sl_price: repairedStop,
    tp_price: repairedTarget,
  };
}

function clearExitOutcome(data: ExtractedTradeData): void {
  data.exit_reason = null;
  data.pnl_result = null;
  data.trade_length_seconds = null;
  data.candle_count = null;
  data.exit_confidence = null;
  data.first_touch_candle_index = null;
  data.first_touch_evidence = null;
}

function sanitizeExtractedTradeData(raw: Record<string, unknown>): ExtractedTradeData {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    : [];

  const data: ExtractedTradeData = {
    symbol: parseNullableString(raw.symbol),
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    entry_time: parseNullableTime(raw.entry_time),
    entry_time_confidence: parseNullableExitConfidence(raw.entry_time_confidence),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
    trade_length_seconds: parseNullableNumber(raw.trade_length_seconds),
    candle_count: parseNullableNumber(raw.candle_count),
    timeframe_minutes: parseNullableNumber(raw.timeframe_minutes),
    exit_reason: parseNullableExitReason(raw.exit_reason),
    pnl_result: parseNullablePnLResult(raw.pnl_result),
    exit_confidence: parseNullableExitConfidence(raw.exit_confidence),
    first_touch_candle_index: parseNullableNumber(raw.first_touch_candle_index),
    first_touch_evidence: parseNullableString(raw.first_touch_evidence),
    warnings,
  };

  if (data.symbol) {
    data.symbol = normalizeScannedSymbol(data.symbol);
  }

  if (data.exit_reason !== null) {
    data.pnl_result = data.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return data;
}

function sanitizeExactPriceRead(raw: Record<string, unknown>): ExactPriceRead {
  return {
    direction: parseNullableDirection(raw.direction),
    entry_price: parseNullableNumber(raw.entry_price),
    sl_price: parseNullableNumber(raw.sl_price),
    tp_price: parseNullableNumber(raw.tp_price),
  };
}

function sanitizeHeaderIdentityRead(raw: Record<string, unknown>): HeaderIdentityRead {
  return {
    symbol: normalizeScannedSymbol(parseNullableString(raw.symbol)),
    timeframe_minutes: parseNullableNumber(raw.timeframe_minutes),
  };
}

async function extractHeaderIdentity(images: ChartImageInput[]): Promise<HeaderIdentityRead> {
  const systemPrompt = `You are reading ONLY the TradingView header of the single chart that contains the colored risk/reward box.

  Read only:
  - the exact futures ticker/root from the top-left chart label
  - the timeframe from the small interval immediately beside the ticker in that same header

Critical symbol rules:
- Return the tradeable root ticker, not generic words
- Good outputs: MNQ, NQ, MES, ES, MYM, YM, M2K, RTY, CL, MCL, GC, MGC, SI, SIL, 6E, 6B, 6J, BTC, MBT, ETH, MET
- If the header shows an expiry code like MNQM26 or NQU6, return the root ticker only: MNQ or NQ
- If the header says Micro Nasdaq-100 or Micro E-mini Nasdaq-100, return MNQ
- If the header says E-mini Nasdaq-100, return NQ
- NEVER return generic words like Futures, Micro, E-mini, CME, CBOT, or TradingView as the symbol

Critical timeframe rules:
- Read the timeframe ONLY from the interval shown immediately beside the ticker/root in the top-left header
- Example: "MNQM6 Â· 1 Â· CME" => timeframe_minutes = 1
- Example: "NQ1! Â· 5" => timeframe_minutes = 5
- Example: "ES1! Â· 15" => timeframe_minutes = 15
- Do NOT estimate timeframe from candle width, chart zoom, x-axis spacing, or trade duration
- Return timeframe_minutes as a number in minutes only

Return ONLY a raw JSON object with these exact keys:
symbol, timeframe_minutes`;

  return sanitizeHeaderIdentityRead(await callClaudeJson(
    systemPrompt,
    images,
    'Read only the instrument ticker/root and the timeframe interval printed immediately beside it in the header of the chart containing the colored risk/reward box.',
    250
  ));
}

async function extractExactPriceLevels(
  images: ChartImageInput[],
  scannerContext?: ScannerContext
): Promise<ExactPriceRead> {
  const systemPrompt = `You are reading ONLY the exact three price labels from TradingView risk/reward screenshots.
${MANUAL_READING_PROCESS}

Focus on price labels only:
- entry-label-focus is the primary source for entry_price
- stop-label-focus is the primary source for sl_price
- target-label-focus is the primary source for tp_price
- price-label-focus is the secondary source if one tight crop is slightly unclear
- trade-box-focus and full_chart are only for confirming long vs short and which label belongs to the box
- If a second chart exists in the screenshot, ignore it completely unless it is the one containing the colored risk/reward box

Critical rules:
- Read the numbers printed inside the pill labels exactly
- Do not round
- Do not use nearby gridline text
- Do not use unrelated horizontal drawing lines
- The grey entry label can be lower-contrast than the red and green labels; still use the printed grey pill value
- If the green target label is centered in target-label-focus and aligns with the OUTERMOST teal box edge, treat it as tp_price even if it resembles a current-price label
- If there are dashed lines, colored markers, or intermediate green labels INSIDE the body of the teal zone (between entry and the outer edge), they are NOT the TP â€” ignore them and use only the label at the absolute outer boundary of the teal box
- Similarly, if there are multiple red labels visible, only use the one at the outermost edge of the pink zone (furthest from entry) as sl_price; ignore any intermediate red labels inside the pink zone

Return ONLY a raw JSON object with these exact keys:
direction, entry_price, sl_price, tp_price`;

  return sanitizeExactPriceRead(await callClaudeJson(
    systemPrompt,
    images,
    `${formatScannerContext(scannerContext)} Read only the exact entry, stop-loss, and take-profit prices from these focused chart crops.`,
    500
  ));
}

function applyExactPriceRead(base: ExtractedTradeData, exactPriceRead: ExactPriceRead | null): ExtractedTradeData {
  if (!exactPriceRead) {
    return base;
  }

  const exactValueCount = [
    exactPriceRead.entry_price,
    exactPriceRead.sl_price,
    exactPriceRead.tp_price,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value)).length;

  if (exactValueCount < 2) {
    return base;
  }

  const repairedStructure = repairTradeStructure(
    pickMostCommonString(exactPriceRead.direction, base.direction),
    chooseConsensusNumber(exactPriceRead.entry_price, base.entry_price),
    chooseConsensusNumber(exactPriceRead.sl_price, base.sl_price),
    chooseConsensusNumber(exactPriceRead.tp_price, base.tp_price),
    {
      entries: [exactPriceRead.entry_price, base.entry_price],
      stops: [exactPriceRead.sl_price, base.sl_price],
      targets: [exactPriceRead.tp_price, base.tp_price],
    }
  );

  return {
    ...base,
    direction: repairedStructure.direction ?? base.direction,
    entry_price: repairedStructure.entry_price ?? base.entry_price,
    sl_price: repairedStructure.sl_price ?? base.sl_price,
    tp_price: repairedStructure.tp_price ?? base.tp_price,
  };
}

function applyHeaderIdentityRead(base: ExtractedTradeData, headerIdentityRead: HeaderIdentityRead | null): ExtractedTradeData {
  if (!headerIdentityRead) {
    return base;
  }

  return {
    ...base,
    symbol: headerIdentityRead.symbol ?? base.symbol,
    timeframe_minutes: headerIdentityRead.timeframe_minutes ?? base.timeframe_minutes,
  };
}

async function callClaudeJson(
  system: string,
  images: ChartImageInput[],
  userText: string,
  maxTokens = 1024
): Promise<Record<string, unknown>> {
  const imageContent = images.map(image => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: image.mimeType,
      data: image.base64Image,
    },
  }));

  const imageGuide = images
    .map((image, index) => `Image ${index + 1} (${image.label}): ${describeImageLabel(image.label)}`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: 'user',
        content: [
          ...imageContent,
          {
            type: 'text',
            text: `${userText}\n\nAttached views:\n${imageGuide}`,
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseJsonObject(content.text.trim());
}

async function extractTradeFacts(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const systemPrompt = `You are a futures trade data extractor analysing TradingView screenshots with a risk/reward box.
${MANUAL_READING_PROCESS}

Read these facts directly from the screenshot:
- symbol
- direction
- entry_price
- entry_time
- sl_price
- tp_price
- timeframe_minutes

Symbol rules:
- Read the symbol from the top-left chart label only
- Return the tradable root ticker such as MNQ, NQ, MES, ES, MYM, YM, M2K, RTY, CL, MCL, GC, MGC, SI, SIL, 6E, 6B, 6J, BTC, MBT, ETH, MET
- If the header shows an expiry code like MNQM26 or NQU6, return MNQ or NQ
- Never return generic words like Futures, Micro, E-mini, CME, CBOT, or TradingView as the symbol

Timeframe rules:
- Read timeframe_minutes from the top-left header only
- The timeframe is the interval value printed immediately beside the symbol/ticker
- Example: "MNQM6 Â· 1 Â· CME" means timeframe_minutes = 1
- Do not infer timeframe from the x-axis, candle spacing, zoom level, or trade duration

Never estimate price labels. Read the exact numbers shown on the right axis labels.
If entry-label-focus, stop-label-focus, or target-label-focus are attached, use those as the primary source for the exact prices.
If entry time is not clearly readable, return null for entry_time and low or null confidence.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count

Rules for these extra fields:
- You may include exit_reason, pnl_result, trade_length_seconds, candle_count if the chart is clear.
- If unclear, return null for them.
- exit_reason must be TP or SL only if you can visibly determine which was touched first.`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    systemPrompt,
    images,
    `Trade date: ${entryDate}. Fallback entry time hint if the x-axis is unclear: ${fallbackEntryTime}. ${formatScannerContext(scannerContext)} Extract the trade facts from this screenshot.`,
    1100
  ));
}

async function verifyExitOrder(
  images: ChartImageInput[],
  entryDate: string,
  extraction: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExitVerificationResult> {
  const verificationPrompt = `You are verifying which fixed level is hit first in a futures trade screenshot.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use these fixed trade details as ground truth:
- Direction: ${extraction.direction}
- Entry price: ${extraction.entry_price}
- Entry time from screenshot if visible: ${extraction.entry_time ?? 'unknown'}
- Stop loss: ${extraction.sl_price}
- Take profit: ${extraction.tp_price}

Use only the screenshot itself.
Use the candle aligned with the left edge of the risk/reward box as the entry candle.
Scan forward candle by candle from the entry candle.
If multiple charts are visible in any crop, ONLY use the chart containing the colored risk/reward box and ignore the comparison chart.
Before deciding exit_reason, explicitly identify:
- which candle is the entry candle
- which candle is the first candle to touch either stop or target
- which exact level that first-touch candle reaches first

Rules:
- For LONG: if any candle low touches or breaks the stop before any candle high touches or breaks the target, exit_reason = SL.
- For LONG: if any candle high touches or breaks the target before any candle low touches or breaks the stop, exit_reason = TP.
- For SHORT: if any candle high touches or breaks the stop before any candle low touches or breaks the target, exit_reason = SL.
- For SHORT: if any candle low touches or breaks the target before any candle high touches or breaks the stop, exit_reason = TP.
- If both levels are touched in the same candle, return the level that is more visually likely to have been hit first.
- Only use null if the chart is too unclear to make a reasonable decision.
- candle_count must include the exit candle.
- trade_length_seconds = candle_count x timeframe_minutes x 60.
- first_touch_evidence must mention the first move that ends the trade, not the later continuation.

Return ONLY a raw JSON object with these exact keys:
exit_reason, trade_length_seconds, candle_count, timeframe_minutes, exit_confidence, first_touch_candle_index, first_touch_evidence

Valid values:
- exit_reason: "TP", "SL", or null
- exit_confidence: "high", "medium", "low", or null
- first_touch_evidence: one short sentence or null

The evidence sentence must mention the entry anchor and the first candle that ends the trade.`;

  const parsed = await callClaudeJson(
    verificationPrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(extraction.entry_time)} Verify which level hits first from the screenshot.`,
    800
  );

  return {
    exit_reason: parseNullableExitReason(parsed.exit_reason),
    trade_length_seconds: parseNullableNumber(parsed.trade_length_seconds),
    candle_count: parseNullableNumber(parsed.candle_count),
    timeframe_minutes: parseNullableNumber(parsed.timeframe_minutes),
    exit_confidence: parseNullableExitConfidence(parsed.exit_confidence),
    first_touch_candle_index: parseNullableNumber(parsed.first_touch_candle_index),
    first_touch_evidence: parseNullableString(parsed.first_touch_evidence),
  };
}

async function sanityCheckLevelTouches(
  images: ChartImageInput[],
  entryDate: string,
  extraction: ExtractedTradeData
): Promise<LevelTouchSanityResult> {
  const sanityPrompt = `You are performing a strict sanity check on a futures trade screenshot.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Your only job is to answer these three questions from the chart with the colored risk/reward box:
1. Is the stop-loss level touched at any point after the entry candle?
2. Is the take-profit level touched at any point after the entry candle?
3. Which one is touched first?

Trade details to verify:
- Direction: ${extraction.direction}
- Entry price: ${extraction.entry_price}
- Entry time from chart if visible: ${extraction.entry_time ?? 'unknown'}
- Stop loss: ${extraction.sl_price}
- Take profit: ${extraction.tp_price}

Rules:
- Use only the chart containing the risk/reward box.
- Start from the entry candle aligned with the left edge of the box.
- A level counts as touched only if a candle wick or body clearly reaches that exact level.
- If target is never visibly reached, target_touched must be false.
- If stop is visibly reached before target, first_touch must be SL.
- If target is visibly reached before stop, first_touch must be TP.
- If neither is clearly touched, return null for first_touch.

Return ONLY a raw JSON object with these exact keys:
stop_touched, target_touched, first_touch, evidence`;

  const parsed = await callClaudeJson(
    sanityPrompt,
    images,
    `Trade date: ${entryDate}. Perform only the stop/target touch sanity check for this screenshot.`,
    500
  );

  return {
    stop_touched: parseNullableBoolean(parsed.stop_touched),
    target_touched: parseNullableBoolean(parsed.target_touched),
    first_touch: parseNullableExitReason(parsed.first_touch),
    evidence: parseNullableString(parsed.evidence),
  };
}

async function humanStyleReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const reviewPrompt = `Review this chart exactly like a skilled human trader filling out a trade journal by eye.
${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use only the screenshot itself and read it in this exact order:
1. Read the symbol and timeframe from the top-left label.
   The timeframe is the interval shown immediately beside the ticker in the header.
2. Read entry, stop loss, and take profit from the exact right-axis labels.
3. Infer long or short from the box layout.
4. Read the entry time from the x-axis using the left edge of the risk/reward box.
5. Follow candles from the entry candle until the first touch of stop or target.
6. Count candles to the exit and compute trade_length_seconds.

You should make the most likely decision even when the chart is slightly messy, but do not invent price labels.

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    reviewPrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(null)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Read this chart the same way a human would fill a journal entry.`,
    1200
  ));
}

async function decisiveFinalReview(
  images: ChartImageInput[],
  entryDate: string,
  fallbackEntryTime: string,
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  scannerContext?: ScannerContext
): Promise<ExtractedTradeData> {
  const decisivePrompt = `You are the final decision-maker for a futures trade journal scanner.

Your job is to read the TradingView screenshot exactly the way an experienced trader would manually journal it.
You must return one single best final answer, not an abstention.

${MANUAL_READING_PROCESS}
${FIRST_TOUCH_RULE}

Use header-focus for symbol/timeframe, the three label-focus crops for exact levels, entry-window-focus for the exact entry anchor, and exit-path-focus for the first-touch path after entry.
When deciding timeframe_minutes, trust the header-focus interval immediately beside the ticker over every other clue.
If a comparison chart is visible anywhere, ignore it unless it is the chart with the colored risk/reward box.

If the earlier passes disagree, use them only as hints. The screenshot itself is the source of truth.
Do not return manual review text. Choose the single most likely final interpretation.
Never invent price levels that are not visible on the screenshot. If one field is slightly unclear, use the best supported value from the hints below.

Hint pass 1:
${JSON.stringify({
  symbol: extraction.symbol,
  direction: extraction.direction,
  entry_price: extraction.entry_price,
  entry_time: extraction.entry_time,
  sl_price: extraction.sl_price,
  tp_price: extraction.tp_price,
  timeframe_minutes: extraction.timeframe_minutes,
  exit_reason: extraction.exit_reason,
  trade_length_seconds: extraction.trade_length_seconds,
  candle_count: extraction.candle_count,
}, null, 2)}

Hint pass 2:
${JSON.stringify(verification, null, 2)}

Hint pass 3:
${JSON.stringify({
  symbol: humanReview.symbol,
  direction: humanReview.direction,
  entry_price: humanReview.entry_price,
  entry_time: humanReview.entry_time,
  sl_price: humanReview.sl_price,
  tp_price: humanReview.tp_price,
  timeframe_minutes: humanReview.timeframe_minutes,
  exit_reason: humanReview.exit_reason,
  trade_length_seconds: humanReview.trade_length_seconds,
  candle_count: humanReview.candle_count,
  first_touch_evidence: humanReview.first_touch_evidence,
}, null, 2)}

Return ONLY a raw JSON object with these exact keys:
symbol, direction, entry_price, entry_time, entry_time_confidence, sl_price, tp_price, timeframe_minutes, exit_reason, pnl_result, trade_length_seconds, candle_count, exit_confidence, first_touch_evidence`;

  return sanitizeExtractedTradeData(await callClaudeJson(
    decisivePrompt,
    images,
    `Trade date: ${entryDate}. ${buildEntryTimeHint(extraction.entry_time ?? humanReview.entry_time)} ${formatScannerContext(scannerContext)} Fallback time for the form is ${fallbackEntryTime}, but do not let that override the chart itself. Produce the single best final journal-ready trade analysis from this screenshot.`,
    1400
  ));
}

function resolveExitReason(
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData
): 'TP' | 'SL' | null {
  if (verification.exit_reason && humanReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (verification.exit_reason && decisiveReview.exit_reason === verification.exit_reason) {
    return verification.exit_reason;
  }

  if (humanReview.exit_reason && decisiveReview.exit_reason === humanReview.exit_reason) {
    return humanReview.exit_reason;
  }

  return verification.exit_reason
    ?? humanReview.exit_reason
    ?? decisiveReview.exit_reason
    ?? extraction.exit_reason;
}

function buildManualReaderBase(
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
  ];

  const humanStructureValid = hasValidLevelStructure(
    humanReview.direction,
    humanReview.entry_price,
    humanReview.sl_price,
    humanReview.tp_price
  );
  const extractionStructureValid = hasValidLevelStructure(
    extraction.direction,
    extraction.entry_price,
    extraction.sl_price,
    extraction.tp_price
  );

  const repairedStructure = repairTradeStructure(
    humanReview.direction ?? extraction.direction,
    chooseConsensusNumber(humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(humanReview.tp_price, extraction.tp_price),
    {
      entries: [humanReview.entry_price, extraction.entry_price],
      stops: [humanReview.sl_price, extraction.sl_price],
      targets: [humanReview.tp_price, extraction.tp_price],
    }
  );

  const direction = humanStructureValid
    ? humanReview.direction
    : extractionStructureValid
      ? extraction.direction
      : repairedStructure.direction;
  const entryPrice = humanStructureValid
    ? humanReview.entry_price
    : extractionStructureValid
      ? extraction.entry_price
      : repairedStructure.entry_price;
  const stopPrice = humanStructureValid
    ? humanReview.sl_price
    : extractionStructureValid
      ? extraction.sl_price
      : repairedStructure.sl_price;
  const targetPrice = humanStructureValid
    ? humanReview.tp_price
    : extractionStructureValid
      ? extraction.tp_price
      : repairedStructure.tp_price;

  return {
    symbol: humanReview.symbol ?? extraction.symbol,
    direction,
    entry_price: entryPrice,
    entry_time: humanReview.entry_time ?? extraction.entry_time ?? parseNullableTime(fallbackEntryTime),
    entry_time_confidence: normalizeExitConfidence(humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: stopPrice,
    tp_price: targetPrice,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: humanReview.timeframe_minutes ?? extraction.timeframe_minutes ?? 1,
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };
}

function finalizeManualReaderResult(
  baseRead: ExtractedTradeData,
  verification: ExitVerificationResult,
  extraction: ExtractedTradeData,
  humanReview: ExtractedTradeData
): ExtractedTradeData {
  const exitReason = verification.exit_reason
    ?? humanReview.exit_reason
    ?? extraction.exit_reason
    ?? null;

  return {
    ...baseRead,
    exit_reason: exitReason,
    pnl_result: exitReason === 'TP' ? 'Win' : exitReason === 'SL' ? 'Loss' : null,
    trade_length_seconds: verification.trade_length_seconds
      ?? humanReview.trade_length_seconds
      ?? extraction.trade_length_seconds
      ?? null,
    candle_count: verification.candle_count
      ?? humanReview.candle_count
      ?? extraction.candle_count
      ?? null,
    timeframe_minutes: verification.timeframe_minutes
      ?? baseRead.timeframe_minutes
      ?? null,
    exit_confidence: verification.exit_confidence
      ?? humanReview.exit_confidence
      ?? extraction.exit_confidence
      ?? 'low',
    first_touch_candle_index: verification.first_touch_candle_index
      ?? humanReview.first_touch_candle_index
      ?? extraction.first_touch_candle_index
      ?? null,
    first_touch_evidence: verification.first_touch_evidence
      ?? humanReview.first_touch_evidence
      ?? extraction.first_touch_evidence
      ?? null,
  };
}

function applySanityOverride(
  result: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  if (!sanity) {
    return result;
  }

  const next = { ...result };

  if (sanity.target_touched === false && sanity.stop_touched === true) {
    next.exit_reason = 'SL';
  } else if (sanity.target_touched === true && sanity.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (sanity.first_touch) {
    next.exit_reason = sanity.first_touch;
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  if (sanity.evidence) {
    next.first_touch_evidence = sanity.evidence;
  }

  return next;
}

function hasHighConfidenceExit(
  source: ExtractedTradeData | ExitVerificationResult,
  exitReason: 'TP' | 'SL'
): boolean {
  return source.exit_reason === exitReason && source.exit_confidence === 'high';
}

function applyConservativeExitDecision(
  result: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  extraction: ExtractedTradeData,
  sanity: LevelTouchSanityResult | null
): ExtractedTradeData {
  const next = { ...result };
  const votes = countVotes(
    verification.exit_reason,
    humanReview.exit_reason,
    decisiveReview.exit_reason,
    extraction.exit_reason
  );
  const hasSanityConfirmation = Boolean(
    sanity && (sanity.first_touch || sanity.stop_touched !== null || sanity.target_touched !== null)
  );

  if (sanity?.stop_touched === true && sanity?.target_touched === false) {
    next.exit_reason = 'SL';
  } else if (sanity?.target_touched === true && sanity?.stop_touched === false) {
    next.exit_reason = 'TP';
  } else if (votes.SL >= 2 && votes.TP <= 1) {
    next.exit_reason = 'SL';
  } else if (votes.TP >= 2 && votes.SL === 0) {
    next.exit_reason = 'TP';
  } else if (
    next.exit_reason === 'TP' &&
    votes.SL >= 1 &&
    !hasHighConfidenceExit(verification, 'TP') &&
    !hasHighConfidenceExit(humanReview, 'TP') &&
    !hasHighConfidenceExit(decisiveReview, 'TP')
  ) {
    next.exit_reason = 'SL';
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'Exit-order signals disagreed, so the scanner used the conservative stop-first fallback.'
    );
  } else if (
    next.exit_reason === 'TP' &&
    votes.TP < 3 &&
    votes.SL >= 1 &&
    !hasSanityConfirmation
  ) {
    next.exit_reason = 'SL';
    appendWarning(
      next.warnings ?? (next.warnings = []),
      'TP was not confirmed by the sanity pass, so the scanner fell back to the conservative stop-first result.'
    );
  }

  if (next.exit_reason) {
    next.pnl_result = next.exit_reason === 'TP' ? 'Win' : 'Loss';
  }

  return next;
}

function buildConsensusTradeAnalysis(
  extraction: ExtractedTradeData,
  verification: ExitVerificationResult,
  humanReview: ExtractedTradeData,
  decisiveReview: ExtractedTradeData,
  fallbackEntryTime: string
): ExtractedTradeData {
  const warnings = [
    ...(extraction.warnings ?? []),
    ...(humanReview.warnings ?? []),
    ...(decisiveReview.warnings ?? []),
  ];

  const resolvedStructure = repairTradeStructure(
    pickMostCommonString(decisiveReview.direction, humanReview.direction, extraction.direction),
    chooseConsensusNumber(decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price),
    chooseConsensusNumber(decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price),
    chooseConsensusNumber(decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price),
    {
      entries: [decisiveReview.entry_price, humanReview.entry_price, extraction.entry_price],
      stops: [decisiveReview.sl_price, humanReview.sl_price, extraction.sl_price],
      targets: [decisiveReview.tp_price, humanReview.tp_price, extraction.tp_price],
    }
  );

  const result: ExtractedTradeData = {
    symbol: decisiveReview.symbol
      ?? pickMostCommonString(humanReview.symbol, extraction.symbol)
      ?? pickFirstNonNull(humanReview.symbol, extraction.symbol),
    direction: resolvedStructure.direction,
    entry_price: resolvedStructure.entry_price,
    entry_time: pickFirstNonNull(decisiveReview.entry_time, humanReview.entry_time, extraction.entry_time, parseNullableTime(fallbackEntryTime)),
    entry_time_confidence: normalizeExitConfidence(decisiveReview.entry_time_confidence, humanReview.entry_time_confidence, extraction.entry_time_confidence, 'low'),
    sl_price: resolvedStructure.sl_price,
    tp_price: resolvedStructure.tp_price,
    trade_length_seconds: null,
    candle_count: null,
    timeframe_minutes: decisiveReview.timeframe_minutes
      ?? chooseConsensusNumber(humanReview.timeframe_minutes, verification.timeframe_minutes, extraction.timeframe_minutes),
    exit_reason: null,
    pnl_result: null,
    exit_confidence: null,
    first_touch_candle_index: null,
    first_touch_evidence: null,
    warnings,
  };

  if (!hasValidLevelStructure(result.direction, result.entry_price, result.sl_price, result.tp_price)) {
    result.direction = inferDirectionFromLevels(result.entry_price, result.sl_price, result.tp_price);
  }

  const votes = countVotes(decisiveReview.exit_reason, extraction.exit_reason, verification.exit_reason, humanReview.exit_reason);
  result.exit_reason = resolveExitReason(verification, humanReview, decisiveReview, extraction);

  const durationSource = [
    verification.exit_reason === result.exit_reason ? verification : null,
    humanReview.exit_reason === result.exit_reason ? humanReview : null,
    decisiveReview.exit_reason === result.exit_reason ? decisiveReview : null,
    extraction.exit_reason === result.exit_reason ? extraction : null,
  ].find(Boolean) as (ExtractedTradeData | ExitVerificationResult | null);

  result.trade_length_seconds = chooseConsensusNumber(
    durationSource?.trade_length_seconds,
    verification.trade_length_seconds,
    humanReview.trade_length_seconds,
    decisiveReview.trade_length_seconds,
    extraction.trade_length_seconds
  );
  result.candle_count = chooseConsensusNumber(
    durationSource?.candle_count,
    verification.candle_count,
    humanReview.candle_count,
    decisiveReview.candle_count,
    extraction.candle_count
  );
  result.timeframe_minutes = result.timeframe_minutes ?? durationSource?.timeframe_minutes ?? null;
  result.pnl_result = result.exit_reason === 'TP' ? 'Win' : result.exit_reason === 'SL' ? 'Loss' : null;
  result.exit_confidence = verification.exit_confidence
    ?? humanReview.exit_confidence
    ?? decisiveReview.exit_confidence
    ?? (votes.TP === 3 || votes.SL === 3
    ? 'high'
    : votes.TP >= 2 || votes.SL >= 2
      ? 'medium'
      : normalizeExitConfidence(extraction.exit_confidence, 'low'));
  result.first_touch_candle_index = pickFirstNonNull(verification.first_touch_candle_index, humanReview.first_touch_candle_index, result.candle_count);
  result.first_touch_evidence = pickFirstNonNull(verification.first_touch_evidence, humanReview.first_touch_evidence, decisiveReview.first_touch_evidence, extraction.first_touch_evidence);

  if (result.trade_length_seconds === null && result.candle_count !== null && result.timeframe_minutes !== null) {
    result.trade_length_seconds = result.candle_count * result.timeframe_minutes * 60;
  }

  if (result.entry_time === null) {
    result.entry_time = parseNullableTime(fallbackEntryTime);
    result.entry_time_confidence = 'low';
  }

  return result;
}

export async function analyzeChartImage(
  base64Image: string,
  mimeType: string,
  entryDate: string,
  entryTime: string,
  focusImages: Array<{ base64Image: string; mimeType: string; label: string }> = [],
  scannerContext?: Record<string, unknown>
): Promise<ExtractedTradeData> {
  const safeMimeType: ImageMimeType = VALID_MIME_TYPES.includes(mimeType as ImageMimeType)
    ? (mimeType as ImageMimeType)
    : 'image/jpeg';
  const analysisImages: ChartImageInput[] = [
    { base64Image, mimeType: safeMimeType, label: 'full_chart' },
    ...focusImages.map((image, index) => ({
      base64Image: image.base64Image,
      mimeType: VALID_MIME_TYPES.includes(image.mimeType as ImageMimeType)
        ? (image.mimeType as ImageMimeType)
        : 'image/jpeg',
      label: image.label || `focus_${index + 1}`,
    })),
  ];
  const normalizedScannerContext = scannerContext as ScannerContext | undefined;
  const decodedFullImage = safeMimeType === 'image/png' ? decodePngImage(base64Image) : null;
  const deterministicExit = safeMimeType === 'image/png'
    ? detectDeterministicExitFromDecodedImage(decodedFullImage, normalizedScannerContext)
    : null;
  const identityImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'full_chart',
  ]);
  const exactPriceImages = selectImagesByLabels(analysisImages, [
    'trade-box-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const extractionImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const verificationImages = selectImagesByLabels(analysisImages, [
    'header-focus',
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'price-label-focus',
    'entry-label-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const sanityImages = selectImagesByLabels(analysisImages, [
    'trade-box-focus',
    'entry-window-focus',
    'exit-path-focus',
    'stop-label-focus',
    'target-label-focus',
  ]);
  const preAnalysisWarnings: string[] = [];
  const [
    headerIdentityResult,
    exactPriceResult,
    extractionResult,
    humanReviewResult,
  ] = await Promise.allSettled([
    extractHeaderIdentity(identityImages),
    extractExactPriceLevels(exactPriceImages, normalizedScannerContext),
    extractTradeFacts(extractionImages, entryDate, entryTime, normalizedScannerContext),
    humanStyleReview(extractionImages, entryDate, entryTime, normalizedScannerContext),
  ]);

  const headerIdentityRead = headerIdentityResult.status === 'fulfilled'
    ? headerIdentityResult.value
    : null;
  if (headerIdentityResult.status === 'rejected') {
    preAnalysisWarnings.push('Header symbol/timeframe read failed, so identity relied on the broader chart reads.');
  }

  const exactPriceRead = exactPriceResult.status === 'fulfilled'
    ? exactPriceResult.value
    : null;
  if (exactPriceResult.status === 'rejected') {
    preAnalysisWarnings.push('Exact price-label review failed, so price levels relied on the broader chart reads.');
  }

  if (extractionResult.status === 'rejected' && humanReviewResult.status === 'rejected') {
    throw new Error('Chart analysis failed for both the primary and fallback Claude passes.');
  }

  const extractionSource = extractionResult.status === 'fulfilled'
    ? extractionResult.value
    : (humanReviewResult as PromiseFulfilledResult<ExtractedTradeData>).value;
  const humanReviewSource = humanReviewResult.status === 'fulfilled'
    ? humanReviewResult.value
    : (extractionResult as PromiseFulfilledResult<ExtractedTradeData>).value;

  if (extractionResult.status === 'rejected') {
    preAnalysisWarnings.push('Primary chart extraction failed, so the scanner fell back to the human-style review pass.');
  }

  if (humanReviewResult.status === 'rejected') {
    preAnalysisWarnings.push('Human-style review failed, so the scanner relied on the primary extraction pass.');
  }

  const extraction = applyHeaderIdentityRead(
    applyExactPriceRead(
      extractionSource,
      exactPriceRead
    ),
    headerIdentityRead
  );
  const rawHumanReview = applyHeaderIdentityRead(
    applyExactPriceRead(
      humanReviewSource,
      exactPriceRead
    ),
    headerIdentityRead
  );
  const baseRead = buildManualReaderBase(extraction, rawHumanReview, entryTime);
  preAnalysisWarnings.forEach(warning => appendWarning(baseRead.warnings ?? (baseRead.warnings = []), warning));

  let verification: ExitVerificationResult = {
    exit_reason: baseRead.exit_reason,
    trade_length_seconds: baseRead.trade_length_seconds,
    candle_count: baseRead.candle_count,
    timeframe_minutes: baseRead.timeframe_minutes,
    exit_confidence: baseRead.exit_confidence,
    first_touch_candle_index: baseRead.first_touch_candle_index,
    first_touch_evidence: baseRead.first_touch_evidence,
  };

  const [verificationResult, sanityResult] = await Promise.allSettled([
    verifyExitOrder(verificationImages, entryDate, baseRead, normalizedScannerContext),
    sanityCheckLevelTouches(sanityImages, entryDate, baseRead),
  ]);

  if (verificationResult.status === 'fulfilled') {
    verification = verificationResult.value;
  } else {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Exit verification failed, so the final answer relied on the manual chart read.');
  }

  let sanityCheck: LevelTouchSanityResult | null = null;
  if (sanityResult.status === 'fulfilled') {
    sanityCheck = sanityResult.value;
  } else {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Stop/target sanity check failed, so the final answer relied on the broader exit review.');
  }

  let decisiveReview = rawHumanReview;
  try {
    decisiveReview = applyHeaderIdentityRead(
      applyExactPriceRead(
        await decisiveFinalReview(
          extractionImages,
          entryDate,
          entryTime,
          extraction,
          verification,
          rawHumanReview,
          normalizedScannerContext
        ),
        exactPriceRead
      ),
      headerIdentityRead
    );
  } catch {
    appendWarning(baseRead.warnings ?? (baseRead.warnings = []), 'Final consensus review failed, so the result relied on the primary extraction passes.');
  }

  const consensus = applyHeaderIdentityRead(
    applyExactPriceRead(
      buildConsensusTradeAnalysis(
        extraction,
        verification,
        rawHumanReview,
        decisiveReview,
        entryTime
      ),
      exactPriceRead
    ),
    headerIdentityRead
  );
  const fallbackResult = applyHeaderIdentityRead(
    applyExactPriceRead(
      finalizeManualReaderResult(baseRead, verification, extraction, rawHumanReview),
      exactPriceRead
    ),
    headerIdentityRead
  );
  const structureSafeResult = hasValidLevelStructure(consensus.direction, consensus.entry_price, consensus.sl_price, consensus.tp_price)
    ? consensus
    : fallbackResult;
  const finalResult = applyConservativeExitDecision(
    applySanityOverride(structureSafeResult, sanityCheck),
    verification,
    rawHumanReview,
    decisiveReview,
    extraction,
    sanityCheck
  );

  if (deterministicExit?.exit_reason) {
    finalResult.exit_reason = deterministicExit.exit_reason;
    finalResult.pnl_result = deterministicExit.exit_reason === 'TP' ? 'Win' : 'Loss';
    finalResult.exit_confidence = 'high';
    finalResult.first_touch_evidence = deterministicExit.evidence ?? finalResult.first_touch_evidence;
  }

  finalResult.warnings = [
    ...(finalResult.warnings ?? []),
    ...(baseRead.warnings ?? []),
  ];

  return finalResult;
}

export async function analyzeIndividualTrade(trade: Trade): Promise<string> {
  const rr = trade.sl_price && trade.entry_price && trade.tp_price
    ? Math.abs(trade.tp_price - trade.entry_price) / Math.abs(trade.sl_price - trade.entry_price)
    : 0;

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a brutally honest professional futures trading coach with 20+ years of experience.
Your job is to give traders raw, unfiltered feedback on their trades. Do not sugarcoat.
Be direct, insightful, and constructive. Focus on what they did right, what they did wrong,
and exactly what they need to improve. Use specific numbers from the trade.`,
    messages: [
      {
        role: 'user',
        content: `Analyse this trade in detail:

Symbol: ${trade.symbol}
Direction: ${trade.direction}
Date: ${trade.trade_date} at ${trade.trade_time}
Session: ${trade.session}
Entry: ${trade.entry_price}
Stop Loss: ${trade.sl_price}
Take Profit: ${trade.tp_price}
Exit Price: ${trade.exit_price}
Exit Reason: ${trade.exit_reason}
Contracts: ${trade.contract_size}
Point Value: $${trade.point_value}
P&L: $${trade.pnl.toFixed(2)}
R:R Ratio: ${rr.toFixed(2)}
Trade Duration: ${trade.trade_length_seconds ? Math.round(trade.trade_length_seconds / 60) + ' minutes' : 'unknown'}
Emotional State: ${trade.emotional_state}
Confidence Level: ${trade.confidence_level}/10
Followed Plan: ${trade.followed_plan ? 'Yes' : 'No'}
Confluences: ${Array.isArray(trade.confluences) && trade.confluences.length > 0 ? trade.confluences.join(', ') : 'None tagged'}
Pre-trade Notes: ${trade.pre_trade_notes || 'None'}
Post-trade Notes: ${trade.post_trade_notes || 'None'}

Provide a brutally honest breakdown covering:
1. Trade quality assessment
2. Risk management evaluation
3. Execution analysis
4. Psychology and emotional factors
5. What was done well (if anything)
6. Key mistakes and how to fix them
7. Specific actionable improvements for next time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function analyzePatterns(trades: Trade[]): Promise<string> {
  const tradeSummaries = trades.map(t => ({
    symbol: t.symbol,
    direction: t.direction,
    date: t.trade_date,
    time: t.trade_time,
    session: t.session,
    pnl: t.pnl,
    exit_reason: t.exit_reason,
    emotional_state: t.emotional_state,
    confidence: t.confidence_level,
    followed_plan: t.followed_plan,
    confluences: Array.isArray(t.confluences) ? t.confluences : [],
    rr: t.sl_price && t.entry_price && t.tp_price
      ? (Math.abs(t.tp_price - t.entry_price) / Math.abs(t.sl_price - t.entry_price)).toFixed(2)
      : 'N/A',
  }));

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance analyst specialising in pattern recognition and behavioral finance.
Analyse trading data to find actionable patterns, both profitable and detrimental.
Be specific with numbers and percentages. Identify root causes of problems.`,
    messages: [
      {
        role: 'user',
        content: `Analyse these ${trades.length} futures trades and identify all significant patterns:

${JSON.stringify(tradeSummaries, null, 2)}

Provide a comprehensive pattern analysis covering:
1. Best performing setups (time, session, symbol, direction)
2. Worst performing patterns and why
3. Emotional state impact on performance
4. Plan adherence correlation with results
5. Risk management patterns
6. Time-of-day and session edge analysis
7. Confidence calibration (do high confidence trades perform better?)
8. Confluence performance (which tagged confluences are most profitable vs most costly)
9. Most critical behavioural improvements needed
10. Top 3 strengths to capitalise on
11. Top 3 weaknesses that are costing the most money`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generateWeeklyReport(
  trades: Trade[],
  weekStart: string,
  weekEnd: string
): Promise<string> {
  const wins = trades.filter(t => t.exit_reason === 'TP');
  const losses = trades.filter(t => t.exit_reason === 'SL');
  const netPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length * 100).toFixed(1) : '0';
  const confluenceBuckets = trades.reduce<Record<string, { count: number; pnl: number }>>((acc, trade) => {
    const tags = Array.isArray(trade.confluences) ? trade.confluences : [];
    tags.forEach(tag => {
      if (typeof tag !== 'string' || !tag.trim()) return;
      const key = tag.trim().toLowerCase();
      if (!acc[key]) {
        acc[key] = { count: 0, pnl: 0 };
      }
      acc[key].count += 1;
      acc[key].pnl += trade.pnl;
    });
    return acc;
  }, {});

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a professional trading performance coach generating weekly review reports.
Create comprehensive, structured reports that help traders improve systematically.
Be specific, actionable, and data-driven. Format your response with clear sections using markdown.`,
    messages: [
      {
        role: 'user',
        content: `Generate a comprehensive weekly performance report for the week of ${weekStart} to ${weekEnd}.

Summary Statistics:
- Total Trades: ${trades.length}
- Wins: ${wins.length} | Losses: ${losses.length}
- Win Rate: ${winRate}%
- Net P&L: $${netPnL.toFixed(2)}

Confluence Breakdown:
${JSON.stringify(
  Object.entries(confluenceBuckets)
    .map(([confluence, data]) => ({ confluence, trades: data.count, net_pnl: data.pnl }))
    .sort((a, b) => b.net_pnl - a.net_pnl),
  null,
  2
)}

Individual Trades:
${JSON.stringify(trades.map(t => ({
  date: t.trade_date,
  time: t.trade_time,
  symbol: t.symbol,
  direction: t.direction,
  session: t.session,
  pnl: t.pnl,
  exit_reason: t.exit_reason,
  emotional_state: t.emotional_state,
  confidence: t.confidence_level,
  followed_plan: t.followed_plan,
  confluences: Array.isArray(t.confluences) ? t.confluences : [],
})), null, 2)}

Create a report with these sections:
# Weekly Performance Report: ${weekStart} to ${weekEnd}

## Executive Summary
## Performance Statistics
## Best Trades of the Week
## Worst Trades and Lessons
## Psychological Performance
## Plan Adherence Analysis
## Key Patterns Observed
## Confluence Performance (best vs worst tagged confluences)
## Goals for Next Week
## Action Items (specific, numbered list)`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generatePsychologyReport(
  trades: Trade[],
  psychLogs: Array<{
    date: string;
    mood: string;
    mindset_score: number;
    pre_session_notes: string;
    post_session_notes: string;
  }>
): Promise<string> {
  const emotionalBreakdown = trades.reduce<Record<string, { count: number; pnl: number }>>((acc, t) => {
    const state = t.emotional_state || 'Unknown';
    if (!acc[state]) acc[state] = { count: 0, pnl: 0 };
    acc[state].count++;
    acc[state].pnl += t.pnl;
    return acc;
  }, {});

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 3000,
    system: `You are a trading psychologist specialising in performance psychology and behavioral finance.
Provide deep, insightful analysis of a trader's psychological patterns.
Be empathetic but brutally honest about destructive patterns.
Give concrete, practical psychological techniques to improve performance.`,
    messages: [
      {
        role: 'user',
        content: `Perform a deep psychology analysis for this futures trader.

Emotional State vs Performance:
${JSON.stringify(emotionalBreakdown, null, 2)}

Plan Adherence: ${trades.filter(t => t.followed_plan).length}/${trades.length} trades followed the plan

Psychology Logs (recent):
${JSON.stringify(psychLogs.slice(-14), null, 2)}

Trades Not Following Plan:
${JSON.stringify(trades.filter(t => !t.followed_plan).map(t => ({
  date: t.trade_date,
  emotional_state: t.emotional_state,
  pnl: t.pnl,
  notes: t.post_trade_notes,
})), null, 2)}

Provide a comprehensive psychology report:
# Trading Psychology Report

## Emotional State Analysis
## Behavioral Patterns
## Tilt and Revenge Trading Assessment
## FOMO and Overconfidence Patterns
## Discipline and Plan Adherence
## Mindset Score Trends
## Root Cause Analysis
## Recommended Psychological Strategies
## Daily Routine Recommendations
## Affirmations and Mental Framework`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function compareTradeToPlaybook(
  trade: Trade,
  playbookEntries: Array<{
    setup_name: string;
    description: string;
    rules: string;
    ideal_conditions: string;
  }>
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 2048,
    system: `You are a trading coach that specialises in evaluating whether trades adhere to established trading playbooks and rules.
Be specific about which rules were followed and which were violated.
Provide a structured compliance assessment.`,
    messages: [
      {
        role: 'user',
        content: `Evaluate this trade against the trading playbook.

Trade Details:
${JSON.stringify({
  symbol: trade.symbol,
  direction: trade.direction,
  date: trade.trade_date,
  time: trade.trade_time,
  session: trade.session,
  entry_price: trade.entry_price,
  sl_price: trade.sl_price,
  tp_price: trade.tp_price,
  exit_reason: trade.exit_reason,
  pnl: trade.pnl,
  emotional_state: trade.emotional_state,
  confidence_level: trade.confidence_level,
  followed_plan: trade.followed_plan,
  confluences: Array.isArray(trade.confluences) ? trade.confluences : [],
  pre_trade_notes: trade.pre_trade_notes,
  post_trade_notes: trade.post_trade_notes,
}, null, 2)}

Playbook Entries:
${JSON.stringify(playbookEntries, null, 2)}

Provide a detailed compliance assessment:
# Playbook Compliance Report

## Best Matching Setup
## Rules Followed
## Rules Violated
## Ideal Conditions Match
## Compliance Score (0-100%)
## Specific Violations and Impact
## How to Better Execute This Setup Next Time`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function answerFlyxaQuestion(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<string> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error('Question is required');
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    temperature: MODEL_TEMPERATURE,
    max_tokens: 700,
    system: `You are Flyxa's built-in product assistant.

Flyxa is a futures trading journal and review workspace. Key areas include:
- Trade journaling and daily reflections
- Dashboard analytics and performance review
- AI Coach analysis
- Risk Manager and daily risk controls
- Trade Scanner and chart import workflows
- Backtesting / replay
- Playbook and psychology tracking

Rules:
- Answer questions about Flyxa clearly and helpfully.
- Be concise, practical, and product-focused.
- If the user asks how to do something in Flyxa, give direct steps.
- If the user asks about account-specific data, explain you cannot see their private data from the chat widget.
- If the question is unrelated to Flyxa, gently steer back to Flyxa and what the product does.
- Do not invent features that Flyxa does not clearly have.
- Keep responses in plain text, usually 2-6 short sentences.`,
    messages: [
      ...history
        .filter(message => message.content.trim() !== '')
        .slice(-8)
        .map(message => ({
          role: message.role,
          content: message.content,
        })),
      {
        role: 'user',
        content: trimmedQuestion,
      },
    ],
  });

  const textBlocks = response.content.filter(block => block.type === 'text');
  const combined = textBlocks.map(block => block.text.trim()).filter(Boolean).join('\n\n');

  if (!combined) {
    throw new Error('Unexpected response type from Claude');
  }

  return combined;
}

```

## File: backend/src/types/index.ts
```ts
import { Request } from 'express';

export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  screenshot_url?: string;
  account_id?: string;
  direction: 'Long' | 'Short';
  entry_price: number;
  exit_price: number;
  sl_price: number;
  tp_price: number;
  exit_reason: 'TP' | 'SL' | 'BE';
  pnl: number;
  contract_size: number;
  point_value: number;
  trade_date: string;
  trade_time: string;
  trade_length_seconds: number;
  candle_count: number;
  timeframe_minutes: number;
  emotional_state: 'Calm' | 'Confident' | 'Anxious' | 'Revenge Trading' | 'FOMO' | 'Overconfident' | 'Tired';
  confidence_level: number;
  pre_trade_notes: string;
  post_trade_notes: string;
  confluences?: string[];
  followed_plan: boolean;
  session: 'Asia' | 'London' | 'New York' | 'Other';
  created_at: string;
}

export interface PsychologyLog {
  id: string;
  user_id: string;
  date: string;
  mood: string;
  pre_session_notes: string;
  post_session_notes: string;
  mindset_score: number;
  created_at: string;
}

export interface PlaybookEntry {
  id: string;
  user_id: string;
  setup_name: string;
  description: string;
  rules: string;
  ideal_conditions: string;
  screenshot_url: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  date: string;
  content: string;
  screenshots: string[];
  created_at: string;
}

export interface RiskSettings {
  id: string;
  user_id: string;
  daily_loss_limit: number;
  max_trades_per_day: number;
  max_contracts_per_trade: number;
  account_size: number;
  risk_percentage: number;
  updated_at: string;
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export interface ExtractedTradeData {
  symbol: string | null;
  direction: 'Long' | 'Short' | null;
  entry_price: number | null;
  entry_time: string | null;
  entry_time_confidence: 'high' | 'medium' | 'low' | null;
  sl_price: number | null;
  tp_price: number | null;
  trade_length_seconds: number | null;
  candle_count: number | null;
  timeframe_minutes: number | null;
  exit_reason: 'TP' | 'SL' | null;
  pnl_result: 'Win' | 'Loss' | null;
  exit_confidence: 'high' | 'medium' | 'low' | null;
  first_touch_candle_index: number | null;
  first_touch_evidence: string | null;
  warnings?: string[];
}

```


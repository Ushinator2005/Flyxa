import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import {
  type ScannerColorKey,
  type ScannerColorProfile,
  formatScannerColorValue,
  getScannerColors,
  isValidScannerHex,
  normalizeScannerHex,
  saveScannerColors,
  updateScannerColor,
} from '../../utils/scannerColors.js';

const TRADINGVIEW_COLOR_GRID: string[][] = [
  ['#FFFFFF', '#D1D4DC', '#9598A1', '#6A6D78', '#50535E', '#373A45', '#2A2E39', '#1C2030', '#131722', '#0C0E15'],
  ['#FFC0CB', '#FFB3BA', '#FF9999', '#FF6B6B', '#FF4444', '#FF0000', '#E00000', '#C00000', '#8B0000', '#5C0000'],
  ['#FFE4B5', '#FFCC80', '#FFB347', '#FFA500', '#FF8C00', '#FF6600', '#E55100', '#C84B00', '#A63200', '#7A1E00'],
  ['#FFFFE0', '#FFFF99', '#FFFF00', '#FFD700', '#FFC200', '#FFB300', '#F9A825', '#E65100', '#BF360C', '#7F2704'],
  ['#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784', '#4CAF50', '#2E7D32', '#1B5E20', '#33691E', '#558B2F', '#76900D'],
  ['#E0F7FA', '#B2EBF2', '#80DEEA', '#4DD0E1', '#00BCD4', '#0097A7', '#00796B', '#1A6B5A', '#00574B', '#004D40'],
  ['#E3F2FD', '#BBDEFB', '#90CAF9', '#64B5F6', '#2196F3', '#1565C0', '#0D47A1', '#1A237E', '#283593', '#311B92'],
  ['#F3E5F5', '#CE93D8', '#BA68C8', '#AB47BC', '#9C27B0', '#7B1FA2', '#6A1B9A', '#4A148C', '#38006B', '#1A0035'],
  ['#FCE4EC', '#F8BBD9', '#F48FB1', '#F06292', '#E91E63', '#C2185B', '#AD1457', '#880E4F', '#560027', '#37001C'],
];

const COLOR_ROW_META: Array<{ key: ScannerColorKey; label: string }> = [
  { key: 'supplyStopZone', label: 'Loss zone' },
  { key: 'targetDemandZone', label: 'Profit zone' },
  { key: 'entryZone', label: 'Entry zone' },
];

const TOKEN_SCOPE_STYLE: CSSProperties = {
  '--surface-1': 'var(--app-panel)',
  '--surface-2': 'var(--app-panel-strong)',
  '--surface-3': 'rgba(255,255,255,0.08)',
  '--border': 'var(--app-border)',
  '--border-sub': 'rgba(255,255,255,0.05)',
  '--txt': 'var(--app-text)',
  '--txt-2': 'var(--app-text-muted)',
  '--txt-3': 'var(--app-text-subtle)',
  '--amber': 'var(--accent)',
  '--amber-dim': 'var(--accent-dim)',
  '--amber-border': 'var(--accent-border)',
} as CSSProperties;

function areProfilesEqual(a: ScannerColorProfile, b: ScannerColorProfile): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ChartScannerColorSettings() {
  const initialProfile = useMemo(() => getScannerColors(), []);
  const [draftProfile, setDraftProfile] = useState<ScannerColorProfile>(initialProfile);
  const [savedProfile, setSavedProfile] = useState<ScannerColorProfile>(initialProfile);
  const [openPopoverRow, setOpenPopoverRow] = useState<ScannerColorKey | null>(null);
  const [customHexInput, setCustomHexInput] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const rowRefs = useRef(new Map<ScannerColorKey, HTMLDivElement>());
  const swatchButtonRefs = useRef(new Map<ScannerColorKey, HTMLButtonElement>());
  const [popoverPlacement, setPopoverPlacement] = useState<{ vertical: 'below' | 'above'; horizontal: 'left' | 'right' }>({
    vertical: 'below',
    horizontal: 'left',
  });

  const isDirty = !areProfilesEqual(draftProfile, savedProfile);
  const activeColor = openPopoverRow ? draftProfile[openPopoverRow] : null;

  useEffect(() => {
    if (!openPopoverRow) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const activeRow = rowRefs.current.get(openPopoverRow);
      if (!activeRow) {
        setOpenPopoverRow(null);
        return;
      }

      if (!activeRow.contains(event.target as Node)) {
        setOpenPopoverRow(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPopoverRow(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [openPopoverRow]);

  useEffect(() => {
    if (!savedFlash) {
      return;
    }

    const timer = window.setTimeout(() => setSavedFlash(false), 1800);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);

  const syncPopoverPlacement = (key: ScannerColorKey) => {
    const anchorButton = swatchButtonRefs.current.get(key);
    if (!anchorButton) return;

    const anchorRect = anchorButton.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedPopoverWidth = 220;
    const estimatedPopoverHeight = 278;
    const gap = 8;

    const opensAbove = anchorRect.bottom + gap + estimatedPopoverHeight > window.innerHeight - viewportPadding
      && anchorRect.top - gap - estimatedPopoverHeight >= viewportPadding;
    const alignRight = anchorRect.left + estimatedPopoverWidth > window.innerWidth - viewportPadding;

    setPopoverPlacement({
      vertical: opensAbove ? 'above' : 'below',
      horizontal: alignRight ? 'right' : 'left',
    });
  };

  const openColorPopover = (key: ScannerColorKey) => {
    syncPopoverPlacement(key);
    setOpenPopoverRow(current => {
      if (current === key) {
        return null;
      }
      setCustomHexInput(draftProfile[key].hex);
      return key;
    });
  };

  const applyHexToActiveRow = (rawHex: string) => {
    if (!openPopoverRow) {
      return;
    }

    const normalizedHex = normalizeScannerHex(rawHex);
    if (!normalizedHex) {
      return;
    }

    setDraftProfile(current => updateScannerColor(current, openPopoverRow, { hex: normalizedHex }));
    setCustomHexInput(normalizedHex);
    setOpenPopoverRow(null);
  };

  const handleSaveProfile = () => {
    const saved = saveScannerColors(draftProfile);
    setDraftProfile(saved);
    setSavedProfile(saved);
    setSavedFlash(true);
  };

  return (
    <div style={{ ...TOKEN_SCOPE_STYLE, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'visible' }}>
      <style>
        {`
          .chart-scanner-color-cell {
            width: 18px;
            height: 18px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            outline: 1px solid transparent;
            transform: scale(1);
            transition: transform 120ms ease, outline-color 120ms ease;
          }

          .chart-scanner-color-cell:hover {
            transform: scale(1.2);
            outline: 1.5px solid rgba(255,255,255,0.9);
          }

          .chart-scanner-color-cell.is-selected {
            transform: scale(1.1);
            outline: 2px solid rgba(255,255,255,0.95);
          }

          .chart-scanner-opacity {
            width: 100%;
            appearance: none;
            -webkit-appearance: none;
            height: 6px;
            border-radius: 999px;
            cursor: pointer;
          }

          .chart-scanner-opacity::-webkit-slider-runnable-track {
            height: 6px;
            border-radius: 999px;
            background: transparent;
          }

          .chart-scanner-opacity::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,0.96);
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            margin-top: -4px;
          }

          .chart-scanner-opacity::-moz-range-track {
            height: 6px;
            border-radius: 999px;
            background: transparent;
          }

          .chart-scanner-opacity::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border: none;
            border-radius: 999px;
            background: rgba(255,255,255,0.96);
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
          }
        `}
      </style>

      <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>Chart Scanner Colors</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>
          Tell Flyxa which colors you use for zones in TradingView
        </p>
      </header>

      {COLOR_ROW_META.map(row => {
        const colorValue = draftProfile[row.key];
        const valueText = formatScannerColorValue(colorValue);
        const isPopoverOpen = openPopoverRow === row.key;
        const sliderFillColor = formatScannerColorValue({
          hex: colorValue.hex,
          opacity: colorValue.opacity,
        });

        return (
          <div
            key={row.key}
            ref={node => {
              if (!node) {
                rowRefs.current.delete(row.key);
                return;
              }
              rowRefs.current.set(row.key, node);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-sub)',
            }}
          >
            <span style={{ minWidth: 140, fontSize: 12, color: 'var(--txt-2)' }}>{row.label}</span>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => openColorPopover(row.key)}
                aria-label={`Open ${row.label} color picker`}
                ref={node => {
                  if (!node) {
                    swatchButtonRefs.current.delete(row.key);
                    return;
                  }
                  swatchButtonRefs.current.set(row.key, node);
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: '2px solid rgba(255,255,255,0.15)',
                  background: valueText,
                  cursor: 'pointer',
                }}
              />

              {isPopoverOpen && activeColor && (
                <div
                  style={{
                    position: 'absolute',
                    top: popoverPlacement.vertical === 'below' ? 'calc(100% + 8px)' : undefined,
                    bottom: popoverPlacement.vertical === 'above' ? 'calc(100% + 8px)' : undefined,
                    left: popoverPlacement.horizontal === 'left' ? 0 : undefined,
                    right: popoverPlacement.horizontal === 'right' ? 0 : undefined,
                    width: 220,
                    padding: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 120,
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 18px)', gap: 3 }}>
                    {TRADINGVIEW_COLOR_GRID.flat().map(color => (
                      <button
                        key={`${row.key}-${color}`}
                        type="button"
                        className={`chart-scanner-color-cell${activeColor.hex === color ? ' is-selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => applyHexToActiveRow(color)}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => applyHexToActiveRow(customHexInput)}
                      aria-label="Apply custom hex color"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-3)',
                        color: 'var(--txt-2)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={12} />
                    </button>
                    <input
                      value={customHexInput}
                      onChange={event => setCustomHexInput(event.target.value.trim().toUpperCase())}
                      onBlur={() => {
                        if (isValidScannerHex(customHexInput)) {
                          applyHexToActiveRow(customHexInput);
                        }
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          applyHexToActiveRow(customHexInput);
                        }
                      }}
                      placeholder="#HEX"
                      style={{
                        width: 80,
                        height: 22,
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        background: 'var(--surface-3)',
                        color: 'var(--txt)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        padding: '4px 8px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)' }}>
                        Opacity
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--txt-2)', fontFamily: 'var(--font-mono)' }}>
                        {activeColor.opacity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={activeColor.opacity}
                      onChange={event => {
                        const nextOpacity = Number(event.target.value);
                        setDraftProfile(current => updateScannerColor(current, row.key, { opacity: nextOpacity }));
                      }}
                      className="chart-scanner-opacity"
                      style={{
                        background: `linear-gradient(to right, ${sliderFillColor} 0%, ${sliderFillColor} ${activeColor.opacity}%, var(--surface-3) ${activeColor.opacity}%, var(--surface-3) 100%)`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--txt-3)' }}>
              {valueText}
            </span>
          </div>
        );
      })}

      <p
        style={{
          margin: 0,
          padding: '12px 18px',
          fontSize: 11,
          color: 'var(--txt-3)',
          fontStyle: 'italic',
          borderBottom: '1px solid var(--border-sub)',
        }}
      >
        Match these to your TradingView Position tool Stop color and Target color settings.
      </p>

      <div style={{ padding: '12px 18px' }}>
        <button
          type="button"
          onClick={handleSaveProfile}
          style={{
            width: '100%',
            height: 34,
            border: 'none',
            borderRadius: 5,
            background: 'var(--amber)',
            color: 'var(--app-bg)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isDirty ? 1 : 0.86,
            transition: 'opacity 120ms ease',
          }}
        >
          Save Color Profile
        </button>

        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>
          These colors are sent to Flyxa AI with every chart upload.
          {savedFlash ? ' Saved.' : ''}
        </p>
      </div>
    </div>
  );
}

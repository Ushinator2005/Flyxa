import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, X, Settings, Loader2, TrendingUp, TrendingDown,
  AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { lookupContract } from '../constants/futuresContracts.js';
import { aiApi } from '../services/api.js';
import { formatRiskRewardRatio, parseRiskRewardValue } from '../utils/riskReward.js';

interface TradeResult {
  symbol?: string;
  direction?: 'Long' | 'Short' | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rr_ratio: string | null;
  outcome: 'WIN' | 'LOSS' | null;
  trade_duration: string | null;
  net_pnl: number | null;
}

export default function ChartAnalyzer() {
  const [contractSize, setContractSize] = useState(1);
  const [image, setImage] = useState<{ file: File; base64: string; preview: string } | null>(null);
  const [results, setResults] = useState<TradeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setImage({ file, base64, preview: dataUrl });
      setResults([]);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleAnalyze = async () => {
    if (!image) { setError('Please upload a chart screenshot'); return; }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const parsed = await aiApi.analyzeChartScreenshot(image.file, contractSize);
      setResults(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Chart Analyser</h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload a TradingView screenshot for instant P&L analysis
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 text-sm transition-all"
        >
          <Settings size={15} />
          Settings
          {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <div className="text-xs text-slate-400 leading-5">
            Chart analysis now runs through Flyxa&apos;s backend, so browser-stored Anthropic keys are no longer needed on this page.
          </div>
          <div className="w-36">
            <label className="text-xs text-slate-400 font-medium block mb-2">Default Contract Size</label>
            <input
              type="number"
              className="input-field"
              value={contractSize}
              onChange={e => setContractSize(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
            />
          </div>
        </div>
      )}

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 cursor-copy'
            : image
              ? 'border-slate-600 bg-slate-800/30'
              : 'border-slate-600 hover:border-slate-400 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => { if (!image) fileInputRef.current?.click(); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])}
        />

        {image ? (
          <div className="relative">
            <img
              src={image.preview}
              alt="Chart screenshot"
              className="w-full rounded-xl max-h-[500px] object-contain bg-slate-900"
            />
            <button
              onClick={e => {
                e.stopPropagation();
                setImage(null);
                setResults([]);
                setError(null);
              }}
              className="absolute top-3 right-3 p-1.5 bg-slate-900/80 rounded-lg text-slate-400 hover:text-white border border-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="absolute bottom-3 left-3 bg-slate-900/80 rounded-lg px-3 py-1.5 text-xs text-slate-300 border border-slate-600">
              {image.file.name}
            </div>
            {/* Click to replace */}
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="absolute bottom-3 right-3 bg-slate-900/80 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:text-white border border-slate-600 transition-colors"
            >
              Replace
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 select-none">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
              <Upload size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-200 font-medium text-lg">
              {isDragging ? 'Drop it here' : 'Drop your chart screenshot'}
            </p>
            <p className="text-slate-500 text-sm mt-1">or click to browse your files</p>
            <p className="text-slate-600 text-xs mt-4">PNG · JPG · WebP</p>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Analyse button */}
      <button
        onClick={handleAnalyze}
        disabled={loading || !image}
        className={`w-full py-3.5 rounded-xl font-semibold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
          loading || !image
            ? 'bg-slate-700'
            : 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700'
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2.5">
            <Loader2 size={18} className="animate-spin" />
            Analysing with Claude...
          </span>
        ) : (
          'Analyse Chart'
        )}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">
              {results.length === 1 ? 'Analysis Result' : `${results.length} Charts Analysed`}
            </h2>
            <div className="h-px flex-1 bg-slate-700/50" />
          </div>
          <div className={`grid gap-4 ${results.length >= 2 ? 'md:grid-cols-2' : ''}`}>
            {results.map((r, i) => (
              <ResultCard
                key={i}
                result={r}
                index={results.length > 1 ? i + 1 : undefined}
                contractSize={contractSize}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  index,
  contractSize,
}: {
  result: TradeResult;
  index?: number;
  contractSize: number;
}) {
  const isWin = result.outcome === 'WIN';
  const isLoss = result.outcome === 'LOSS';

  // Calculate P&L from contract specs if possible, falling back to Claude's raw points value
  const contract = result.symbol ? lookupContract(result.symbol) : undefined;
  // Use explicit direction from Claude; fall back to inferring from label positions
  const direction = result.direction
    ?? (result.entry_price != null && result.take_profit != null
      ? (result.take_profit > result.entry_price ? 'Long' : 'Short')
      : null);
  const exitPrice = isWin ? result.take_profit : isLoss ? result.stop_loss : null;
  const calculatedPnl = (() => {
    if (contract && exitPrice != null && result.entry_price != null && direction) {
      const diff = direction === 'Long'
        ? exitPrice - result.entry_price
        : result.entry_price - exitPrice;
      return diff * contract.point_value * contractSize;
    }
    // Fall back to Claude's raw points × point_value, or just raw points × contractSize
    if (result.net_pnl != null) {
      return contract
        ? result.net_pnl * contract.point_value * contractSize
        : result.net_pnl * contractSize;
    }
    return null;
  })();
  const adjustedPnl = calculatedPnl;
  const pointValueNote = contract ? `${contract.symbol} · $${contract.point_value}/pt` : null;
  const rrValue = formatRiskRewardRatio(parseRiskRewardValue(result.rr_ratio), { placeholder: 'N/A' });

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Card header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          isWin
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : isLoss
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-slate-700/20 border-slate-700/50'
        }`}
      >
        <div className="flex items-center gap-2">
          {result.symbol && (
            <span className="text-white font-bold text-base">{result.symbol}</span>
          )}
          {index && (
            <span className="text-slate-400 text-sm">Chart {index}</span>
          )}
          {!result.symbol && !index && (
            <span className="text-slate-400 text-sm">Trade Analysis</span>
          )}
        </div>
        {result.outcome ? (
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${
              isWin
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}
          >
            {isWin ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {result.outcome}
          </div>
        ) : null}
      </div>

      {/* Fields */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <Field label="Entry Price" value={fmtPrice(result.entry_price)} />
        <Field
          label="Direction"
          value={direction}
          color={direction === 'Long' ? 'text-emerald-400' : direction === 'Short' ? 'text-red-400' : undefined}
        />
        <Field label="Stop Loss" value={fmtPrice(result.stop_loss)} color="text-red-400" />
        <Field label="Take Profit" value={fmtPrice(result.take_profit)} color="text-emerald-400" />
        <Field label="R:R Ratio" value={rrValue} color="text-blue-400" />
        <Field label="Trade Duration" value={result.trade_duration} />
        <Field
          label={contractSize > 1 ? `Net P&L (×${contractSize})` : 'Net P&L'}
          value={adjustedPnl != null
            ? `${adjustedPnl >= 0 ? '+' : ''}$${Math.abs(adjustedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : null}
          color={adjustedPnl != null ? (adjustedPnl >= 0 ? 'text-emerald-400' : 'text-red-400') : undefined}
          note={pointValueNote}
          large
        />
      </div>
    </div>
  );
}

function fmtPrice(v: number | null | undefined): string | null {
  if (v == null) return null;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Field({
  label,
  value,
  color,
  large,
  note,
}: {
  label: string;
  value: string | null | undefined;
  color?: string;
  large?: boolean;
  note?: string | null;
}) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-slate-500 text-xs mb-1">{label}</div>
      <div className={`font-semibold ${large ? 'text-xl' : 'text-base'} ${color ?? 'text-white'}`}>
        {value ?? <span className="text-slate-600 font-normal">—</span>}
      </div>
      {note && <div className="text-slate-600 text-xs mt-0.5">{note}</div>}
    </div>
  );
}

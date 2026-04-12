import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';
import { Pencil, Trash2 } from 'lucide-react';
import ScreenshotImportModal from '../components/scanner/ScreenshotImportModal.js';
import Modal from '../components/common/Modal.js';
import { useTrades } from '../hooks/useTrades.js';
import { Trade } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';
import { lookupContract } from '../constants/futuresContracts.js';
import { format, isValid, parseISO } from 'date-fns';
import { useAppSettings } from '../contexts/AppSettingsContext.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function calcPoints(t: Trade): number | null {
  if (!t.entry_price || !t.exit_price) return null;
  return t.direction === 'Long'
    ? t.exit_price - t.entry_price
    : t.entry_price - t.exit_price;
}

function calcTicks(t: Trade): number | null {
  const pts = calcPoints(t);
  if (pts === null) return null;
  const contract = lookupContract(t.symbol);
  const tickSize = contract?.tick_size ?? 0.25;
  return Math.round(Math.abs(pts) / tickSize);
}

function calcRR(t: Trade): string {
  if (!t.entry_price || !t.sl_price || !t.tp_price) return '—';
  const risk   = Math.abs(t.entry_price - t.sl_price);
  const reward = Math.abs(t.tp_price - t.entry_price);
  if (risk === 0) return '—';
  return `1:${(reward / risk).toFixed(2)}`;
}

function normalizeConfluences(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const deduped = new Set<string>();
  const normalized: string[] = [];

  for (const entry of rawValues) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (deduped.has(key)) continue;
    deduped.add(key);
    normalized.push(cleaned);
  }

  return normalized;
}

function formatTradeDate(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'â€”';
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : value;
}

function formatTradeDirection(value: unknown): string {
  return value === 'Long' || value === 'Short' ? value.toUpperCase() : 'â€”';
}

function formatTradeSymbol(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : 'â€”';
}

const MOOD_EMOJI: Record<string, string> = {
  Calm: '😌', Confident: '💪', Anxious: '😰',
  'Revenge Trading': '😤', FOMO: '😱', Overconfident: '😎',
  Tired: '😴', Vengeful: '😡', Neutral: '😐',
};

type FilterResult = 'All' | 'Win' | 'Loss' | 'Long' | 'Short';
type SortOption   = 'newest' | 'oldest' | 'pnl_high' | 'pnl_low';
const BACKTEST_PREFILL_KEY = 'tw_backtest_trade_prefill';

// ─── component ──────────────────────────────────────────────────────────────

export default function TradeScanner() {
  const { trades, loading, error, createTrade, updateTrade, deleteTrade } = useTrades();
  const { filterTradesBySelectedAccount } = useAppSettings();

  const [showAdd, setShowAdd]       = useState(false);
  const [editTrade, setEditTrade]   = useState<Trade | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [backtestPrefill, setBacktestPrefill] = useState<Partial<Trade> | null>(null);

  const [search, setSearch]         = useState('');
  const [filterResult, setFilterResult] = useState<FilterResult>('All');
  const [sort, setSort]             = useState<SortOption>('newest');

  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu]     = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(BACKTEST_PREFILL_KEY);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as Partial<Trade>;
      setBacktestPrefill(parsed);
      setShowAdd(true);
      sessionStorage.removeItem(BACKTEST_PREFILL_KEY);
    } catch {
      sessionStorage.removeItem(BACKTEST_PREFILL_KEY);
    }
  }, []);

  const filtered = useMemo(() => {
    let list = [...filterTradesBySelectedAccount(trades)];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => {
        const symbolMatch = (t.symbol ?? '').toLowerCase().includes(q);
        const confluenceMatch = normalizeConfluences(t.confluences).some(confluence => confluence.toLowerCase().includes(q));
        return symbolMatch || confluenceMatch;
      });
    }

    if (filterResult === 'Win')   list = list.filter(t => t.pnl > 0);
    if (filterResult === 'Loss')  list = list.filter(t => t.pnl < 0);
    if (filterResult === 'Long')  list = list.filter(t => t.direction === 'Long');
    if (filterResult === 'Short') list = list.filter(t => t.direction === 'Short');

    if (sort === 'newest')   list.sort((a, b) => (a.trade_date < b.trade_date ? 1 : -1));
    if (sort === 'oldest')   list.sort((a, b) => (a.trade_date > b.trade_date ? 1 : -1));
    if (sort === 'pnl_high') list.sort((a, b) => b.pnl - a.pnl);
    if (sort === 'pnl_low')  list.sort((a, b) => a.pnl - b.pnl);

    return list;
  }, [filterResult, filterTradesBySelectedAccount, search, sort, trades]);

  const handleSave = async (data: Partial<Trade>) => {
    await createTrade(data);
    setBacktestPrefill(null);
    setShowAdd(false);
  };

  const handleUpdate = async (data: Partial<Trade>) => {
    if (!editTrade) return;
    await updateTrade(editTrade.id, data);
    setEditTrade(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteTrade(deleteId);
    setDeleteId(null);
  };

  const FILTER_OPTIONS: FilterResult[] = ['All', 'Win', 'Loss', 'Long', 'Short'];
  const SORT_OPTIONS: { value: SortOption; label: string }[] = [
    { value: 'newest',   label: 'Newest First' },
    { value: 'oldest',   label: 'Oldest First' },
    { value: 'pnl_high', label: 'Largest Win'  },
    { value: 'pnl_low',  label: 'Largest Loss' },
  ];

  const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Newest First';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Trade Journal</h1>
          <p className="text-slate-400 text-base mt-1">Record and manage all your trades in one place</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-3 rounded-xl text-base transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Plus size={18} />
          Add Trade
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3.5">
        {/* Search */}
        <div className="relative flex-1 max-w-sm min-w-[260px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search symbol or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field h-12 pl-11 text-base"
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-base hover:border-slate-500 transition-colors"
          >
            {filterResult === 'All' ? 'All Results' : filterResult}
            <ChevronDown size={15} className="text-slate-500" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[140px]">
              {FILTER_OPTIONS.map(opt => (
                <button key={opt} onClick={() => { setFilterResult(opt); setShowFilterMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-base transition-colors ${filterResult === opt ? 'text-white bg-slate-700' : 'text-slate-300 hover:bg-slate-700/60'}`}>
                  {opt === 'All' ? 'All Results' : opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false); }}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 text-base hover:border-slate-500 transition-colors"
          >
            {sortLabel}
            <ChevronDown size={15} className="text-slate-500" />
          </button>
          {showSortMenu && (
            <div className="absolute top-full mt-1 left-0 z-10 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[150px]">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setSort(opt.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-base transition-colors ${sort === opt.value ? 'text-white bg-slate-700' : 'text-slate-300 hover:bg-slate-700/60'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load trades: {error}
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/60">
                {['DATE','SYMBOL','DIRECTION','ENTRY','EXIT','SIZE','POINTS','P&L','R:R','CONFLUENCES','PSYCHOLOGY',''].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-sm font-semibold text-slate-500 tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {loading ? (
                <tr><td colSpan={12} className="text-center text-slate-500 text-base py-14">Loading trades...</td></tr>
              ) : error ? (
                <tr><td colSpan={12} className="text-center text-red-300 text-base py-14">
                  Couldn&apos;t load your trades right now. Please refresh or sign in again.
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="text-center text-slate-500 text-base py-14">
                  {trades.length === 0 ? 'No trades yet — click Add Trade to get started.' : 'No trades match your filters.'}
                </td></tr>
              ) : filtered.map(t => {
                const pts   = calcPoints(t);
                const ticks = calcTicks(t);
                const rr    = calcRR(t);
                const mood  = t.emotional_state;
                const emoji = mood ? (MOOD_EMOJI[mood] ?? '😐') : null;
                const confluences = normalizeConfluences(t.confluences);

                return (
                  <tr key={t.id} className="hover:bg-slate-700/20 transition-colors group">
                    {/* Date */}
                    <td className="px-5 py-4 text-slate-400 text-base whitespace-nowrap">
                      {formatTradeDate(t.trade_date)}
                    </td>
                    {/* Symbol */}
                    <td className="px-5 py-4 text-white font-bold text-base">{formatTradeSymbol(t.symbol)}</td>
                    {/* Direction */}
                    <td className="px-5 py-4">
                      <span className={`text-sm font-bold px-3.5 py-1.5 rounded-full ${
                        t.direction === 'Long'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}>
                        {formatTradeDirection(t.direction)}
                      </span>
                    </td>
                    {/* Entry */}
                    <td className="px-5 py-4 text-slate-300 text-base tabular-nums">{t.entry_price}</td>
                    {/* Exit */}
                    <td className="px-5 py-4 text-slate-300 text-base tabular-nums">{t.exit_price}</td>
                    {/* Size */}
                    <td className="px-5 py-4 text-slate-300 text-base">{t.contract_size}</td>
                    {/* Points */}
                    <td className="px-5 py-4 text-base tabular-nums">
                      {pts !== null ? (
                        <span className={pts >= 0 ? 'text-slate-300' : 'text-slate-300'}>
                          {pts >= 0 ? '+' : ''}{pts.toFixed(2)}
                          {ticks !== null && <span className="text-slate-500 ml-1 text-sm">({ticks}t)</span>}
                        </span>
                      ) : '—'}
                    </td>
                    {/* P&L */}
                    <td className={`px-5 py-4 text-base font-bold tabular-nums ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(Number.isFinite(t.pnl) ? t.pnl : 0)}
                    </td>
                    {/* R:R */}
                    <td className="px-5 py-4 text-slate-300 text-base">{rr}</td>
                    {/* Confluences */}
                    <td className="px-5 py-4">
                      {confluences.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {confluences.slice(0, 3).map(confluence => (
                            <span
                              key={`${t.id}-${confluence}`}
                              className="inline-flex items-center rounded-full border border-blue-400/25 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200"
                            >
                              {confluence}
                            </span>
                          ))}
                          {confluences.length > 3 && (
                            <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-700/30 px-2.5 py-1 text-xs text-slate-300">
                              +{confluences.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">--</span>
                      )}
                    </td>
                    {/* Psychology */}
                    <td className="px-5 py-4 text-base text-slate-400">
                      {emoji && mood ? (
                        <span>{emoji} {mood}</span>
                      ) : '—'}
                    </td>
                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditTrade(t)}
                          className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteId(t.id)}
                          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add trade modal */}
      <ScreenshotImportModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setBacktestPrefill(null); }}
        onSave={handleSave}
        prefillTrade={backtestPrefill}
      />

      {/* Edit trade modal */}
      <ScreenshotImportModal
        isOpen={!!editTrade}
        onClose={() => setEditTrade(null)}
        onSave={handleUpdate}
        editTrade={editTrade}
      />

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Trade" size="sm">
        <p className="text-slate-300 mb-4">Are you sure you want to delete this trade? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={handleDelete} className="btn-danger flex-1">Delete</button>
          <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

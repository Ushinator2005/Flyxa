import React, { useState, useEffect } from 'react';
import { BrainCircuit, FileText, Plus, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Trade } from '../../types/index.js';
import { formatCurrency } from '../../utils/calculations.js';
import { lookupContract, FuturesContract } from '../../constants/futuresContracts.js';
import { useAppSettings } from '../../contexts/AppSettingsContext.js';

interface Props {
  initialData?: Partial<Trade>;
  aiFields?: Set<string>;
  tradeDate: string;
  tradeTime: string;
  showContractsField?: boolean;
  onSubmit: (data: Partial<Trade>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const emotionalStates = ['Calm', 'Confident', 'Anxious', 'Revenge Trading', 'FOMO', 'Overconfident', 'Tired'];
const THESIS_BLOCK = 'FLYXA_THESIS';
const PROCESS_BLOCK = 'FLYXA_PROCESS_GRADE';
const REFLECTION_BLOCK = 'FLYXA_REFLECTION';

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
    normalized.push(cleaned.slice(0, 64));
    if (normalized.length >= 12) break;
  }

  return normalized;
}

function encodeStructuredValue(value: string): string {
  return value.replace(/\n/g, '\\n').trim();
}

function decodeStructuredValue(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function parseStructuredBlock(note: string | undefined, blockName: string): { fields: Record<string, string>; remaining: string } {
  if (!note?.trim()) {
    return { fields: {}, remaining: '' };
  }

  const pattern = new RegExp(`\\[${blockName}\\]\\n?([\\s\\S]*?)\\n?\\[\\/${blockName}\\]\\n?`, 'm');
  const match = note.match(pattern);
  if (!match) {
    return { fields: {}, remaining: note.trim() };
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) continue;
    fields[key] = decodeStructuredValue(value);
  }

  return {
    fields,
    remaining: note.replace(match[0], '').trim(),
  };
}

function buildStructuredBlock(blockName: string, fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${key}:${encodeStructuredValue(value)}`);

  if (lines.length === 0) {
    return '';
  }

  return `[${blockName}]\n${lines.join('\n')}\n[/${blockName}]`;
}

const defaultForm: Partial<Trade> = {
  symbol: '',
  direction: 'Long',
  entry_price: 0,
  exit_price: 0,
  sl_price: 0,
  tp_price: 0,
  contract_size: 1,
  point_value: 20,
  trade_date: new Date().toISOString().split('T')[0],
  trade_time: '09:30',
  trade_length_seconds: 0,
  candle_count: 0,
  timeframe_minutes: 1,
  emotional_state: 'Calm',
  confidence_level: 7,
  pre_trade_notes: '',
  post_trade_notes: '',
  confluences: [],
  followed_plan: true,
};

function buildFormState(initialData?: Partial<Trade>): Partial<Trade> {
  return {
    ...defaultForm,
    ...initialData,
    confluences: normalizeConfluences(initialData?.confluences),
  };
}

export default function TradeForm({
  initialData,
  aiFields = new Set(),
  tradeDate,
  tradeTime,
  showContractsField = true,
  onSubmit,
  onCancel,
  isLoading,
}: Props) {
  const { confluenceOptions } = useAppSettings();
  const [form, setForm] = useState<Partial<Trade>>(() => buildFormState(initialData));
  const [thesisSetup, setThesisSetup] = useState('');
  const [thesisInvalidation, setThesisInvalidation] = useState('');
  const [thesisTrigger, setThesisTrigger] = useState('');
  const [processScore, setProcessScore] = useState(0);
  const [processReason, setProcessReason] = useState('');
  const [reflectionMarket, setReflectionMarket] = useState('');
  const [reflectionExecution, setReflectionExecution] = useState('');
  const [reflectionAdjustment, setReflectionAdjustment] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [selectedConfluence, setSelectedConfluence] = useState('');
  const [matchedContract, setMatchedContract] = useState<FuturesContract | undefined>(
    () => lookupContract(initialData?.symbol || '')
  );

  useEffect(() => {
    const nextForm = buildFormState(initialData);
    const preParsed = parseStructuredBlock(nextForm.pre_trade_notes, THESIS_BLOCK);
    const processParsed = parseStructuredBlock(nextForm.post_trade_notes, PROCESS_BLOCK);
    const reflectionParsed = parseStructuredBlock(processParsed.remaining, REFLECTION_BLOCK);

    const parsedScore = Number(processParsed.fields.score);

    setThesisSetup(preParsed.fields.setup || '');
    setThesisInvalidation(preParsed.fields.invalidation || '');
    setThesisTrigger(preParsed.fields.trigger || '');
    setProcessScore(Number.isFinite(parsedScore) && parsedScore >= 1 && parsedScore <= 5 ? parsedScore : 0);
    setProcessReason(processParsed.fields.reason || '');
    setReflectionMarket(reflectionParsed.fields.market_vs_thesis || '');
    setReflectionExecution(reflectionParsed.fields.execution_quality || '');
    setReflectionAdjustment(reflectionParsed.fields.next_adjustment || '');
    setForm({
      ...nextForm,
      pre_trade_notes: preParsed.remaining,
      post_trade_notes: reflectionParsed.remaining,
    });
    const contract = lookupContract(initialData?.symbol || '');
    setMatchedContract(contract);
    setSubmitError('');
    setSelectedConfluence('');
  }, [initialData]);

  const calcPnL = (): number => {
    const { direction, entry_price, exit_price, contract_size, point_value } = form;
    if (!entry_price || !exit_price || !contract_size || !point_value) return 0;
    return direction === 'Long'
      ? (exit_price - entry_price) * contract_size * point_value
      : (entry_price - exit_price) * contract_size * point_value;
  };

  const calcRR = (): string => {
    const { entry_price, sl_price, tp_price } = form;
    if (!entry_price || !sl_price || !tp_price) return 'N/A';
    const risk = Math.abs(entry_price - sl_price);
    const reward = Math.abs(tp_price - entry_price);
    if (risk === 0) return 'N/A';
    return (reward / risk).toFixed(2);
  };

  const set = (key: keyof Trade, value: unknown) => {
    setSubmitError('');
    setForm(f => {
      const next = { ...f, [key]: value };

      if (key === 'tp_price' && next.exit_reason === 'TP') {
        next.exit_price = Number(value);
      }

      if (key === 'sl_price' && next.exit_reason === 'SL') {
        next.exit_price = Number(value);
      }

      if (key === 'entry_price' && next.exit_reason === 'BE') {
        next.exit_price = Number(value);
      }

      return next;
    });
  };

  const handleSymbolChange = (value: string) => {
    const upper = value.toUpperCase();
    set('symbol', upper);
    const contract = lookupContract(upper);
    setMatchedContract(contract);
    if (contract) set('point_value', contract.point_value);
  };

  const hasTradeDateTime = Boolean(tradeDate && tradeTime);
  const hasDuration = typeof form.trade_length_seconds === 'number'
    && Number.isFinite(form.trade_length_seconds)
    && form.trade_length_seconds > 0;
  const requiredFieldsMessage = !hasTradeDateTime && !hasDuration
    ? 'Trade Date/Time and Duration are required before saving.'
    : !hasTradeDateTime
      ? 'Trade Date/Time required before saving.'
      : !hasDuration
        ? 'Duration is required before saving.'
        : '';
  const canSubmit = Boolean(hasTradeDateTime && hasDuration && !isLoading);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTradeDateTime || !hasDuration) {
      setSubmitError(requiredFieldsMessage);
      return;
    }

    if (form.exit_reason !== 'TP' && form.exit_reason !== 'SL' && form.exit_reason !== 'BE') {
      setSubmitError('Select whether TP, SL, or Breakeven before saving this trade.');
      return;
    }

    const normalizedExitPrice =
      form.exit_reason === 'TP' ? form.tp_price :
      form.exit_reason === 'SL' ? form.sl_price :
      form.entry_price;
    if (!normalizedExitPrice) {
      setSubmitError('Add an entry price so the breakeven exit can be priced correctly.');
      return;
    }

    const thesisBlock = buildStructuredBlock(THESIS_BLOCK, {
      setup: thesisSetup,
      invalidation: thesisInvalidation,
      trigger: thesisTrigger,
    });
    const processBlock = buildStructuredBlock(PROCESS_BLOCK, {
      score: processScore > 0 ? String(processScore) : '',
      reason: processReason,
    });
    const reflectionBlock = buildStructuredBlock(REFLECTION_BLOCK, {
      market_vs_thesis: reflectionMarket,
      execution_quality: reflectionExecution,
      next_adjustment: reflectionAdjustment,
    });

    const preTradeNotes = [thesisBlock, form.pre_trade_notes?.trim() || '']
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const postTradeNotes = [processBlock, reflectionBlock, form.post_trade_notes?.trim() || '']
      .filter(Boolean)
      .join('\n\n')
      .trim();

    onSubmit({
      ...form,
      confluences: normalizeConfluences(form.confluences),
      trade_date: tradeDate,
      trade_time: tradeTime,
      exit_price: normalizedExitPrice,
      pre_trade_notes: preTradeNotes,
      post_trade_notes: postTradeNotes,
    });
  };

  const pnl = calcPnL();
  const rr = calcRR();
  const confluences = normalizeConfluences(form.confluences);
  const availableConfluenceOptions = confluenceOptions.filter(
    option => !confluences.some(confluence => confluence.toLowerCase() === option.toLowerCase())
  );

  const addConfluence = () => {
    if (!selectedConfluence) {
      return;
    }

    const nextConfluences = normalizeConfluences([...confluences, selectedConfluence]);
    set('confluences', nextConfluences);
    setSelectedConfluence('');
  };

  const removeConfluence = (indexToRemove: number) => {
    set('confluences', confluences.filter((_, index) => index !== indexToRemove));
  };

  const AIBadge = ({ field }: { field: string }) => aiFields.has(field) ? (
    <span className="inline-flex items-center gap-0.5 text-xs text-blue-400 ml-1 font-normal">
      <Sparkles size={9} /> AI
    </span>
  ) : null;

  const panelClass = 'rounded-2xl border border-slate-700/60 bg-[linear-gradient(180deg,rgba(2,6,23,0.34),rgba(15,23,42,0.32))] p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] md:p-5';
  const numericFieldClass = 'input-field h-11';
  const SectionLabel = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="mb-4 flex items-center gap-2">
      <span className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-2 text-slate-300">{icon}</span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{children}</p>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Symbol + Direction */}
      <div className={panelClass}>
        <SectionLabel icon={<Target size={16} />}>Instrument</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Symbol <AIBadge field="symbol" /></label>
            <input
              type="text"
              className={numericFieldClass}
              value={form.symbol || ''}
              onChange={e => handleSymbolChange(e.target.value)}
              placeholder="e.g. MNQM26"
              required
            />
            {matchedContract && (
              <p className="text-xs text-emerald-400 mt-1">{matchedContract.name} · ${matchedContract.point_value}/pt</p>
            )}
          </div>
          <div>
            <label className="label">Direction <AIBadge field="direction" /></label>
            <div className="flex gap-2 h-10">
              {(['Long', 'Short'] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('direction', d)}
                  className={`flex-1 rounded-lg text-sm font-semibold transition-all border flex items-center justify-center gap-1.5 ${
                    form.direction === d
                      ? d === 'Long'
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-400'
                        : 'bg-red-600/30 border-red-500/50 text-red-400'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {d === 'Long' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Entry Details */}
      {showContractsField && (
        <div className={panelClass}>
          <SectionLabel icon={<ShieldCheck size={16} />}>Entry Details</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="label">Contracts</label>
              <input
                type="number"
                className={numericFieldClass}
                value={form.contract_size || 1}
                onChange={e => set('contract_size', parseInt(e.target.value))}
                min={1}
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* Price levels */}
      <div className={panelClass}>
        <SectionLabel icon={<Target size={16} />}>Price Levels</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="label">Entry <AIBadge field="entry_price" /></label>
            <input type="number" className={numericFieldClass} value={form.entry_price || ''} onChange={e => set('entry_price', parseFloat(e.target.value))} step={0.25} required />
          </div>
          <div>
            <label className="label">Exit</label>
            <input type="number" className={numericFieldClass} value={form.exit_price || ''} onChange={e => set('exit_price', parseFloat(e.target.value))} step={0.25} />
          </div>
          <div>
            <label className="label">Stop Loss <AIBadge field="sl_price" /></label>
            <input type="number" className={numericFieldClass} value={form.sl_price || ''} onChange={e => set('sl_price', parseFloat(e.target.value))} step={0.25} required />
          </div>
          <div>
            <label className="label">Take Profit <AIBadge field="tp_price" /></label>
            <input type="number" className={numericFieldClass} value={form.tp_price || ''} onChange={e => set('tp_price', parseFloat(e.target.value))} step={0.25} required />
          </div>
        </div>
      </div>

      {/* Exit + Duration */}
      <div className={panelClass}>
        <SectionLabel icon={<TrendingUp size={16} />}>Outcome</SectionLabel>
        <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2">
          <div>
            <label className="label">Exit Reason <AIBadge field="exit_reason" /></label>
            <div className="flex gap-2 h-10">
              {(['TP', 'SL', 'BE'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    set('exit_reason', r);
                    if (r === 'TP' && form.tp_price) set('exit_price', form.tp_price);
                    if (r === 'SL' && form.sl_price) set('exit_price', form.sl_price);
                    if (r === 'BE' && form.entry_price) set('exit_price', form.entry_price);
                  }}
                  className={`flex-1 rounded-lg text-sm font-semibold transition-all border ${
                    form.exit_reason === r
                      ? r === 'TP'
                        ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-400'
                        : r === 'SL'
                          ? 'bg-red-600/30 border-red-500/50 text-red-400'
                          : 'bg-amber-600/30 border-amber-500/50 text-amber-400'
                      : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {r === 'TP' ? 'Take Profit' : r === 'SL' ? 'Stop Loss' : 'Breakeven'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Duration <AIBadge field="trade_length_seconds" /></label>
            <div className="flex rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden h-11">
              <div className="flex-1 flex items-center">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={Math.floor((form.trade_length_seconds || 0) / 3600)}
                  onChange={e => {
                    const h = Math.max(0, parseInt(e.target.value) || 0);
                    const m = Math.floor(((form.trade_length_seconds || 0) % 3600) / 60);
                    set('trade_length_seconds', h * 3600 + m * 60);
                  }}
                  className="w-full bg-transparent text-center text-sm text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="pr-2 text-xs font-medium text-slate-500">h</span>
              </div>
              <div className="w-px bg-slate-700/80" />
              <div className="flex-1 flex items-center">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={Math.floor(((form.trade_length_seconds || 0) % 3600) / 60)}
                  onChange={e => {
                    const m = Math.max(0, parseInt(e.target.value) || 0);
                    const h = Math.floor((form.trade_length_seconds || 0) / 3600);
                    set('trade_length_seconds', h * 3600 + m * 60);
                  }}
                  className="w-full bg-transparent text-center text-sm text-slate-200 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="pr-2 text-xs font-medium text-slate-500">m</span>
              </div>
            </div>
          </div>
        </div>

        {/* P&L + R:R */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${pnl === 0 ? 'border-amber-500/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(15,23,42,0.2))]' : pnl > 0 ? 'border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(15,23,42,0.2))]' : 'border-red-500/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.12),rgba(15,23,42,0.2))]'}`}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Calculated P&L</p>
            <p className={`text-2xl font-bold tracking-tight ${pnl === 0 ? 'text-amber-300' : pnl > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(pnl)}</p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/65 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Risk : Reward</p>
            <p className="text-2xl font-bold tracking-tight text-blue-300">{rr === 'N/A' ? 'N/A' : `1:${rr}`}</p>
          </div>
        </div>
      </div>

      {/* Psychology */}
      <div className={panelClass}>
        <SectionLabel icon={<BrainCircuit size={16} />}>Psychology</SectionLabel>
        <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2">
          <div>
            <label className="label">Emotional State</label>
            <select className={numericFieldClass} value={form.emotional_state || 'Calm'} onChange={e => set('emotional_state', e.target.value)}>
              {emotionalStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Confidence ({form.confidence_level}/10)</label>
            <input
              type="range" min={1} max={10}
              value={form.confidence_level || 7}
              onChange={e => set('confidence_level', parseInt(e.target.value))}
              className="w-full mt-2 accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1"><span>Low</span><span>High</span></div>
          </div>
        </div>

        <div>
          <label className="label">Followed Trading Plan?</label>
          <div className="flex gap-2 h-9">
            {[true, false].map(v => (
              <button
                key={String(v)}
                type="button"
                onClick={() => set('followed_plan', v)}
                className={`flex-1 rounded-lg text-sm font-medium transition-all border ${
                  form.followed_plan === v
                    ? v ? 'bg-emerald-600/30 border-emerald-500/50 text-emerald-400' : 'bg-red-600/30 border-red-500/50 text-red-400'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400'
                }`}
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confluences */}
      <div className={panelClass}>
        <SectionLabel icon={<Sparkles size={16} />}>Confluences</SectionLabel>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className={`${numericFieldClass} flex-1`}
              value={selectedConfluence}
              onChange={e => setSelectedConfluence(e.target.value)}
            >
              <option value="">Select confluence</option>
              {availableConfluenceOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addConfluence}
              disabled={!selectedConfluence}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/15 px-4 text-sm font-medium text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-700/40 disabled:text-slate-400"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          {confluences.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {confluences.map((confluence, index) => (
                <span
                  key={`${confluence}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-xs text-blue-200"
                >
                  {confluence}
                  <button
                    type="button"
                    onClick={() => removeConfluence(index)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-200/80 transition hover:bg-blue-500/20 hover:text-white"
                    aria-label={`Remove ${confluence}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Pick confirmations that were present when you entered this trade.</p>
          )}
          {availableConfluenceOptions.length === 0 && (
            <p className="text-xs text-slate-500">No additional options available. Manage this list in Settings.</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className={panelClass}>
        <SectionLabel icon={<FileText size={16} />}>Notes</SectionLabel>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">1. Pre-trade Thesis</p>
            <p className="mt-1 text-xs text-slate-500">Capture the setup logic before outcome bias creeps in.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="label">Setup Thesis</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={thesisSetup}
                  onChange={e => setThesisSetup(e.target.value)}
                  placeholder="What edge did you see?"
                />
              </div>
              <div>
                <label className="label">Invalidation</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={thesisInvalidation}
                  onChange={e => setThesisInvalidation(e.target.value)}
                  placeholder="What would prove this wrong?"
                />
              </div>
              <div>
                <label className="label">Execution Trigger</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={thesisTrigger}
                  onChange={e => setThesisTrigger(e.target.value)}
                  placeholder="What had to happen before entry?"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400">3. Outcome-Independent Grade</p>
            <p className="mt-1 text-xs text-slate-500">Grade the quality of process, not P&amp;L.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(score => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setProcessScore(score)}
                  className={`min-w-9 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    processScore === score
                      ? 'border-blue-400/60 bg-blue-500/20 text-blue-200'
                      : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label className="label">Why this score?</label>
              <textarea
                className="input-field resize-none"
                rows={2}
                value={processReason}
                onChange={e => setProcessReason(e.target.value)}
                placeholder="Example: Executed plan well, but rushed final scale-out."
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">5. Reflection Prompts</p>
            <p className="mt-1 text-xs text-slate-500">Use prompts to force specific learning after the trade.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="label">Market vs Thesis</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={reflectionMarket}
                  onChange={e => setReflectionMarket(e.target.value)}
                  placeholder="Did price confirm or reject your thesis?"
                />
              </div>
              <div>
                <label className="label">Execution Quality</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={reflectionExecution}
                  onChange={e => setReflectionExecution(e.target.value)}
                  placeholder="What did you do well or poorly?"
                />
              </div>
              <div>
                <label className="label">One Next Adjustment</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={reflectionAdjustment}
                  onChange={e => setReflectionAdjustment(e.target.value)}
                  placeholder="What single change will you test next?"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Additional Pre-Trade Notes</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={form.pre_trade_notes || ''}
              onChange={e => set('pre_trade_notes', e.target.value)}
              placeholder="Anything else you noticed before entry."
            />
          </div>
          <div>
            <label className="label">Additional Post-Trade Notes</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              value={form.post_trade_notes || ''}
              onChange={e => set('post_trade_notes', e.target.value)}
              placeholder="Anything else you want to capture after exit."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      {(submitError || requiredFieldsMessage) && (
        <p className={`text-sm ${requiredFieldsMessage ? 'text-amber-400' : 'text-red-400'}`}>
          {submitError || requiredFieldsMessage}
        </p>
      )}
      <div className="flex gap-3 border-t border-slate-800/80 pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          title={requiredFieldsMessage || undefined}
          className="btn-primary h-12 flex-1 rounded-xl shadow-[0_14px_30px_rgba(37,99,235,0.18)] disabled:opacity-100 disabled:bg-slate-700 disabled:border disabled:border-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {isLoading ? 'Saving...' : 'Save Trade'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary h-12 rounded-xl px-5">
          Cancel
        </button>
      </div>
    </form>
  );
}

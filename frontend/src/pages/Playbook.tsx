import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, Plus, Edit2, Trash2, Save, X,
  CheckCircle2, Brain, Loader2, AlertCircle, ExternalLink
} from 'lucide-react';
import { playbookApi, tradesApi, aiApi } from '../services/api.js';
import { PlaybookEntry, Trade } from '../types/index.js';
import Modal from '../components/common/Modal.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import { format } from 'date-fns';

const EMPTY_FORM = {
  setup_name: '',
  description: '',
  rules: '',
  ideal_conditions: '',
  screenshot_url: '',
};

// ── Playbook Form ────────────────────────────────────────────────────────────

function PlaybookForm({
  initial, onSave, onCancel
}: {
  initial?: Partial<PlaybookEntry>;
  onSave: (data: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function submit() {
    if (!form.setup_name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Setup Name *</label>
        <input
          type="text"
          className="input-field"
          placeholder="e.g. ICT Breaker Block, Supply Zone Fade..."
          value={form.setup_name}
          onChange={field('setup_name')}
        />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea
          className="input-field resize-none"
          rows={3}
          placeholder="Brief overview of what this setup is and when it occurs..."
          value={form.description}
          onChange={field('description')}
        />
      </div>
      <div>
        <label className="label">Entry Rules</label>
        <textarea
          className="input-field resize-none"
          rows={5}
          placeholder="List your exact entry rules, one per line. e.g.&#10;- Price must reclaim a broken structure level&#10;- Entry on 1m FVG above key level&#10;- Volume spike on entry candle"
          value={form.rules}
          onChange={field('rules')}
        />
      </div>
      <div>
        <label className="label">Ideal Conditions</label>
        <textarea
          className="input-field resize-none"
          rows={3}
          placeholder="When does this setup work best? Session, news context, market structure..."
          value={form.ideal_conditions}
          onChange={field('ideal_conditions')}
        />
      </div>
      <div>
        <label className="label">Screenshot URL (optional)</label>
        <input
          type="url"
          className="input-field"
          placeholder="https://... (Paste a chart image URL as a reference example)"
          value={form.screenshot_url}
          onChange={field('screenshot_url')}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={submit}
          disabled={saving || !form.setup_name.trim()}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <><Save size={16} className="animate-pulse" /> Saving...</> : <><Save size={16} /> Save Setup</>}
        </button>
        <button onClick={onCancel} className="btn-secondary flex items-center gap-2">
          <X size={16} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── Entry Detail View ────────────────────────────────────────────────────────

function EntryDetail({
  entry, trades, onEdit, onDelete
}: {
  entry: PlaybookEntry;
  trades: Trade[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [aiTradeId, setAiTradeId] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function runPlaybookCheck() {
    if (!aiTradeId) { setAiError('Select a trade first.'); return; }
    setAiLoading(true);
    setAiResult('');
    setAiError('');
    try {
      const res = await aiApi.playbookCheck(aiTradeId) as { comparisonReport: string };
      setAiResult(res.comparisonReport);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'AI check failed.');
    } finally {
      setAiLoading(false);
    }
  }

  function renderRules(rules: string) {
    return rules.split('\n').filter(Boolean).map((line, i) => (
      <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
        <CheckCircle2 size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <span>{line.replace(/^[-•]\s*/, '')}</span>
      </div>
    ));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{entry.setup_name}</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Added {format(new Date(entry.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
            <Edit2 size={14} /> Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger flex items-center gap-1.5 text-sm px-3 py-1.5"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {entry.description && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Description</p>
          <p className="text-slate-300 text-sm leading-relaxed">{entry.description}</p>
        </div>
      )}

      {entry.rules && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Entry Rules</p>
          <div className="space-y-1.5">{renderRules(entry.rules)}</div>
        </div>
      )}

      {entry.ideal_conditions && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Ideal Conditions</p>
          <p className="text-slate-300 text-sm leading-relaxed">{entry.ideal_conditions}</p>
        </div>
      )}

      {entry.screenshot_url && (
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-2">Reference Screenshot</p>
          <a
            href={entry.screenshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
          >
            <ExternalLink size={14} /> View Screenshot
          </a>
        </div>
      )}

      {/* AI Comparison */}
      <div className="border-t border-slate-700 pt-5">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">
          AI Trade vs Playbook Comparison
        </p>
        <div className="flex gap-3">
          <select
            className="input-field flex-1"
            value={aiTradeId}
            onChange={e => setAiTradeId(e.target.value)}
          >
            <option value="">— Select a trade —</option>
            {trades.map(t => (
              <option key={t.id} value={t.id}>
                {t.trade_date} · {t.symbol} {t.direction} · {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
              </option>
            ))}
          </select>
          <button
            onClick={runPlaybookCheck}
            disabled={aiLoading || !aiTradeId}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
            {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
            Check
          </button>
        </div>

        {aiError && (
          <div className="mt-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {aiError}
          </div>
        )}

        {aiLoading && (
          <div className="mt-3 space-y-2">
            {[90, 75, 85, 60].map((w, i) => (
              <div key={i} className="h-3 bg-slate-700 rounded animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {aiResult && !aiLoading && (
          <div className="mt-3 bg-slate-900 rounded-xl p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
            {aiResult}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Setup"
      >
        <p className="text-slate-300 mb-5 text-sm">
          Are you sure you want to delete <strong className="text-white">{entry.setup_name}</strong>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowDeleteConfirm(false); onDelete(); }}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 size={15} /> Delete
          </button>
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Playbook() {
  const [entries, setEntries] = useState<PlaybookEntry[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [selected, setSelected] = useState<PlaybookEntry | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [e, t] = await Promise.all([playbookApi.getAll(), tradesApi.getAll()]);
      setEntries(e as PlaybookEntry[]);
      setTrades(t as Trade[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate(data: typeof EMPTY_FORM) {
    const created = await playbookApi.create(data as Record<string, unknown>);
    await fetchData();
    setSelected(created as PlaybookEntry);
    setCreating(false);
  }

  async function handleUpdate(data: typeof EMPTY_FORM) {
    if (!selected) return;
    const updated = await playbookApi.update(selected.id, data as Record<string, unknown>);
    await fetchData();
    setSelected(updated as PlaybookEntry);
    setEditing(false);
  }

  async function handleDelete() {
    if (!selected) return;
    await playbookApi.delete(selected.id);
    setSelected(null);
    await fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading playbook..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <BookOpen size={22} className="text-blue-400" />
          Playbook
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Document your setups and verify your trades follow the rules
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Entry list */}
        <div className="lg:col-span-1 space-y-3">
          <button
            onClick={() => { setCreating(true); setEditing(false); setSelected(null); }}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus size={16} /> New Setup
          </button>

          {entries.length === 0 && !creating && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 text-center">
              <BookOpen size={32} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No setups yet.</p>
              <p className="text-slate-500 text-xs mt-1">Add your first setup above.</p>
            </div>
          )}

          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => { setSelected(entry); setEditing(false); setCreating(false); }}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                selected?.id === entry.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-600'
              }`}
            >
              <p className={`font-medium text-sm ${selected?.id === entry.id ? 'text-blue-300' : 'text-slate-200'}`}>
                {entry.setup_name}
              </p>
              {entry.description && (
                <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{entry.description}</p>
              )}
            </button>
          ))}
        </div>

        {/* Right: Detail / form */}
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700/50 rounded-xl p-6">
          {creating && (
            <>
              <h3 className="text-slate-200 font-semibold mb-5">New Setup</h3>
              <PlaybookForm onSave={handleCreate} onCancel={() => setCreating(false)} />
            </>
          )}

          {editing && selected && (
            <>
              <h3 className="text-slate-200 font-semibold mb-5">Edit Setup</h3>
              <PlaybookForm
                initial={selected}
                onSave={handleUpdate}
                onCancel={() => setEditing(false)}
              />
            </>
          )}

          {!creating && !editing && selected && (
            <EntryDetail
              entry={selected}
              trades={trades}
              onEdit={() => setEditing(true)}
              onDelete={handleDelete}
            />
          )}

          {!creating && !editing && !selected && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <BookOpen size={40} className="text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">Select a setup to view its details</p>
              <p className="text-slate-500 text-xs mt-1">or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

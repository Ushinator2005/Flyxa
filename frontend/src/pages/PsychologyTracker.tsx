import { useEffect, useState, useCallback } from 'react';
import { Heart, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { psychologyApi, tradesApi } from '../services/api.js';
import { PsychologyLog, Trade } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';
import { format } from 'date-fns';
import LoadingSpinner from '../components/common/LoadingSpinner.js';

const MOODS = ['Excellent', 'Good', 'Neutral', 'Below Average', 'Poor'];

const darkTooltip = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

// ── Daily Log Form ───────────────────────────────────────────────────────────

function DailyLogForm({
  existing, onSaved
}: {
  existing: PsychologyLog | null;
  onSaved: () => void;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    date: today,
    mood: existing?.mood || 'Neutral',
    pre_session_notes: existing?.pre_session_notes || '',
    post_session_notes: existing?.post_session_notes || '',
    mindset_score: existing?.mindset_score || 7,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        date: existing.date,
        mood: existing.mood,
        pre_session_notes: existing.pre_session_notes,
        post_session_notes: existing.post_session_notes,
        mindset_score: existing.mindset_score,
      });
    }
  }, [existing]);

  async function save() {
    setSaving(true);
    try {
      if (existing) {
        await psychologyApi.update(existing.id, form as Record<string, unknown>);
      } else {
        await psychologyApi.create(form as Record<string, unknown>);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const scoreColor =
    form.mindset_score >= 8 ? 'text-green-400'
    : form.mindset_score >= 5 ? 'text-blue-400'
    : 'text-red-400';

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <h3 className="text-slate-200 font-semibold flex items-center gap-2">
        <Heart size={17} className="text-blue-400" />
        Daily Psychology Log
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input-field"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Overall Mood</label>
          <select
            className="input-field"
            value={form.mood}
            onChange={e => setForm(f => ({ ...f, mood: e.target.value }))}
          >
            {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">
          Mindset Score: <span className={`font-bold ${scoreColor}`}>{form.mindset_score}/10</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          className="w-full accent-blue-500 h-2"
          value={form.mindset_score}
          onChange={e => setForm(f => ({ ...f, mindset_score: parseInt(e.target.value) }))}
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>1 — Terrible</span>
          <span>5 — Neutral</span>
          <span>10 — Peak</span>
        </div>
      </div>

      <div>
        <label className="label">Pre-Session Notes</label>
        <textarea
          className="input-field resize-none"
          rows={3}
          placeholder="How are you feeling before the session? Any concerns, goals, or focus areas..."
          value={form.pre_session_notes}
          onChange={e => setForm(f => ({ ...f, pre_session_notes: e.target.value }))}
        />
      </div>

      <div>
        <label className="label">Post-Session Notes</label>
        <textarea
          className="input-field resize-none"
          rows={3}
          placeholder="How did the session go? What did you learn? Any mistakes to note?"
          value={form.post_session_notes}
          onChange={e => setForm(f => ({ ...f, post_session_notes: e.target.value }))}
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary flex items-center gap-2"
      >
        {saved ? (
          <><CheckCircle2 size={16} /> Saved!</>
        ) : saving ? (
          <><Save size={16} className="animate-pulse" /> Saving...</>
        ) : (
          <><Save size={16} /> Save Log</>
        )}
      </button>
    </div>
  );
}

// ── Mindset Chart ────────────────────────────────────────────────────────────

function MindsetChart({ logs, trades }: { logs: PsychologyLog[]; trades: Trade[] }) {
  // Build chart data: date → mindset score + avg PnL that day
  const tradesByDate = trades.reduce<Record<string, number[]>>((acc, t) => {
    if (!acc[t.trade_date]) acc[t.trade_date] = [];
    acc[t.trade_date].push(t.pnl);
    return acc;
  }, {});

  const chartData = logs
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const dayTrades = tradesByDate[log.date] || [];
      const avgPnL = dayTrades.length > 0
        ? dayTrades.reduce((s, p) => s + p, 0) / dayTrades.length
        : null;
      return {
        date: format(new Date(log.date), 'MM/dd'),
        mindset: log.mindset_score,
        avgPnL,
      };
    });

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Mindset Score Over Time</h3>
        <div className="text-slate-500 text-sm text-center py-10">
          No psychology logs yet. Start logging daily to see your mindset trend.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
      <h3 className="text-slate-300 font-semibold text-sm mb-4">Mindset Score vs Daily P&L</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis
            yAxisId="left"
            domain={[0, 10]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ value: 'Mindset', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            {...darkTooltip}
            formatter={(value: number, name: string) =>
              name === 'Avg P&L' ? [formatCurrency(value), name] : [value, name]
            }
          />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="mindset"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            name="Mindset Score"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgPnL"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ fill: '#10b981', r: 3 }}
            name="Avg P&L"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Tilt Detector ─────────────────────────────────────────────────────────

function TiltDetector({ trades }: { trades: Trade[] }) {
  // Calculate consecutive losses from recent trades
  const sorted = [...trades].sort(
    (a, b) => `${b.trade_date}${b.trade_time}`.localeCompare(`${a.trade_date}${a.trade_time}`)
  );

  let consecutiveLosses = 0;
  for (const t of sorted) {
    if (t.pnl < 0) consecutiveLosses++;
    else break;
  }

  // Emotional state frequency
  const emotionCounts = trades.reduce<Record<string, number>>((acc, t) => {
    if (t.emotional_state) {
      acc[t.emotional_state] = (acc[t.emotional_state] || 0) + 1;
    }
    return acc;
  }, {});

  const tiltStates = ['Revenge Trading', 'FOMO', 'Anxious', 'Overconfident'];
  const tiltCount = tiltStates.reduce((sum, s) => sum + (emotionCounts[s] || 0), 0);
  const totalTradesWithEmotion = trades.filter(t => t.emotional_state).length;
  const tiltPct = totalTradesWithEmotion > 0
    ? Math.round((tiltCount / totalTradesWithEmotion) * 100)
    : 0;

  const tiltLevel =
    consecutiveLosses >= 3 || tiltPct >= 40 ? 'tilt'
    : consecutiveLosses >= 2 || tiltPct >= 20 ? 'caution'
    : 'normal';

  const tiltConfig = {
    normal: { color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/30', label: 'Normal', icon: '✓' },
    caution: { color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/30', label: 'Caution', icon: '⚠' },
    tilt: { color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/30', label: 'Tilt Detected', icon: '⛔' },
  }[tiltLevel];

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <h3 className="text-slate-200 font-semibold flex items-center gap-2">
        <AlertTriangle size={17} className="text-blue-400" />
        Tilt Detector
      </h3>

      {/* Status banner */}
      <div className={`border rounded-xl p-4 flex items-center gap-3 ${tiltConfig.bg}`}>
        <span className="text-2xl">{tiltConfig.icon}</span>
        <div>
          <p className={`font-bold ${tiltConfig.color}`}>{tiltConfig.label}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {tiltLevel === 'tilt' && 'You may be in tilt. Step away and reset before your next trade.'}
            {tiltLevel === 'caution' && 'Some tilt indicators present. Trade with extra caution.'}
            {tiltLevel === 'normal' && 'No significant tilt indicators detected. Keep it up.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Current Losing Streak</p>
          <p className={`text-3xl font-bold ${consecutiveLosses >= 3 ? 'text-red-400' : consecutiveLosses >= 2 ? 'text-amber-400' : 'text-green-400'}`}>
            {consecutiveLosses}
          </p>
          <p className="text-slate-500 text-xs mt-1">consecutive losses</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Tilt-State Trades</p>
          <p className={`text-3xl font-bold ${tiltPct >= 40 ? 'text-red-400' : tiltPct >= 20 ? 'text-amber-400' : 'text-green-400'}`}>
            {tiltPct}%
          </p>
          <p className="text-slate-500 text-xs mt-1">of trades in tilt state</p>
        </div>
      </div>

      {/* Emotional breakdown */}
      {Object.keys(emotionCounts).length > 0 && (
        <div>
          <p className="text-slate-400 text-xs uppercase tracking-wide font-medium mb-3">
            Emotional State Frequency
          </p>
          <div className="space-y-2">
            {Object.entries(emotionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([state, count]) => {
                const pct = Math.round((count / trades.length) * 100);
                const isTilt = tiltStates.includes(state);
                return (
                  <div key={state} className="flex items-center gap-3">
                    <span className={`text-xs w-32 shrink-0 ${isTilt ? 'text-amber-400' : 'text-slate-300'}`}>
                      {state}
                    </span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isTilt ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-slate-400 text-xs w-12 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PsychologyTracker() {
  const [logs, setLogs] = useState<PsychologyLog[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs.find(l => l.date === today) || null;

  const fetchData = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([
        psychologyApi.getAll(),
        tradesApi.getAll(),
      ]);
      setLogs(l as PsychologyLog[]);
      setTrades(t as Trade[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading psychology data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Heart size={22} className="text-blue-400" />
          Psychology Tracker
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Track your mental performance and identify emotional patterns
        </p>
      </div>

      {/* Daily log form */}
      <DailyLogForm existing={todayLog} onSaved={fetchData} />

      {/* Mindset chart */}
      <MindsetChart logs={logs} trades={trades} />

      {/* Tilt detector */}
      <TiltDetector trades={trades} />

      {/* Past logs */}
      {logs.length > 0 && (
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-slate-200 font-semibold text-sm mb-4">Recent Logs</h3>
          <div className="space-y-3">
            {[...logs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map(log => (
                <div
                  key={log.id}
                  className="bg-slate-900 rounded-xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-slate-200 text-sm font-medium">
                        {format(new Date(log.date), 'MMM d, yyyy')}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                        {log.mood}
                      </span>
                    </div>
                    {log.pre_session_notes && (
                      <p className="text-slate-400 text-xs truncate">{log.pre_session_notes}</p>
                    )}
                  </div>
                  <div className="text-center shrink-0">
                    <p className={`text-xl font-bold ${
                      log.mindset_score >= 7 ? 'text-green-400'
                      : log.mindset_score >= 4 ? 'text-blue-400'
                      : 'text-red-400'
                    }`}>
                      {log.mindset_score}
                    </p>
                    <p className="text-slate-500 text-xs">/10</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

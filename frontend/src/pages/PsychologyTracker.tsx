import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, Brain, CalendarDays, CheckCircle2, Heart, LineChart as LineChartIcon, Save } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { psychologyApi, tradesApi } from '../services/api.js';
import { PsychologyLog, Trade } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';
import './PsychologyTracker.css';

const MOODS = ['Excellent', 'Good', 'Neutral', 'Below Average', 'Poor'] as const;
type MoodValue = (typeof MOODS)[number];

function getMoodTone(mood: string): 'green' | 'amber' | 'red' | 'neutral' {
  if (mood === 'Excellent' || mood === 'Good') return 'green';
  if (mood === 'Neutral') return 'neutral';
  if (mood === 'Below Average') return 'amber';
  return 'red';
}

function getScoreTone(score: number): 'green' | 'amber' | 'red' {
  if (score >= 8) return 'green';
  if (score >= 5) return 'amber';
  return 'red';
}

function dayDiffIso(a: string, b: string): number {
  const aDate = parseISO(`${a}T00:00:00`);
  const bDate = parseISO(`${b}T00:00:00`);
  const delta = Math.abs(aDate.getTime() - bDate.getTime());
  return Math.round(delta / 86400000);
}

function buildCurrentStreak(logs: PsychologyLog[]): number {
  const uniqueDates = Array.from(new Set(logs.map(log => log.date))).sort((a, b) => b.localeCompare(a));
  if (uniqueDates.length === 0) return 0;
  let streak = 1;
  for (let index = 1; index < uniqueDates.length; index += 1) {
    if (dayDiffIso(uniqueDates[index - 1], uniqueDates[index]) !== 1) break;
    streak += 1;
  }
  return streak;
}

function DailyLogForm({ existing, onSaved }: { existing: PsychologyLog | null; onSaved: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    date: today,
    mood: (existing?.mood || 'Neutral') as MoodValue,
    pre_session_notes: existing?.pre_session_notes || '',
    post_session_notes: existing?.post_session_notes || '',
    mindset_score: existing?.mindset_score || 7,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!existing) {
      setForm({
        date: today,
        mood: 'Neutral',
        pre_session_notes: '',
        post_session_notes: '',
        mindset_score: 7,
      });
      return;
    }

    setForm({
      date: existing.date,
      mood: (existing.mood || 'Neutral') as MoodValue,
      pre_session_notes: existing.pre_session_notes || '',
      post_session_notes: existing.post_session_notes || '',
      mindset_score: existing.mindset_score || 7,
    });
  }, [existing, today]);

  async function save() {
    setSaving(true);
    try {
      if (existing) {
        await psychologyApi.update(existing.id, form as Record<string, unknown>);
      } else {
        await psychologyApi.create(form as Record<string, unknown>);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      onSaved();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  const scoreTone = getScoreTone(form.mindset_score);

  return (
    <section className="psy-card">
      <div className="psy-card-head">
        <h2>
          <Heart size={16} />
          Daily Psychology Log
        </h2>
        <span className="psy-head-tag">{existing ? 'Today logged' : 'New log'}</span>
      </div>

      <div className="psy-form-grid">
        <div className="psy-field">
          <label>Date</label>
          <input
            type="date"
            value={form.date}
            onChange={event => setForm(current => ({ ...current, date: event.target.value }))}
          />
        </div>

        <div className="psy-field">
          <label>Overall Mood</label>
          <div className="psy-mood-row">
            {MOODS.map(mood => {
              const active = form.mood === mood;
              return (
                <button
                  key={mood}
                  type="button"
                  className={`psy-mood-pill ${active ? `active ${getMoodTone(mood)}` : ''}`}
                  onClick={() => setForm(current => ({ ...current, mood }))}
                >
                  {mood}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="psy-score-wrap">
        <div className="psy-score-line">
          <span>Mindset Score</span>
          <strong className={scoreTone}>{form.mindset_score}/10</strong>
        </div>
        <input
          type="range"
          min="1"
          max="10"
          value={form.mindset_score}
          onChange={event => setForm(current => ({ ...current, mindset_score: Number.parseInt(event.target.value, 10) }))}
        />
        <div className="psy-range-meta">
          <span>1 - off-plan</span>
          <span>5 - neutral</span>
          <span>10 - locked in</span>
        </div>
      </div>

      <div className="psy-note-grid">
        <div className="psy-field">
          <label>Pre-Session Notes</label>
          <textarea
            rows={4}
            value={form.pre_session_notes}
            placeholder="How are you showing up today? Intentions, concerns, focus checkpoints..."
            onChange={event => setForm(current => ({ ...current, pre_session_notes: event.target.value }))}
          />
        </div>
        <div className="psy-field">
          <label>Post-Session Notes</label>
          <textarea
            rows={4}
            value={form.post_session_notes}
            placeholder="What happened emotionally? What to repeat and what to avoid tomorrow..."
            onChange={event => setForm(current => ({ ...current, post_session_notes: event.target.value }))}
          />
        </div>
      </div>

      <div className="psy-form-actions">
        <button type="button" className="psy-btn psy-btn-primary" onClick={save} disabled={saving}>
          {saved ? (
            <>
              <CheckCircle2 size={14} />
              Saved
            </>
          ) : saving ? (
            <>
              <Save size={14} />
              Saving...
            </>
          ) : (
            <>
              <Save size={14} />
              Save Log
            </>
          )}
        </button>
      </div>
    </section>
  );
}

function MindsetChart({ logs, trades }: { logs: PsychologyLog[]; trades: Trade[] }) {
  const tradesByDate = trades.reduce<Record<string, number[]>>((acc, trade) => {
    if (!acc[trade.trade_date]) acc[trade.trade_date] = [];
    acc[trade.trade_date].push(trade.pnl);
    return acc;
  }, {});

  const chartData = [...logs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(log => {
      const dayTrades = tradesByDate[log.date] || [];
      const avgPnL = dayTrades.length > 0 ? dayTrades.reduce((sum, value) => sum + value, 0) / dayTrades.length : null;
      return {
        dateLabel: format(parseISO(`${log.date}T00:00:00`), 'MMM d'),
        mindset: log.mindset_score,
        avgPnL,
      };
    });

  return (
    <section className="psy-card">
      <div className="psy-card-head">
        <h2>
          <LineChartIcon size={16} />
          Mindset vs Daily P&L
        </h2>
      </div>

      {chartData.length === 0 ? (
        <div className="psy-empty">
          <p>No psychology logs yet. Start logging daily to unlock trend tracking.</p>
        </div>
      ) : (
        <div className="psy-chart-wrap">
          <ResponsiveContainer width="100%" height={272}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-sub)" />
              <XAxis dataKey="dateLabel" tick={{ fill: 'var(--txt-3)', fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                domain={[0, 10]}
                tick={{ fill: 'var(--txt-3)', fontSize: 11 }}
                label={{ value: 'Mindset', angle: -90, position: 'insideLeft', fill: 'var(--txt-3)', fontSize: 10 }}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--txt-3)', fontSize: 11 }} tickFormatter={value => `$${value}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--txt)',
                }}
                labelStyle={{ color: 'var(--txt-2)' }}
                itemStyle={{ color: 'var(--txt)' }}
                formatter={(value: number, name: string) => (name === 'Avg P&L' ? [formatCurrency(value), name] : [value, name])}
              />
              <Legend wrapperStyle={{ color: 'var(--txt-2)', fontSize: 12 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mindset"
                stroke="var(--cobalt)"
                strokeWidth={2}
                dot={{ fill: 'var(--cobalt)', r: 3 }}
                activeDot={{ r: 5 }}
                name="Mindset Score"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgPnL"
                stroke="var(--green)"
                strokeWidth={2}
                dot={{ fill: 'var(--green)', r: 3 }}
                activeDot={{ r: 5 }}
                name="Avg P&L"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function TiltDetector({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a, b) => `${b.trade_date}${b.trade_time}`.localeCompare(`${a.trade_date}${a.trade_time}`));

  let consecutiveLosses = 0;
  for (const trade of sorted) {
    if (trade.pnl < 0) consecutiveLosses += 1;
    else break;
  }

  const emotionCounts = trades.reduce<Record<string, number>>((acc, trade) => {
    if (trade.emotional_state) {
      acc[trade.emotional_state] = (acc[trade.emotional_state] || 0) + 1;
    }
    return acc;
  }, {});

  const tiltStates = ['Revenge Trading', 'FOMO', 'Anxious', 'Overconfident'];
  const tiltCount = tiltStates.reduce((sum, state) => sum + (emotionCounts[state] || 0), 0);
  const totalTradesWithEmotion = trades.filter(trade => trade.emotional_state).length;
  const tiltPct = totalTradesWithEmotion > 0 ? Math.round((tiltCount / totalTradesWithEmotion) * 100) : 0;

  const tiltLevel: 'normal' | 'caution' | 'tilt' =
    consecutiveLosses >= 3 || tiltPct >= 40 ? 'tilt' : consecutiveLosses >= 2 || tiltPct >= 20 ? 'caution' : 'normal';

  const config = {
    normal: {
      label: 'Stable',
      text: 'No strong tilt signals. Keep process discipline steady.',
      badgeClass: 'psy-status-normal',
    },
    caution: {
      label: 'Caution',
      text: 'Warning signs detected. Reduce size and increase selectivity.',
      badgeClass: 'psy-status-caution',
    },
    tilt: {
      label: 'Tilt Detected',
      text: 'Pause trading and reset. Emotional pressure is elevated.',
      badgeClass: 'psy-status-tilt',
    },
  }[tiltLevel];

  return (
    <section className="psy-card">
      <div className="psy-card-head">
        <h2>
          <AlertTriangle size={16} />
          Tilt Detector
        </h2>
      </div>

      <div className={`psy-status ${config.badgeClass}`}>
        <p>{config.label}</p>
        <span>{config.text}</span>
      </div>

      <div className="psy-tilt-grid">
        <article>
          <p>Losing Streak</p>
          <strong className={consecutiveLosses >= 3 ? 'red' : consecutiveLosses >= 2 ? 'amber' : 'green'}>
            {consecutiveLosses}
          </strong>
          <span>consecutive losing trades</span>
        </article>
        <article>
          <p>Tilt-State Rate</p>
          <strong className={tiltPct >= 40 ? 'red' : tiltPct >= 20 ? 'amber' : 'green'}>
            {tiltPct}%
          </strong>
          <span>trades in tilt emotions</span>
        </article>
      </div>

      {Object.keys(emotionCounts).length > 0 && (
        <div className="psy-emotion-stack">
          {Object.entries(emotionCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([state, count]) => {
              const pct = trades.length > 0 ? Math.round((count / trades.length) * 100) : 0;
              const isTiltState = tiltStates.includes(state);
              return (
                <div key={state} className="psy-emotion-row">
                  <span className={isTiltState ? 'tilt' : ''}>{state}</span>
                  <div className="psy-emotion-bar">
                    <div className={isTiltState ? 'tilt' : ''} style={{ width: `${pct}%` }} />
                  </div>
                  <em>{count} ({pct}%)</em>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}

function RecentLogs({ logs }: { logs: PsychologyLog[] }) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  if (sorted.length === 0) {
    return (
      <section className="psy-card">
        <div className="psy-card-head">
          <h2>
            <CalendarDays size={16} />
            Recent Logs
          </h2>
        </div>
        <div className="psy-empty">
          <p>No entries yet. Save your first daily psychology log above.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="psy-card">
      <div className="psy-card-head">
        <h2>
          <CalendarDays size={16} />
          Recent Logs
        </h2>
      </div>
      <div className="psy-recent-list">
        {sorted.map(log => (
          <article key={log.id}>
            <div>
              <p>{format(parseISO(`${log.date}T00:00:00`), 'MMM d, yyyy')}</p>
              <span>{log.pre_session_notes || 'No pre-session note'}</span>
            </div>
            <div className="psy-recent-meta">
              <strong className={getScoreTone(log.mindset_score)}>{log.mindset_score}</strong>
              <em className={getMoodTone(log.mood)}>{log.mood}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PsychologyTracker() {
  const [logs, setLogs] = useState<PsychologyLog[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs.find(log => log.date === today) || null;

  const fetchData = useCallback(async () => {
    try {
      const [psychologyLogs, allTrades] = await Promise.all([psychologyApi.getAll(), tradesApi.getAll()]);
      setLogs(psychologyLogs as PsychologyLog[]);
      setTrades(allTrades as Trade[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = useMemo(() => {
    const avgMindset = logs.length ? logs.reduce((sum, log) => sum + log.mindset_score, 0) / logs.length : 0;
    const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const recentAvg = recent.length ? recent.reduce((sum, log) => sum + log.mindset_score, 0) / recent.length : 0;
    const streak = buildCurrentStreak(logs);
    const bestMood = logs.length
      ? Object.entries(
          logs.reduce<Record<string, number>>((acc, log) => {
            acc[log.mood] = (acc[log.mood] || 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
      : 'N/A';

    return {
      avgMindset,
      recentAvg,
      streak,
      bestMood,
      totalLogs: logs.length,
    };
  }, [logs]);

  if (loading) {
    return (
      <div className="psy-loading">
        <LoadingSpinner size="lg" label="Loading psychology data..." />
      </div>
    );
  }

  return (
    <div className="psy-page animate-fade-in">
      <header className="psy-header">
        <div>
          <h1>
            <Brain size={22} />
            Psychology Tracker
          </h1>
          <p>Track emotional execution quality, monitor tilt pressure, and tighten mental consistency.</p>
        </div>
      </header>

      <section className="psy-kpi-grid">
        <article className="psy-kpi">
          <p>Average Mindset</p>
          <strong className={getScoreTone(Math.round(summary.avgMindset))}>{summary.avgMindset.toFixed(1)}</strong>
          <span>all logged sessions</span>
        </article>
        <article className="psy-kpi">
          <p>7-Day Average</p>
          <strong className={getScoreTone(Math.round(summary.recentAvg))}>{summary.recentAvg.toFixed(1)}</strong>
          <span>recent emotional form</span>
        </article>
        <article className="psy-kpi">
          <p>Logging Streak</p>
          <strong className="cobalt">{summary.streak}</strong>
          <span>days tracked consecutively</span>
        </article>
        <article className="psy-kpi">
          <p>Most Common Mood</p>
          <strong className="amber">{summary.bestMood}</strong>
          <span>{summary.totalLogs} total logs</span>
        </article>
      </section>

      <main className="psy-layout">
        <div className="psy-stack">
          <DailyLogForm existing={todayLog} onSaved={fetchData} />
          <MindsetChart logs={logs} trades={trades} />
        </div>
        <div className="psy-stack">
          <TiltDetector trades={trades} />
          <RecentLogs logs={logs} />
        </div>
      </main>
    </div>
  );
}

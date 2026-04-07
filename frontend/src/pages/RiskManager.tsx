import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Calculator, Activity, Save,
  AlertTriangle, Lock, CheckCircle2
} from 'lucide-react';
import { riskApi } from '../services/api.js';
import { RiskSettings, DailyStatus, Trade } from '../types/index.js';
import { formatCurrency } from '../utils/calculations.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';

// ── Risk Settings Form ──────────────────────────────────────────────────────

function SettingsForm({
  settings, onSaved
}: {
  settings: RiskSettings | null;
  onSaved: (s: RiskSettings) => void;
}) {
  const [form, setForm] = useState({
    daily_loss_limit: settings?.daily_loss_limit ?? 500,
    max_trades_per_day: settings?.max_trades_per_day ?? 10,
    max_contracts_per_trade: settings?.max_contracts_per_trade ?? 5,
    account_size: settings?.account_size ?? 10000,
    risk_percentage: settings?.risk_percentage ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        daily_loss_limit: settings.daily_loss_limit,
        max_trades_per_day: settings.max_trades_per_day,
        max_contracts_per_trade: settings.max_contracts_per_trade,
        account_size: settings.account_size,
        risk_percentage: settings.risk_percentage,
      });
    }
  }, [settings]);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }));
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await riskApi.updateSettings(form);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <h3 className="text-slate-200 font-semibold flex items-center gap-2">
        <Shield size={17} className="text-blue-400" />
        Risk Settings
      </h3>

      <div className="space-y-4">
        <div>
          <label className="label">Account Size ($)</label>
          <input
            type="number"
            className="input-field"
            value={form.account_size}
            onChange={field('account_size')}
            step="100"
            min="0"
          />
        </div>
        <div>
          <label className="label">Daily Loss Limit ($)</label>
          <input
            type="number"
            className="input-field"
            value={form.daily_loss_limit}
            onChange={field('daily_loss_limit')}
            step="50"
            min="0"
          />
          <p className="text-slate-500 text-xs mt-1">
            Warning at 75% · Danger at 90% · Locked at 100%
          </p>
        </div>
        <div>
          <label className="label">Max Trades Per Day</label>
          <input
            type="number"
            className="input-field"
            value={form.max_trades_per_day}
            onChange={field('max_trades_per_day')}
            min="1"
          />
        </div>
        <div>
          <label className="label">Max Contracts Per Trade</label>
          <input
            type="number"
            className="input-field"
            value={form.max_contracts_per_trade}
            onChange={field('max_contracts_per_trade')}
            min="1"
          />
        </div>
        <div>
          <label className="label">Risk Per Trade (%)</label>
          <input
            type="number"
            className="input-field"
            value={form.risk_percentage}
            onChange={field('risk_percentage')}
            step="0.1"
            min="0.1"
            max="100"
          />
          <p className="text-slate-500 text-xs mt-1">
            Dollar risk = {formatCurrency((form.account_size * form.risk_percentage) / 100)} per trade
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saved ? (
          <><CheckCircle2 size={16} /> Saved!</>
        ) : saving ? (
          <><Save size={16} className="animate-pulse" /> Saving...</>
        ) : (
          <><Save size={16} /> Save Settings</>
        )}
      </button>
    </div>
  );
}

// ── Position Size Calculator ────────────────────────────────────────────────

function RiskCalculator({ settings }: { settings: RiskSettings | null }) {
  const [calc, setCalc] = useState({
    account_size: settings?.account_size ?? 10000,
    risk_pct: settings?.risk_percentage ?? 1,
    entry: '',
    stop: '',
    point_value: '2',
  });

  useEffect(() => {
    if (settings) {
      setCalc(c => ({
        ...c,
        account_size: settings.account_size,
        risk_pct: settings.risk_percentage,
      }));
    }
  }, [settings]);

  function f(key: keyof typeof calc) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCalc(c => ({ ...c, [key]: e.target.value }));
  }

  const entry = parseFloat(calc.entry);
  const stop = parseFloat(calc.stop);
  const pv = parseFloat(calc.point_value);
  const dollarRisk = (calc.account_size * calc.risk_pct) / 100;
  const priceDiff = !isNaN(entry) && !isNaN(stop) ? Math.abs(entry - stop) : 0;
  const contracts = priceDiff > 0 && pv > 0
    ? Math.floor(dollarRisk / (priceDiff * pv))
    : 0;

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <h3 className="text-slate-200 font-semibold flex items-center gap-2">
        <Calculator size={17} className="text-blue-400" />
        Position Size Calculator
      </h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Account Size ($)</label>
            <input
              type="number"
              className="input-field"
              value={calc.account_size}
              onChange={f('account_size')}
            />
          </div>
          <div>
            <label className="label">Risk Per Trade (%)</label>
            <input
              type="number"
              className="input-field"
              value={calc.risk_pct}
              onChange={f('risk_pct')}
              step="0.1"
              min="0.1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Entry Price</label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 19500"
              value={calc.entry}
              onChange={f('entry')}
            />
          </div>
          <div>
            <label className="label">Stop Loss Price</label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 19450"
              value={calc.stop}
              onChange={f('stop')}
            />
          </div>
        </div>
        <div>
          <label className="label">Point Value ($ per point)</label>
          <input
            type="number"
            className="input-field"
            placeholder="e.g. MNQ=2, MES=5, NQ=20"
            value={calc.point_value}
            onChange={f('point_value')}
          />
        </div>
      </div>

      {/* Result display */}
      <div className="bg-slate-900 rounded-xl p-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Dollar Risk</span>
          <span className="text-slate-200 font-medium">{formatCurrency(dollarRisk)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Points to Stop</span>
          <span className="text-slate-200 font-medium">
            {priceDiff > 0 ? priceDiff.toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Risk per Contract</span>
          <span className="text-slate-200 font-medium">
            {priceDiff > 0 && pv > 0 ? formatCurrency(priceDiff * pv) : '—'}
          </span>
        </div>
        <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
          <span className="text-slate-300 font-medium">Contracts to Trade</span>
          <span className={`text-3xl font-bold ${contracts > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
            {contracts > 0 ? contracts : '—'}
          </span>
        </div>
        {settings && contracts > settings.max_contracts_per_trade && (
          <p className="text-amber-400 text-xs flex items-center gap-1">
            <AlertTriangle size={12} />
            Exceeds your max contracts per trade limit ({settings.max_contracts_per_trade})
          </p>
        )}
      </div>
    </div>
  );
}

// ── Daily Status Panel ──────────────────────────────────────────────────────

function DailyStatusPanel({ status }: { status: DailyStatus | null }) {
  if (!status) return null;

  const pct = status.lossUsedPercent;
  const barColor =
    pct >= 100 ? 'bg-red-500'
    : pct >= 90 ? 'bg-red-500'
    : pct >= 75 ? 'bg-amber-500'
    : 'bg-green-500';

  const statusLabel =
    status.isLocked ? 'LOCKED'
    : pct >= 90 ? 'DANGER'
    : pct >= 75 ? 'WARNING'
    : 'NORMAL';

  const statusColor =
    status.isLocked ? 'text-red-400'
    : pct >= 90 ? 'text-red-400'
    : pct >= 75 ? 'text-amber-400'
    : 'text-green-400';

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 space-y-5">
      <h3 className="text-slate-200 font-semibold flex items-center gap-2">
        <Activity size={17} className="text-blue-400" />
        Today's Status
      </h3>

      {/* Top row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Today's P&L</p>
          <p className={`text-2xl font-bold ${status.todayPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(status.todayPnL)}
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Trades Taken</p>
          <p className="text-2xl font-bold text-slate-200">
            {status.tradesCount}
            <span className="text-slate-500 text-base font-normal">
              /{status.maxTradesPerDay}
            </span>
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Loss Used</p>
          <p className={`text-2xl font-bold ${statusColor}`}>
            {Math.min(pct, 100).toFixed(0)}%
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-slate-400 text-xs mb-1">Risk Status</p>
          <p className={`text-xl font-bold ${statusColor}`}>{statusLabel}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Daily Loss Limit</span>
          <span>
            {formatCurrency(Math.abs(Math.min(status.todayPnL, 0)))} /
            {formatCurrency(status.dailyLossLimit)}
          </span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>75% ⚠</span>
          <span>90% ⛔</span>
          <span>100% 🔒</span>
        </div>
      </div>

      {status.isLocked && (
        <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-4 flex items-center gap-3">
          <Lock size={18} className="text-red-400 shrink-0" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Daily Loss Limit Reached</p>
            <p className="text-red-400/70 text-xs mt-0.5">
              You've hit your daily loss limit. No more trades today. Come back tomorrow with a fresh mindset.
            </p>
          </div>
        </div>
      )}

      {/* Today's trades */}
      {status.todayTrades && status.todayTrades.length > 0 && (
        <div>
          <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">
            Today's Trades
          </h4>
          <div className="space-y-2">
            {status.todayTrades.map((t: Trade) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    t.direction === 'Long' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  }`}>
                    {t.direction}
                  </span>
                  <span className="text-slate-300 text-sm">{t.symbol}</span>
                  <span className="text-slate-500 text-xs">{t.trade_time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs">{t.exit_reason}</span>
                  <span className={`text-sm font-medium ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {t.pnl >= 0 ? '+' : ''}{formatCurrency(t.pnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {status.todayTrades && status.todayTrades.length === 0 && (
        <div className="text-center text-slate-500 text-sm py-4">
          No trades logged today.
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RiskManager() {
  const [settings, setSettings] = useState<RiskSettings | null>(null);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        riskApi.getSettings(),
        riskApi.getDailyStatus(),
      ]);
      setSettings(s);
      setDailyStatus(d as DailyStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh daily status every 30 seconds
    const interval = setInterval(() => {
      riskApi.getDailyStatus().then(d => setDailyStatus(d as DailyStatus)).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" label="Loading risk data..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Shield size={22} className="text-blue-400" />
          Risk Manager
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Protect your account with hard limits and real-time monitoring
        </p>
      </div>

      {/* Settings + Calculator side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsForm settings={settings} onSaved={s => { setSettings(s); fetchData(); }} />
        <RiskCalculator settings={settings} />
      </div>

      {/* Daily status full width */}
      <DailyStatusPanel status={dailyStatus} />
    </div>
  );
}

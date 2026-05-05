import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  CreditCard,
  Flame,
  Pencil,
  Plus,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';
import { billingApi, type BillingLivePricesResponse } from '../services/api.js';
import useFlyxaStore from '../store/flyxaStore.js';
import type { BillingAccount as StoreBillingAccount } from '../store/types.js';

type AccountStatus = 'Active' | 'Passed' | 'Blown' | 'Reset';

interface BillingAccount {
  id: string;
  firm: string;
  size: string;
  listPrice: number;
  discountCode: string;
  discountPct: number;
  actualPrice: number;
  purchaseDate: string;
  status: AccountStatus;
  payoutReceived: number;
}

interface BillingFormState {
  firm: string;
  size: string;
  listPrice: number;
  discountCode: string;
  discountPct: number;
  purchaseDate: string;
  status: AccountStatus;
  payoutReceived: number;
}


const STATUS_OPTIONS: AccountStatus[] = ['Active', 'Passed', 'Blown', 'Reset'];

const FIRM_OPTIONS = [
  'Apex Funded',
  'FTMO',
  'MyFundedFutures',
  'Topstep',
  'The Funded Trader',
  'True Forex Funds',
  'E8 Funding',
  'Other',
] as const;

const FIRM_PRICES: Record<string, Record<string, number>> = {
  'Apex Funded': {
    '$25,000': 147,
    '$50,000': 167,
    '$100,000': 207,
    '$150,000': 297,
    '$250,000': 497,
    '$300,000': 597,
  },
  FTMO: {
    '€10,000': 155,
    '€25,000': 250,
    '€50,000': 345,
    '€100,000': 540,
    '€200,000': 1080,
  },
  MyFundedFutures: {
    '$50,000': 165,
    '$100,000': 250,
    '$150,000': 340,
    '$200,000': 430,
  },
  Topstep: {
    '$50,000': 99,
    '$100,000': 149,
    '$150,000': 199,
  },
};

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function computeActualPrice(listPrice: number, discountPct: number): number {
  const pct = clampPercentage(discountPct);
  const actual = listPrice * (1 - pct / 100);
  return Number(actual.toFixed(2));
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedCurrency(value: number): string {
  const abs = formatCurrency(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function formatDateLabel(value: string): string {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getTodayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getSizesForFirm(firm: string): string[] {
  return Object.keys(FIRM_PRICES[firm] ?? {});
}

function getDefaultFormState(): BillingFormState {
  const defaultFirm = 'Apex Funded';
  const defaultSize = '$100,000';
  const defaultListPrice = FIRM_PRICES[defaultFirm]?.[defaultSize] ?? 0;

  return {
    firm: defaultFirm,
    size: defaultSize,
    listPrice: defaultListPrice,
    discountCode: '',
    discountPct: 0,
    purchaseDate: getTodayInputDate(),
    status: 'Active',
    payoutReceived: 0,
  };
}


function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `billing-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Billing() {
  const storeBillingAccounts = useFlyxaStore(state => state.billingAccounts);
  const hydrateSharedData = useFlyxaStore(state => state.hydrateSharedData);
  const [accounts, setAccounts] = useState<BillingAccount[]>(
    () => storeBillingAccounts as unknown as BillingAccount[]
  );
  const [firmFilter, setFirmFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BillingFormState>(getDefaultFormState);
  const [livePricesByFirm, setLivePricesByFirm] = useState<Record<string, BillingLivePricesResponse>>({});
  const [livePricingLoadingFirm, setLivePricingLoadingFirm] = useState<string | null>(null);
  const [livePricingError, setLivePricingError] = useState<string | null>(null);

  useEffect(() => {
    hydrateSharedData({ billingAccounts: accounts as unknown as StoreBillingAccount[] });
  }, [accounts, hydrateSharedData]);

  const getPreferredListPrice = (
    firm: string,
    size: string,
    currentListPrice: number
  ): number => {
    const livePrice = livePricesByFirm[firm]?.prices?.[size];
    if (isFiniteNumber(livePrice)) {
      return livePrice;
    }

    const fallbackPrice = FIRM_PRICES[firm]?.[size];
    if (isFiniteNumber(fallbackPrice)) {
      return fallbackPrice;
    }

    return currentListPrice;
  };

  const fetchLivePricesForFirm = async (firm: string): Promise<BillingLivePricesResponse | null> => {
    if (!firm) {
      return null;
    }

    if (livePricesByFirm[firm]) {
      return livePricesByFirm[firm];
    }

    setLivePricingLoadingFirm(firm);
    setLivePricingError(null);
    try {
      const payload = await billingApi.getLivePrices(firm);
      setLivePricesByFirm(current => ({ ...current, [firm]: payload }));
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch live prices.';
      setLivePricingError(message);
      return null;
    } finally {
      setLivePricingLoadingFirm(current => (current === firm ? null : current));
    }
  };

  const openAddModal = () => {
    const defaults = getDefaultFormState();
    setEditingId(null);
    setForm(defaults);
    setIsModalOpen(true);
    void fetchLivePricesForFirm(defaults.firm).then(payload => {
      const livePrice = payload?.prices?.[defaults.size];
      if (!isFiniteNumber(livePrice)) return;
      setForm(current => (
        current.firm === defaults.firm && current.size === defaults.size
          ? { ...current, listPrice: livePrice }
          : current
      ));
    });
  };

  const openEditModal = (account: BillingAccount) => {
    setEditingId(account.id);
    setForm({
      firm: account.firm,
      size: account.size,
      listPrice: account.listPrice,
      discountCode: account.discountCode,
      discountPct: account.discountPct,
      purchaseDate: account.purchaseDate,
      status: account.status,
      payoutReceived: account.payoutReceived,
    });
    setIsModalOpen(true);
    void fetchLivePricesForFirm(account.firm);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const actualPricePreview = useMemo(
    () => computeActualPrice(Math.max(0, toNumber(form.listPrice, 0)), clampPercentage(form.discountPct)),
    [form.discountPct, form.listPrice]
  );
  const savingsPreview = useMemo(
    () => Math.max(0, Math.max(0, toNumber(form.listPrice, 0)) - actualPricePreview),
    [actualPricePreview, form.listPrice]
  );

  const derived = useMemo(() => {
    const totalAccounts = accounts.length;
    const totalSpent = accounts.reduce((sum, account) => sum + account.actualPrice, 0);
    const totalPayouts = accounts.reduce((sum, account) => sum + Math.max(0, account.payoutReceived), 0);
    const totalListPrice = accounts.reduce((sum, account) => sum + account.listPrice, 0);
    const totalSaved = totalListPrice - totalSpent;
    const netPnL = totalPayouts - totalSpent;
    const passedAccounts = accounts.filter(account => account.status === 'Passed').length;
    const passRate = totalAccounts > 0 ? (passedAccounts / totalAccounts) * 100 : 0;
    const avgFeePerAccount = totalAccounts > 0 ? totalSpent / totalAccounts : 0;

    let monthsActive = 1;
    if (accounts.length > 0) {
      const firstPurchase = accounts
        .map(account => new Date(`${account.purchaseDate}T00:00:00`).getTime())
        .filter(timestamp => Number.isFinite(timestamp))
        .sort((a, b) => a - b)[0];
      if (Number.isFinite(firstPurchase)) {
        const elapsedMs = Math.max(1, Date.now() - firstPurchase);
        monthsActive = Math.max(1, elapsedMs / (1000 * 60 * 60 * 24 * 30.4375));
      }
    }
    const monthlyBurn = totalSpent / monthsActive;

    const byFirmMap = new Map<string, { firm: string; accounts: number; spent: number; payouts: number }>();
    accounts.forEach(account => {
      const current = byFirmMap.get(account.firm) ?? {
        firm: account.firm,
        accounts: 0,
        spent: 0,
        payouts: 0,
      };
      current.accounts += 1;
      current.spent += account.actualPrice;
      current.payouts += Math.max(0, account.payoutReceived);
      byFirmMap.set(account.firm, current);
    });

    const roiByFirm = Array.from(byFirmMap.values())
      .map(row => ({
        ...row,
        roi: row.payouts - row.spent,
        recoveredRatio: row.spent > 0 ? Math.min(1, row.payouts / row.spent) : 0,
      }))
      .sort((a, b) => b.spent - a.spent);

    return {
      totalAccounts,
      totalSpent,
      totalPayouts,
      netPnL,
      monthlyBurn,
      avgFeePerAccount,
      passedAccounts,
      passRate,
      totalListPrice,
      totalSaved,
      roiByFirm,
    };
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      if (firmFilter !== 'All' && account.firm !== firmFilter) return false;
      if (statusFilter !== 'All' && account.status !== statusFilter) return false;
      return true;
    });
  }, [accounts, firmFilter, statusFilter]);

  const footerTotals = useMemo(() => {
    const totalListPrice = filteredAccounts.reduce((sum, account) => sum + account.listPrice, 0);
    const totalPaid = filteredAccounts.reduce((sum, account) => sum + account.actualPrice, 0);
    const totalSaved = totalListPrice - totalPaid;
    const passedCount = filteredAccounts.filter(account => account.status === 'Passed').length;
    return {
      totalListPrice,
      totalPaid,
      totalSaved,
      count: filteredAccounts.length,
      passedCount,
    };
  }, [filteredAccounts]);

  const knownSizes = useMemo(() => getSizesForFirm(form.firm), [form.firm]);
  const hasFirmLookup = knownSizes.length > 0;
  const currentLivePricing = livePricesByFirm[form.firm];
  const selectedSizeIsFallback = Boolean(
    currentLivePricing?.unavailableSizes?.includes(form.size)
  );
  const currentPricingSourceLabel = currentLivePricing?.source
    ? (() => {
      try {
        return new URL(currentLivePricing.source).hostname.replace(/^www\./, '');
      } catch {
        return currentLivePricing.source;
      }
    })()
    : null;

  const saveAccount = () => {
    const listPrice = Math.max(0, toNumber(form.listPrice, 0));
    const discountPct = clampPercentage(form.discountPct);
    const actualPrice = computeActualPrice(listPrice, discountPct);
    const payoutReceived = form.status === 'Passed' ? Math.max(0, toNumber(form.payoutReceived, 0)) : 0;

    const next: BillingAccount = {
      id: editingId ?? createId(),
      firm: form.firm.trim() || 'Other',
      size: form.size.trim() || 'Custom',
      listPrice,
      discountCode: form.discountCode.trim().toUpperCase(),
      discountPct,
      actualPrice,
      purchaseDate: form.purchaseDate || getTodayInputDate(),
      status: form.status,
      payoutReceived,
    };

    setAccounts(current => editingId
      ? current.map(row => (row.id === editingId ? next : row))
      : [next, ...current]);
    closeModal();
  };

  const deleteAccount = (id: string) => {
    const target = accounts.find(account => account.id === id);
    if (!target) return;
    const confirmed = window.confirm(`Delete billing entry for ${target.firm} ${target.size}?`);
    if (!confirmed) return;
    setAccounts(current => current.filter(account => account.id !== id));
  };

  const setFormField = <K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const applyFirm = (firm: string) => {
    const nextSizes = getSizesForFirm(firm);
    const nextSize = nextSizes[0] ?? form.size;
    const nextListPrice = getPreferredListPrice(firm, nextSize, form.listPrice);
    setForm(current => ({
      ...current,
      firm,
      size: nextSizes.length > 0 ? nextSize : current.size,
      listPrice: nextListPrice,
    }));

    void fetchLivePricesForFirm(firm).then(payload => {
      const livePrice = payload?.prices?.[nextSize];
      if (!isFiniteNumber(livePrice)) return;
      setForm(current => (
        current.firm === firm && current.size === nextSize
          ? { ...current, listPrice: livePrice }
          : current
      ));
    });
  };

  const applySize = (size: string) => {
    const selectedFirm = form.firm;
    const lookupPrice = getPreferredListPrice(selectedFirm, size, form.listPrice);
    setForm(current => ({
      ...current,
      size,
      listPrice: lookupPrice,
    }));

    void fetchLivePricesForFirm(selectedFirm).then(payload => {
      const livePrice = payload?.prices?.[size];
      if (!isFiniteNumber(livePrice)) return;
      setForm(current => (
        current.firm === selectedFirm && current.size === size
          ? { ...current, listPrice: livePrice }
          : current
      ));
    });
  };

  const getStatusBadgeStyle = (status: AccountStatus): CSSProperties => {
    if (status === 'Passed') {
      return {
        background: 'var(--green-dim)',
        color: 'var(--green)',
        border: '1px solid var(--green-border)',
      };
    }
    if (status === 'Blown') {
      return {
        background: 'var(--red-dim)',
        color: 'var(--red)',
        border: '1px solid var(--red-border)',
      };
    }
    if (status === 'Reset') {
      return {
        background: 'var(--surface-2)',
        color: 'var(--txt-3)',
        border: '1px solid var(--border)',
      };
    }
    return {
      background: 'var(--amber-dim)',
      color: 'var(--amber)',
      border: '1px solid var(--amber-border)',
    };
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 28px 40px', background: 'var(--app-bg)' }}>
      <style>
        {`
          .billing-stat-card {
            transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
          }
          .billing-stat-card:hover {
            border-color: var(--amber-border);
            transform: translateY(-1px);
            background: var(--surface-2);
          }
          .billing-table-row:hover td {
            background: var(--surface-2);
          }
          .billing-action-icon {
            border: none;
            background: transparent;
            color: var(--txt-3);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            cursor: pointer;
          }
          .billing-action-icon:hover {
            color: var(--txt-2);
          }
          .billing-action-icon.billing-delete:hover {
            color: var(--red);
          }
          .billing-status-toggle {
            border: none;
            height: 32px;
            font-size: 12px;
            font-weight: 500;
            color: var(--txt-2);
            background: var(--surface-2);
            cursor: pointer;
          }
          .billing-status-toggle.is-active {
            background: var(--amber);
            color: var(--bg);
          }
          .billing-modal-field {
            width: 100%;
            height: 38px;
            border-radius: 5px;
            border: 1px solid var(--border);
            background: var(--surface-2);
            color: var(--txt);
            font-size: 13px;
            padding: 0 12px;
            outline: none;
          }
          .billing-modal-field:focus {
            border-color: var(--amber-border);
          }
          .billing-filter-wrap {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0 8px;
            height: 30px;
            border-radius: 5px;
            border: 1px solid var(--border);
            background: var(--surface-2);
          }
          .billing-filter-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--txt-3);
          }
          .billing-filter-select {
            border: none;
            outline: none;
            background: transparent;
            color: var(--txt-2);
            font-size: 12px;
            height: 100%;
          }
        `}
      </style>

      <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>
            Billing
          </p>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--txt)' }}>Billing</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--txt-2)' }}>
            Prop firm account costs, discount tracking, and ROI
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          style={{
            height: 34,
            borderRadius: 5,
            border: 'none',
            background: 'var(--amber)',
            color: 'var(--bg)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          Add Account
        </button>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 24 }}>
        <article className="billing-stat-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-border)', marginBottom: 8 }}>
            <TrendingDown size={15} />
          </span>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Total Spent</p>
          <p style={{ margin: '8px 0 5px', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(derived.totalSpent)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--txt-3)' }}>across all accounts and resets</p>
        </article>

        <article className="billing-stat-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green-border)', marginBottom: 8 }}>
            <TrendingUp size={15} />
          </span>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Total Payouts Received</p>
          <p style={{ margin: '8px 0 5px', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(derived.totalPayouts)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--txt-3)' }}>from funded accounts</p>
        </article>

        <article className="billing-stat-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: derived.netPnL >= 0 ? 'var(--cobalt-dim)' : 'var(--red-dim)', color: derived.netPnL >= 0 ? 'var(--cobalt)' : 'var(--red)', border: derived.netPnL >= 0 ? '1px solid var(--cobalt-border)' : '1px solid var(--red-border)', marginBottom: 8 }}>
            <CreditCard size={15} />
          </span>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Net P&amp;L</p>
          <p style={{ margin: '8px 0 5px', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: derived.netPnL >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
            {formatSignedCurrency(derived.netPnL)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--txt-3)' }}>overall return on prop firm investment</p>
        </article>

        <article className="billing-stat-card" style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber-border)', marginBottom: 8 }}>
            <Flame size={15} />
          </span>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Monthly Burn Rate</p>
          <p style={{ margin: '8px 0 5px', fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 500, color: 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(derived.monthlyBurn)}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--txt-3)' }}>avg monthly spend on account fees</p>
        </article>
      </section>

      <section style={{ position: 'relative', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 22px', marginBottom: 24 }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 3,
            height: '100%',
            background: 'linear-gradient(to bottom, var(--amber), transparent)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280, maxWidth: 480 }}>
            <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Monthly Break-even</p>
            <p style={{ margin: '8px 0 6px', fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 500, color: 'var(--amber)', fontVariantNumeric: 'tabular-nums' }}>
              {formatCurrency(derived.monthlyBurn)}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.55 }}>
              You need to earn this each month just to cover your account fees before you are actually profitable.
            </p>
          </div>

          <span aria-hidden="true" style={{ width: 1, height: 48, background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(derived.avgFeePerAccount)}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Avg fee per account</p>
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{derived.totalAccounts}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Accounts purchased</p>
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{derived.passedAccounts}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Accounts passed</p>
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 18, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>
                {derived.totalAccounts > 0 ? `${derived.passRate.toFixed(1)}%` : '0.0%'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Pass rate</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <header style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>Account Ledger</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Every purchase logged</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label className="billing-filter-wrap">
              <span className="billing-filter-label">Firm</span>
              <select
                className="billing-filter-select"
                value={firmFilter}
                onChange={event => setFirmFilter(event.target.value)}
              >
                <option value="All">All Firms</option>
                {Array.from(new Set(accounts.map(account => account.firm))).map(firm => (
                  <option key={firm} value={firm}>
                    {firm}
                  </option>
                ))}
              </select>
            </label>

            <label className="billing-filter-wrap">
              <span className="billing-filter-label">Status</span>
              <select
                className="billing-filter-select"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
              >
                <option value="All">All</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={openAddModal}
              style={{
                height: 30,
                borderRadius: 5,
                border: 'none',
                background: 'var(--amber)',
                color: 'var(--app-bg)',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        </header>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead>
              <tr>
                {[
                  'Firm',
                  'Account Size',
                  'Purchase Date',
                  'List Price',
                  'Discount Code',
                  'Discount %',
                  'Actual Price',
                  'Status',
                  'Payout',
                  'ROI',
                  'Actions',
                ].map(header => (
                  <th
                    key={header}
                    style={{
                      textAlign: 'left',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--txt-3)',
                      padding: '10px 18px',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '26px 24px', textAlign: 'center', fontSize: 12, color: 'var(--txt-3)', borderBottom: '1px solid var(--border-sub)' }}>
                    <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--amber-dim)',
                          border: '1px solid var(--amber-border)',
                          color: 'var(--amber)',
                        }}
                      >
                        <CreditCard size={16} />
                      </span>
                      <span style={{ color: 'var(--txt-2)', fontSize: 13, fontWeight: 500 }}>
                        No accounts yet
                      </span>
                      <span style={{ color: 'var(--txt-3)', fontSize: 12 }}>
                        Add your first prop account to unlock spend, burn, and ROI tracking.
                      </span>
                      <button
                        type="button"
                        onClick={openAddModal}
                        style={{
                          marginTop: 4,
                          height: 28,
                          borderRadius: 5,
                          border: 'none',
                          background: 'var(--amber)',
                          color: 'var(--app-bg)',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '0 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={12} />
                        Add first account
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account, index) => {
                  const roiValue = account.payoutReceived > 0 ? account.payoutReceived - account.actualPrice : null;
                  return (
                    <tr key={account.id} className="billing-table-row">
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{account.firm}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--txt-3)', fontFamily: 'var(--font-mono)' }}>Performance Account</p>
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                        {account.size}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt-3)', whiteSpace: 'nowrap' }}>
                        {formatDateLabel(account.purchaseDate)}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--txt-2)', textDecoration: account.discountPct > 0 ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>
                        {formatCurrency(account.listPrice)}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)' }}>
                        {account.discountCode ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 8px', display: 'inline-flex' }}>
                            {account.discountCode}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)' }}>
                        {account.discountPct > 0 ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: 3, padding: '2px 8px', display: 'inline-flex' }}>
                            {account.discountPct.toFixed(0)}% off
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--txt)', whiteSpace: 'nowrap' }}>
                        {formatCurrency(account.actualPrice)}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)' }}>
                        <span
                          style={{
                            ...getStatusBadgeStyle(account.status),
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            display: 'inline-flex',
                          }}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 12, color: account.payoutReceived > 0 ? 'var(--green)' : 'var(--txt-3)', whiteSpace: 'nowrap' }}>
                        {account.payoutReceived > 0 ? formatCurrency(account.payoutReceived) : '—'}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)', fontFamily: 'var(--font-mono)', fontSize: 12, color: roiValue === null ? 'var(--txt-3)' : roiValue >= 0 ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                        {roiValue === null ? '—' : formatSignedCurrency(roiValue)}
                      </td>
                      <td style={{ padding: '14px 18px', borderBottom: index === filteredAccounts.length - 1 ? 'none' : '1px solid var(--border-sub)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          <button type="button" className="billing-action-icon" onClick={() => openEditModal(account)} aria-label={`Edit ${account.firm} account`} title="Edit account">
                            <Pencil size={13} />
                          </button>
                          <button type="button" className="billing-action-icon billing-delete" onClick={() => deleteAccount(account.id)} aria-label={`Delete ${account.firm} account`} title="Delete account">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
            {footerTotals.count} accounts · {footerTotals.passedCount} passed
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
              Total list price:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--txt-2)', textDecoration: 'line-through' }}>
                {formatCurrency(footerTotals.totalListPrice)}
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
              Total saved:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
                {formatCurrency(footerTotals.totalSaved)}
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>
              Total paid:{' '}
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--txt)' }}>
                {formatCurrency(footerTotals.totalPaid)}
              </span>
            </span>
          </span>
        </footer>
      </section>

      <section style={{ marginTop: 16, background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>ROI by Firm</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--txt-3)' }}>Which firms have been worth it</p>
        </header>

        {derived.roiByFirm.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 12, color: 'var(--txt-3)' }}>No firms logged yet.</div>
        ) : (
          derived.roiByFirm.map((row, index) => (
            <div
              key={row.firm}
              style={{
                padding: '14px 18px',
                borderBottom: index === derived.roiByFirm.length - 1 ? 'none' : '1px solid var(--border-sub)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ minWidth: 140, fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{row.firm}</span>
              <span style={{ fontSize: 12, color: 'var(--txt-3)', fontFamily: 'var(--font-mono)' }}>{row.accounts} accounts</span>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, fontSize: 10, color: 'var(--txt-3)' }}>
                  <span>Spent: {formatCurrency(row.spent)}</span>
                  <span>Received: {formatCurrency(row.payouts)}</span>
                </div>
                <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <span style={{ position: 'absolute', inset: 0, background: 'var(--red)' }} />
                  <span style={{ position: 'absolute', inset: 0, width: `${row.recoveredRatio * 100}%`, background: 'var(--green)' }} />
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 3,
                  padding: '4px 10px',
                  background: row.roi >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
                  color: row.roi >= 0 ? 'var(--green)' : 'var(--red)',
                  border: row.roi >= 0 ? '1px solid var(--green-border)' : '1px solid var(--red-border)',
                }}
              >
                {formatSignedCurrency(row.roi)}
              </span>
            </div>
          ))
        )}
      </section>

      {isModalOpen && (
        <div
          role="presentation"
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 120,
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit Account' : 'Add Account'}
            onClick={event => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--txt)' }}>
                {editingId ? 'Edit Account' : 'Add Account'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--txt-3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Close modal"
              >
                <X size={14} />
              </button>
            </header>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Prop Firm</label>
                <select className="billing-modal-field" value={form.firm} onChange={event => applyFirm(event.target.value)}>
                  {FIRM_OPTIONS.map(firm => (
                    <option key={firm} value={firm}>
                      {firm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Account Size</label>
                {hasFirmLookup ? (
                  <select className="billing-modal-field" value={form.size} onChange={event => applySize(event.target.value)}>
                    {knownSizes.map(size => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="billing-modal-field"
                    value={form.size}
                    onChange={event => setFormField('size', event.target.value)}
                    placeholder="Enter account size"
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>
                  List Price (before discount)
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--txt-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  >
                    $
                  </span>
                  <input
                    className="billing-modal-field"
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(form.listPrice) ? form.listPrice : 0}
                    onChange={event => setFormField('listPrice', Math.max(0, toNumber(event.target.value, 0)))}
                    style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', paddingLeft: 28 }}
                  />
                </div>
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 11,
                    color: livePricingLoadingFirm === form.firm
                      ? 'var(--txt-2)'
                      : livePricingError && !currentLivePricing
                        ? 'var(--red)'
                        : selectedSizeIsFallback
                          ? 'var(--amber)'
                          : currentLivePricing?.live
                            ? 'var(--green)'
                            : 'var(--txt-3)',
                  }}
                >
                  {livePricingLoadingFirm === form.firm
                    ? 'Syncing live listing prices...'
                    : livePricingError && !currentLivePricing
                      ? `Live pricing unavailable (${livePricingError}). Using fallback values.`
                      : selectedSizeIsFallback
                        ? `Live source missing this size. Using fallback value${currentPricingSourceLabel ? ` · Source: ${currentPricingSourceLabel}` : ''}.`
                        : currentLivePricing?.live
                          ? `Live price synced${currentPricingSourceLabel ? ` · Source: ${currentPricingSourceLabel}` : ''}.`
                          : currentLivePricing?.note ?? 'Using configured fallback values.'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>
                  Discount Code (optional)
                </label>
                <input
                  className="billing-modal-field"
                  value={form.discountCode}
                  onChange={event => setFormField('discountCode', event.target.value.toUpperCase())}
                  placeholder="e.g. APEX20"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Discount %</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="billing-modal-field"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={Number.isFinite(form.discountPct) ? form.discountPct : 0}
                    onChange={event => setFormField('discountPct', clampPercentage(toNumber(event.target.value, 0)))}
                    style={{ fontFamily: 'var(--font-mono)', paddingRight: 30 }}
                  />
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--txt-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                    }}
                  >
                    %
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                  You save {formatCurrency(savingsPreview)}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--txt-3)', fontFamily: 'var(--font-mono)' }}>
                  Actual price: {formatCurrency(actualPricePreview)}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Actual Price Paid</label>
                <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 500, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(actualPricePreview)}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Purchase Date</label>
                <input
                  className="billing-modal-field"
                  type="date"
                  value={form.purchaseDate}
                  onChange={event => setFormField('purchaseDate', event.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>Status</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status}
                      type="button"
                      className={`billing-status-toggle${form.status === status ? ' is-active' : ''}`}
                      onClick={() => setFormField('status', status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {form.status === 'Passed' && (
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--txt-2)', marginBottom: 6 }}>
                    Payout Received (if any)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--txt-3)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                      }}
                    >
                      $
                    </span>
                    <input
                      className="billing-modal-field"
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number.isFinite(form.payoutReceived) ? form.payoutReceived : 0}
                      onChange={event => setFormField('payoutReceived', Math.max(0, toNumber(event.target.value, 0)))}
                      style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', paddingLeft: 28 }}
                    />
                  </div>
                </div>
              )}
            </div>

            <footer style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  height: 32,
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--txt-2)',
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAccount}
                style={{
                  height: 32,
                  borderRadius: 5,
                  border: 'none',
                  background: 'var(--amber)',
                  color: 'var(--bg)',
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

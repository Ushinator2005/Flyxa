import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Construction,
  Download,
  FileText,
  Grid2x2,
  LineChart,
  Pencil,
  Plus,
} from 'lucide-react';

type TradingPlanTab =
  | 'trading-plan'
  | 'risk-rules'
  | 'playbook'
  | 'prop-firm-rules'
  | 'pre-session-checklist';

type ColorTone = 'amber' | 'cobalt' | 'green' | 'red' | 'neutral';

interface PlanBlock {
  id: string;
  name: string;
  iconColor: ColorTone;
  content: string;
  placeholder: string;
  isOpen: boolean;
}

interface RiskRule {
  id: string;
  label: string;
  value: string;
  unit: string;
  color: 'red' | 'amber' | 'green' | 'default';
}

interface Setup {
  id: string;
  rank: 'A+' | 'A' | 'B';
  name: string;
  description: string;
  timeframe: string;
  market: string;
  avgRR: string;
  confluences: string[];
  isExpanded: boolean;
}

interface PropFirmParam {
  label: string;
  value: string;
  color: 'amber' | 'green' | 'default';
}

interface PropFirm {
  id: string;
  name: string;
  phase: 'Eval' | 'Funded';
  params: PropFirmParam[];
  progress?: {
    percent: number;
    currentLabel: string;
    targetLabel: string;
  };
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface TradingPlanPersistedState {
  planBlocks?: Array<Pick<PlanBlock, 'id' | 'content' | 'isOpen'>>;
  checklist?: Array<Pick<ChecklistItem, 'id' | 'done'>>;
  setups?: Array<Pick<Setup, 'id' | 'isExpanded'>>;
  lastSaved?: string;
}

const LOCAL_STORAGE_KEY = 'flyxa_trading_plan_state_v1';

const PLAN_BLOCK_ICONS = {
  market: Clock,
  edge: LineChart,
  entry: CheckSquare,
  avoid: AlertCircle,
  windows: Grid2x2,
} as const;

const TAB_ITEMS: Array<{ id: TradingPlanTab; label: string }> = [
  { id: 'trading-plan', label: 'Trading Plan' },
  { id: 'risk-rules', label: 'Risk Rules' },
  { id: 'playbook', label: 'Playbook' },
  { id: 'prop-firm-rules', label: 'Prop Firm Rules' },
  { id: 'pre-session-checklist', label: 'Pre-session Checklist' },
];

const INITIAL_PLAN_BLOCKS: PlanBlock[] = [
  {
    id: 'market',
    name: 'What markets I trade and why',
    iconColor: 'amber',
    content: '',
    placeholder: 'Which instruments, why these and not others, what you understand about them...',
    isOpen: true,
  },
  {
    id: 'edge',
    name: 'My edge and why it works',
    iconColor: 'cobalt',
    content: '',
    placeholder: 'The specific setup or condition that gives you a statistical advantage...',
    isOpen: true,
  },
  {
    id: 'entry',
    name: 'What a valid entry looks like',
    iconColor: 'green',
    content: '',
    placeholder: 'Step by step - every condition that must be true before you press the button...',
    isOpen: true,
  },
  {
    id: 'avoid',
    name: 'What I do NOT trade',
    iconColor: 'red',
    content: '',
    placeholder: 'News windows, time restrictions, conditions that invalidate a setup...',
    isOpen: true,
  },
  {
    id: 'windows',
    name: 'Time windows I trade',
    iconColor: 'neutral',
    content: '',
    placeholder: 'Session times, when you are active, when you are flat...',
    isOpen: true,
  },
];

const INITIAL_RISK_RULES: RiskRule[] = [
  { id: 'daily-loss', label: 'Daily loss limit', value: '$500', unit: '/ day', color: 'red' },
  { id: 'max-trades', label: 'Max trades per day', value: '3', unit: 'trades', color: 'amber' },
  { id: 'max-contracts', label: 'Max contracts per trade', value: '2', unit: 'contracts', color: 'default' },
  { id: 'min-rr', label: 'Minimum R:R to take a trade', value: '2.0R', unit: '', color: 'green' },
  { id: 'max-losses', label: 'Max consecutive losses before stopping', value: '2', unit: 'in a row', color: 'red' },
  { id: 'risk-per-trade', label: 'Risk per trade (% of account)', value: '0.5%', unit: '', color: 'default' },
];

const INITIAL_SETUPS: Setup[] = [
  {
    id: 'setup-a-plus',
    rank: 'A+',
    name: 'Opening Reclaim Continuation',
    description: 'Strong reclaim through prior session level with pullback hold and momentum confirmation.',
    timeframe: '5m',
    market: 'NQ',
    avgRR: '2.8R',
    confluences: [
      'Reclaim above prior session high with volume expansion',
      'Pullback respects VWAP and prior breakout level',
      'Second push confirms momentum with no immediate rejection',
    ],
    isExpanded: true,
  },
  {
    id: 'setup-a',
    rank: 'A',
    name: 'London Session Sweep Reversal',
    description: 'Liquidity sweep into key zone followed by fast reclaim and trapped continuation.',
    timeframe: '15m',
    market: 'ES',
    avgRR: '2.2R',
    confluences: [
      'Liquidity sweep into pre-marked demand or supply',
      'Fast reclaim through invalidation level',
      'Entry only after structure shift and rejection candle close',
    ],
    isExpanded: false,
  },
  {
    id: 'setup-b',
    rank: 'B',
    name: 'Range Rotation Fade',
    description: 'Fade the edge of a clean intraday range only when breadth and timing align.',
    timeframe: '5m',
    market: 'MNQ',
    avgRR: '1.7R',
    confluences: [
      'Range boundaries tested at least twice with rejection',
      'No immediate high-impact news risk',
      'Entry aligned with session timing and acceptable spread',
    ],
    isExpanded: false,
  },
];

const INITIAL_PROP_FIRMS: PropFirm[] = [
  {
    id: 'apex',
    name: 'Apex $100K',
    phase: 'Eval',
    params: [
      { label: 'Daily loss limit', value: '$2,000', color: 'amber' },
      { label: 'Trailing drawdown', value: '$3,000', color: 'amber' },
      { label: 'Profit target', value: '$10,000', color: 'default' },
      { label: 'Min trading days', value: '10', color: 'default' },
      { label: 'Consistency', value: 'None', color: 'green' },
    ],
    progress: {
      percent: 68,
      currentLabel: '$6,800',
      targetLabel: '$10,000',
    },
  },
  {
    id: 'ftmo',
    name: 'FTMO $50K',
    phase: 'Funded',
    params: [
      { label: 'Daily loss limit', value: '$1,000', color: 'amber' },
      { label: 'Max drawdown', value: '$2,500', color: 'amber' },
      { label: 'Payout split', value: '80%', color: 'green' },
      { label: 'Min payout cycle', value: '30 days', color: 'default' },
    ],
  },
];

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 'news', text: 'Check economic calendar - no news in first 30 minutes', done: true },
  { id: 'zones', text: 'Mark key supply and demand zones on chart', done: true },
  { id: 'bias', text: 'Write pre-market bias in journal', done: true },
  { id: 'loss-limit', text: 'Confirm daily loss limit is not already breached', done: false },
  { id: 'gap', text: 'Check overnight gap - adjust levels if needed', done: false },
  { id: 'state', text: 'Confirm mental state - clear to trade today?', done: false },
  { id: 'alerts', text: 'Set daily loss limit alert on platform', done: false },
];

const TOKEN_SCOPE_STYLE: CSSProperties = {
  '--bg': 'var(--app-bg)',
  '--surface-1': 'var(--surface-1)',
  '--surface-2': 'var(--surface-2)',
  '--surface-3': 'var(--surface-3)',
  '--border': 'var(--app-border)',
  '--border-sub': 'var(--border-sub)',
  '--txt': 'var(--txt)',
  '--txt-2': 'var(--txt-2)',
  '--txt-3': 'var(--txt-3)',
  '--amber': 'var(--amber)',
  '--amber-dim': 'var(--amber-dim)',
  '--amber-border': 'var(--amber-border)',
  '--cobalt': 'var(--cobalt)',
  '--cobalt-dim': 'var(--cobalt-dim)',
  '--cobalt-border': 'var(--cobalt-border)',
  '--green': 'var(--green)',
  '--green-dim': 'var(--green-dim)',
  '--green-border': 'var(--green-border)',
  '--red': 'var(--red)',
  '--red-dim': 'var(--red-dim)',
  '--red-border': 'var(--red-border)',
} as CSSProperties;

function formatLastSaved(lastSaved: Date | null, now: number): string {
  if (!lastSaved) {
    return 'Last saved just now';
  }

  const delta = Math.max(0, now - lastSaved.getTime());
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return 'Last saved just now';
  if (minutes === 1) return 'Last saved 1 min ago';
  if (minutes < 60) return `Last saved ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Last saved 1 hr ago';
  return `Last saved ${hours} hr ago`;
}

function loadPersistedState(): TradingPlanPersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TradingPlanPersistedState;
  } catch {
    return null;
  }
}

export default function TradingPlan() {
  const persistedState = useMemo(() => loadPersistedState(), []);
  const [activeTab, setActiveTab] = useState<TradingPlanTab>('trading-plan');
  const [planBlocks, setPlanBlocks] = useState<PlanBlock[]>(() => {
    if (!persistedState?.planBlocks) return INITIAL_PLAN_BLOCKS;
    const map = new Map(persistedState.planBlocks.map(block => [block.id, block]));
    return INITIAL_PLAN_BLOCKS.map(block => {
      const persisted = map.get(block.id);
      if (!persisted) return block;
      return {
        ...block,
        content: typeof persisted.content === 'string' ? persisted.content : block.content,
        isOpen: typeof persisted.isOpen === 'boolean' ? persisted.isOpen : block.isOpen,
      };
    });
  });
  const [riskRules] = useState<RiskRule[]>(INITIAL_RISK_RULES);
  const [setups, setSetups] = useState<Setup[]>(() => {
    if (!persistedState?.setups) return INITIAL_SETUPS;
    const map = new Map(persistedState.setups.map(setup => [setup.id, setup]));
    return INITIAL_SETUPS.map(setup => {
      const persisted = map.get(setup.id);
      if (!persisted) return setup;
      return {
        ...setup,
        isExpanded: typeof persisted.isExpanded === 'boolean' ? persisted.isExpanded : setup.isExpanded,
      };
    });
  });
  const [propFirms] = useState<PropFirm[]>(INITIAL_PROP_FIRMS);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    if (!persistedState?.checklist) return INITIAL_CHECKLIST;
    const doneById = new Map(persistedState.checklist.map(item => [item.id, item.done]));
    return INITIAL_CHECKLIST.map(item => ({
      ...item,
      done: typeof doneById.get(item.id) === 'boolean' ? Boolean(doneById.get(item.id)) : item.done,
    }));
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    if (!persistedState?.lastSaved) return null;
    const parsed = new Date(persistedState.lastSaved);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  });
  const [now, setNow] = useState(() => Date.now());
  const blurSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (blurSaveTimerRef.current) {
        clearTimeout(blurSaveTimerRef.current);
      }
    };
  }, []);

  const persistState = useCallback(() => {
    const savedAt = new Date();
    if (typeof window !== 'undefined') {
      const payload: TradingPlanPersistedState = {
        planBlocks: planBlocks.map(block => ({
          id: block.id,
          content: block.content,
          isOpen: block.isOpen,
        })),
        checklist: checklist.map(item => ({
          id: item.id,
          done: item.done,
        })),
        setups: setups.map(setup => ({
          id: setup.id,
          isExpanded: setup.isExpanded,
        })),
        lastSaved: savedAt.toISOString(),
      };
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
    }
    setLastSaved(savedAt);
    setNow(savedAt.getTime());
  }, [checklist, planBlocks, setups]);

  const scheduleBlurSave = useCallback(() => {
    if (blurSaveTimerRef.current) {
      clearTimeout(blurSaveTimerRef.current);
    }
    blurSaveTimerRef.current = setTimeout(() => persistState(), 300);
  }, [persistState]);

  const lastSavedLabel = useMemo(() => formatLastSaved(lastSaved, now), [lastSaved, now]);

  const togglePlanBlock = (id: string) => {
    setPlanBlocks(current =>
      current.map(block => (
        block.id === id
          ? { ...block, isOpen: !block.isOpen }
          : block
      ))
    );
  };

  const updatePlanBlockContent = (id: string, content: string) => {
    setPlanBlocks(current =>
      current.map(block => (
        block.id === id
          ? { ...block, content }
          : block
      ))
    );
  };

  const toggleSetup = (id: string) => {
    setSetups(current => current.map(setup => (
      setup.id === id
        ? { ...setup, isExpanded: !setup.isExpanded }
        : setup
    )));
  };

  const toggleChecklist = (id: string) => {
    setChecklist(current => current.map(item => (
      item.id === id
        ? { ...item, done: !item.done }
        : item
    )));
  };

  const getRuleValueColor = (color: RiskRule['color']) => {
    if (color === 'red') return 'var(--red)';
    if (color === 'amber') return 'var(--amber)';
    if (color === 'green') return 'var(--green)';
    return 'var(--txt)';
  };

  return (
    <div style={{ ...TOKEN_SCOPE_STYLE, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <style>
        {`
          .trading-plan-scroll {
            scrollbar-width: thin;
            scrollbar-color: var(--border) transparent;
          }
          .trading-plan-scroll::-webkit-scrollbar {
            width: 3px;
            height: 3px;
          }
          .trading-plan-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .trading-plan-scroll::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 2px;
          }
          .trading-plan-rule-row:hover {
            border-color: var(--amber-border);
          }
          .trading-plan-add-setup:hover {
            border-color: var(--amber-border);
            color: var(--amber);
          }
          .trading-plan-check-row:hover {
            border-color: var(--amber-border);
          }
          .trading-plan-tab:hover {
            color: var(--txt-2);
          }
          @media (max-width: 1100px) {
            .trading-plan-content-grid {
              grid-template-columns: minmax(0, 1fr) !important;
            }
            .trading-plan-right-col {
              border-top: 1px solid var(--border);
              padding-top: 20px !important;
            }
            .trading-plan-left-col {
              border-right: none !important;
            }
          }
        `}
      </style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '18px 28px 0',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--txt)' }}>Trading Plan</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--txt-2)' }}>
              Your strategy, rules, and playbook - the document you built when thinking clearly
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--txt-3)' }}>{lastSavedLabel}</span>
            <button
              type="button"
              style={{
                height: 30,
                borderRadius: 5,
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--txt-2)',
                fontSize: 12,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              Export PDF
            </button>
            <button
              type="button"
              onClick={persistState}
              style={{
                height: 30,
                borderRadius: 5,
                border: 'none',
                background: 'var(--amber)',
                color: 'var(--bg)',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                cursor: 'pointer',
              }}
            >
              <Check size={13} />
              Save Plan
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          {TAB_ITEMS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className="trading-plan-tab"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  background: 'transparent',
                  color: active ? 'var(--amber)' : 'var(--txt-3)',
                  fontSize: 13,
                  padding: '10px 18px',
                  marginBottom: -1,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {activeTab !== 'trading-plan' ? (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center', color: 'var(--txt-2)' }}>
            <Construction size={32} style={{ margin: '0 auto 10px', color: 'var(--txt-3)' }} />
            <p style={{ margin: 0, fontSize: 13 }}>Full editor coming soon</p>
          </div>
        </div>
      ) : (
        <div className="trading-plan-content-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px' }}>
          <section className="trading-plan-left-col trading-plan-scroll" style={{ borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '24px 28px 48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Your Strategy</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {planBlocks.map(block => {
                const Icon = PLAN_BLOCK_ICONS[block.id as keyof typeof PLAN_BLOCK_ICONS];
                const toneStyles: Record<ColorTone, { badgeBg: string; badgeBorder: string; badgeColor: string }> = {
                  amber: { badgeBg: 'var(--amber-dim)', badgeBorder: 'var(--amber-border)', badgeColor: 'var(--amber)' },
                  cobalt: { badgeBg: 'var(--cobalt-dim)', badgeBorder: 'var(--cobalt-border)', badgeColor: 'var(--cobalt)' },
                  green: { badgeBg: 'var(--green-dim)', badgeBorder: 'var(--green-border)', badgeColor: 'var(--green)' },
                  red: { badgeBg: 'var(--red-dim)', badgeBorder: 'var(--red-border)', badgeColor: 'var(--red)' },
                  neutral: { badgeBg: 'var(--surface-2)', badgeBorder: 'var(--border)', badgeColor: 'var(--txt-3)' },
                };
                const tone = toneStyles[block.iconColor];

                return (
                  <article key={block.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => togglePlanBlock(block.id)}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderBottom: block.isOpen ? '1px solid var(--border)' : 'none',
                        background: 'transparent',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 5,
                            border: `1px solid ${tone.badgeBorder}`,
                            background: tone.badgeBg,
                            color: tone.badgeColor,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {Icon ? <Icon size={13} /> : <FileText size={13} />}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{block.name}</span>
                      </span>
                      <ChevronDown
                        size={13}
                        style={{
                          color: 'var(--txt-3)',
                          transform: block.isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>

                    {block.isOpen && (
                      <div style={{ padding: 16 }}>
                        <textarea
                          value={block.content}
                          onChange={event => updatePlanBlockContent(block.id, event.target.value)}
                          onBlur={scheduleBlurSave}
                          placeholder={block.placeholder}
                          style={{
                            width: '100%',
                            minHeight: 80,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            color: 'var(--txt)',
                            fontSize: 13,
                            lineHeight: 1.75,
                            fontFamily: 'var(--font-sans)',
                          }}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div style={{ marginTop: 28, marginBottom: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Hard Risk Rules</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riskRules.map(rule => (
                <div
                  key={rule.id}
                  className="trading-plan-rule-row"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'border-color 0.14s ease',
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--txt-2)', flex: 1 }}>{rule.label}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: getRuleValueColor(rule.color), fontVariantNumeric: 'tabular-nums' }}>
                      {rule.value}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{rule.unit}</span>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: 'var(--txt-3)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                      onMouseEnter={event => { event.currentTarget.style.color = 'var(--txt-2)'; }}
                      onMouseLeave={event => { event.currentTarget.style.color = 'var(--txt-3)'; }}
                    >
                      <Pencil size={13} />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 8, background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: 6, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500, color: 'var(--red)' }}>
                <AlertCircle size={13} />
                If I hit the daily limit - I stop. Full stop.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.6 }}>
                No "one more trade." No "I will make it back." Platform closes, I step away. This is the rule that protects the account above all others.
              </p>
            </div>

            <div style={{ marginTop: 28, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Setup Playbook</span>
              <button type="button" style={{ border: 'none', background: 'transparent', color: 'var(--cobalt)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                View all
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {setups.map(setup => {
                const rankStyle =
                  setup.rank === 'A+'
                    ? { color: 'var(--amber)', border: 'var(--amber-border)', background: 'var(--amber-dim)' }
                    : setup.rank === 'A'
                      ? { color: 'var(--amber)', border: 'var(--amber-border)', background: 'var(--amber-dim)' }
                      : { color: 'var(--cobalt)', border: 'var(--cobalt-border)', background: 'var(--cobalt-dim)' };

                return (
                  <article
                    key={setup.id}
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', transition: 'border-color 0.12s ease' }}
                    onMouseEnter={event => { event.currentTarget.style.borderColor = 'var(--amber-border)'; }}
                    onMouseLeave={event => { event.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSetup(setup.id)}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 3,
                          border: `1px solid ${rankStyle.border}`,
                          background: rankStyle.background,
                          color: rankStyle.color,
                          fontSize: 10,
                          fontWeight: 500,
                          fontFamily: 'var(--font-mono)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {setup.rank}
                      </span>
                      <span style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--txt)', marginBottom: 3 }}>{setup.name}</span>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.5 }}>{setup.description}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)', borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--txt-2)', padding: '2px 7px' }}>
                            {setup.timeframe}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)', borderRadius: 3, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--txt-2)', padding: '2px 7px' }}>
                            {setup.market}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)', borderRadius: 3, background: 'var(--green-dim)', border: '1px solid var(--green-border)', color: 'var(--green)', padding: '2px 7px' }}>
                            Avg {setup.avgRR}
                          </span>
                        </span>
                      </span>
                      <span style={{ border: 'none', background: 'transparent', color: 'var(--txt-3)', padding: 0 }}>
                        <Pencil size={13} />
                      </span>
                    </button>

                    {setup.isExpanded && (
                      <div style={{ padding: '0 16px 14px', marginLeft: 32 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {setup.confluences.map(confluence => (
                            <div key={`${setup.id}-${confluence}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--txt-2)' }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
                              <span>{confluence}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}

              <button
                type="button"
                className="trading-plan-add-setup"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  padding: 14,
                  color: 'var(--txt-3)',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  transition: 'border-color 0.14s ease, color 0.14s ease',
                }}
              >
                <Plus size={14} />
                Add setup
              </button>
            </div>
          </section>

          <aside className="trading-plan-right-col trading-plan-scroll" style={{ overflowY: 'auto', padding: '24px 20px 48px' }}>
            <div style={{ position: 'relative', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', marginBottom: 24, overflow: 'hidden' }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: 3,
                  height: '100%',
                  background: 'linear-gradient(to bottom, var(--amber), var(--amber-dim))',
                }}
              />
              <p style={{ margin: 0, paddingLeft: 4, fontFamily: 'var(--font-serif-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.65 }}>
                The trading plan is written by the trader who is thinking clearly. Follow it when you are not.
              </p>
              <p style={{ margin: '8px 0 0', paddingLeft: 4, fontSize: 10, color: 'var(--txt-3)' }}>- pinned to your plan</p>
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Prop Firm Parameters</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {propFirms.map(firm => (
                <article key={firm.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <header style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{firm.name}</span>
                    <span
                      style={{
                        borderRadius: 3,
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 7px',
                        background: firm.phase === 'Eval' ? 'var(--amber-dim)' : 'var(--green-dim)',
                        color: firm.phase === 'Eval' ? 'var(--amber)' : 'var(--green)',
                      }}
                    >
                      {firm.phase}
                    </span>
                  </header>

                  <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {firm.params.map(param => (
                      <div key={`${firm.id}-${param.label}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{param.label}</span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            fontWeight: 500,
                            color: param.color === 'amber' ? 'var(--amber)' : param.color === 'green' ? 'var(--green)' : 'var(--txt)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {param.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {firm.progress && (
                    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--txt-3)' }}>
                        <span>{firm.progress.currentLabel}</span>
                        <span>{firm.progress.targetLabel}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-3)', overflow: 'hidden' }}>
                        <div style={{ width: `${firm.progress.percent}%`, height: '100%', background: 'var(--amber)' }} />
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div style={{ marginTop: 24, marginBottom: 10 }}>
              <span style={{ fontSize: 10, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--txt-3)' }}>Pre-session Checklist</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {checklist.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="trading-plan-check-row"
                  onClick={() => toggleChecklist(item.id)}
                  style={{
                    width: '100%',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 5,
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'border-color 0.14s ease',
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      border: `1px solid ${item.done ? 'var(--green-border)' : 'var(--border)'}`,
                      background: item.done ? 'var(--green-dim)' : 'transparent',
                      color: item.done ? 'var(--green)' : 'transparent',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Check size={9} />
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: item.done ? 'var(--txt-3)' : 'var(--txt-2)',
                      textDecoration: item.done ? 'line-through' : 'none',
                      textDecorationColor: 'var(--border-sub)',
                    }}
                  >
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

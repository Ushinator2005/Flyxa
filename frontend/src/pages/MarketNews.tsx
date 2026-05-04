import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Search,
  Settings2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { aiApi, NewsFilterItem } from '../services/api.js';

const PAGE_BG = 'var(--app-bg)';
const S1 = 'var(--app-panel)';
const S2 = 'var(--app-panel-strong)';
const BORDER = 'var(--app-border)';
const AMBER = 'var(--amber)';
const AMBER_DIM = 'var(--amber-dim)';
const AMBER_BORDER = 'var(--amber-border)';
const GREEN = 'var(--green)';
const GREEN_DIM = 'var(--green-dim)';
const GREEN_BORDER = 'var(--green-border)';
const RED = 'var(--red)';
const RED_DIM = 'var(--red-dim)';
const RED_BORDER = 'var(--red-border)';
const COBALT = 'var(--cobalt)';
const COBALT_DIM = 'var(--cobalt-dim)';
const COBALT_BORDER = 'var(--cobalt-border)';
const PURPLE = '#a78bfa';
const T1 = 'var(--app-text)';
const T2 = 'var(--app-text-muted)';
const T3 = 'var(--app-text-subtle)';
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY as string | undefined;
const POLYGON_KEY = import.meta.env.VITE_POLYGON_KEY as string | undefined;
const CACHE_KEY = 'flyxa_news_cache_v2';
const SOURCES_KEY = 'flyxa_news_sources';
const CACHE_TTL = 15 * 60 * 1000;
const REFRESH_INTERVAL = 3 * 60 * 1000;

type ImpactLevel = 'high' | 'medium' | 'low';

interface RawHeadline {
  headline: string;
  source: string;
  timestamp: string;
  summary?: string;
  url?: string;
}

interface FuturesQuote {
  symbol: string;
  label: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
}

interface CalendarEvent {
  event: string;
  time: string;
  impact: ImpactLevel;
  actual?: string;
  forecast?: string;
  previous?: string;
}

interface NewsCache {
  items: NewsFilterItem[];
  fetchedAt: number;
}

interface SourcePrefs {
  finnhub: boolean;
  polygon: boolean;
  economicCalendar: boolean;
  aiFilter: boolean;
}

function readCache(): NewsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsCache;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(items: NewsFilterItem[]) {
  if (!items.length) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, fetchedAt: Date.now() }));
  } catch {
    // ignore storage failures
  }
}

function readSourcePrefs(): SourcePrefs {
  const defaults: SourcePrefs = { finnhub: true, polygon: false, economicCalendar: true, aiFilter: true };
  try {
    const raw = localStorage.getItem(SOURCES_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SourcePrefs>;
    return {
      finnhub: parsed.finnhub ?? defaults.finnhub,
      polygon: parsed.polygon ?? defaults.polygon,
      economicCalendar: parsed.economicCalendar ?? defaults.economicCalendar,
      aiFilter: parsed.aiFilter ?? defaults.aiFilter,
    };
  } catch {
    return defaults;
  }
}

function writeSourcePrefs(prefs: SourcePrefs) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(prefs));
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function impactColor(impact: ImpactLevel) {
  if (impact === 'high') return RED;
  if (impact === 'medium') return AMBER;
  return T3;
}

function impactBorderColor(impact: ImpactLevel, breaking: boolean) {
  if (breaking) return RED;
  if (impact === 'high') return RED;
  if (impact === 'medium') return AMBER;
  return T3;
}

function impactRank(impact: ImpactLevel) {
  if (impact === 'high') return 0;
  if (impact === 'medium') return 1;
  return 2;
}

function sentimentTone(value: string | undefined) {
  if (!value) return { color: T2, bg: S2, border: BORDER };
  const normalized = value.toLowerCase();
  if (normalized.includes('bull')) return { color: GREEN, bg: GREEN_DIM, border: GREEN_BORDER };
  if (normalized.includes('bear')) return { color: RED, bg: RED_DIM, border: RED_BORDER };
  return { color: T2, bg: S2, border: BORDER };
}

function impactTagLabel(symbol: 'ES' | 'NQ', value: string | undefined) {
  if (!value) return `${symbol} neutral`;
  const normalized = value.toLowerCase();
  if (normalized.includes('bull')) return `${symbol} bullish`;
  if (normalized.includes('bear')) return `${symbol} bearish`;
  return `${symbol} neutral`;
}

function sidebarCardStyle(): React.CSSProperties {
  return {
    background: S1,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '12px 13px',
  };
}

function kpiCardStyle(): React.CSSProperties {
  return {
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    background: S1,
    padding: '8px 10px',
  };
}

function feedCardBaseStyle(item: NewsFilterItem): React.CSSProperties {
  return {
    background: S1,
    border: `1px solid ${BORDER}`,
    borderLeft: `3px solid ${impactBorderColor(item.impact, item.isBreaking)}`,
    borderRadius: 8,
    padding: '14px 14px 13px',
    transition: 'background 0.15s ease, transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
    cursor: item.url ? 'pointer' : 'default',
  };
}

function feedCardHoverStyle(item: NewsFilterItem): React.CSSProperties {
  return {
    ...feedCardBaseStyle(item),
    background: S2,
    borderColor: BORDER,
    transform: 'translateY(-1px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  };
}

function feedCardRestStyle(item: NewsFilterItem): React.CSSProperties {
  return {
    ...feedCardBaseStyle(item),
    background: item.isBreaking ? RED_DIM : S1,
    transform: 'none',
    boxShadow: 'none',
  };
}

function impactBadgeStyle(impact: ImpactLevel): React.CSSProperties {
  if (impact === 'high') {
    return { color: RED, background: RED_DIM, border: `1px solid ${RED_BORDER}` };
  }
  if (impact === 'medium') {
    return { color: AMBER, background: AMBER_DIM, border: `1px solid ${AMBER_BORDER}` };
  }
  return { color: T2, background: S2, border: `1px solid ${BORDER}` };
}

async function fetchFinnhubNews(): Promise<RawHeadline[]> {
  if (!FINNHUB_KEY) return [];
  const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
  if (!res.ok) return [];
  const data = await res.json() as Array<{ headline: string; source: string; datetime: number; summary?: string; url?: string }>;
  return data.slice(0, 50).map(item => ({
    headline: item.headline,
    source: item.source,
    timestamp: new Date(item.datetime * 1000).toISOString(),
    summary: item.summary,
    url: item.url,
  }));
}

async function fetchPolygonNews(): Promise<RawHeadline[]> {
  if (!POLYGON_KEY) return [];
  const url = `https://api.polygon.io/v2/reference/news?limit=25&order=desc&sort=published_utc&ticker=ES1!&apiKey=${POLYGON_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { results?: Array<{ title: string; publisher: { name: string }; published_utc: string; description?: string; article_url?: string }> };
  return (data.results ?? []).map(item => ({
    headline: item.title,
    source: item.publisher?.name ?? 'Polygon',
    timestamp: item.published_utc,
    summary: item.description,
    url: item.article_url,
  }));
}

async function fetchFuturesQuotes(): Promise<FuturesQuote[]> {
  if (!FINNHUB_KEY) {
    return [
      { symbol: 'ES', label: 'E-mini S&P 500', price: null, change: null, changePct: null },
      { symbol: 'NQ', label: 'E-mini NASDAQ-100', price: null, change: null, changePct: null },
    ];
  }

  const symbols = [
    { id: 'ES1!', symbol: 'ES', label: 'E-mini S&P 500' },
    { id: 'NQ1!', symbol: 'NQ', label: 'E-mini NASDAQ-100' },
  ];

  const results = await Promise.allSettled(
    symbols.map(async symbol => {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.id)}&token=${FINNHUB_KEY}`);
      if (!res.ok) return { ...symbol, price: null, change: null, changePct: null };
      const quote = await res.json() as { c: number; d: number; dp: number };
      return { ...symbol, price: quote.c ?? null, change: quote.d ?? null, changePct: quote.dp ?? null };
    }),
  );

  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : { ...symbols[index], price: null, change: null, changePct: null },
  );
}

async function fetchEconomicCalendar(): Promise<CalendarEvent[]> {
  if (!FINNHUB_KEY) return [];
  const day = new Date().toISOString().slice(0, 10);
  const res = await fetch(`https://finnhub.io/api/v1/calendar/economic?from=${day}&to=${day}&token=${FINNHUB_KEY}`);
  if (!res.ok) return [];

  const data = await res.json() as { economicCalendar?: Array<{ event: string; time: string; impact: string; actual?: string; estimate?: string; prev?: string }> };
  return (data.economicCalendar ?? []).slice(0, 12).map(event => ({
    event: event.event,
    time: event.time,
    impact: (event.impact === 'high' || event.impact === 'medium' ? event.impact : 'low') as ImpactLevel,
    actual: event.actual,
    forecast: event.estimate,
    previous: event.prev,
  }));
}

function rawToNewsItem(raw: RawHeadline): NewsFilterItem {
  return {
    headline: raw.headline,
    summary: raw.summary || '',
    impact: 'low',
    category: 'Other',
    marketImpact: { es: 'neutral', nq: 'neutral' },
    isBreaking: false,
    source: raw.source,
    timestamp: raw.timestamp,
    url: raw.url,
  };
}

function ImpactBadge({ impact }: { impact: ImpactLevel }) {
  const style = impactBadgeStyle(impact);
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 4,
        ...style,
      }}
    >
      {impact}
    </span>
  );
}

function BreakingBadge() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '2px 6px',
        borderRadius: 4,
        background: RED,
        color: '#fff',
        border: `1px solid ${RED_BORDER}`,
        boxShadow: `0 0 0 1px ${RED_BORDER} inset`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <Zap size={8} strokeWidth={2.4} />
      Breaking
    </span>
  );
}

function NewsCard({ item }: { item: NewsFilterItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(item.summary || item.marketImpact?.note);
  const esTone = sentimentTone(item.marketImpact?.es);
  const nqTone = sentimentTone(item.marketImpact?.nq);

  return (
    <article
      style={feedCardRestStyle(item)}
      onMouseEnter={event => {
        Object.assign(event.currentTarget.style, feedCardHoverStyle(item));
      }}
      onMouseLeave={event => {
        Object.assign(event.currentTarget.style, feedCardRestStyle(item));
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {item.isBreaking && <BreakingBadge />}
            <ImpactBadge impact={item.impact} />
            <span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>{item.category}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.48, color: T1, fontWeight: 500 }}>
            {item.headline}
          </p>
        </div>

        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T3, lineHeight: 0, marginTop: 2 }}
            onMouseEnter={event => {
              event.currentTarget.style.color = COBALT;
            }}
            onMouseLeave={event => {
              event.currentTarget.style.color = T3;
            }}
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: T2, fontFamily: MONO }}>{item.source}</span>
        <span style={{ fontSize: 10, color: T3 }}>•</span>
        <span style={{ fontSize: 10, color: T2, fontFamily: MONO }}>{fmtRelative(item.timestamp)}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO,
              color: esTone.color,
              background: esTone.bg,
              borderRadius: 3,
              border: `1px solid ${esTone.border}`,
              padding: '2px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {impactTagLabel('ES', item.marketImpact?.es)}
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO,
              color: nqTone.color,
              background: nqTone.bg,
              borderRadius: 3,
              border: `1px solid ${nqTone.border}`,
              padding: '2px 6px',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {impactTagLabel('NQ', item.marketImpact?.nq)}
          </span>
        </span>
      </div>

      {hasDetail && (
        <button
          onClick={() => setExpanded(value => !value)}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 'none',
            color: COBALT,
            fontSize: 11,
            fontWeight: 600,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Hide details' : 'Show details'}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {expanded && hasDetail && (
        <div
          style={{
            marginTop: 9,
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            background: S2,
            padding: '10px 12px',
          }}
        >
          {item.summary && <p style={{ margin: 0, color: T2, fontSize: 12, lineHeight: 1.55 }}>{item.summary}</p>}
          {item.marketImpact?.note && (
            <p style={{ margin: item.summary ? '8px 0 0' : 0, color: AMBER, fontSize: 11, lineHeight: 1.5 }}>
              {item.marketImpact.note}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function FuturesPanel({ quotes }: { quotes: FuturesQuote[] }) {
  return (
    <section style={sidebarCardStyle()}>
      <p style={{ margin: '0 0 10px', fontSize: 10, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
        Live Futures
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {quotes.map(quote => {
          const up = quote.change != null && quote.change >= 0;
          const color = quote.change == null ? T3 : up ? GREEN : RED;
          return (
            <div key={quote.symbol} style={{ padding: '7px 8px', borderRadius: 6, background: S2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{quote.symbol}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: T1 }}>
                  {quote.price == null ? '—' : quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: T3 }}>{quote.label}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color, fontSize: 10, fontFamily: MONO }}>
                  {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {quote.change == null ? '—' : `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePct?.toFixed(2) ?? '0.00'}%)`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CalendarPanel({ events }: { events: CalendarEvent[] }) {
  return (
    <section style={sidebarCardStyle()}>
      <p style={{ margin: '0 0 10px', fontSize: 10, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
        Economic Calendar
      </p>
      {events.length === 0 ? (
        <p style={{ margin: 0, color: T3, fontSize: 11 }}>No events today or data unavailable.</p>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          {events.map((event, index) => (
            <div
              key={`${event.event}-${index}`}
              style={{
                padding: '7px 8px',
                borderRadius: 6,
                background: S2,
                borderLeft: `2px solid ${impactColor(event.impact)}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: T3, minWidth: 46 }}>{fmtTime(event.time)}</span>
                <span style={{ fontSize: 11, color: T2, flex: 1, minWidth: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{event.event}</span>
                {event.actual && <span style={{ color: GREEN, fontFamily: MONO, fontSize: 10 }}>{event.actual}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SourcesPanel({ prefs, onChange }: { prefs: SourcePrefs; onChange: (value: SourcePrefs) => void }) {
  return (
    <section style={sidebarCardStyle()}>
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 10,
          color: T3,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 700,
          display: 'inline-flex',
          gap: 5,
          alignItems: 'center',
        }}
      >
        <Settings2 size={10} />
        Sources
      </p>
      <div style={{ display: 'grid', gap: 7 }}>
        {([
          { key: 'finnhub', label: 'Finnhub', note: 'Requires VITE_FINNHUB_KEY' },
          { key: 'polygon', label: 'Polygon.io', note: 'Requires VITE_POLYGON_KEY' },
          { key: 'economicCalendar', label: 'Economic Calendar', note: '' },
          { key: 'aiFilter', label: 'AI Filter', note: '' },
        ] as const).map(source => {
          const available =
            source.key === 'finnhub'
              ? Boolean(FINNHUB_KEY)
              : source.key === 'polygon'
                ? Boolean(POLYGON_KEY)
                : true;
          const active = prefs[source.key] && available;
          return (
            <label
              key={source.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: available ? 'pointer' : 'not-allowed',
                opacity: available ? 1 : 0.45,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                disabled={!available}
                onChange={event => onChange({ ...prefs, [source.key]: event.target.checked })}
                style={{ accentColor: AMBER }}
              />
              <span style={{ fontSize: 11, color: T2 }}>{source.label}</span>
              {!available && source.note && <span style={{ fontSize: 9, color: T3 }}>({source.note})</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default function MarketNews() {
  const [items, setItems] = useState<NewsFilterItem[]>([]);
  const [quotes, setQuotes] = useState<FuturesQuote[]>([]);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRawFallback, setIsRawFallback] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | ImpactLevel>('all');
  const [prefs, setPrefs] = useState<SourcePrefs>(readSourcePrefs);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'impact' | 'newest'>('impact');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNews = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        setItems(cached.items);
        setLastRefresh(new Date(cached.fetchedAt));
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const [finnhubRaw, polygonRaw] = await Promise.allSettled([
        prefs.finnhub ? fetchFinnhubNews() : Promise.resolve([]),
        prefs.polygon ? fetchPolygonNews() : Promise.resolve([]),
      ]);

      const combined: RawHeadline[] = [
        ...(finnhubRaw.status === 'fulfilled' ? finnhubRaw.value : []),
        ...(polygonRaw.status === 'fulfilled' ? polygonRaw.value : []),
      ];

      if (combined.length === 0) {
        setError(
          !FINNHUB_KEY && !POLYGON_KEY
            ? 'Add VITE_FINNHUB_KEY to frontend/.env and restart the dev server.'
            : 'No headlines returned. Restart the dev server to pick up API keys, then refresh.',
        );
        setLoading(false);
        return;
      }

      const dedupedMap = new Map<string, RawHeadline>();
      for (const headline of combined) dedupedMap.set(headline.headline.slice(0, 100), headline);
      const deduped = Array.from(dedupedMap.values()).slice(0, 40);

      let finalItems: NewsFilterItem[] = [];
      let rawFallback = false;
      if (prefs.aiFilter) {
        try {
          const { items: filtered } = await aiApi.filterNews(deduped);
          if (filtered.length > 0) {
            finalItems = filtered;
          } else {
            finalItems = deduped.slice(0, 20).map(rawToNewsItem);
            rawFallback = true;
          }
        } catch {
          finalItems = deduped.slice(0, 20).map(rawToNewsItem);
          rawFallback = true;
        }
      } else {
        finalItems = deduped.slice(0, 20).map(rawToNewsItem);
      }

      finalItems.sort((a, b) => {
        const impactDiff = impactRank(a.impact) - impactRank(b.impact);
        if (impactDiff !== 0) return impactDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setItems(finalItems);
      setIsRawFallback(rawFallback);
      writeCache(finalItems);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [prefs]);

  const fetchSidebar = useCallback(async () => {
    const [quoteResult, calendarResult] = await Promise.allSettled([
      fetchFuturesQuotes(),
      prefs.economicCalendar ? fetchEconomicCalendar() : Promise.resolve([]),
    ]);
    if (quoteResult.status === 'fulfilled') setQuotes(quoteResult.value);
    if (calendarResult.status === 'fulfilled') setCalendar(calendarResult.value);
  }, [prefs.economicCalendar]);

  useEffect(() => {
    fetchNews();
    fetchSidebar();
    const scheduleNext = () => {
      timerRef.current = setTimeout(() => {
        fetchNews(true);
        fetchSidebar();
        scheduleNext();
      }, REFRESH_INTERVAL);
    };
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchNews, fetchSidebar]);

  const handlePrefsChange = (next: SourcePrefs) => {
    setPrefs(next);
    writeSourcePrefs(next);
  };

  const breakingCount = useMemo(() => items.filter(item => item.isBreaking).length, [items]);
  const highCount = useMemo(() => items.filter(item => item.impact === 'high').length, [items]);
  const highCalendarCount = useMemo(() => calendar.filter(event => event.impact === 'high').length, [calendar]);

  const displayed = useMemo(() => {
    const filtered = (filter === 'all' ? items : items.filter(item => item.impact === filter)).filter(item => {
      if (!query.trim()) return true;
      const haystack = `${item.headline} ${item.summary ?? ''} ${item.source} ${item.category}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });

    if (sortBy === 'newest') {
      return [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return [...filtered].sort((a, b) => {
      const impactDiff = impactRank(a.impact) - impactRank(b.impact);
      if (impactDiff !== 0) return impactDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [filter, items, query, sortBy]);

  const topBreaking = useMemo(() => items.find(item => item.isBreaking), [items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden', fontFamily: SANS, background: PAGE_BG }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${BORDER}`, background: S1, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 19, letterSpacing: '-0.02em' }}>Market News</h1>
            <p style={{ margin: '4px 0 0', color: T2, fontSize: 12 }}>High-signal feed for ES and NQ with live context.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={() => fetchNews(true)}
              disabled={loading}
              style={{
                height: 32,
                borderRadius: 6,
                border: `1px solid ${loading ? COBALT_BORDER : BORDER}`,
                background: loading ? COBALT_DIM : S2,
                color: loading ? COBALT : T2,
                padding: '0 11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : undefined }} />
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
            {lastRefresh && <span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>Updated {fmtRelative(lastRefresh.toISOString())}</span>}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <KpiCard label="Breaking" value={breakingCount} tone={RED} icon={<Zap size={12} />} />
          <KpiCard label="High Impact" value={highCount} tone={AMBER} icon={<AlertTriangle size={12} />} />
          <KpiCard label="Calendar Risks" value={highCalendarCount} tone={PURPLE} icon={<Settings2 size={12} />} />
        </div>

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              borderRadius: 6,
              border: `1px solid ${BORDER}`,
              background: S2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '0 10px',
              height: 32,
            }}
          >
            <Search size={13} color={T3} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search headlines, source, category..."
              style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: T1, fontSize: 12 }}
            />
          </div>

          <InlineToggle
            label="Sort"
            value={sortBy}
            options={[
              { key: 'impact', label: 'Impact' },
              { key: 'newest', label: 'Newest' },
            ]}
            onChange={value => setSortBy(value as 'impact' | 'newest')}
          />

          <InlineToggle
            label="Impact"
            value={filter}
            options={[
              { key: 'all', label: 'All' },
              { key: 'high', label: 'High' },
              { key: 'medium', label: 'Med' },
              { key: 'low', label: 'Low' },
            ]}
            onChange={value => setFilter(value as 'all' | ImpactLevel)}
          />

          {lastRefresh && <span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>Updated {fmtRelative(lastRefresh.toISOString())}</span>}
        </div>
      </div>

      <div
        className="mn-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) clamp(240px, 23vw, 300px)',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          maxWidth: '100%',
          width: '100%',
          overflow: 'hidden',
          gap: 0,
        }}
      >
        <main className="mn-feed" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 10px 14px' }}>
          {topBreaking && (
            <div
              style={{
                margin: '12px 0 0',
                borderRadius: 8,
                border: `1px solid ${RED_BORDER}`,
                background: RED_DIM,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <BreakingBadge />
                <span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>{fmtRelative(topBreaking.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, color: T1, fontWeight: 500 }}>{topBreaking.headline}</div>
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                margin: '12px 0 0',
                padding: '11px 14px',
                borderRadius: 8,
                background: RED_DIM,
                border: `1px solid ${RED_BORDER}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <AlertTriangle size={15} color={RED} />
              <span style={{ fontSize: 12, color: RED }}>{error}</span>
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: RED, cursor: 'pointer', lineHeight: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          )}

          {loading && items.length === 0 && (
            <div style={{ height: 250, display: 'grid', placeItems: 'center', color: T3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Fetching and scoring headlines...
              </div>
            </div>
          )}

          {!loading && !error && displayed.length === 0 && items.length > 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: T3, fontSize: 12 }}>
              No stories match the current filters.
            </div>
          )}

          {!loading && !error && items.length === 0 && !FINNHUB_KEY && !POLYGON_KEY && (
            <div style={{ padding: '42px 32px', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: T2, marginBottom: 8 }}>No API keys configured.</p>
              <p style={{ fontSize: 12, color: T3 }}>
                Add <code style={{ background: S2, padding: '1px 5px', borderRadius: 3 }}>VITE_FINNHUB_KEY</code> in{' '}
                <code style={{ background: S2, padding: '1px 5px', borderRadius: 3 }}>frontend/.env</code> and restart.
              </p>
            </div>
          )}

          {!loading && isRawFallback && items.length > 0 && (
            <div
              style={{
                margin: '12px 0 0',
                padding: '8px 12px',
                borderRadius: 6,
                border: `1px solid ${AMBER_BORDER}`,
                background: AMBER_DIM,
                color: T2,
                fontSize: 11,
              }}
            >
              <span style={{ color: AMBER, fontWeight: 700 }}>Fallback Mode:</span> AI filter did not return ES/NQ-specific items, so latest raw
              headlines are shown.
            </div>
          )}

          <div style={{ marginTop: 10, display: 'grid', gap: 10, padding: '0 4px' }}>
            {displayed.map((item, index) => (
              <NewsCard key={`${item.headline}-${index}`} item={item} />
            ))}
          </div>
          </div>
        </main>

        <aside
          className="mn-sidebar"
          style={{
            width: '100%',
            minWidth: 0,
            borderLeft: `1px solid ${BORDER}`,
            background: PAGE_BG,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 12,
          }}
        >
          <div style={{ position: 'sticky', top: 12, display: 'grid', gap: 10 }}>
            <FuturesPanel quotes={quotes} />
            {prefs.economicCalendar && <CalendarPanel events={calendar} />}
            <SourcesPanel prefs={prefs} onChange={handlePrefsChange} />
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 1440px) {
          .mn-grid {
            display: block !important;
            overflow: auto !important;
          }
          .mn-feed {
            overflow: visible !important;
          }
          .mn-sidebar {
            width: 100% !important;
            border-left: none !important;
            border-top: 1px solid ${BORDER} !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div style={kpiCardStyle()}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: T3, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</span>
        <span style={{ color: tone, lineHeight: 0 }}>{icon}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 18, color: tone, fontWeight: 700, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function InlineToggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ key: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
      <span style={{ fontSize: 10, color: T3, padding: '0 8px', height: 32, display: 'inline-flex', alignItems: 'center', background: S2 }}>
        {label}
      </span>
      {options.map(option => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            onClick={() => onChange(option.key)}
            style={{
              height: 32,
              border: 'none',
              borderLeft: `1px solid ${BORDER}`,
              background: active ? COBALT_DIM : 'transparent',
              color: active ? COBALT : T2,
              padding: '0 9px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

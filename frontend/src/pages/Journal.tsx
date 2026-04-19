import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Leaf,
  Moon,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { journalApi } from '../services/api.js';
import { JournalEntry } from '../types/index.js';
import Modal from '../components/common/Modal.js';
import LoadingSpinner from '../components/common/LoadingSpinner.js';

// constants

const JOURNAL_MOOD_STORAGE_KEY = 'tw-journal-moods';
const JOURNAL_TITLE_STORAGE_KEY = 'tw-journal-titles';
const JOURNAL_MOODS = ['Calm', 'Focused', 'Confident', 'Tired', 'Frustrated'] as const;
const MOOD_ICONS: Record<(typeof JOURNAL_MOODS)[number], LucideIcon> = {
  Calm: Leaf,
  Focused: Target,
  Confident: ShieldCheck,
  Tired: Moon,
  Frustrated: AlertTriangle,
};

const MOOD_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Focused:    { bg: '#1a3166', color: '#60a5fa', border: '#1e3d80' },
  Calm:       { bg: '#0d3325', color: '#34d399', border: '#0f4030' },
  Frustrated: { bg: '#3d1515', color: '#f87171', border: '#4d1a1a' },
  Confident:  { bg: '#2d1f0a', color: '#fbbf24', border: '#3a280e' },
  Tired:      { bg: '#1f1a2e', color: '#a78bfa', border: '#2a2240' },
};

const AMBER = '#f59e0b';
const GREEN = '#22c55e';
const S1 = 'var(--app-panel)';
const S2 = 'var(--app-panel-strong)';
const BORDER = 'var(--app-border)';
const BSUB = 'rgba(255,255,255,0.04)';
const T1 = 'var(--app-text)';
const T2 = 'var(--app-text-muted)';
const T3 = 'var(--app-text-subtle)';
const ACCENT = 'var(--accent)';
const ACCENT_DIM = 'var(--accent-dim)';

// helpers

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getPreview(text: string) {
  return text.slice(0, 140).replace(/\n/g, ' ').trim();
}

function formatEntryTitleFromDate(date: string) {
  const parsed = parseISO(date);
  return Number.isNaN(parsed.getTime()) ? 'Untitled entry' : format(parsed, 'EEEE, MMMM d');
}

function truncateTitle(title: string) {
  if (title.length <= 54) return title;
  return `${title.slice(0, 54).trimEnd()}...`;
}

function loadJournalMoods(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(JOURNAL_MOOD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch { return {}; }
}

function saveJournalMoods(moods: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JOURNAL_MOOD_STORAGE_KEY, JSON.stringify(moods));
}

function loadJournalTitles(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(JOURNAL_TITLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch { return {}; }
}

function saveJournalTitles(titles: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JOURNAL_TITLE_STORAGE_KEY, JSON.stringify(titles));
}

function getDisplayTitle(entry: JournalEntry, titleByEntryId: Record<string, string>) {
  const stored = titleByEntryId[entry.id]?.trim();
  return stored ? truncateTitle(stored) : formatEntryTitleFromDate(entry.date);
}

function getEntryContent(entry: JournalEntry) {
  return typeof entry.content === 'string' ? entry.content : '';
}

function formatEntryDate(date: string, pattern: string) {
  const parsed = parseISO(date);
  return Number.isNaN(parsed.getTime()) ? (date || 'Unknown date') : format(parsed, pattern);
}

// EntryItem

function EntryItem({
  entry,
  mood,
  titleByEntryId,
  selected,
  onClick,
}: {
  entry: JournalEntry;
  mood?: string;
  titleByEntryId: Record<string, string>;
  selected: boolean;
  onClick: () => void;
}) {
  const content = getEntryContent(entry);
  const preview = getPreview(content);
  const title = getDisplayTitle(entry, titleByEntryId);
  const wc = wordCount(content);
  const hasContent = wc > 0;
  const moodStyle = mood ? (MOOD_STYLES[mood] ?? null) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        borderRadius: '8px',
        border: `1px solid ${selected ? ACCENT : BORDER}`,
        background: selected ? ACCENT_DIM : S1,
        marginBottom: '6px',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = S1;
      }}
    >
      {/* Date badge */}
      <div
        style={{
          width: '46px',
          flexShrink: 0,
          borderRight: `1px solid ${selected ? 'rgba(245,158,11,0.3)' : BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 0',
          gap: '2px',
        }}
      >
        <span style={{ fontSize: '9px', fontWeight: 700, color: selected ? AMBER : T3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {formatEntryDate(entry.date, 'MMM')}
        </span>
        <span style={{ fontSize: '18px', fontWeight: 600, color: selected ? AMBER : T1, lineHeight: 1, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          {formatEntryDate(entry.date, 'd')}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: T1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
          {title}
        </p>
        <p style={{ fontSize: '11px', color: T2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {hasContent ? preview : "A clean page waiting for today's note."}
        </p>
      </div>

      {/* Meta */}
      <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '6px', flexShrink: 0 }}>
        {hasContent && (
          <span style={{ fontSize: '10px', color: T3, fontFamily: 'var(--font-mono)' }}>{wc}w</span>
        )}
        {mood && moodStyle && (
          <span style={{ borderRadius: '20px', fontSize: '10px', fontWeight: 600, padding: '2px 7px', background: moodStyle.bg, color: moodStyle.color, whiteSpace: 'nowrap' }}>
            {mood}
          </span>
        )}
      </div>
    </button>
  );
}

// Journal page

export default function Journal() {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
  const [moodByEntryId, setMoodByEntryId] = useState<Record<string, string>>(() => loadJournalMoods());
  const [titleByEntryId, setTitleByEntryId] = useState<Record<string, string>>(() => loadJournalTitles());
  const [titleDraft, setTitleDraft] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await journalApi.getAll();
      setEntries(data as JournalEntry[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    };
  }, []);

  function updateEntryMood(entryId: string, mood: string) {
    setMoodByEntryId(current => {
      const next = { ...current, [entryId]: mood };
      saveJournalMoods(next);
      return next;
    });
  }

  useEffect(() => {
    setSelected(current => {
      if (!current) return current;
      return entries.find(entry => entry.id === current.id) ?? current;
    });
  }, [entries]);

  useEffect(() => {
    const requestedDate = searchParams.get('date');
    if (!requestedDate || entries.length === 0) return;
    const match = entries.find(entry => entry.date === requestedDate);
    if (match && selected?.id !== match.id) setSelected(match);
  }, [entries, searchParams, selected]);

  useEffect(() => {
    if (selected && textareaRef.current) textareaRef.current.focus();
  }, [selected?.id]);

  useEffect(() => {
    if (!selected) { setTitleDraft(''); return; }
    setTitleDraft(titleByEntryId[selected.id] ?? '');
  }, [selected, titleByEntryId]);

  function persistEntryTitle(entryId: string, nextTitle: string) {
    const normalized = nextTitle.trim();
    setTitleByEntryId(current => {
      const next = { ...current };
      if (normalized) { next[entryId] = normalized; } else { delete next[entryId]; }
      saveJournalTitles(next);
      return next;
    });
  }

  function applyEntryUpdateLocally(entryId: string, updates: Partial<JournalEntry>) {
    setEntries(current => current.map(e => (e.id === entryId ? { ...e, ...updates } : e)));
    setSelected(current => (current?.id === entryId ? { ...current, ...updates } : current));
  }

  async function autoSave(content: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await journalApi.update(selected.id, { content } as Record<string, unknown>);
      applyEntryUpdateLocally(selected.id, updated as JournalEntry);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  function handleContentChange(content: string) {
    if (!selected) return;
    applyEntryUpdateLocally(selected.id, { content });
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void autoSave(content); }, 1500);
  }

  function handleTitleChange(nextTitle: string) {
    if (!selected) return;
    setTitleDraft(nextTitle);
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => { persistEntryTitle(selected.id, nextTitle); }, 300);
  }

  function handleTitleBlur() {
    if (!selected) return;
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    persistEntryTitle(selected.id, titleDraft);
  }

  async function handleDateChange(nextDate: string) {
    if (!selected || !nextDate || nextDate === selected.date) return;
    const duplicate = entries.find(e => e.id !== selected.id && e.date === nextDate);
    if (duplicate) {
      window.alert(`There is already a journal entry for ${formatEntryDate(nextDate, 'MMMM d, yyyy')}.`);
      return;
    }
    const previousDate = selected.date;
    applyEntryUpdateLocally(selected.id, { date: nextDate });
    setSaving(true);
    setSaved(false);
    try {
      const updated = await journalApi.update(selected.id, { date: nextDate } as Record<string, unknown>);
      applyEntryUpdateLocally(selected.id, updated as JournalEntry);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error(error);
      applyEntryUpdateLocally(selected.id, { date: previousDate });
    } finally {
      setSaving(false);
    }
  }

  async function createEntry() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = entries.find(e => e.date === today);
    if (existing) { setSelected(existing); return; }
    try {
      const created = await journalApi.create({ date: today, content: '', screenshots: [] } as Record<string, unknown>);
      await fetchEntries();
      setSelected(created as JournalEntry);
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteEntry(entry: JournalEntry) {
    try {
      await journalApi.delete(entry.id);
      if (selected?.id === entry.id) setSelected(null);
      setTitleByEntryId(current => {
        const next = { ...current };
        delete next[entry.id];
        saveJournalTitles(next);
        return next;
      });
      await fetchEntries();
    } catch (error) {
      console.error(error);
    }
    setDeleteTarget(null);
  }

  const filtered = useMemo(
    () => entries.filter(
      entry =>
        search === '' ||
        getEntryContent(entry).toLowerCase().includes(search.toLowerCase()) ||
        (entry.date ?? '').includes(search)
    ),
    [entries, search]
  );

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    const bucket = new Map<string, JournalEntry[]>();
    sorted.forEach(entry => {
      const month = formatEntryDate(entry.date, 'MMMM yyyy');
      const current = bucket.get(month) ?? [];
      current.push(entry);
      bucket.set(month, current);
    });
    return Array.from(bucket.entries());
  }, [filtered]);

  const totalWords = useMemo(
    () => entries.reduce((sum, entry) => sum + wordCount(getEntryContent(entry)), 0),
    [entries]
  );
  const selectedWordCount = selected ? wordCount(getEntryContent(selected)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" label="Loading daily journal..." />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}
    >
      <style>{`input[type="text"]::placeholder { color: var(--app-text-subtle); } textarea::placeholder { color: var(--app-text-subtle); }`}</style>

      {/* Top header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 20px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
          background: S1,
        }}
      >
        <div>
          <h1 style={{ fontSize: '17px', fontWeight: 600, color: T1, margin: 0, lineHeight: 1.2 }}>Daily Journal</h1>
          <p style={{ fontSize: '11px', color: T3, marginTop: '3px' }}>Your private trading log — pick up where you left off.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selected && (
            <span style={{ fontSize: '11px', color: T3, fontFamily: 'var(--font-mono)' }}>
              {totalWords} words total
            </span>
          )}
          <button
            type="button"
            onClick={createEntry}
            style={{
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: AMBER,
              border: 'none',
              borderRadius: '5px',
              padding: '0 12px',
              color: '#000',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            <Plus size={13} />
            New entry
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr', minHeight: 0, overflow: 'hidden' }}>

        {/* Left: entry list */}
        <div style={{ borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: T3, pointerEvents: 'none' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search entries..."
                style={{
                  width: '100%',
                  background: S2,
                  border: `1px solid ${BORDER}`,
                  borderRadius: '6px',
                  padding: '7px 10px 7px 30px',
                  fontSize: '12px',
                  color: T2,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = ACCENT; }}
                onBlur={e => { e.target.style.borderColor = BORDER; }}
              />
            </div>
          </div>

          {/* Entry list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            {grouped.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '10px' }}>
                <PenLine size={20} style={{ color: T3 }} />
                <p style={{ fontSize: '13px', color: T2, margin: 0 }}>{search ? 'No matching entries' : 'No entries yet'}</p>
                <p style={{ fontSize: '11px', color: T3, margin: 0, textAlign: 'center' }}>
                  {search ? 'Try a different keyword.' : 'Hit "New entry" to begin your first session note.'}
                </p>
              </div>
            ) : (
              grouped.map(([month, monthEntries]) => (
                <div key={month} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                      {month}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: BSUB }} />
                    <span style={{ fontSize: '10px', color: T3, whiteSpace: 'nowrap' }}>
                      {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  {monthEntries.map(entry => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      mood={moodByEntryId[entry.id]}
                      titleByEntryId={titleByEntryId}
                      selected={selected?.id === entry.id}
                      onClick={() => setSelected(entry)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: editor or empty state */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: T3 }}>
              <PenLine size={28} style={{ opacity: 0.4 }} />
              <p style={{ fontSize: '14px', color: T2, margin: 0 }}>Select an entry to read or write</p>
              <p style={{ fontSize: '12px', color: T3, margin: 0 }}>Or create a new one for today</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

              {/* Entry header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '16px 20px 12px',
                  borderBottom: `1px solid ${BORDER}`,
                  flexShrink: 0,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '19px', fontWeight: 600, color: T1, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.1 }}>
                    {formatEntryDate(selected.date, 'EEEE, MMMM d')}
                  </h2>
                  <p style={{ fontSize: '11px', color: T3, marginTop: '5px' }}>
                    {formatEntryDate(selected.date, 'yyyy')}
                    <span style={{ margin: '0 5px' }}>|</span>
                    {selectedWordCount}w written
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={selected.date}
                    onChange={e => void handleDateChange(e.target.value)}
                    style={{
                      background: S2,
                      border: `1px solid ${BORDER}`,
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      color: T2,
                      colorScheme: 'dark',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  />

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      border: `1px solid ${BORDER}`,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: saving ? AMBER : T2,
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: saving ? AMBER : GREEN, opacity: saving ? 1 : saved ? 1 : 0.4 }} />
                    {saving ? 'Saving...' : saved ? 'Saved' : 'Auto-save on'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selected)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      border: `1px solid ${BORDER}`,
                      borderRadius: '6px',
                      background: 'transparent',
                      fontSize: '11px',
                      color: T2,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = '#7f1d1d'; el.style.color = '#f87171'; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.borderColor = BORDER; el.style.color = T2; }}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Mood toggles */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '10px 20px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
                {JOURNAL_MOODS.map(mood => {
                  const isActive = moodByEntryId[selected.id] === mood;
                  const ms = MOOD_STYLES[mood];
                  const MoodIcon = MOOD_ICONS[mood];
                  return (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => updateEntryMood(selected.id, mood)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 11px',
                        borderRadius: '20px',
                        border: `1px solid ${isActive ? ms.border : BORDER}`,
                        background: isActive ? ms.bg : S2,
                        fontSize: '11px',
                        color: isActive ? ms.color : T2,
                        cursor: 'pointer',
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                      }}
                    >
                      {isActive && (
                        <svg width="7" height="7" viewBox="0 0 8 8" style={{ flexShrink: 0 }}>
                          <circle cx="4" cy="4" r="4" fill={ms.color} />
                        </svg>
                      )}
                      <MoodIcon size={11} />
                      {mood}
                    </button>
                  );
                })}
              </div>

              {/* Writing area — fills remaining height */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                {/* Title input */}
                <input
                  type="text"
                  value={titleDraft}
                  onChange={e => handleTitleChange(e.target.value)}
                  onBlur={handleTitleBlur}
                  placeholder="Entry title..."
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px 20px 10px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: T1,
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                />

                {/* Hint bar */}
                <div style={{ borderTop: `1px solid ${BSUB}`, borderBottom: `1px solid ${BSUB}`, padding: '6px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', color: T3 }}>What happened · What you felt · What to carry forward</span>
                  <span style={{ fontSize: '11px', color: T3 }}>Autosaves after 1.5s</span>
                </div>

                {/* Body textarea */}
                <textarea
                  ref={textareaRef}
                  value={getEntryContent(selected)}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder={`Write your reflection for ${formatEntryDate(selected.date, 'MMMM d, yyyy')}...`}
                  style={{
                    display: 'block',
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    fontSize: '13px',
                    color: T2,
                    lineHeight: 1.75,
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Journal Entry">
        <p className="mb-6 text-[13px] leading-relaxed text-slate-300">
          Permanently delete the entry for{' '}
          <span className="font-semibold text-white">
            {deleteTarget ? formatEntryDate(deleteTarget.date, 'MMMM d, yyyy') : ''}
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={() => deleteTarget && deleteEntry(deleteTarget)} className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 size={13} />
            Delete Entry
          </button>
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

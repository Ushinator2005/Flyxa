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

// ─── constants ────────────────────────────────────────────────────────────────

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

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── EntryItem ────────────────────────────────────────────────────────────────

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
        borderRadius: '11px',
        border: `1px solid ${selected ? '#2563eb' : '#1a2336'}`,
        background: selected ? '#0f1e38' : '#111620',
        marginBottom: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Date badge */}
      <div
        style={{
          width: '52px',
          flexShrink: 0,
          borderRight: `1px solid ${selected ? '#1a3166' : '#1a2336'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 0',
          gap: '2px',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            color: '#3b82f6',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {formatEntryDate(entry.date, 'MMM')}
        </span>
        <span
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#d0dae6',
            lineHeight: 1,
          }}
        >
          {formatEntryDate(entry.date, 'd')}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: selected ? '#e2e8f0' : '#c9d3e0',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: '5px',
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: '12px',
            color: '#4a5a6e',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {hasContent ? preview : "A clean page waiting for today's note."}
        </p>
      </div>

      {/* Meta */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {hasContent && (
          <span style={{ fontSize: '10px', color: '#2d3d52' }}>{wc}w</span>
        )}
        {mood && moodStyle && (
          <span
            style={{
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 600,
              padding: '3px 8px',
              background: moodStyle.bg,
              color: moodStyle.color,
              whiteSpace: 'nowrap',
            }}
          >
            {mood}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Journal page ─────────────────────────────────────────────────────────────

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
      className="animate-fade-in -m-8 flex flex-col lg:min-h-[calc(100vh-3.5rem)]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >

      {/* ── Timeline section ─────────────────────────────────────────────── */}
      <section style={{ padding: '16px 32px 10px', flexShrink: 0 }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#c9d3e0', margin: 0, lineHeight: 1.2 }}>
              Daily Journal
            </h1>
            <p style={{ fontSize: '12px', color: '#3d4e62', marginTop: '4px' }}>
              Your private trading log — pick up where you left off.
            </p>
          </div>
          <button
            type="button"
            onClick={createEntry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              padding: '7px 14px',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2563eb'; }}
          >
            <Plus size={13} />
            New entry
          </button>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#2d3d52',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entries..."
            style={{
              width: '100%',
              background: '#111620',
              border: '1px solid #1a2336',
              borderRadius: '9px',
              padding: '9px 12px 9px 36px',
              fontSize: '13px',
              color: '#8892a0',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = '#2d3d52'; }}
            onBlur={e => { e.target.style.borderColor = '#1a2336'; }}
          />
        </div>

        {/* Entry list */}
        <div style={{ maxHeight: 'min(24vh, 280px)', overflowY: 'auto', paddingRight: '2px' }}>
        {grouped.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: '10px' }}>
            <PenLine size={22} style={{ color: '#2d3d52' }} />
            <p style={{ fontSize: '13px', color: '#4a5a6e', margin: 0 }}>
              {search ? 'No matching entries' : 'No entries yet'}
            </p>
            <p style={{ fontSize: '12px', color: '#2d3d52', margin: 0 }}>
              {search ? 'Try a different keyword.' : 'Hit "New entry" to begin your first session note.'}
            </p>
          </div>
        ) : (
          grouped.map(([month, monthEntries]) => (
            <div key={month} style={{ marginBottom: '14px' }}>
              {/* Month separator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#3b82f6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {month}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#1a2236' }} />
                <span style={{ fontSize: '10px', color: '#2d3d52', whiteSpace: 'nowrap' }}>
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
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      {selected && <div style={{ height: '1px', background: '#1a2236' }} />}

      {/* ── Detail panel ─────────────────────────────────────────────────── */}
      {selected && (
        <section
          style={{
            padding: '18px 32px 32px',
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            minHeight: 0,
          }}
        >

          {/* Section label */}
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#3b82f6',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '10px',
            }}
          >
            Entry
          </p>

          {/* Header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '18px',
              marginBottom: '12px',
              flexWrap: 'wrap',
            }}
          >
            {/* Left: date + stats */}
            <div>
              <h2
                style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#e2e8f0',
                  letterSpacing: '-0.03em',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {formatEntryDate(selected.date, 'EEEE, MMMM d')}
              </h2>
              <p style={{ fontSize: '11px', color: '#2d3d52', marginTop: '7px' }}>
                {formatEntryDate(selected.date, 'yyyy')}
                <span style={{ margin: '0 5px' }}>·</span>
                {selectedWordCount}w
                <span style={{ margin: '0 5px' }}>·</span>
                {totalWords} overall
              </p>
            </div>

            {/* Right: actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Date picker */}
              <input
                type="date"
                value={selected.date}
                onChange={e => void handleDateChange(e.target.value)}
                style={{
                  background: '#111620',
                  border: '1px solid #1a2336',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  color: '#8892a0',
                  colorScheme: 'dark',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />

              {/* Auto-save status */}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  border: '1px solid #1a2336',
                  borderRadius: '7px',
                  fontSize: '11px',
                  color: saving ? '#fbbf24' : '#4a5a6e',
                  cursor: 'default',
                  userSelect: 'none',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: saving ? '#f59e0b' : saved ? '#10b981' : '#10b981',
                    opacity: saving ? 1 : saved ? 1 : 0.4,
                  }}
                />
                {saving ? 'Saving…' : saved ? 'Auto-saved' : 'Auto-save on'}
              </span>

              {/* Delete */}
              <button
                type="button"
                onClick={() => setDeleteTarget(selected)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  border: '1px solid #1a2336',
                  borderRadius: '7px',
                  background: 'transparent',
                  fontSize: '11px',
                  color: '#4a5a6e',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = '#7f1d1d';
                  el.style.color = '#f87171';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = '#1a2336';
                  el.style.color = '#4a5a6e';
                }}
              >
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          </div>

          {/* Mood toggles */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
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
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: `1px solid ${isActive ? ms.border : '#1a2336'}`,
                    background: isActive ? ms.bg : '#111620',
                    fontSize: '11px',
                    color: isActive ? ms.color : '#4a5a6e',
                    cursor: 'pointer',
                    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                  }}
                >
                  {isActive && (
                    <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}>
                      <circle cx="4" cy="4" r="4" fill={ms.color} />
                    </svg>
                  )}
                  <MoodIcon size={11} />
                  {mood}
                </button>
              );
            })}
          </div>

          {/* Writing area */}
          <div
            className="min-h-[500px] lg:h-[55vh]"
            style={{
              background: '#111620',
              border: '1px solid #1a2336',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
            }}
          >
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
                padding: '14px 18px 12px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: '#c9d3e0',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
            <style>{`input[type="text"]::placeholder { color: #2d3d52; } textarea::placeholder { color: #2d3d52; }`}</style>

            {/* Hint bar */}
            <div
              style={{
                borderTop: '1px solid #131c2a',
                borderBottom: '1px solid #131c2a',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '11px', color: '#2d3d52' }}>
                What happened · What you felt · What to carry forward
              </span>
              <span style={{ fontSize: '11px', color: '#2d3d52' }}>Autosaves after 1.5s</span>
            </div>

            {/* Body textarea */}
            <textarea
              ref={textareaRef}
              value={getEntryContent(selected)}
              onChange={e => handleContentChange(e.target.value)}
              placeholder={`Write your reflection for ${formatEntryDate(selected.date, 'MMMM d, yyyy')}…`}
              style={{
                display: 'block',
                width: '100%',
                flex: 1,
                minHeight: 0,
                padding: '18px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: '13.5px',
                color: '#8892a0',
                lineHeight: 1.75,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </section>
      )}

      {/* ── Delete modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Journal Entry">
        <p className="mb-6 text-[13px] leading-relaxed text-slate-300">
          Permanently delete the entry for{' '}
          <span className="font-semibold text-white">
            {deleteTarget ? formatEntryDate(deleteTarget.date, 'MMMM d, yyyy') : ''}
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => deleteTarget && deleteEntry(deleteTarget)}
            className="btn-danger flex items-center gap-2 text-sm"
          >
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

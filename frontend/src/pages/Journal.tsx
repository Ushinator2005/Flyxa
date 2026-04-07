import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Heart,
  Leaf,
  Moon,
  PenLine,
  Plus,
  Save,
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

const JOURNAL_MOOD_STORAGE_KEY = 'tw-journal-moods';
const JOURNAL_MOODS = ['Calm', 'Focused', 'Confident', 'Tired', 'Frustrated'] as const;
const ICON_STROKE_WIDTH = 1.75;
const MOOD_ICONS: Record<(typeof JOURNAL_MOODS)[number], LucideIcon> = {
  Calm: Leaf,
  Focused: Target,
  Confident: ShieldCheck,
  Tired: Moon,
  Frustrated: AlertTriangle,
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getPreview(text: string) {
  return text.slice(0, 120).replace(/\n/g, ' ').trim();
}

function getEntryTitle(text: string) {
  const firstLine = text
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) return 'Untitled entry';
  if (firstLine.length <= 54) return firstLine;
  return `${firstLine.slice(0, 54).trimEnd()}...`;
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
  } catch {
    return {};
  }
}

function saveJournalMoods(moods: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(JOURNAL_MOOD_STORAGE_KEY, JSON.stringify(moods));
}

function EntryItem({
  entry,
  mood,
  selected,
  onClick,
}: {
  entry: JournalEntry;
  mood?: string;
  selected: boolean;
  onClick: () => void;
}) {
  const preview = getPreview(entry.content);
  const title = getEntryTitle(entry.content);
  const wc = wordCount(entry.content);
  const hasContent = wc > 0;
  const entryDate = parseISO(entry.date);
  const MoodIcon = mood ? MOOD_ICONS[mood as keyof typeof MOOD_ICONS] : null;

  return (
    <button
      onClick={onClick}
      className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? 'border-slate-600 bg-slate-800/95 text-white'
          : 'border-slate-800/80 bg-slate-950/80 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-100'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[18px] border ${
            selected ? 'border-slate-500 bg-slate-900' : 'border-slate-800 bg-slate-950'
          }`}
        >
          <span className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
            {format(entryDate, 'MMM')}
          </span>
          <span className={`mt-2 text-2xl font-semibold tracking-tight ${selected ? 'text-white' : 'text-slate-100'}`}>
            {format(entryDate, 'd')}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold leading-tight ${selected ? 'text-white' : 'text-slate-100'}`}>
                {hasContent ? title : format(entryDate, 'EEEE')}
              </p>
              <p className={`mt-2 text-[11px] uppercase tracking-[0.18em] ${selected ? 'text-slate-400' : 'text-slate-500'}`}>
                {format(entryDate, 'EEEE, MMMM d')}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-2 text-[10px] font-medium ${
                hasContent
                  ? selected
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-800 text-slate-400'
                  : selected
                    ? 'bg-slate-700 text-slate-300'
                    : 'bg-slate-900 text-slate-500'
              }`}
            >
              {hasContent ? `${wc} words` : 'Blank'}
            </span>
          </div>

          <p
            className={`mt-4 max-h-[3.8rem] overflow-hidden text-[13px] leading-6 ${
              selected ? 'text-slate-300' : hasContent ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {hasContent ? preview : "A clean page waiting for today's note."}
          </p>

          {mood && (
            <div className="mt-4">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-medium ${
                  selected
                    ? 'bg-slate-700 text-slate-200'
                    : 'border border-slate-800 bg-slate-950/70 text-slate-400'
                }`}
              >
                {MoodIcon ? (
                  <MoodIcon
                    size={10}
                    strokeWidth={ICON_STROKE_WIDTH}
                    className={selected ? 'text-slate-300' : 'text-slate-500'}
                  />
                ) : (
                  <Heart
                    size={10}
                    strokeWidth={ICON_STROKE_WIDTH}
                    className={selected ? 'text-slate-300' : 'text-slate-500'}
                  />
                )}
                {mood}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
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

  async function autoSave(content: string) {
    if (!selected) return;
    setSaving(true);

    try {
      const updated = await journalApi.update(selected.id, { content } as Record<string, unknown>);
      setEntries(current => current.map(entry => (entry.id === selected.id ? (updated as JournalEntry) : entry)));
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

    setSelected(current => (current ? { ...current, content } : current));
    setSaved(false);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void autoSave(content);
    }, 1500);
  }

  async function createEntry() {
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = entries.find(entry => entry.date === today);

    if (existing) {
      setSelected(existing);
      return;
    }

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
      await fetchEntries();
    } catch (error) {
      console.error(error);
    }

    setDeleteTarget(null);
  }

  const filtered = useMemo(
    () =>
      entries.filter(
        entry =>
          search === '' ||
          entry.content.toLowerCase().includes(search.toLowerCase()) ||
          entry.date.includes(search)
      ),
    [entries, search]
  );

  const grouped = useMemo(() => {
    const sortedEntries = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    const bucket = new Map<string, JournalEntry[]>();

    sortedEntries.forEach(entry => {
      const month = format(parseISO(entry.date), 'MMMM yyyy');
      const current = bucket.get(month) ?? [];
      current.push(entry);
      bucket.set(month, current);
    });

    return Array.from(bucket.entries());
  }, [filtered]);

  const totalWords = useMemo(() => entries.reduce((sum, entry) => sum + wordCount(entry.content), 0), [entries]);
  const selectedWordCount = selected ? wordCount(selected.content) : 0;
  const todayLabel = format(new Date(), 'EEEE, MMMM d, yyyy');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" label="Loading daily journal..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">Daily Journal</h1>
          <p className="mt-2 text-sm text-slate-500">{todayLabel}</p>
        </div>

        <button
          onClick={createEntry}
          className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-2xl bg-blue-600 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:self-auto"
        >
          <Plus size={16} strokeWidth={ICON_STROKE_WIDTH} />
          New Entry
        </button>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-slate-800/80 bg-[linear-gradient(180deg,rgba(10,13,20,0.97),rgba(6,9,15,0.98))]">
          <div className="border-b border-slate-800/80 px-6 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Archive</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Journal timeline</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Browse by date, pick up where you left off, or start a fresh page for today.
            </p>
          </div>

          <div className="border-b border-slate-800/80 px-4 py-4">
            <div className="relative">
              <Search
                size={14}
                strokeWidth={ICON_STROKE_WIDTH}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"
              />
              <input
                type="text"
                className="h-12 w-full rounded-2xl border border-slate-800 bg-slate-900/80 pl-12 pr-4 text-sm text-slate-200 outline-none placeholder:text-slate-600 transition-colors focus:border-blue-500/40 focus:bg-slate-900"
                placeholder="Search by date or note text..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[432px] overflow-y-auto p-4">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80">
                  <PenLine size={18} strokeWidth={ICON_STROKE_WIDTH} className="text-slate-600" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {search ? 'No matching entries' : 'No entries yet'}
                </p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  {search ? 'Try a different keyword or date.' : 'Start a new note and your timeline will begin here.'}
                </p>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {grouped.map(([month, monthEntries]) => (
                  <div key={month}>
                    <div className="flex items-center justify-between px-2 pb-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">{month}</p>
                      <p className="text-[11px] text-slate-600">
                        {monthEntries.length} {monthEntries.length === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {monthEntries.map(entry => (
                        <EntryItem
                          key={entry.id}
                          entry={entry}
                          mood={moodByEntryId[entry.id]}
                          selected={selected?.id === entry.id}
                          onClick={() => setSelected(entry)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-800/80 bg-[linear-gradient(180deg,rgba(11,15,24,0.95),rgba(8,11,18,0.99))]">
          {selected ? (
            <>
              <div className="border-b border-slate-800/80 px-6 py-6 md:px-8">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Entry</p>
                    <h2 className="mt-4 font-serif text-4xl tracking-[-0.04em] text-white md:text-5xl">
                      {format(parseISO(selected.date), 'EEEE, MMMM d')}
                    </h2>
                    <p className="mt-4 text-sm text-slate-400 md:text-[15px]">
                      {format(parseISO(selected.date), 'yyyy')} | {selectedWordCount.toLocaleString()} words |{' '}
                      {totalWords.toLocaleString()} overall
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {JOURNAL_MOODS.map(mood => {
                        const isActive = moodByEntryId[selected.id] === mood;
                        const MoodIcon = MOOD_ICONS[mood];

                        return (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => updateEntryMood(selected.id, mood)}
                            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                              isActive
                                ? 'border-slate-500 bg-slate-800 text-slate-100'
                                : 'border-slate-700/70 bg-slate-950/80 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                          >
                            <MoodIcon
                              size={12}
                              strokeWidth={ICON_STROKE_WIDTH}
                              className={isActive ? 'text-slate-300' : 'text-slate-500'}
                            />
                            {mood}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                      {saving && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/[0.08] px-4 py-2 text-sm text-blue-300">
                        <Save size={14} strokeWidth={ICON_STROKE_WIDTH} className="animate-pulse" />
                        Saving
                      </span>
                    )}

                    {!saving && saved && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-4 py-2 text-sm text-emerald-300">
                        <CheckCircle2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                        Saved
                      </span>
                    )}

                    {!saving && !saved && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm text-slate-400">
                        <Save size={14} strokeWidth={ICON_STROKE_WIDTH} className="text-slate-500" />
                        Auto-save on
                      </span>
                    )}

                    <button
                      onClick={() => setDeleteTarget(selected)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm text-slate-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                      title="Delete entry"
                    >
                      <Trash2 size={14} strokeWidth={ICON_STROKE_WIDTH} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
                <div className="mx-auto flex h-full min-h-[480px] max-w-4xl flex-col rounded-[30px] border border-slate-800/80 bg-[#0f1726] px-6 py-6 md:px-8 md:py-8">
                  <div className="mb-6 flex flex-col gap-4 border-b border-slate-800/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Writing space</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Keep it simple: what happened, what you felt, and what you want to remember next time.
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">Autosaves after 1.5 seconds</p>
                  </div>

                  <div
                    className="flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-slate-800/80 bg-[#111b2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                    style={{
                      backgroundImage:
                        'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(15,23,42,0.98)), repeating-linear-gradient(180deg, transparent 0, transparent 47px, rgba(148,163,184,0.08) 47px, rgba(148,163,184,0.08) 48px)',
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      className="block h-full min-h-[384px] w-full resize-none overflow-y-auto bg-transparent px-6 py-6 font-serif text-[18px] leading-[48px] text-slate-100 outline-none placeholder:text-slate-500 md:px-8 md:py-8"
                      placeholder={`Write your reflection for ${format(parseISO(selected.date), 'MMMM d, yyyy')}...\n\nWhat happened today?\nWhat felt clear?\nWhat do you want to carry into tomorrow?`}
                      value={selected.content}
                      onChange={event => handleContentChange(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-12 text-center text-sm text-slate-500 md:px-8">
              Select a journal entry from the archive to open the writing view.
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Journal Entry">
        <p className="mb-6 text-[13px] leading-relaxed text-slate-300">
          Permanently delete the entry for{' '}
          <span className="font-semibold text-white">
            {deleteTarget ? format(parseISO(deleteTarget.date), 'MMMM d, yyyy') : ''}
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => deleteTarget && deleteEntry(deleteTarget)}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <Trash2 size={13} strokeWidth={ICON_STROKE_WIDTH} />
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

import { useEffect, useMemo, useState } from 'react';
import { BookOpenText, LogOut, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import BackgroundCanvas from '../components/BackgroundCanvas.js';
import LumisLogo from '../components/LumisLogo.js';
import {
  LumisEntry,
  LumisSession,
  clearSession,
  createJournalEntry,
  getJournalEntries,
  saveJournalEntries,
} from '../lib/storage.js';

type JournalPageProps = {
  session: LumisSession;
  onSignedOut: () => void;
};

export default function JournalPage({ session, onSignedOut }: JournalPageProps) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LumisEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [savedPulse, setSavedPulse] = useState(false);

  useEffect(() => {
    const nextEntries = getJournalEntries(session.email);
    setEntries(nextEntries);
    setSelectedId(nextEntries[0]?.id ?? null);
  }, [session.email]);

  const selectedEntry = useMemo(
    () => entries.find(entry => entry.id === selectedId) ?? null,
    [entries, selectedId]
  );

  useEffect(() => {
    if (!selectedEntry) {
      setDraftTitle('');
      setDraftBody('');
      return;
    }

    setDraftTitle(selectedEntry.title);
    setDraftBody(selectedEntry.body);
  }, [selectedEntry]);

  function persistEntries(nextEntries: LumisEntry[]) {
    const ordered = [...nextEntries].sort((a, b) => b.date.localeCompare(a.date));
    setEntries(ordered);
    saveJournalEntries(session.email, ordered);
    setSavedPulse(true);
    window.setTimeout(() => setSavedPulse(false), 1200);
  }

  function handleCreateEntry() {
    const entry = createJournalEntry();
    const nextEntries = [entry, ...entries];
    persistEntries(nextEntries);
    setSelectedId(entry.id);
  }

  function handleSave() {
    if (!selectedEntry) return;
    const nextEntries = entries.map(entry =>
      entry.id === selectedEntry.id
        ? {
            ...entry,
            title: draftTitle.trim() || 'Untitled Entry',
            body: draftBody,
          }
        : entry
    );

    persistEntries(nextEntries);
  }

  function handleDelete() {
    if (!selectedEntry) return;
    const nextEntries = entries.filter(entry => entry.id !== selectedEntry.id);
    persistEntries(nextEntries);
    setSelectedId(nextEntries[0]?.id ?? null);
  }

  function handleSignOut() {
    clearSession();
    onSignedOut();
    navigate('/', { replace: true });
  }

  return (
    <BackgroundCanvas className="min-h-screen">
      <div className="page-fade flex min-h-screen">
        <aside className="w-full max-w-[260px] border-r border-white/10 bg-[rgba(255,255,255,0.04)] backdrop-blur-[24px]">
          <div className="flex h-full flex-col">
            <div className="border-b border-white/10 px-6 py-6">
              <LumisLogo className="text-3xl" />
              <div className="mt-6">
                <div className="text-base font-medium text-white">{session.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">{session.email}</div>
              </div>
              <button
                type="button"
                onClick={handleCreateEntry}
                className="lumis-primary-button mt-6 w-full justify-center"
              >
                New Entry <Plus size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              {entries.length === 0 ? (
                <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm leading-7 text-[var(--muted)]">
                  No entries yet. Start with a fresh page and let Flyxa keep the timeline tidy.
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map(entry => {
                    const active = entry.id === selectedId;

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className={`lumis-entry-item ${active ? 'is-active' : ''}`}
                      >
                        <div className="truncate text-sm font-medium text-white">
                          {entry.title || 'Untitled Entry'}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--muted)]">
                          {format(new Date(entry.date), 'do MMMM yyyy')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 px-6 py-5">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-white"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col px-6 py-6 md:px-9 md:py-8">
          {!selectedEntry ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <BookOpenText className="text-white" />
              </div>
              <h1 className="mt-8 font-['Syne'] text-4xl font-bold tracking-[-0.05em] text-white md:text-5xl">
                Your thoughts, beautifully captured.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-8 text-[var(--muted)]">
                Start a new entry and let the space stay quiet, generous, and ready for what happened today.
              </p>
              <button type="button" onClick={handleCreateEntry} className="lumis-primary-button mt-8">
                New Entry <Plus size={15} />
              </button>
            </div>
          ) : (
            <div className="lumis-journal-editor">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-[var(--muted)]">{format(new Date(selectedEntry.date), 'do MMMM yyyy')}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`text-sm transition-colors ${savedPulse ? 'text-emerald-300' : 'text-[var(--muted)]'}`}>
                    {savedPulse ? 'Saved' : 'Auto-save on blur'}
                  </span>
                  <button type="button" onClick={handleSave} className="lumis-primary-button lumis-primary-button--small">
                    <Save size={15} />
                    Save
                  </button>
                  <button type="button" onClick={handleDelete} className="lumis-delete-button">
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>

              <input
                value={draftTitle}
                onChange={event => setDraftTitle(event.target.value)}
                onBlur={handleSave}
                placeholder="Untitled Entry"
                className="mt-8 w-full bg-transparent font-['Syne'] text-4xl font-bold tracking-[-0.05em] text-white outline-none placeholder:text-white/40 md:text-6xl"
              />

              <div className="mt-4 text-base text-[var(--muted)]">
                {format(new Date(selectedEntry.date), 'EEEE, do MMMM yyyy')}
              </div>

              <textarea
                value={draftBody}
                onChange={event => setDraftBody(event.target.value)}
                onBlur={handleSave}
                placeholder="Start writing..."
                className="mt-10 min-h-[420px] flex-1 resize-none bg-transparent text-lg leading-9 text-white outline-none placeholder:text-white/30"
              />
            </div>
          )}
        </main>
      </div>
    </BackgroundCanvas>
  );
}

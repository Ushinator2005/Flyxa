import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { journalApi } from '../../services/api.js';
import { formatCurrency } from '../../utils/calculations.js';
import { JournalEntry, Trade } from '../../types/index.js';
import { buildMonthlyHeatmapData } from '../../utils/tradeAnalytics.js';

function getCellBg(pnl: number | undefined): string {
  if (pnl === undefined) return '';
  if (pnl > 200) return 'bg-emerald-800/60';
  if (pnl > 50) return 'bg-emerald-700/40';
  if (pnl > 0) return 'bg-emerald-900/40';
  if (pnl > -50) return 'bg-red-900/40';
  if (pnl > -200) return 'bg-red-700/40';
  return 'bg-red-800/60';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const JOURNAL_MODAL_DURATION = 380;
const JOURNAL_MODAL_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const JOURNAL_MODAL_RADIUS = '28px';

type RectSnapshot = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type JournalOverlayState = {
  journalId: string;
  journalDate: string;
  originRect: RectSnapshot;
  phase: 'opening' | 'open' | 'closing';
  closeVisible: boolean;
};

function getExpandedRect(): RectSnapshot {
  const width = Math.min(window.innerWidth - 48, Math.round(window.innerWidth * 0.8));
  const height = Math.min(window.innerHeight - 48, Math.round(window.innerHeight * 0.85));

  return {
    width,
    height,
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
  };
}

function getFlipTransform(from: RectSnapshot, to: RectSnapshot) {
  const scaleX = from.width / to.width;
  const scaleY = from.height / to.height;
  const translateX = from.left - to.left;
  const translateY = from.top - to.top;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
}

function JournalOverlay({
  overlay,
  selectedJournal,
  journalLoading,
  journalError,
  onRequestClose,
  onOpenComplete,
  onCloseComplete,
}: {
  overlay: JournalOverlayState;
  selectedJournal: JournalEntry | null;
  journalLoading: boolean;
  journalError: string;
  onRequestClose: () => void;
  onOpenComplete: () => void;
  onCloseComplete: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const expandedRect = useMemo(() => getExpandedRect(), []);
  const displayDate = selectedJournal
    ? format(parseISO(selectedJournal.date), 'do MMMM yyyy')
    : format(parseISO(overlay.journalDate), 'do MMMM yyyy');

  useEffect(() => {
    const panel = panelRef.current;
    const backdrop = backdropRef.current;

    if (!panel || !backdrop) return undefined;

    panel.getAnimations().forEach(animation => animation.cancel());
    backdrop.getAnimations().forEach(animation => animation.cancel());

    if (overlay.phase === 'opening') {
      const panelAnimation = panel.animate(
        [
          {
            transform: getFlipTransform(overlay.originRect, expandedRect),
            borderRadius: JOURNAL_MODAL_RADIUS,
          },
          {
            transform: 'translate3d(0, 0, 0) scale(1, 1)',
            borderRadius: JOURNAL_MODAL_RADIUS,
          },
        ],
        {
          duration: JOURNAL_MODAL_DURATION,
          easing: JOURNAL_MODAL_EASING,
          fill: 'forwards',
        }
      );

      const backdropAnimation = backdrop.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: 300,
          easing: 'ease',
          fill: 'forwards',
        }
      );

      void backdropAnimation.finished.catch(() => undefined);

      void panelAnimation.finished
        .then(() => onOpenComplete())
        .catch(() => undefined);

      return () => {
        panelAnimation.cancel();
        backdropAnimation.cancel();
      };
    }

    if (overlay.phase === 'closing') {
      const panelAnimation = panel.animate(
        [
          {
            transform: 'translate3d(0, 0, 0) scale(1, 1)',
            borderRadius: JOURNAL_MODAL_RADIUS,
          },
          {
            transform: getFlipTransform(overlay.originRect, expandedRect),
            borderRadius: JOURNAL_MODAL_RADIUS,
          },
        ],
        {
          duration: JOURNAL_MODAL_DURATION,
          easing: JOURNAL_MODAL_EASING,
          fill: 'forwards',
        }
      );

      const backdropAnimation = backdrop.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        {
          duration: 240,
          easing: 'ease',
          fill: 'forwards',
        }
      );

      void backdropAnimation.finished.catch(() => undefined);

      void panelAnimation.finished
        .then(() => onCloseComplete())
        .catch(() => undefined);

      return () => {
        panelAnimation.cancel();
        backdropAnimation.cancel();
      };
    }

    panel.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
    backdrop.style.opacity = '1';
    return undefined;
  }, [expandedRect, onCloseComplete, onOpenComplete, overlay]);

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <button
        ref={backdropRef}
        type="button"
        aria-label="Close journal"
        onClick={onRequestClose}
        className="absolute inset-0 opacity-0"
        style={{
          background: 'radial-gradient(circle at center, rgba(239, 246, 255, 0.42) 0%, rgba(148, 184, 255, 0.18) 42%, rgba(15, 23, 42, 0.42) 100%)',
        }}
      />

      <div
        ref={panelRef}
        className="absolute overflow-hidden border border-[#c9dcf6] bg-[linear-gradient(180deg,#e7f2ff_0%,#dcecff_56%,#d3e6ff_100%)] shadow-[0_40px_120px_rgba(83,120,167,0.26)]"
        style={{
          top: expandedRect.top,
          left: expandedRect.left,
          width: expandedRect.width,
          height: expandedRect.height,
          transformOrigin: 'top left',
          borderRadius: JOURNAL_MODAL_RADIUS,
        }}
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-[#d7ebff]/80 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-24 h-52 w-52 rounded-full bg-[#c6dcff]/60 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4 border-b border-[#cfe1f7] bg-[#e5f0ff]/72 px-6 py-5 backdrop-blur-sm md:px-8">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6f88aa]">Daily Journal</p>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-[#28405f]">
                  {displayDate}
                </h3>
                <p className="mt-1 text-sm text-[#6d7f99]">
                  Review your note for this day without leaving the dashboard.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRequestClose}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#c2d8f4] bg-[#edf5ff]/90 text-[#6a84a6] shadow-[0_8px_20px_rgba(158,183,216,0.18)] transition-all duration-150 hover:bg-[#f2f8ff] hover:text-[#28405f] ${
                overlay.closeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden px-6 py-6 md:px-8">
            {journalLoading && (
              <div className="flex h-full items-center justify-center text-sm text-[#6d7f99]">
                Loading journal entry...
              </div>
            )}

            {!journalLoading && journalError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-500">
                {journalError}
              </div>
            )}

            {!journalLoading && selectedJournal && (
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_340px]">
                  <div className="rounded-[30px] border border-[#cddff8] bg-[linear-gradient(135deg,rgba(229,240,255,0.96),rgba(211,228,250,0.92))] p-6 shadow-[0_20px_48px_rgba(158,183,216,0.2)]">
                    <div className="max-w-3xl">
                      <h4 className="text-[42px] font-semibold tracking-[-0.05em] text-[#28405f] md:text-[54px]">
                        {format(parseISO(selectedJournal.date), 'do MMMM yyyy')}
                      </h4>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <div className="text-[#486789]">
                        <span className="text-[28px] font-semibold tracking-[-0.04em]">
                          {selectedJournal.content?.trim()
                            ? selectedJournal.content.trim().split(/\s+/).filter(Boolean).length
                            : 0}
                        </span>
                        <span className="ml-2 text-[16px] font-medium text-[#6782a2]">words</span>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Completed daily reflection
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-[24px] border border-[#d2e3fa] bg-[#eef5ff]/86 p-4 shadow-[0_14px_34px_rgba(158,183,216,0.16)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7f92ad]">Date</p>
                      <p className="mt-3 text-base font-semibold text-[#28405f]">{format(parseISO(selectedJournal.date), 'do MMMM yyyy')}</p>
                    </div>
                    <div className="rounded-[24px] border border-[#d2e3fa] bg-[#eef5ff]/86 p-4 shadow-[0_14px_34px_rgba(158,183,216,0.16)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7f92ad]">Word Count</p>
                      <p className="mt-3 text-base font-semibold text-[#28405f]">
                        {selectedJournal.content?.trim()
                          ? selectedJournal.content.trim().split(/\s+/).filter(Boolean).length
                          : 0} words
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-[#d2e3fa] bg-[#eef5ff]/86 p-4 shadow-[0_14px_34px_rgba(158,183,216,0.16)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7f92ad]">Status</p>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
                        Journal complete
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 rounded-[32px] border border-[#cfe2fb] bg-[linear-gradient(180deg,rgba(226,239,255,0.98),rgba(213,229,250,0.98))] p-2 shadow-[0_22px_56px_rgba(158,183,216,0.18)]">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#d8e8fc] bg-[linear-gradient(180deg,rgba(241,247,255,0.9),rgba(232,242,255,0.92))]">
                    <div className="flex items-center justify-between gap-3 border-b border-[#d7e5f8] px-6 py-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#7f92ad]">Reflection</p>
                        <p className="mt-1 text-sm text-[#6d7f99]">The actual journal entry takes priority here.</p>
                      </div>
                      <span className="rounded-full bg-[#e4f0ff] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#6d84a3]">
                        Personal note
                      </span>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
                      <div className="mx-auto max-w-4xl rounded-[26px] border border-[#d9e7fb] bg-[#f4f8ff]/82 px-6 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:px-10 md:py-9">
                        <p className="whitespace-pre-wrap text-[16px] leading-8 text-[#36506e] md:text-[17px]">
                          {selectedJournal.content?.trim() || 'This journal entry is empty.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MonthlyHeatmap({ trades = [] }: { trades?: Trade[] }) {
  const now = new Date();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journals, setJournals] = useState<Record<number, { id: string; date: string }>>({});
  const [selectedJournal, setSelectedJournal] = useState<JournalEntry | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalOverlay, setJournalOverlay] = useState<JournalOverlayState | null>(null);
  const journalRequestRef = useRef(0);

  useEffect(() => {
    if (journalOverlay) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }

    document.body.style.overflow = '';
    return undefined;
  }, [journalOverlay]);

  useEffect(() => {
    journalApi.getAll()
      .then(data => setJournalEntries(data as JournalEntry[]))
      .catch(() => setJournalEntries([]));
  }, []);

  const { days, counts } = useMemo(
    () => buildMonthlyHeatmapData(trades, year, month),
    [month, trades, year]
  );

  useEffect(() => {
    const nextJournals = journalEntries.reduce<Record<number, { id: string; date: string }>>((acc, journal) => {
      const parsed = new Date(`${journal.date}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return acc;
      if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month) return acc;
      acc[parsed.getDate()] = { id: journal.id, date: journal.date };
      return acc;
    }, {});
    setJournals(nextJournals);
  }, [journalEntries, month, year]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstDay.getDay();

  const cells: Array<number | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);

  const openJournalModal = async (journalId: string, journalDate: string, originRect: RectSnapshot) => {
    if (journalOverlay) return;

    const requestId = journalRequestRef.current + 1;
    journalRequestRef.current = requestId;

    setJournalOverlay({
      journalId,
      journalDate,
      originRect,
      phase: 'opening',
      closeVisible: false,
    });
    setJournalLoading(true);
    setJournalError('');
    setSelectedJournal(null);

    try {
      const entry = await journalApi.getById(journalId);
      if (journalRequestRef.current !== requestId) return;
      setSelectedJournal(entry as JournalEntry);
    } catch {
      if (journalRequestRef.current !== requestId) return;
      setJournalError('Unable to load this daily journal entry.');
    } finally {
      if (journalRequestRef.current !== requestId) return;
      setJournalLoading(false);
    }
  };

  const closeJournalModal = useCallback(() => {
    journalRequestRef.current += 1;
    setJournalOverlay(curr => (
      curr && curr.phase !== 'closing'
        ? { ...curr, phase: 'closing', closeVisible: false }
        : curr
    ));
  }, []);

  const handleJournalOpenComplete = useCallback(() => {
    setJournalOverlay(curr => (
      curr && curr.phase === 'opening'
        ? { ...curr, phase: 'open', closeVisible: true }
        : curr
    ));
  }, []);

  const handleJournalCloseComplete = useCallback(() => {
    setJournalOverlay(null);
    setSelectedJournal(null);
    setJournalError('');
    setJournalLoading(false);
  }, []);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-white">
          Daily P&L - {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-0.5">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:text-slate-200">
            <ChevronLeft size={16} />
          </button>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:text-slate-200">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-700/50">
        <div className="grid grid-cols-7 bg-slate-900/30">
          {DAYS.map(d => (
            <div key={d} className="border-b border-r border-slate-700/50 py-2 text-center text-xs font-medium text-slate-500 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 [grid-auto-rows:84px]">
          {cells.map((day, i) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${i}`}
                  className="border-b border-r border-slate-700/50 last:border-r-0"
                />
              );
            }

            const pnl = days[day];
            const tradeCount = counts[day] ?? 0;
            const journalEntry = journals[day];
            const hasJournal = !!journalEntry;
            const isToday = day === today.getDate()
              && month === today.getMonth() + 1
              && year === today.getFullYear();
            const title = [
              pnl !== undefined ? `${day} - ${formatCurrency(pnl)}` : `${day} - No trades`,
              hasJournal ? 'Daily journal completed' : undefined,
            ].filter(Boolean).join(' | ');

            return (
              <div
                key={day}
                title={title}
                onClick={event => {
                  if (!journalEntry) return;

                  const rect = event.currentTarget.getBoundingClientRect();
                  void openJournalModal(journalEntry.id, journalEntry.date, {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                  });
                }}
                className={`relative flex flex-col border-b border-r border-slate-700/50 p-2 transition-colors last:border-r-0 ${getCellBg(pnl)} ${
                  hasJournal ? 'cursor-pointer hover:ring-1 hover:ring-blue-400/40 hover:ring-inset' : ''
                } ${
                  isToday ? 'bg-cyan-500/[0.04]' : ''
                }`}
              >
                {isToday && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 border border-cyan-400/45"
                  />
                )}
                {isToday ? (
                  <span className="inline-flex flex-col items-start text-xs font-semibold leading-none text-cyan-400">
                    <span>{day}</span>
                    <span className="mt-1 h-[3px] w-[3px] self-start rounded-full bg-cyan-400" />
                  </span>
                ) : (
                  <span className="text-xs leading-none text-slate-400">{day}</span>
                )}
                {pnl !== undefined && (
                  <div className="mt-auto flex flex-col gap-0.5">
                    <span className={`text-xs font-semibold ${pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {pnl >= 0 ? '+' : ''}
                      {Math.abs(pnl) >= 1000
                        ? `${(pnl / 1000).toFixed(1)}k`
                        : pnl.toFixed(0)}
                    </span>
                    {tradeCount > 0 && (
                      <span className="text-[10px] leading-none text-slate-400 opacity-90">
                        {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
                      </span>
                    )}
                  </div>
                )}
                {hasJournal && (
                  <span
                    className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]"
                    aria-label="Daily journal completed"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {journalOverlay && (
        <JournalOverlay
          overlay={journalOverlay}
          selectedJournal={selectedJournal}
          journalLoading={journalLoading}
          journalError={journalError}
          onRequestClose={closeJournalModal}
          onOpenComplete={handleJournalOpenComplete}
          onCloseComplete={handleJournalCloseComplete}
        />
      )}
    </div>
  );
}

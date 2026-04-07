import {
  ArrowRight,
  BarChart3,
  Brain,
  FileText,
  Target,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BackgroundCanvas from '../components/BackgroundCanvas.js';
import Reveal from '../components/Reveal.js';
import FlyxaLogo from '../../components/common/FlyxaLogo.js';

const journalTags = ['Setup', 'Entry thesis', 'Stop & target', 'Screenshot', 'Emotion', 'Post-trade lesson'];

const analyticsBars = [
  { value: 42, positive: true },
  { value: 26, positive: false },
  { value: 58, positive: true },
  { value: 34, positive: false },
  { value: 72, positive: true },
  { value: 46, positive: false },
  { value: 66, positive: true },
  { value: 54, positive: true },
];

const psychologyTimeline = [
  { day: 'Mon', tag: 'Focused', color: '#3BC8FF' },
  { day: 'Tue', tag: 'Revenge traded', color: '#FFB84D' },
  { day: 'Wed', tag: 'Disciplined', color: '#3BC8FF' },
  { day: 'Thu', tag: 'Tilt risk', color: '#FF4D4D' },
];

const reviewFlow = ['Backtest idea', 'Mark on chart', 'Log to journal'];

const featureStats = [
  { label: 'Workspace', value: '1 unified workspace' },
  { label: 'Tools', value: '5 core review tools' },
  { label: 'Coverage', value: '360deg session view' },
  { label: 'Cadence', value: 'Built for daily use' },
];

const primaryStory = {
  quote: 'I stopped overtrading two weeks after I started logging my emotional state before the open.',
  name: 'James T.',
  credential: 'ES futures | 60+ sessions logged',
};

const secondaryStories = [
  {
    quote: "The AI review told me I was profitable on trend days but bleeding on ranges. I genuinely hadn't seen that pattern.",
    name: 'Riya P.',
    credential: 'Full-time NQ trader | 80+ sessions',
  },
  {
    quote: 'Everything used to live in screenshots and a notes app. Now I actually close the loop after every session.',
    name: 'Daniel L.',
    credential: 'Prop firm trader | FTMO funded',
  },
];

const storyStripQuotes = [
  {
    quote: 'Saw my revenge trading pattern in the data for the first time.',
    credential: 'ES futures trader | 34 sessions',
  },
  {
    quote: 'Review used to feel optional. Now it is the whole point.',
    credential: 'Micros trader | 51 sessions',
  },
  {
    quote: "My win rate didn't change - my consistency of process did.",
    credential: 'NQ trader | 67 sessions',
  },
  {
    quote: 'I finally knew which sessions were paying me and which ones were just noise.',
    credential: 'Prop trader | 73 sessions',
  },
  {
    quote: 'The notes and the chart started telling the same story for once.',
    credential: 'ES scalper | 44 sessions',
  },
  {
    quote: 'It made me review execution, not just the outcome.',
    credential: 'Index futures trader | 58 sessions',
  },
];

const heroInsightStats = [
  { label: 'Pattern confidence', value: '84%', detail: 'surfaced across 7 reviewed sessions' },
  { label: 'Best window', value: '9:30-10:15', detail: 'where your cleanest executions happen' },
];

const heroBehaviorBars = [
  { label: 'Waited for confirmation', value: '+2.3R avg', width: '78%', color: '#3BC8FF' },
  { label: 'Impulse re-entry', value: '-1.4R avg', width: '36%', color: '#FF4D4D' },
];

const heroFocusItems = [
  'Log your pre-open emotion before the first trade',
  'Tag every second entry after a stop-out',
  'Review only range mornings this week',
];

export default function LandingPage() {
  const storyStripTop = [...storyStripQuotes.slice(0, 3), ...storyStripQuotes.slice(0, 3)];
  const storyStripBottom = [...storyStripQuotes.slice(3), ...storyStripQuotes.slice(3)];

  return (
    <BackgroundCanvas plain className="bg-[#080B10]">
      <div className="page-fade min-h-screen text-[var(--text)]">
        <style>{`
          @keyframes flyxa-stories-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
        <main>
          <section className="relative overflow-hidden border-b border-white/5 bg-[#080B10]">
            <div className="pointer-events-none absolute inset-0">
              <svg
                viewBox="0 0 1440 420"
                className="absolute inset-x-0 top-[10%] h-[340px] w-full opacity-[0.08] md:h-[420px]"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 296C68 295 120 255 182 255C244 255 276 311 346 311C416 311 438 160 514 160C590 160 607 249 692 249C777 249 811 90 892 90C973 90 1008 196 1080 196C1152 196 1181 135 1246 135C1311 135 1372 215 1440 214"
                  stroke="#3BC8FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>

              <div className="absolute inset-x-0 top-12 hidden h-56 opacity-[0.05] lg:block" aria-hidden="true">
                {[8, 21, 34, 47, 60, 73, 86].map((left, index) => (
                  <div key={left} className="absolute bottom-0" style={{ left: `${left}%` }}>
                    <div
                      className="mx-auto w-px bg-[#3BC8FF]"
                      style={{ height: `${72 + index * 18}px` }}
                    />
                    <div
                      className="absolute left-[-5px] w-[10px] rounded-sm border border-[#3BC8FF] bg-transparent"
                      style={{
                        bottom: `${14 + index * 10}px`,
                        height: `${24 + (index % 3) * 8}px`,
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,16,0.18),rgba(8,11,16,0.85)_72%,#080B10)]" />
            </div>

            <header className="relative z-20">
              <div className="mx-auto grid max-w-[1240px] grid-cols-[auto_1fr] items-center gap-4 px-6 py-6 lg:grid-cols-[1fr_auto_1fr]">
                <Link to="/auth" className="text-2xl font-extrabold tracking-[-0.04em]">
                  <FlyxaLogo
                    size={40}
                    showWordmark
                    wordmarkClassName="text-[1.95rem] font-extrabold tracking-[-0.06em] text-white"
                  />
                </Link>

                <nav className="hidden items-center justify-center gap-10 text-sm text-[#8A8F98] lg:flex">
                  <a href="#features" className="transition-colors hover:text-white">Features</a>
                  <a href="#stats" className="transition-colors hover:text-white">Why Flyxa</a>
                  <a href="#testimonials" className="transition-colors hover:text-white">Stories</a>
                </nav>

                <div className="justify-self-end">
                  <Link
                    to="/auth"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-[#3BC8FF]/70 px-5 text-sm font-medium text-[#3BC8FF] transition-colors hover:bg-[#3BC8FF]/10"
                  >
                    Get started free
                  </Link>
                </div>

                <nav className="col-span-2 flex items-center gap-6 text-sm text-[#8A8F98] lg:hidden">
                  <a href="#features" className="transition-colors hover:text-white">Features</a>
                  <a href="#stats" className="transition-colors hover:text-white">Why Flyxa</a>
                  <a href="#testimonials" className="transition-colors hover:text-white">Stories</a>
                </nav>
              </div>
            </header>

            <div className="relative z-20 mx-auto max-w-[1240px] px-6 pb-20 pt-8 md:pb-24 md:pt-12">
              <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
                <Reveal className="max-w-[560px]">
                  <h1 className="font-['Syne'] text-[clamp(3rem,6vw,5.2rem)] font-extrabold leading-[0.94] tracking-[-0.05em] text-white">
                    You don&apos;t have a strategy problem. You have a <span className="text-[#3BC8FF]">review</span> problem.
                  </h1>

                  <p className="mt-8 max-w-[480px] text-[17px] leading-[1.65] text-[#8A8F98]">
                    Flyxa connects your trades, psychology, and session notes into one review workspace - so patterns become visible and habits actually change.
                  </p>

                  <div className="mt-10">
                    <Link
                      to="/auth"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3BC8FF] px-6 text-sm font-semibold text-[#080B10] transition-colors hover:bg-[#67E8FF]"
                    >
                      Start reviewing free <ArrowRight size={16} />
                    </Link>
                    <p className="mt-5 text-sm text-[#8A8F98]">Joined by 240 futures traders this week</p>
                  </div>
                </Reveal>

                <Reveal delay={120}>
                  <div className="mx-auto w-full max-w-[620px]">
                    <div className="relative overflow-hidden rounded-[40px] border border-white/[0.08] bg-[#0D1218] p-4 sm:p-6">
                      <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-[#3BC8FF]/[0.05] blur-3xl" />
                      <div className="pointer-events-none absolute -left-12 bottom-8 h-28 w-28 rounded-full bg-white/[0.03] blur-2xl" />

                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8A8F98]">Flyxa review</p>
                          <p className="mt-2 text-sm font-medium text-white">Pattern surfaced from your last 7 sessions</p>
                        </div>
                        <div className="rounded-full border border-[#3BC8FF]/20 bg-[#3BC8FF]/8 px-3 py-1 text-[11px] font-medium text-[#3BC8FF]">
                          Behavior pattern found
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_220px] lg:items-start">
                        <div className="space-y-4">
                          <div className="rounded-[32px] border border-white/[0.06] bg-[#111824] p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#8A8F98]">
                                <FileText size={14} />
                                AI review summary
                              </div>
                              <span className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] text-[#8A8F98]">
                                7 sessions analyzed
                              </span>
                            </div>
                            <p className="mt-5 text-[1.35rem] font-medium leading-9 text-white">
                              You make money when you wait for confirmation. You give it back when you force a second trade on range mornings.
                            </p>
                            <p className="mt-4 max-w-[460px] text-sm leading-7 text-[#8A8F98]">
                              Flyxa connected your notes, trade history, and emotional tags to show the pattern you kept feeling but could not prove.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-2 rounded-full border border-[#3BC8FF]/18 bg-[#3BC8FF]/8 px-3 py-1.5 text-xs text-[#C8D7E6]">
                                Trend mornings +2.3R avg
                              </span>
                              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#8A8F98]">
                                Range re-entries -1.4R avg
                              </span>
                            </div>
                          </div>

                          <div className="ml-0 rounded-[34px] border border-white/[0.06] bg-[#111824] p-5 sm:ml-8">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#8A8F98]">
                                <BarChart3 size={14} />
                                P&L by behavior
                              </div>
                              <span className="text-sm font-medium text-[#3BC8FF]">+4.8R reclaimed</span>
                            </div>
                            <div className="mt-5 rounded-[26px] border border-white/[0.05] bg-[#0C121B] p-4">
                              <div className="space-y-4">
                                {heroBehaviorBars.map(item => (
                                  <div key={item.label}>
                                    <div className="flex items-center justify-between gap-4 text-sm">
                                      <span className="text-[#C8D7E6]">{item.label}</span>
                                      <span style={{ color: item.color }} className="font-medium">
                                        {item.value}
                                      </span>
                                    </div>
                                    <div className="mt-2 h-2.5 rounded-full bg-white/[0.05]">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: item.width, backgroundColor: item.color }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-5 h-16">
                                <svg viewBox="0 0 320 64" className="h-full w-full" fill="none" aria-hidden="true">
                                  <path d="M4 52H316" stroke="rgba(138,143,152,0.12)" strokeWidth="1" />
                                  <path d="M4 42 42 46 78 32 114 34 150 22 188 24 226 10 264 16 316 4" stroke="#3BC8FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M4 42 42 46 78 32 114 34 150 22 188 24 226 10 264 16 316 4" stroke="#3BC8FF" strokeOpacity="0.16" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 lg:pt-8">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            {heroInsightStats.map(stat => (
                              <div
                                key={stat.label}
                                className="rounded-[999px] border border-white/[0.06] bg-[#111824] px-5 py-4"
                              >
                                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8A8F98]">{stat.label}</p>
                                <p className="mt-3 font-['Syne'] text-[1.9rem] font-bold tracking-[-0.04em] text-white">
                                  {stat.value}
                                </p>
                                <p className="mt-2 text-xs text-[#8A8F98]">{stat.detail}</p>
                              </div>
                            ))}
                          </div>

                          <div className="rounded-[32px] border border-white/[0.06] bg-[#111824] p-5">
                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#8A8F98]">
                              <Brain size={14} />
                              What changes next
                            </div>
                            <div className="mt-4 rounded-[24px] border border-[#3BC8FF]/16 bg-[#3BC8FF]/6 px-4 py-4">
                              <p className="text-sm font-medium text-white">Keep the first pullback. Cut the emotional re-entry.</p>
                              <div className="mt-4 space-y-2.5">
                                {heroFocusItems.map(item => (
                                  <div key={item} className="flex items-start gap-3 rounded-[16px] border border-white/[0.06] bg-[#0D1218]/70 px-3 py-3">
                                    <Target size={14} className="mt-0.5 shrink-0 text-[#3BC8FF]" />
                                    <p className="text-xs leading-6 text-[#C8D7E6]">{item}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </section>

          <section id="features" className="mx-auto max-w-[1240px] px-6 py-10">
            <Reveal>
              <div className="max-w-[720px]">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Features</p>
                <h2 className="mt-4 font-['Syne'] text-4xl font-bold tracking-[-0.05em] text-[var(--text)] md:text-5xl">
                  You already know what went wrong. The question is whether you'll see it again next week.
                </h2>
              </div>
            </Reveal>

            <div className="mt-10 space-y-6">
              <Reveal>
                <article className="min-h-[280px] rounded-[12px] border border-[#1C2030] bg-[#0E1117] p-6 lg:grid lg:grid-cols-[1.2fr_0.9fr] lg:gap-8 lg:p-8">
                  <div className="flex flex-col justify-between">
                    <div>
                      <h3 className="text-[18px] font-semibold text-white">Trade Journal</h3>
                      <p className="mt-3 max-w-[520px] text-sm leading-7 text-[#8A8F98]">
                        Put the setup, decision, screenshot, emotion, and outcome in one review entry so the lesson survives longer than the sting of the loss.
                      </p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {journalTags.map(tag => (
                        <span
                          key={tag}
                          className="rounded-full border border-[#1C2030] bg-[#121723] px-3 py-1.5 text-xs text-[#8A8F98]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 lg:mt-0">
                    <div className="rounded-[12px] border border-[#1C2030] bg-[#121723] p-4">
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                        <div>
                          <p className="text-xs font-medium text-white">Tuesday, Apr 7 - ES Futures</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-[#8A8F98]">Journal entry</p>
                        </div>
                        <span className="rounded-full bg-[#3BC8FF]/12 px-3 py-1 text-xs font-semibold text-[#3BC8FF]">
                          +2.4R
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {[
                          ['Setup', 'Opening range retest after failed squeeze'],
                          ['Entry thesis', 'Buyer absorption held at prior resistance and reclaimed VWAP'],
                          ['Emotion', 'Patient before entry, calm once risk was defined'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A8F98]">{label}</p>
                            <p className="mt-2 text-sm leading-6 text-white">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 h-16 rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-3 py-3">
                        <svg viewBox="0 0 260 40" className="h-full w-full" fill="none" aria-hidden="true">
                          <path d="M0 30 36 29 62 26 88 27 112 20 145 20 175 14 205 17 232 10 260 5" stroke="#3BC8FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M0 30 36 29 62 26 88 27 112 20 145 20 175 14 205 17 232 10 260 5" stroke="#3BC8FF" strokeOpacity="0.15" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </article>
              </Reveal>

              <div className="grid gap-6 lg:grid-cols-[1.05fr_1.05fr_0.9fr]">
                <Reveal>
                  <article className="h-full rounded-[12px] border border-[#1C2030] bg-[#0E1117] p-6">
                    <h3 className="text-[18px] font-semibold text-white">Performance Analytics</h3>
                    <p className="mt-3 text-sm leading-7 text-[#8A8F98]">
                      See quickly whether progress is actually showing up in the numbers.
                    </p>

                    <div className="mt-8 flex h-36 items-end gap-3 rounded-[12px] border border-[#1C2030] bg-[#121723] px-4 pb-4 pt-6">
                      {analyticsBars.map((bar, index) => (
                        <div key={`${bar.value}-${index}`} className="flex flex-1 items-end justify-center">
                          <div
                            className="w-full rounded-t-[8px]"
                            style={{
                              height: `${bar.value}%`,
                              backgroundColor: bar.positive ? '#3BC8FF' : '#FF4D4D',
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-sm text-[#8A8F98]">Win Rate 64% · Avg R 1.8 · Sessions 42</p>
                  </article>
                </Reveal>

                <Reveal delay={90}>
                  <article className="h-full rounded-[12px] border border-[#1C2030] bg-[#0E1117] p-6">
                    <h3 className="text-[18px] font-semibold text-white">Psychology Tracking</h3>
                    <p className="mt-3 text-sm leading-7 text-[#8A8F98]">
                      Review the emotional texture of the week, not just the trade outcomes.
                    </p>

                    <div className="mt-8 rounded-[12px] border border-[#1C2030] bg-[#121723] p-4">
                      <div className="space-y-4">
                        {psychologyTimeline.map((item, index) => (
                          <div key={item.day} className="flex items-start gap-3">
                            <div className="flex flex-col items-center pt-1">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              {index < psychologyTimeline.length - 1 && (
                                <span className="mt-2 h-10 w-px bg-[#1C2030]" />
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-3 py-3">
                              <span className="text-sm font-medium text-white">{item.day}</span>
                              <span className="text-sm text-[#8A8F98]">{item.tag}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>

                <Reveal delay={180}>
                  <article className="h-full rounded-[12px] border border-[#1C2030] bg-[#0E1117] p-6">
                    <h3 className="text-[18px] font-semibold text-white">Backtest to Review Flow</h3>
                    <p className="mt-3 text-sm leading-7 text-[#8A8F98]">
                      Carry good ideas from testing into live review instead of losing them between tools.
                    </p>

                    <div className="mt-8 rounded-[12px] border border-[#1C2030] bg-[#121723] p-4">
                      <div className="flex flex-col gap-3">
                        {reviewFlow.map((step, index) => (
                          <div key={step} className="flex items-center gap-3">
                            <div className="rounded-full border border-[#1C2030] bg-[#0E1117] px-4 py-2 text-sm text-white">
                              {step}
                            </div>
                            {index < reviewFlow.length - 1 && (
                              <div className="flex items-center gap-2 text-[#3BC8FF]">
                                <span className="h-px w-6 bg-[#3BC8FF]" />
                                <ArrowRight size={14} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </Reveal>
              </div>
            </div>
          </section>

          <section id="stats" className="mx-auto max-w-[1240px] px-6 py-12">
            <Reveal>
              <div className="grid gap-6 border-t border-white/[0.08] pt-8 sm:grid-cols-2 lg:grid-cols-4">
                {featureStats.map(item => (
                  <div key={item.label}>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-[#8A8F98]">{item.label}</div>
                    <div className="mt-3 text-[22px] font-bold text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          <section id="testimonials" className="overflow-hidden px-6 py-24">
            <div className="mx-auto max-w-[1240px]">
              <Reveal>
                <div className="mx-auto max-w-[680px]">
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Stories</p>

                  <div className="mt-8 space-y-8">
                    {[primaryStory, ...secondaryStories].map((story, index, stories) => (
                      <div
                        key={story.name}
                        className={index < stories.length - 1 ? 'border-b border-[#1C2030] pb-8' : ''}
                      >
                        <div className="relative pl-6">
                          <span className="absolute left-0 top-[-4px] font-['Syne'] text-4xl leading-none text-[#3BC8FF]">
                            "
                          </span>
                          <p className="text-[17px] font-normal leading-8 text-white">{story.quote}</p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="text-[15px] font-semibold text-white">{story.name}</span>
                          <span className="rounded-full border border-[#1C2030] bg-[#0E1117] px-3 py-1.5 text-[13px] text-[#8A8F98]">
                            {story.credential}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal delay={120}>
              <div className="mt-12 hover:[&_.story-strip]:[animation-play-state:paused]">
                <div
                  className="overflow-hidden"
                  style={{
                    maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                  }}
                >
                  <div
                    className="story-strip flex min-w-max items-start gap-3 pr-16 will-change-transform"
                    style={{ animation: 'flyxa-stories-marquee 34s linear infinite' }}
                  >
                    {[...storyStripTop, ...storyStripBottom].map((story, index) => (
                      <div
                        key={`${story.quote}-${index}`}
                        className="shrink-0 whitespace-nowrap rounded-full border border-[#1C2030] bg-[#121723] px-6 py-4.5"
                      >
                        <p className="whitespace-nowrap text-[16px] leading-7 text-white">{story.quote}</p>
                        <p className="mt-2 whitespace-nowrap text-[14px] text-[#8A8F98]">{story.credential}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </section>

          <section className="relative overflow-hidden bg-[#080B10] px-6 py-20">
            <div className="pointer-events-none absolute inset-0">
              <svg
                viewBox="0 0 1440 220"
                className="absolute inset-x-0 top-1/2 h-[220px] w-full -translate-y-1/2 opacity-[0.06]"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0 132C82 131 130 100 202 100C274 100 324 146 387 146C450 146 489 78 565 78C641 78 675 123 749 123C823 123 864 64 938 64C1012 64 1054 112 1126 112C1198 112 1239 83 1311 83C1383 83 1410 98 1440 98"
                  stroke="#3BC8FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <Reveal>
              <div className="relative mx-auto max-w-[640px] text-center">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Start reviewing with Flyxa</p>
                <h2 className="mt-5 font-['Syne'] text-4xl font-bold tracking-[-0.05em] text-white md:text-5xl">
                  Turn scattered lessons into a repeatable trading process.
                </h2>
                <p className="mx-auto mt-5 max-w-[480px] text-[16px] leading-[1.65] text-[#8A8F98]">
                  One workspace for your trades, your notes, and your patterns. Review with intention.
                </p>
                <Link
                  to="/auth"
                  className="mt-9 inline-flex h-12 items-center justify-center rounded-full bg-[#3BC8FF] px-6 text-sm font-semibold text-[#080B10] transition-colors hover:bg-[#67E8FF]"
                >
                  Start reviewing free <ArrowRight size={16} className="ml-2" />
                </Link>
                <p className="mt-5 text-sm text-[#8A8F98]">
                  No credit card | Cancel anytime | Used by 240+ futures traders
                </p>
              </div>
            </Reveal>
          </section>
        </main>

        <footer className="border-t border-[#1C2030]">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-6 py-8 text-sm text-[var(--muted)] md:grid-cols-3 md:items-start">
            <div>
              <FlyxaLogo
                size={38}
                showWordmark
                wordmarkClassName="text-[1.75rem] font-extrabold tracking-[-0.06em] text-white"
              />
              <p className="mt-3 text-sm text-[#8A8F98]">Built for traders who review with intention.</p>
            </div>

            <div className="flex flex-col gap-3 md:items-center">
              <a href="#features" className="transition-colors hover:text-white">Features</a>
              <a href="#stats" className="transition-colors hover:text-white">Why Flyxa</a>
              <a href="#testimonials" className="transition-colors hover:text-white">Stories</a>
            </div>

            <div className="md:text-right">
              <div className="text-sm text-[#C8CDD6]">Copyright 2026 Flyxa. All rights reserved.</div>
              <div className="mt-2 text-sm text-[#8A8F98]">Made for futures traders</div>
            </div>
          </div>
        </footer>
      </div>
    </BackgroundCanvas>
  );
}

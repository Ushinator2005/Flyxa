import { useState } from 'react';

type ViewKey = 'weekly' | 'patterns' | 'pre-session' | 'emotional' | 'ask';
type InsightTone = 'pattern' | 'psychology' | 'edge' | 'risk';
type DataPillTone = 'default' | 'green' | 'red';
type TrendTone = 'improving' | 'worsening' | 'stable';
type MatrixTone = 'good' | 'neutral' | 'bad';

const navItems: Array<{ key: ViewKey; label: string }> = [
  { key: 'weekly', label: 'Weekly debrief' },
  { key: 'patterns', label: 'Pattern library' },
  { key: 'pre-session', label: 'Pre-session brief' },
  { key: 'emotional', label: 'Emotional fingerprint' },
  { key: 'ask', label: 'Ask Flyxa' },
];

const historyItems = ['Mar 31 debrief', 'Mar 24 debrief', 'Mar 17 debrief'];

const weeklyInsightCards: Array<{
  badge: string;
  tone: InsightTone;
  context: string;
  title: string;
  body: string;
  pills: Array<{ label: string; tone: DataPillTone }>;
}> = [
  {
    badge: 'RECURRING PATTERN',
    tone: 'pattern',
    context: 'Seen in 6 of 8 sessions',
    title: "You're fading moves in the first 30 minutes and it's costing you",
    body:
      "Of your 7 losses this week, 5 occurred between 9:30-10:00 ET. Your notes consistently reference 'felt choppy' or 'wasn't sure' in that window - but you traded anyway. On the days you waited until 10:15 before entering, your R was positive in 4 of 4 sessions. The data is clear on this.",
    pills: [
      { label: '-4.1R in open 30min', tone: 'red' },
      { label: '+7.3R after 10:15', tone: 'green' },
    ],
  },
  {
    badge: 'PSYCHOLOGY',
    tone: 'psychology',
    context: 'Wednesday - Thursday',
    title: "Your tilt on Wednesday didn't end on Wednesday",
    body:
      "After your -2.1R session you logged 'frustrated, felt like I gave it away.' Thursday's first two trades were taken within 8 minutes of open - your fastest entry times all week. Both were losers. This is the third time this year a large loss has bled into the following morning. The day-after session is your highest-risk window.",
    pills: [
      { label: 'Same pattern: Mar 17', tone: 'default' },
      { label: 'Same pattern: Feb 28', tone: 'default' },
      { label: '3x this year', tone: 'default' },
    ],
  },
  {
    badge: 'EDGE CONFIRMED',
    tone: 'edge',
    context: 'Consistent 4 weeks',
    title: 'London-NY overlap is your most reliable edge - protect it',
    body:
      "Trades taken 8:00-9:30 ET on NQ: 71% win rate, avg +1.6R, over 4 consecutive weeks. Your notes in these sessions use the word 'clear' significantly more than any other window. You are not replicating this process - you're just showing up earlier. Consider building a pre-session checklist specifically for this window.",
    pills: [
      { label: '71% W/R', tone: 'green' },
      { label: 'avg +1.6R', tone: 'green' },
      { label: '4 weeks straight', tone: 'default' },
    ],
  },
  {
    badge: 'RISK FLAG',
    tone: 'risk',
    context: 'This week',
    title: 'You sized up after losses twice - both ended in larger losses',
    body:
      "On Tuesday and Thursday you increased position size on the trade immediately following a losing trade. Your notes don't mention this decision either time - which suggests it wasn't part of the plan. Both trades lost. Combined cost: -2.8R. This is a pattern worth making a rule around, not just noticing.",
    pills: [
      { label: '-2.8R combined', tone: 'red' },
      { label: 'Unplanned both times', tone: 'default' },
    ],
  },
];

const patternRows: Array<{
  name: string;
  firstSeen: string;
  occurrences: string;
  impact: string;
  impactColor: string;
  trend: string;
  trendTone: TrendTone;
}> = [
  {
    name: 'Revenge trading after gap days',
    firstSeen: 'Feb 3',
    occurrences: '7x',
    impact: '-3.2R total',
    impactColor: 'text-[#E24B4A]',
    trend: 'Worsening',
    trendTone: 'worsening',
  },
  {
    name: 'Fading the open (9:30-10:00)',
    firstSeen: 'Jan 14',
    occurrences: '12x',
    impact: '-8.1R total',
    impactColor: 'text-[#E24B4A]',
    trend: 'Stable',
    trendTone: 'stable',
  },
  {
    name: 'London-NY overlap edge',
    firstSeen: 'Mar 2',
    occurrences: '18x',
    impact: '+14.3R total',
    impactColor: 'text-[#00C97A]',
    trend: 'Improving',
    trendTone: 'improving',
  },
  {
    name: 'Oversizing after a loss',
    firstSeen: 'Mar 17',
    occurrences: '4x',
    impact: '-4.4R total',
    impactColor: 'text-[#E24B4A]',
    trend: 'Worsening',
    trendTone: 'worsening',
  },
  {
    name: 'Tilt bleed into next session',
    firstSeen: 'Jan 28',
    occurrences: '3x',
    impact: '-5.1R total',
    impactColor: 'text-[#E24B4A]',
    trend: 'Stable',
    trendTone: 'stable',
  },
  {
    name: 'Strong Mondays after rest weekend',
    firstSeen: 'Feb 10',
    occurrences: '6x',
    impact: '+7.2R total',
    impactColor: 'text-[#00C97A]',
    trend: 'Improving',
    trendTone: 'improving',
  },
];

const emotionalMatrix: Array<{
  state: string;
  winRate: string;
  avgR: string;
  avgTrades: string;
  bestWindow: string;
  winTone: MatrixTone;
  rTone: MatrixTone;
}> = [
  { state: 'Confident', winRate: '71%', avgR: '+1.8R', avgTrades: '2.1', bestWindow: 'London-NY', winTone: 'good', rTone: 'good' },
  { state: 'Focused', winRate: '68%', avgR: '+1.6R', avgTrades: '2.4', bestWindow: 'Any', winTone: 'good', rTone: 'good' },
  { state: 'Neutral', winRate: '54%', avgR: '+0.8R', avgTrades: '3.1', bestWindow: 'Midday', winTone: 'neutral', rTone: 'neutral' },
  { state: 'Anxious', winRate: '38%', avgR: '-0.4R', avgTrades: '4.8', bestWindow: 'None', winTone: 'bad', rTone: 'bad' },
  { state: 'Frustrated', winRate: '29%', avgR: '-1.1R', avgTrades: '5.9', bestWindow: 'None', winTone: 'bad', rTone: 'bad' },
  { state: 'Need to make it back', winRate: '18%', avgR: '-2.1R', avgTrades: '7.2', bestWindow: 'None', winTone: 'bad', rTone: 'bad' },
];

const suggestedQuestions = [
  'Why was Thursday my worst day this week?',
  'Am I more profitable on trend days or range days?',
  "What's my biggest behavioral pattern costing me?",
  'When am I most likely to revenge trade?',
];

const rightPanelStats = [
  { label: 'Net R', value: '+3.2R', detail: '', valueClass: 'text-[#00C97A]' },
  { label: 'Win rate', value: '57%', detail: '13 of 23 trades', valueClass: 'text-white' },
  { label: 'Avg winner', value: '+1.8R', detail: '', valueClass: 'text-[#00C97A]' },
  { label: 'Avg loser', value: '-0.9R', detail: '', valueClass: 'text-[#E24B4A]' },
];

const scoreBreakdown = [
  { label: 'Plan adherence', value: 82, color: '#00C97A' },
  { label: 'Risk discipline', value: 71, color: '#00C97A' },
  { label: 'Entry patience', value: 54, color: '#EF9F27' },
  { label: 'Post-loss mgmt', value: 38, color: '#E24B4A' },
];

function insightBadgeClasses(tone: InsightTone) {
  switch (tone) {
    case 'pattern':
      return 'border-[#7F77DD]/30 bg-[#7F77DD]/15 text-[#7F77DD]';
    case 'psychology':
      return 'border-[#EF9F27]/30 bg-[#EF9F27]/15 text-[#EF9F27]';
    case 'edge':
      return 'border-[#00C97A]/30 bg-[#00C97A]/15 text-[#00C97A]';
    case 'risk':
      return 'border-[#E24B4A]/30 bg-[#E24B4A]/15 text-[#E24B4A]';
  }
}

function dataPillClasses(tone: DataPillTone) {
  switch (tone) {
    case 'green':
      return 'border-[#00C97A]/30 bg-[#00C97A]/10 text-[#00C97A]';
    case 'red':
      return 'border-[#E24B4A]/30 bg-[#E24B4A]/10 text-[#E24B4A]';
    case 'default':
      return 'border-[#1C2030] bg-[#0B0F16] text-[#8A8F98]';
  }
}

function trendPillClasses(tone: TrendTone) {
  switch (tone) {
    case 'improving':
      return 'border-[#00C97A]/30 bg-[#00C97A]/10 text-[#00C97A]';
    case 'worsening':
      return 'border-[#E24B4A]/30 bg-[#E24B4A]/10 text-[#E24B4A]';
    case 'stable':
      return 'border-[#1C2030] bg-[#0B0F16] text-[#8A8F98]';
  }
}

function parseInsightBody(body: string) {
  const fragments = body.split(/(<strong>.*?<\/strong>|'.*?')/g).filter(Boolean);

  return fragments.map((fragment, index) => {
    if (fragment.startsWith('<strong>') && fragment.endsWith('</strong>')) {
      return (
        <strong key={`${fragment}-${index}`} className="font-semibold text-white">
          {fragment.replace(/<\/?strong>/g, '')}
        </strong>
      );
    }

    if (fragment.startsWith("'") && fragment.endsWith("'")) {
      return (
        <strong key={`${fragment}-${index}`} className="font-semibold text-white">
          {fragment}
        </strong>
      );
    }

    return fragment;
  });
}

function MatrixCell({
  value,
  tone,
}: {
  value: string;
  tone: 'good' | 'neutral' | 'bad';
}) {
  const className =
    tone === 'good'
      ? 'bg-[#00C97A]/10 text-[#00C97A]'
      : tone === 'bad'
        ? 'bg-[#E24B4A]/10 text-[#E24B4A]'
        : 'bg-[#0E1117] text-[#C8CDD6]';

  return <td className={`px-4 py-3 text-sm ${className}`}>{value}</td>;
}

function WeeklyDebriefView() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[22px] font-medium text-white">Week of Apr 1 - Apr 7, 2026</h2>
        <p className="mt-2 text-[13px] text-[#8A8F98]">8 sessions · 23 trades logged · Generated Apr 7</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['ES', 'NQ'].map(symbol => (
            <span
              key={symbol}
              className="rounded-[6px] border border-[#1C2030] bg-[#0E1117] px-2.5 py-1 text-[12px] text-[#C8CDD6]"
            >
              {symbol}
            </span>
          ))}
        </div>
        <div className="mt-5 border-b border-[#1C2030]" />
      </div>

      {weeklyInsightCards.map(card => (
        <article key={card.title} className="rounded-[10px] border border-[#1C2030] bg-[#0E1117] p-5">
          <div className="flex items-center justify-between gap-4">
            <span
              className={`rounded-[6px] border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${insightBadgeClasses(card.tone)}`}
            >
              {card.badge}
            </span>
            <span className="text-[12px] text-[#8A8F98]">{card.context}</span>
          </div>

          <h3 className="mt-4 text-[16px] font-medium text-white">{card.title}</h3>
          <p className="mt-3 text-[14px] leading-[1.7] text-[#8A8F98]">{parseInsightBody(card.body)}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {card.pills.map(pill => (
              <span
                key={pill.label}
                className={`rounded-[6px] border px-2.5 py-1.5 text-[12px] ${dataPillClasses(pill.tone)}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        </article>
      ))}

      <section className="border-l-[3px] border-[#00C97A] bg-[#00C97A08] px-6 py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#00C97A]">THIS WEEK&apos;S QUESTION</p>
        <p className="mt-3 text-[17px] italic leading-[1.6] text-white">
          You had your two best days this week when you took fewer than 3 trades. Why did you take 8 on Thursday?
        </p>
        <p className="mt-3 text-[12px] text-[#8A8F98]">No response needed. Sit with it.</p>
      </section>
    </div>
  );
}

function PatternLibraryView() {
  return (
    <div>
      <h2 className="text-[18px] font-medium text-white">Your pattern library</h2>
      <p className="mt-2 text-[13px] text-[#8A8F98]">Built from 47 sessions over 14 weeks</p>

      <div className="mt-6 overflow-hidden rounded-[10px] border border-[#1C2030] bg-[#0E1117]">
        {patternRows.map((pattern, index) => (
          <div
            key={pattern.name}
            className={`grid grid-cols-[minmax(0,1.8fr)_110px_90px_110px_110px] items-center gap-4 px-4 py-4 ${
              index % 2 === 1 ? 'bg-[#00000018]' : ''
            } ${index < patternRows.length - 1 ? 'border-b border-[#1C2030]' : ''}`}
          >
            <div className="group min-w-0">
              <p className="truncate text-[15px] text-white">
                {pattern.name}
                <span className="ml-2 opacity-0 transition-opacity group-hover:opacity-100">pencil</span>
              </p>
            </div>
            <p className="text-[13px] text-[#8A8F98]">{pattern.firstSeen}</p>
            <p className="text-[13px] text-[#8A8F98]">{pattern.occurrences}</p>
            <p className={`text-[13px] font-medium ${pattern.impactColor}`}>{pattern.impact}</p>
            <span className={`w-fit rounded-[6px] border px-2.5 py-1 text-[12px] ${trendPillClasses(pattern.trendTone)}`}>
              {pattern.trend}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreSessionBriefView({
  intention,
  onChangeIntention,
}: {
  intention: string;
  onChangeIntention: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-medium text-white">Tuesday, Apr 7 - before you trade</h2>
        <p className="mt-2 text-[13px] text-[#8A8F98]">
          Generated based on your historical patterns for today&apos;s conditions
        </p>
      </div>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">TODAY&apos;S RISK FLAGS</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[10px] border border-[#E24B4A]/30 bg-[#E24B4A]/10 p-5">
            <h3 className="text-[16px] font-medium text-white">Post-loss session risk</h3>
            <p className="mt-3 text-[14px] leading-[1.7] text-[#8A8F98]">
              You lost -2.1R yesterday. Historically you lose money in 7 of 9 sessions the day after a loss above
              -1.5R. Consider sizing down by 50% for the first 2 trades.
            </p>
            <span className="mt-4 inline-flex rounded-[6px] border border-[#E24B4A]/30 bg-[#0E1117] px-2.5 py-1.5 text-[12px] text-[#E24B4A]">
              Win rate day-after loss: 22%
            </span>
          </div>

          <div className="rounded-[10px] border border-[#EF9F27]/30 bg-[#EF9F27]/10 p-5">
            <h3 className="text-[16px] font-medium text-white">Monday open tendency</h3>
            <p className="mt-3 text-[14px] leading-[1.7] text-[#8A8F98]">
              You have a pattern of overtrading in the first 30 minutes on days following a losing session. Your avg
              trades in open 30min on these days: 3.8. Your avg on other days: 1.4.
            </p>
            <span className="mt-4 inline-flex rounded-[6px] border border-[#EF9F27]/30 bg-[#0E1117] px-2.5 py-1.5 text-[12px] text-[#EF9F27]">
              3.8 avg trades vs 1.4 normal
            </span>
          </div>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">YOUR BEST CONDITIONS</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            'Wait for 10:15 before first trade',
            'Max 3 trades today',
            'NQ only - avoid ES on Tuesdays',
          ].map(condition => (
            <span
              key={condition}
              className="rounded-[6px] border border-[#00C97A]/30 bg-[#00C97A]/10 px-3 py-2 text-[12px] text-[#00C97A]"
            >
              {condition}
            </span>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">SET YOUR INTENTION</p>
        <textarea
          value={intention}
          onChange={event => onChangeIntention(event.target.value)}
          rows={3}
          placeholder="What is your one goal for today&apos;s session?"
          className="mt-4 w-full rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-4 py-3 text-[14px] text-white outline-none placeholder:text-[#4A5060]"
        />
      </section>
    </div>
  );
}

function EmotionalFingerprintView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[18px] font-medium text-white">How your emotional state affects your trading</h2>
        <p className="mt-2 text-[13px] text-[#8A8F98]">Based on 47 pre-session psychology logs</p>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#1C2030] bg-[#0E1117]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#1C2030] bg-[#0A0D13]">
              <th className="px-4 py-3 text-left text-[12px] font-medium text-[#8A8F98]">State</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-[#8A8F98]">Win rate</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-[#8A8F98]">Avg R</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-[#8A8F98]">Avg trades</th>
              <th className="px-4 py-3 text-left text-[12px] font-medium text-[#8A8F98]">Best time window</th>
            </tr>
          </thead>
          <tbody>
            {emotionalMatrix.map((row, index) => (
              <tr key={row.state} className={index < emotionalMatrix.length - 1 ? 'border-b border-[#1C2030]' : ''}>
                <td className="px-4 py-3 text-sm text-white">{row.state}</td>
                <MatrixCell value={row.winRate} tone={row.winTone} />
                <MatrixCell value={row.avgR} tone={row.rTone} />
                <td className="px-4 py-3 text-sm text-[#C8CDD6]">{row.avgTrades}</td>
                <td className="px-4 py-3 text-sm text-[#C8CDD6]">{row.bestWindow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="border-l-[3px] border-[#00C97A] bg-[#00C97A08] px-6 py-5">
        <p className="text-[14px] leading-[1.7] text-[#8A8F98]">
          <span className="font-medium text-white">
            When you log &apos;need to make it back&apos; before a session, your win rate is 18% and you average 7.2
            trades.
          </span>{' '}
          That is not trading - that is gambling. This is what the data says.
        </p>
      </section>
    </div>
  );
}

function AskFlyxaView({
  question,
  onChangeQuestion,
}: {
  question: string;
  onChangeQuestion: (value: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto pb-6">
        <div>
          <h2 className="text-[18px] font-medium text-white">Ask about your trading</h2>
          <p className="mt-2 text-[13px] text-[#8A8F98]">Flyxa has context from all your sessions, notes, and patterns</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {suggestedQuestions.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => onChangeQuestion(item)}
              className="rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-4 py-4 text-left text-[14px] text-white transition-colors hover:bg-[#121722]"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          <div className="flex justify-end">
            <div className="max-w-[540px] rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-4 py-3 text-[14px] text-white">
              Why do I keep losing in the first 30 minutes?
            </div>
          </div>

          <div className="max-w-[640px]">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">FLYXA</p>
            <p className="mt-3 text-[14px] leading-[1.7] text-[#8A8F98]">
              Looking at your last 8 weeks, 68% of your first-30-minute trades are losers. The pattern is consistent
              regardless of the day or instrument. Your notes in these trades frequently mention &apos;getting a feel for it&apos;
              or &apos;testing the waters&apos; - language that suggests you already know the conviction isn&apos;t there. The trades
              after 10:15 where you note &apos;clear structure&apos; or &apos;obvious level&apos; show a 71% win rate. You&apos;re not bad at
              trading the open. You&apos;re bad at waiting for it to be ready.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-[#1C2030] bg-[#080B10] pt-4">
        <div className="flex items-center gap-3 rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-4 py-3">
          <input
            value={question}
            onChange={event => onChangeQuestion(event.target.value)}
            placeholder="Ask anything about your sessions, patterns, or performance..."
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-[#4A5060]"
          />
          <button type="button" className="shrink-0 text-[14px] font-medium text-[#00C97A]">
            Ask -&gt;
          </button>
        </div>
      </div>
    </div>
  );
}

function RightPanel({ onAskShortcut }: { onAskShortcut: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6">
      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">THIS WEEK</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {rightPanelStats.map(stat => (
            <div key={stat.label} className="rounded-[10px] border border-[#1C2030] bg-[#0E1117] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8A8F98]">{stat.label}</p>
              <p className={`mt-3 text-[20px] font-medium ${stat.valueClass}`}>{stat.value}</p>
              {stat.detail ? <p className="mt-1 text-[12px] text-[#8A8F98]">{stat.detail}</p> : <div className="mt-1 h-[18px]" />}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">PROCESS SCORE</p>
        <div className="mt-4 rounded-[10px] border border-[#1C2030] bg-[#0E1117] p-5">
          <div className="flex items-end gap-2">
            <span className="text-[48px] font-medium leading-none text-white">74</span>
            <span className="pb-1 text-[20px] text-[#8A8F98]">/100</span>
          </div>
          <p className="mt-3 text-[13px] text-[#8A8F98]">Above your 30-day avg of 68</p>
          <div className="mt-4 h-1.5 rounded-full bg-[#1C2030]">
            <div className="h-1.5 rounded-full bg-[#00C97A]" style={{ width: '74%' }} />
          </div>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">BREAKDOWN</p>
        <div className="mt-4 rounded-[10px] border border-[#1C2030] bg-[#0E1117] p-5">
          <div className="space-y-4">
            {scoreBreakdown.map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-[12px] text-[#8A8F98]">{item.label}</span>
                <div className="h-1 flex-1 rounded bg-[#1C2030]">
                  <div className="h-1 rounded" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
                <span className="w-8 shrink-0 text-right text-[12px]" style={{ color: item.color }}>
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">NEXT DEBRIEF</p>
        <div className="mt-4 rounded-[10px] border border-[#1C2030] bg-[#0E1117] p-5">
          <p className="text-[13px] text-[#8A8F98]">Generates Sunday, Apr 12</p>
          <p className="mt-3 text-[12px] text-[#8A8F98]">5 of 5 sessions logged</p>
          <div className="mt-3 h-1.5 rounded-full bg-[#1C2030]">
            <div className="h-1.5 w-full rounded-full bg-[#00C97A]" />
          </div>
        </div>
      </section>

      <div className="mt-auto border-t border-[#1C2030] pt-4">
        <div className="flex items-center gap-3 rounded-[10px] border border-[#1C2030] bg-[#0E1117] px-4 py-3">
          <button
            type="button"
            onClick={onAskShortcut}
            className="min-w-0 flex-1 truncate text-left text-[13px] text-[#4A5060]"
          >
            Ask about this week...
          </button>
          <button type="button" onClick={onAskShortcut} className="shrink-0 text-[13px] font-medium text-[#00C97A]">
            Ask -&gt;
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AICoach() {
  const [activeView, setActiveView] = useState<ViewKey>('weekly');
  const [intention, setIntention] = useState('');
  const [askInput, setAskInput] = useState('');

  return (
    <div className="animate-fade-in -m-8 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#080B10] text-white">
      <div className="grid h-full grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden md:grid-cols-[220px_minmax(0,1fr)_320px] md:grid-rows-[auto_minmax(0,1fr)]">
        <aside className="border-b border-[#1C2030] bg-[#0A0D13] md:col-[1] md:row-[1/span_2] md:h-full md:overflow-y-auto md:border-b-0 md:border-r">
          <div className="px-5 py-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#4A5060]">FLYXA AI</p>

            <nav className="-mx-1 mt-5 flex gap-2 overflow-x-auto pb-2 md:mx-0 md:mt-6 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
              {navItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveView(item.key)}
                  className={`flex shrink-0 items-center gap-3 rounded-[6px] border border-transparent px-4 py-3 text-left text-[13px] transition-colors md:rounded-none md:border-l-2 md:border-y-0 md:border-r-0 md:px-3 ${
                    activeView === item.key
                      ? 'bg-[#00C97A]/8 text-white md:border-l-[#00C97A]'
                      : 'text-[#8A8F98] md:border-l-transparent'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${activeView === item.key ? 'bg-[#00C97A]' : 'bg-[#4A5060]'}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-6 border-t border-[#1C2030] pt-5 md:mt-8">
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#4A5060]">HISTORY</p>
              <div className="mt-4 flex flex-wrap gap-2 md:flex-col md:gap-1">
                {historyItems.map(item => (
                  <button
                    key={item}
                    type="button"
                    className="rounded-[6px] border border-transparent px-3 py-2 text-left text-[13px] text-[#8A8F98] transition-colors hover:bg-[#0E1117] hover:text-white"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <header className="border-b border-[#1C2030] px-5 py-5 md:col-[2/span_2] md:row-[1] md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-[22px] font-medium text-white">Week of Apr 1 - Apr 7, 2026</h1>
              <p className="mt-2 text-[13px] text-[#8A8F98]">Based on 8 sessions · 23 logged trades</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-[6px] border border-[#1C2030] bg-[#0E1117] px-2.5 py-1 text-[12px] text-[#C8CDD6]">
                ES / NQ
              </span>
              <span className="rounded-[6px] border border-[#00C97A]/30 bg-[#00C97A]/10 px-2.5 py-1 text-[12px] text-[#00C97A]">
                +3.2R week
              </span>
            </div>
          </div>
        </header>

        <main className="min-h-0 md:col-[2] md:row-[2] md:h-full md:overflow-y-auto">
          <div className="h-full px-5 py-5 md:p-5">
            {activeView === 'weekly' && <WeeklyDebriefView />}
            {activeView === 'patterns' && <PatternLibraryView />}
            {activeView === 'pre-session' && (
              <PreSessionBriefView intention={intention} onChangeIntention={setIntention} />
            )}
            {activeView === 'emotional' && <EmotionalFingerprintView />}
            {activeView === 'ask' && <AskFlyxaView question={askInput} onChangeQuestion={setAskInput} />}
          </div>
        </main>

        <aside className="border-t border-[#1C2030] px-5 py-5 md:col-[3] md:row-[2] md:h-full md:overflow-y-auto md:border-l md:border-t-0 md:p-5">
          <RightPanel onAskShortcut={() => setActiveView('ask')} />
        </aside>
      </div>
    </div>
  );
}

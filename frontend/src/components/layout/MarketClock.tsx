import { Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const MARKET_TIMEZONE = 'America/New_York';
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

type MarketClockProps = {
  displayTimezone: string;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';

  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')) % 24,
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: value('weekday'),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return localAsUtc - date.getTime();
}

function makeZonedDate(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

function addDaysToZonedDate(parts: ZonedParts, days: number): { year: number; month: number; day: number } {
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function isWeekday(weekday: string): boolean {
  return weekday !== 'Sat' && weekday !== 'Sun';
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getMarketState(now: Date) {
  const marketParts = getZonedParts(now, MARKET_TIMEZONE);
  const todayOpen = makeZonedDate(
    marketParts.year,
    marketParts.month,
    marketParts.day,
    MARKET_OPEN_HOUR,
    MARKET_OPEN_MINUTE,
    MARKET_TIMEZONE,
  );
  const todayClose = makeZonedDate(
    marketParts.year,
    marketParts.month,
    marketParts.day,
    MARKET_CLOSE_HOUR,
    MARKET_CLOSE_MINUTE,
    MARKET_TIMEZONE,
  );

  if (isWeekday(marketParts.weekday) && now >= todayOpen && now < todayClose) {
    return {
      tone: 'open' as const,
      status: 'Market open',
      detail: `${formatDuration(todayClose.getTime() - now.getTime())} left`,
    };
  }

  if (isWeekday(marketParts.weekday) && now < todayOpen) {
    return {
      tone: 'pending' as const,
      status: 'Opens in',
      detail: formatDuration(todayOpen.getTime() - now.getTime()),
    };
  }

  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const candidateDate = addDaysToZonedDate(marketParts, dayOffset);
    const candidateOpen = makeZonedDate(
      candidateDate.year,
      candidateDate.month,
      candidateDate.day,
      MARKET_OPEN_HOUR,
      MARKET_OPEN_MINUTE,
      MARKET_TIMEZONE,
    );
    const candidateParts = getZonedParts(candidateOpen, MARKET_TIMEZONE);
    if (isWeekday(candidateParts.weekday)) {
      return {
        tone: 'pending' as const,
        status: 'Opens in',
        detail: formatDuration(candidateOpen.getTime() - now.getTime()),
      };
    }
  }

  return {
    tone: 'pending' as const,
    status: 'Opens soon',
    detail: 'Stand by',
  };
}

function formatDisplayTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
}

export default function MarketClock({ displayTimezone }: MarketClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  const marketState = useMemo(() => getMarketState(now), [now]);
  const displayTime = useMemo(() => formatDisplayTime(now, displayTimezone), [displayTimezone, now]);

  return (
    <div className={`market-clock market-clock--${marketState.tone}`} title="US regular session: 9:30 AM to 4:00 PM New York time">
      <span className="market-clock__segment market-clock__segment--clock">
        <span className="market-clock__icon" aria-hidden="true">
          <Clock3 size={13} />
        </span>
        <span className="market-clock__time">{displayTime}</span>
      </span>
      <span className="market-clock__segment market-clock__segment--countdown">
        <span className="market-clock__pulse" aria-hidden="true" />
        <span className="market-clock__status">{marketState.tone === 'open' ? 'MARKET OPEN' : 'OPENS IN'}</span>
        <span className="market-clock__detail">{marketState.detail}</span>
      </span>
    </div>
  );
}

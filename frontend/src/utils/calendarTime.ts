export const DEFAULT_CALENDAR_TIME_ZONE = 'America/New_York';
export const FEED_CALENDAR_TIME_ZONE = 'UTC';

export function normalizeCalendarTimeZone(timeZone: string | undefined | null): string {
  const fallback = DEFAULT_CALENDAR_TIME_ZONE;
  if (!timeZone) return fallback;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return fallback;
  }
}

export function getTimeZoneParts(date: Date, timeZone = DEFAULT_CALENDAR_TIME_ZONE): {
  date: string;
  time: string;
} {
  const safeTimeZone = normalizeCalendarTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '00';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  };
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const safeTimeZone = normalizeCalendarTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value ?? 0);
  const zonedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  return zonedAsUtc - date.getTime();
}

export function parseCalendarClockTime(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const twelveHour = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] ?? '0');
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return '';

    const meridiem = twelveHour[3].toLowerCase();
    const hour24 = meridiem === 'pm' && hour !== 12 ? hour + 12 : meridiem === 'am' && hour === 12 ? 0 : hour;
    return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return '';
}

export function zonedWallTimeToDate(
  dateSlice: string,
  time: string,
  sourceTimeZone = DEFAULT_CALENDAR_TIME_ZONE
): Date | null {
  const dateMatch = dateSlice.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const normalizedTime = parseCalendarClockTime(time);
  const timeMatch = normalizedTime.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;

  const desiredWallTime = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  const firstPass = new Date(desiredWallTime - getTimeZoneOffsetMs(new Date(desiredWallTime), sourceTimeZone));
  return new Date(desiredWallTime - getTimeZoneOffsetMs(firstPass, sourceTimeZone));
}

export function convertCalendarWallTime(
  dateSlice: string,
  time: string,
  targetTimeZone: string,
  sourceTimeZone = DEFAULT_CALENDAR_TIME_ZONE
): { date: string; time: string } | null {
  const instant = zonedWallTimeToDate(dateSlice, time, sourceTimeZone);
  return instant ? getTimeZoneParts(instant, targetTimeZone) : null;
}

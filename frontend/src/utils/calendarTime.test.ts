import { describe, expect, it } from 'vitest';
import {
  convertCalendarWallTime,
  getTimeZoneParts,
  normalizeCalendarTimeZone,
  parseCalendarClockTime,
} from './calendarTime.js';

describe('calendarTime', () => {
  it('converts UTC economic calendar feed times into the user timezone', () => {
    expect(convertCalendarWallTime('2026-05-12', '12:30', 'America/New_York', 'UTC')).toEqual({
      date: '2026-05-12',
      time: '08:30',
    });
  });

  it('converts the same UTC instant into Australia/Sydney when selected', () => {
    expect(convertCalendarWallTime('2026-05-12', '12:30', 'Australia/Sydney', 'UTC')).toEqual({
      date: '2026-05-12',
      time: '22:30',
    });
  });

  it('parses common 12-hour calendar clock labels', () => {
    expect(parseCalendarClockTime('8:30am')).toBe('08:30');
    expect(parseCalendarClockTime('12:00 AM')).toBe('00:00');
    expect(parseCalendarClockTime('12:00 PM')).toBe('12:00');
  });

  it('normalizes invalid timezones to the calendar default', () => {
    expect(normalizeCalendarTimeZone('Not/AZone')).toBe('America/New_York');
  });

  it('formats instants with stable calendar parts', () => {
    const instant = new Date('2026-05-12T12:30:00.000Z');
    expect(getTimeZoneParts(instant, 'America/New_York')).toEqual({
      date: '2026-05-12',
      time: '08:30',
    });
  });
});

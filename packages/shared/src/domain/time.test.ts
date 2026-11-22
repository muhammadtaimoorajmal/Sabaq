import { describe, expect, it } from 'vitest';
import { addDays, dayKeyOf, daysBetween, dayOfWeekOf, eachDay, toTimestamp } from './time.js';

describe('dayKeyOf', () => {
  it('uses the calendar day of the given time zone, not UTC', () => {
    // 19:30 UTC on the 22nd is already 00:30 on the 23rd in Karachi (UTC+5).
    expect(dayKeyOf('2026-11-22T19:30:00Z', 'UTC')).toBe('2026-11-22');
    expect(dayKeyOf('2026-11-22T19:30:00Z', 'Asia/Karachi')).toBe('2026-11-23');
  });

  it('handles daylight-saving transitions', () => {
    // New York leaves daylight time on 1 November 2026.
    expect(dayKeyOf('2026-11-01T03:30:00Z', 'America/New_York')).toBe('2026-10-31');
    expect(dayKeyOf('2026-11-02T04:30:00Z', 'America/New_York')).toBe('2026-11-01');
  });

  it('accepts dates, strings and timestamps', () => {
    const instant = Date.UTC(2026, 0, 5, 12);
    expect(dayKeyOf(instant, 'UTC')).toBe('2026-01-05');
    expect(dayKeyOf(new Date(instant), 'UTC')).toBe('2026-01-05');
  });

  it('rejects invalid dates', () => {
    expect(() => dayKeyOf('not a date', 'UTC')).toThrow(RangeError);
    expect(() => toTimestamp(Number.NaN)).toThrow('Invalid date');
  });
});

describe('day arithmetic', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts whole days in both directions', () => {
    expect(daysBetween('2026-11-22', '2026-11-29')).toBe(7);
    expect(daysBetween('2026-11-29', '2026-11-22')).toBe(-7);
    expect(daysBetween('2026-11-22', '2026-11-22')).toBe(0);
  });

  it('reports the day of the week', () => {
    expect(dayOfWeekOf('2026-11-22')).toBe(0); // Sunday
    expect(dayOfWeekOf('2026-11-28')).toBe(6); // Saturday
  });

  it('lists every day of an inclusive range', () => {
    expect(eachDay('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(eachDay('2026-03-02', '2026-03-01')).toEqual([]);
  });

  it('rejects malformed day keys', () => {
    expect(() => addDays('22/11/2026', 1)).toThrow('Invalid day key');
  });
});

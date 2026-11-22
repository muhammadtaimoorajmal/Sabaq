import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayKeyOf,
  daysBetween,
  dayOfWeekOf,
  eachDay,
  toTimestamp,
  zonedDateTime,
} from './time.js';

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

describe('zonedDateTime', () => {
  it('finds the instant of a wall-clock time in a time zone', () => {
    expect(zonedDateTime('2026-11-27', '23:59', 'Asia/Karachi').toISOString()).toBe(
      '2026-11-27T18:59:00.000Z',
    );
    expect(zonedDateTime('2026-11-27', '00:00', 'UTC').toISOString()).toBe(
      '2026-11-27T00:00:00.000Z',
    );
    expect(zonedDateTime('2026-07-01', '09:30', 'America/New_York').toISOString()).toBe(
      '2026-07-01T13:30:00.000Z',
    );
  });

  it('round-trips with dayKeyOf, including zones ahead of UTC by more than a day boundary', () => {
    const instant = zonedDateTime('2026-12-31', '23:30', 'Pacific/Kiritimati');
    expect(dayKeyOf(instant, 'Pacific/Kiritimati')).toBe('2026-12-31');
    expect(instant.toISOString()).toBe('2026-12-31T09:30:00.000Z');
  });

  it('moves a time inside a spring-forward gap forward', () => {
    // On 2026-03-08 New York clocks jump from 02:00 to 03:00; 02:30 does not exist.
    expect(zonedDateTime('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe(
      '2026-03-08T07:30:00.000Z',
    );
  });

  it('uses the earlier instant for a time repeated when clocks fall back', () => {
    // On 2026-11-01 New York clocks fall back from 02:00 to 01:00; 01:30 happens twice.
    expect(zonedDateTime('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('rejects malformed times', () => {
    expect(() => zonedDateTime('2026-11-27', '24:00', 'UTC')).toThrow(RangeError);
    expect(() => zonedDateTime('2026-11-27', '9:30', 'UTC')).toThrow(RangeError);
  });
});

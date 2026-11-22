/**
 * Calendar-day helpers. A "day key" is a `YYYY-MM-DD` string. Instants are converted to day
 * keys in a specific IANA time zone, so "due today" means today *where the class is*,
 * regardless of the server's or browser's own time zone.
 */

export type Instant = Date | string | number;

const DAY_MS = 86_400_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** Converts an instant to an epoch-millisecond timestamp, rejecting invalid dates. */
export function toTimestamp(instant: Instant): number {
  const time = new Date(instant).getTime();
  if (Number.isNaN(time)) throw new RangeError(`Invalid date: ${String(instant)}`);
  return time;
}

/** The calendar day (`YYYY-MM-DD`) on which `instant` falls in `timeZone`. */
export function dayKeyOf(instant: Instant, timeZone: string): string {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const { type, value } of dayFormatter(timeZone).formatToParts(toTimestamp(instant))) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayKeyToUtc(dayKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) throw new RangeError(`Invalid day key: ${dayKey}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function utcToDayKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

/** Moves a day key forwards (positive) or backwards (negative) by whole calendar days. */
export function addDays(dayKey: string, days: number): string {
  return utcToDayKey(dayKeyToUtc(dayKey) + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayKeyToUtc(to) - dayKeyToUtc(from)) / DAY_MS);
}

/** Day of the week for a day key: 0 is Sunday, 6 is Saturday. */
export function dayOfWeekOf(dayKey: string): number {
  return new Date(dayKeyToUtc(dayKey)).getUTCDay();
}

/** Every day key from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const length = daysBetween(from, to) + 1;
  return Array.from({ length: Math.max(0, length) }, (_, index) => addDays(from, index));
}

const wallClockCache = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = wallClockCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    wallClockCache.set(timeZone, formatter);
  }
  return formatter;
}

/** How many milliseconds `timeZone` is ahead of UTC at the instant `time`. */
function zoneOffset(time: number, timeZone: string): number {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const { type, value } of wallClockFormatter(timeZone).formatToParts(time)) {
    parts[type] = value;
  }
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallClockAsUtc - Math.floor(time / 1000) * 1000;
}

/**
 * The instant at which the wall-clock `time` (`HH:mm`) occurs on `dayKey` in `timeZone`,
 * for example "23:59 on 2026-11-27 in Asia/Karachi". When clocks spring forward and the time
 * does not exist, the result moves forward by the size of the gap; when clocks fall back and
 * the time occurs twice, the earlier instant is used.
 */
export function zonedDateTime(dayKey: string, time: string, timeZone: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new RangeError(`Invalid time of day: ${time}`);
  const wallClock = dayKeyToUtc(dayKey) + (Number(match[1]) * 60 + Number(match[2])) * 60_000;
  // Treat the wall-clock time as UTC, then correct it by the zone's offset at that moment.
  const firstGuess = wallClock - zoneOffset(wallClock, timeZone);
  const offset = zoneOffset(firstGuess, timeZone);
  const candidate = wallClock - offset;
  // A different offset at the candidate means the time falls in a spring-forward gap.
  return new Date(zoneOffset(candidate, timeZone) === offset ? candidate : firstGuess);
}

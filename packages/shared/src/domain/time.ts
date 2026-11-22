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

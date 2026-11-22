import { daysBetween, dayKeyOf, type Instant, toTimestamp } from './time.js';

/** Urgency buckets, in the order the Today screen shows them. */
export const URGENCY_LEVELS = ['overdue', 'today', 'tomorrow', 'next_7_days', 'later'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

/**
 * How urgent something due at `dueAt` is at `now`, judged by calendar days in `timeZone`.
 * Anything whose due moment has passed is overdue, even if it is still the same day.
 */
export function urgencyOf(dueAt: Instant, now: Instant, timeZone: string): Urgency {
  if (toTimestamp(dueAt) < toTimestamp(now)) return 'overdue';
  const days = daysBetween(dayKeyOf(now, timeZone), dayKeyOf(dueAt, timeZone));
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'next_7_days';
  return 'later';
}

/**
 * Groups items into urgency buckets. Within each bucket, items are ordered by due time,
 * earliest first; items without a stable order keep their original relative order.
 */
export function groupByUrgency<T>(
  items: readonly T[],
  getDueAt: (item: T) => Instant,
  now: Instant,
  timeZone: string,
): Record<Urgency, T[]> {
  const groups: Record<Urgency, T[]> = {
    overdue: [],
    today: [],
    tomorrow: [],
    next_7_days: [],
    later: [],
  };
  const sorted = items
    .map((item, index) => ({ item, index, due: toTimestamp(getDueAt(item)) }))
    .sort((a, b) => a.due - b.due || a.index - b.index);
  for (const { item, due } of sorted) {
    groups[urgencyOf(due, now, timeZone)].push(item);
  }
  return groups;
}

import type { QuietHours } from '../schemas/user.js';
import { addDays, dayKeyOf, type Instant, toTimestamp, zonedDateTime } from './time.js';

/** Fields of an announcement that readers care about when it changes. */
export const EDITABLE_ANNOUNCEMENT_FIELDS = [
  'title',
  'body',
  'courseId',
  'links',
  'dueAt',
  'startsAt',
  'venue',
  'taskType',
] as const;
export type EditableAnnouncementField = (typeof EDITABLE_ANNOUNCEMENT_FIELDS)[number];

/** Changes that alter what a student must do or where to go; members are told about these. */
export const IMPORTANT_ANNOUNCEMENT_FIELDS: readonly EditableAnnouncementField[] = [
  'dueAt',
  'startsAt',
  'venue',
];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The fields an edit actually changes, in a stable order. Fields not present in `change` are
 * left alone; setting a field to its current value is not a change, so edit history stays
 * honest.
 */
export function changedAnnouncementFields(
  current: Partial<Record<EditableAnnouncementField, unknown>>,
  change: Partial<Record<EditableAnnouncementField, unknown>>,
): EditableAnnouncementField[] {
  return EDITABLE_ANNOUNCEMENT_FIELDS.filter(
    (field) =>
      field in change && change[field] !== undefined && !same(current[field], change[field]),
  );
}

/** Whether any of these changes should be announced to members again. */
export const isImportantChange = (fields: readonly EditableAnnouncementField[]) =>
  fields.some((field) => IMPORTANT_ANNOUNCEMENT_FIELDS.includes(field));

/** Minutes since midnight of an "HH:MM" time. */
const minutesOf = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * When a notification created at `now` should reach someone: immediately, unless it falls in
 * their quiet hours, in which case it waits until the quiet hours end (in their time zone).
 * Quiet hours may run past midnight, such as 22:00 to 07:00.
 */
export function deliveryTime(now: Instant, quietHours: QuietHours, timeZone: string): Date {
  const instant = new Date(toTimestamp(now));
  const start = minutesOf(quietHours.start);
  const end = minutesOf(quietHours.end);
  if (!quietHours.enabled || start === end) return instant;

  const today = dayKeyOf(instant, timeZone);
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  const minute = minutesOf(clock);
  const overnight = start > end;
  const quiet = overnight ? minute >= start || minute < end : minute >= start && minute < end;
  if (!quiet) return instant;
  // Overnight quiet hours that began this evening end tomorrow morning.
  const endDay = overnight && minute >= start ? addDays(today, 1) : today;
  return zonedDateTime(endDay, quietHours.end, timeZone);
}

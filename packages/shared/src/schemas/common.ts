import { z } from 'zod';

/** A MongoDB ObjectId in its 24-character hexadecimal form. */
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export type Id = z.infer<typeof idSchema>;

/** An instant in time, serialized as an ISO 8601 string with a time-zone offset or `Z`. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

/** A calendar day in `YYYY-MM-DD` form, independent of any time zone. */
export const dayKeySchema = z.iso.date();
export type DayKey = z.infer<typeof dayKeySchema>;

/** A wall-clock time in 24-hour `HH:mm` form. */
export const timeOfDaySchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use the 24-hour HH:mm format');
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/** Day of the week, where 0 is Sunday and 6 is Saturday (as in `Date.prototype.getDay`). */
export const dayOfWeekSchema = z.number().int().min(0).max(6);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

/** Returns true when `timeZone` is an IANA time-zone name the runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** An IANA time-zone name such as `Asia/Karachi` or `Europe/London`. */
export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { error: 'Unknown time zone' });

/**
 * Named accent colors from the design system. Courses store a token, never a raw color,
 * so every theme (including high contrast) can render it with sufficient contrast.
 */
export const COLOR_TOKENS = [
  'blue',
  'teal',
  'green',
  'lime',
  'amber',
  'orange',
  'red',
  'pink',
  'purple',
  'indigo',
  'slate',
] as const;
export const colorTokenSchema = z.enum(COLOR_TOKENS);
export type ColorToken = z.infer<typeof colorTokenSchema>;

/** Trimmed, non-empty single-line text with a maximum length. */
export const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Trimmed multi-line text that may be empty. */
export const longText = (max: number) => z.string().trim().max(max);

/** An absolute http(s) URL. */
export const webUrlSchema = z.url({ protocol: /^https?$/ });

/** Standard pagination query parameters. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

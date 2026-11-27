import { z } from 'zod';
import { LOAD_LEVELS } from '../domain/workload.js';
import { courseSummarySchema } from './agenda.js';
import { dayKeySchema, idSchema, isoDateTimeSchema, timeZoneSchema } from './common.js';
import { taskTypeSchema } from './task.js';

/** A term (about 26 weeks) fits in one request. */
export const WORKLOAD_MAX_DAYS = 190;

const daysApart = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** Calendar days, inclusive, in the time zone of whoever the workload is for. */
export const workloadQuerySchema = z
  .object({ from: dayKeySchema, to: dayKeySchema })
  .refine(({ from, to }) => to >= from, { path: ['to'], message: 'End before start' })
  .refine(({ from, to }) => daysApart(from, to) < WORKLOAD_MAX_DAYS, {
    path: ['to'],
    message: `At most ${WORKLOAD_MAX_DAYS} days`,
  });
export type WorkloadQuery = z.infer<typeof workloadQuerySchema>;

export const loadLevelSchema = z.enum(LOAD_LEVELS);

/** One task as it counts towards workload. */
export const workloadItemSchema = z.object({
  id: idSchema,
  title: z.string(),
  type: taskTypeSchema,
  dueAt: isoDateTimeSchema,
  /** The task's own effort, or `null` to use the default for its type. */
  effort: z.number().int().min(1).max(5).nullable(),
  course: courseSummarySchema.nullable(),
  classId: idSchema.nullable(),
  className: z.string().nullable(),
});
export type WorkloadItem = z.infer<typeof workloadItemSchema>;

export const dailyLoadSchema = z.object({
  date: dayKeySchema,
  taskCount: z.number().int().min(0),
  load: z.number().int().min(0),
  level: loadLevelSchema,
});

/**
 * How heavy each day is: a person's workload across all their classes (with personal tasks),
 * or a class's workload across all its courses.
 */
export const workloadSchema = z.object({
  timeZone: timeZoneSchema,
  from: dayKeySchema,
  to: dayKeySchema,
  /** Every day in the range, including empty ones. */
  days: z.array(dailyLoadSchema),
  items: z.array(workloadItemSchema),
});
export type Workload = z.infer<typeof workloadSchema>;

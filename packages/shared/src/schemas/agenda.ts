import { z } from 'zod';
import {
  colorTokenSchema,
  dayKeySchema,
  idSchema,
  isoDateTimeSchema,
  timeZoneSchema,
} from './common.js';
import { SESSION_KINDS } from './course.js';
import { taskForUserSchema } from './task.js';

/** The longest range one agenda request may cover (a month view plus its edges). */
export const AGENDA_MAX_DAYS = 62;

const daysApart = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

/** Calendar days in the viewer's time zone, inclusive. */
export const agendaQuerySchema = z
  .object({ from: dayKeySchema, to: dayKeySchema })
  .refine(({ from, to }) => to >= from, { path: ['to'], message: 'End before start' })
  .refine(({ from, to }) => daysApart(from, to) < AGENDA_MAX_DAYS, {
    path: ['to'],
    message: `At most ${AGENDA_MAX_DAYS} days`,
  });
export type AgendaQuery = z.infer<typeof agendaQuerySchema>;

export const courseSummarySchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  color: colorTokenSchema,
});
export type CourseSummary = z.infer<typeof courseSummarySchema>;

/** A task as it appears in the agenda: with its course, class and what the person may do. */
export const agendaTaskSchema = taskForUserSchema.extend({
  course: courseSummarySchema.nullable(),
  /** The class's name for class tasks; `null` for personal tasks. */
  className: z.string().nullable(),
  /** Personal tasks, and class tasks the person may edit (not those owned by an announcement). */
  canManage: z.boolean(),
});
export type AgendaTask = z.infer<typeof agendaTaskSchema>;

export const SESSION_STATUSES = ['scheduled', 'cancelled', 'moved'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** One class meeting on one day, with announced cancellations and room changes applied. */
export const agendaSessionSchema = z.object({
  /** Stable for a course, day and start time. */
  id: z.string(),
  classId: idSchema,
  className: z.string(),
  course: courseSummarySchema,
  kind: z.enum(SESSION_KINDS),
  /** The day in the viewer's time zone. */
  day: dayKeySchema,
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  venue: z.string().nullable(),
  /** The usual room when the session has moved. */
  originalVenue: z.string().nullable(),
  status: z.enum(SESSION_STATUSES),
  /** The announcement that cancelled or moved it. */
  announcementId: idSchema.nullable(),
});
export type AgendaSession = z.infer<typeof agendaSessionSchema>;

export const agendaSchema = z.object({
  timeZone: timeZoneSchema,
  from: dayKeySchema,
  to: dayKeySchema,
  /** Due in the range, plus unfinished work from the last 30 days that is overdue. */
  tasks: z.array(agendaTaskSchema),
  sessions: z.array(agendaSessionSchema),
});
export type Agenda = z.infer<typeof agendaSchema>;

import { z } from 'zod';
import {
  colorTokenSchema,
  dayOfWeekSchema,
  idSchema,
  isoDateTimeSchema,
  shortText,
  timeOfDaySchema,
} from './common.js';

export const SESSION_KINDS = ['lecture', 'lab', 'tutorial', 'other'] as const;

/** A recurring weekly meeting of a course, such as "Lab, Wednesday 08:00–11:00, Room E-102". */
export const courseSessionSchema = z
  .object({
    kind: z.enum(SESSION_KINDS),
    dayOfWeek: dayOfWeekSchema,
    start: timeOfDaySchema,
    end: timeOfDaySchema,
    venue: shortText(80).nullable(),
  })
  .refine((session) => session.start < session.end, {
    error: 'The session must end after it starts',
    path: ['end'],
  });
export type CourseSession = z.infer<typeof courseSessionSchema>;

const courseFields = {
  code: shortText(20),
  title: shortText(120),
  instructorName: shortText(80).nullable(),
  color: colorTokenSchema,
  schedule: z.array(courseSessionSchema).max(14),
};

export const courseSchema = z.object({
  id: idSchema,
  classId: idSchema,
  ...courseFields,
  createdAt: isoDateTimeSchema,
});
export type Course = z.infer<typeof courseSchema>;

export const createCourseInputSchema = z.object({
  ...courseFields,
  instructorName: courseFields.instructorName.default(null),
  schedule: courseFields.schedule.default([]),
});
export type CreateCourseInput = z.infer<typeof createCourseInputSchema>;

export const updateCourseInputSchema = z.object(courseFields).partial();
export type UpdateCourseInput = z.infer<typeof updateCourseInputSchema>;

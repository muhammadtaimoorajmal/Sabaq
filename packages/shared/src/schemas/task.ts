import { z } from 'zod';
import { idSchema, isoDateTimeSchema, longText, shortText } from './common.js';
import { submissionRuleSchema } from './submission-rule.js';

export const TASK_TYPES = [
  'assignment',
  'lab',
  'quiz',
  'exam',
  'project',
  'presentation',
  'reading',
  'other',
] as const;
export const taskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof taskTypeSchema>;

/** Relative effort from 1 (light) to 5 (very heavy), used by the workload heatmap. */
export const effortSchema = z.number().int().min(1).max(5);

const taskFields = {
  title: shortText(140),
  type: taskTypeSchema,
  dueAt: isoDateTimeSchema,
  description: longText(4000).default(''),
  courseId: idSchema.nullable().default(null),
  /** Overrides the default effort for the task type. */
  effort: effortSchema.nullable().default(null),
  submissionRule: submissionRuleSchema.nullable().default(null),
};

/**
 * A task is anything with a due date. Class tasks are created by instructors and class
 * representatives and appear for every member; personal tasks belong to one student.
 */
export const taskSchema = z.object({
  id: idSchema,
  classId: idSchema.nullable(),
  /** Set for personal tasks; null for class tasks. */
  ownerId: idSchema.nullable(),
  /** The announcement that created this task, if any. */
  announcementId: idSchema.nullable(),
  ...taskFields,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Task = z.infer<typeof taskSchema>;

/** A task together with the signed-in student's own progress on it. */
export const taskForUserSchema = taskSchema.extend({
  completedAt: isoDateTimeSchema.nullable(),
});
export type TaskForUser = z.infer<typeof taskForUserSchema>;

export const createTaskInputSchema = z.object(taskFields);
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z
  .object({
    title: taskFields.title,
    type: taskFields.type,
    dueAt: taskFields.dueAt,
    description: longText(4000),
    courseId: idSchema.nullable(),
    effort: effortSchema.nullable(),
    submissionRule: submissionRuleSchema.nullable(),
  })
  .partial();
export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

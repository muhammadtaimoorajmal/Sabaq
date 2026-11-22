import { z } from 'zod';
import { idSchema, isoDateTimeSchema, longText, shortText, webUrlSchema } from './common.js';
import { submissionRuleSchema } from './submission-rule.js';
import { taskTypeSchema } from './task.js';
import { userSummarySchema } from './user.js';

export const ANNOUNCEMENT_TYPES = [
  'deadline',
  'assessment',
  'venue_change',
  'cancellation',
  'material',
  'general',
] as const;
export const announcementTypeSchema = z.enum(ANNOUNCEMENT_TYPES);
export type AnnouncementType = z.infer<typeof announcementTypeSchema>;

export const announcementLinkSchema = z.object({
  label: shortText(80),
  url: webUrlSchema,
});

const baseFields = {
  courseId: idSchema.nullable().default(null),
  title: shortText(140),
  body: longText(5000).default(''),
  links: z.array(announcementLinkSchema).max(10).default([]),
  pinned: z.boolean().default(false),
};

/**
 * Each announcement type carries the fields that make it actionable. A `deadline` or
 * `assessment` creates a task for every member of the class.
 */
export const createAnnouncementInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('deadline'),
    ...baseFields,
    dueAt: isoDateTimeSchema,
    taskType: taskTypeSchema.default('assignment'),
    submissionRule: submissionRuleSchema.nullable().default(null),
  }),
  z.object({
    type: z.literal('assessment'),
    ...baseFields,
    dueAt: isoDateTimeSchema,
    taskType: z.enum(['quiz', 'exam', 'presentation']).default('quiz'),
    venue: shortText(120).nullable().default(null),
  }),
  z.object({
    type: z.literal('venue_change'),
    ...baseFields,
    startsAt: isoDateTimeSchema,
    venue: shortText(120),
  }),
  z.object({
    type: z.literal('cancellation'),
    ...baseFields,
    startsAt: isoDateTimeSchema,
  }),
  z.object({ type: z.literal('material'), ...baseFields }),
  z.object({ type: z.literal('general'), ...baseFields }),
]);
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementInputSchema>;

export const announcementEditSchema = z.object({
  editedAt: isoDateTimeSchema,
  editedBy: userSummarySchema,
  /** Names of the fields that changed, e.g. `["venue"]`, so readers see what is new. */
  changedFields: z.array(z.string()).min(1),
});

export const announcementSchema = z.object({
  id: idSchema,
  classId: idSchema,
  author: userSummarySchema,
  type: announcementTypeSchema,
  courseId: idSchema.nullable(),
  title: shortText(140),
  body: longText(5000),
  links: z.array(announcementLinkSchema),
  pinned: z.boolean(),
  dueAt: isoDateTimeSchema.nullable(),
  startsAt: isoDateTimeSchema.nullable(),
  venue: z.string().nullable(),
  taskId: idSchema.nullable(),
  edits: z.array(announcementEditSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Announcement = z.infer<typeof announcementSchema>;

/** An announcement as seen by one member, with their read state. */
export const announcementForUserSchema = announcementSchema.extend({
  seenAt: isoDateTimeSchema.nullable(),
});
export type AnnouncementForUser = z.infer<typeof announcementForUserSchema>;

/** "Seen by" receipts, visible to roles allowed to view them. */
export const announcementReceiptsSchema = z.object({
  announcementId: idSchema,
  memberCount: z.number().int().min(0),
  seenCount: z.number().int().min(0),
  notSeen: z.array(userSummarySchema),
});
export type AnnouncementReceipts = z.infer<typeof announcementReceiptsSchema>;

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

/**
 * Changes to an announcement. The type cannot change (a cancellation never becomes a deadline);
 * fields that do not apply to the type are refused by the API.
 */
export const updateAnnouncementInputSchema = z
  .object({
    courseId: idSchema.nullable(),
    title: shortText(140),
    body: longText(5000),
    links: z.array(announcementLinkSchema).max(10),
    pinned: z.boolean(),
    dueAt: isoDateTimeSchema,
    startsAt: isoDateTimeSchema,
    venue: shortText(120).nullable(),
    taskType: taskTypeSchema,
  })
  .partial();
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementInputSchema>;

/** Filters for the announcement feed across the person's classes. */
export const announcementFeedQuerySchema = z.object({
  classId: idSchema.optional(),
  type: announcementTypeSchema.optional(),
  /** Only announcements the person has not seen yet. */
  unread: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  /** Words to find in the title or body. */
  q: z.string().trim().min(1).max(100).optional(),
  /** Older than this instant, for loading the next page. */
  before: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type AnnouncementFeedQuery = z.infer<typeof announcementFeedQuerySchema>;

/** Announcements the person has just seen; recorded in one request. */
export const markSeenInputSchema = z.object({ ids: z.array(idSchema).min(1).max(100) });
export type MarkSeenInput = z.infer<typeof markSeenInputSchema>;

/** Unread announcements, in total and per class. */
export const unreadCountSchema = z.object({
  total: z.number().int().min(0),
  byClass: z.record(z.string(), z.number().int().min(0)),
});
export type UnreadCount = z.infer<typeof unreadCountSchema>;

export const announcementEditSchema = z.object({
  editedAt: isoDateTimeSchema,
  /** `null` when the editor's account no longer exists. */
  editedBy: userSummarySchema.nullable(),
  /** Names of the fields that changed, e.g. `["venue"]`, so readers see what is new. */
  changedFields: z.array(z.string()).min(1),
});

export const announcementSchema = z.object({
  id: idSchema,
  classId: idSchema,
  /** `null` when the author's account no longer exists. */
  author: userSummarySchema.nullable(),
  type: announcementTypeSchema,
  courseId: idSchema.nullable(),
  title: shortText(140),
  body: longText(5000),
  links: z.array(announcementLinkSchema),
  pinned: z.boolean(),
  dueAt: isoDateTimeSchema.nullable(),
  startsAt: isoDateTimeSchema.nullable(),
  venue: z.string().nullable(),
  /** For deadlines and assessments: the kind of task created for every member. */
  taskType: taskTypeSchema.nullable(),
  taskId: idSchema.nullable(),
  edits: z.array(announcementEditSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Announcement = z.infer<typeof announcementSchema>;

/** An announcement as seen by one member, with their read state. */
export const announcementForUserSchema = announcementSchema.extend({
  seenAt: isoDateTimeSchema.nullable(),
  /** Whether the person may edit, pin or delete it. */
  canManage: z.boolean(),
  /** "Seen by" counts, only for roles allowed to see receipts. */
  receipts: z
    .object({ seen: z.number().int().min(0), members: z.number().int().min(0) })
    .nullable(),
});
export type AnnouncementForUser = z.infer<typeof announcementForUserSchema>;

/** "Seen by" receipts, visible to roles allowed to view them. */
export const announcementReceiptsSchema = z.object({
  announcementId: idSchema,
  memberCount: z.number().int().min(0),
  seenCount: z.number().int().min(0),
  notSeen: z.array(userSummarySchema),
  seen: z.array(z.object({ user: userSummarySchema, seenAt: isoDateTimeSchema })),
});
export type AnnouncementReceipts = z.infer<typeof announcementReceiptsSchema>;

/** One page of the feed: pinned announcements first (on the first page only), then newest. */
export const announcementPageSchema = z.object({
  items: z.array(announcementForUserSchema),
  /** Pass as `before` to load older announcements; `null` when there are no more. */
  nextBefore: isoDateTimeSchema.nullable(),
});
export type AnnouncementPage = z.infer<typeof announcementPageSchema>;

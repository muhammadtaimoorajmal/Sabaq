import { z } from 'zod';
import {
  normalizeExtension,
  parseNamingPattern,
  SUBMISSION_CHANNELS,
} from '../domain/submission.js';
import { shortText, webUrlSchema } from './common.js';

/** A naming pattern such as `Lab{TASK_NO}_{STUDENT_ID}_{SECTION}`, validated token by token. */
export const namingPatternSchema = z
  .string()
  .trim()
  .max(120)
  .superRefine((pattern, context) => {
    const parsed = parseNamingPattern(pattern);
    if (!parsed.ok) {
      context.addIssue({ code: 'custom', message: parsed.error.code, params: { ...parsed.error } });
    }
  });

export const extensionSchema = z
  .string()
  .transform(normalizeExtension)
  .pipe(z.string().regex(/^[a-z\d]{1,10}(?:\.[a-z\d]{1,10})?$/, 'Invalid file extension'));

const graceMinutesSchema = z.number().int().min(0).max(1440).default(0);

export const latePolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not_accepted'), graceMinutes: graceMinutesSchema }),
  z.object({
    kind: z.literal('penalty'),
    graceMinutes: graceMinutesSchema,
    penaltyPercent: z.number().int().min(1).max(100),
  }),
  z.object({ kind: z.literal('accepted'), graceMinutes: graceMinutesSchema }),
]);

export const submissionChannelSchema = z.object({
  kind: z.enum(SUBMISSION_CHANNELS),
  /** For example "Upload on the LMS under Week 11" or the instructor's email address. */
  label: shortText(120).nullable().default(null),
  url: webUrlSchema.nullable().default(null),
});

/** How a task must be submitted. Attached to a task by an instructor or class representative. */
export const submissionRuleSchema = z.object({
  namingPattern: namingPatternSchema.nullable().default(null),
  caseSensitive: z.boolean().default(false),
  allowedExtensions: z
    .array(extensionSchema)
    .max(20)
    .default([])
    .transform((extensions) => [...new Set(extensions)]),
  maxSizeMB: z.number().positive().max(1024).nullable().default(null),
  channel: submissionChannelSchema,
  latePolicy: latePolicySchema.default({ kind: 'not_accepted', graceMinutes: 0 }),
});
export type SubmissionRule = z.infer<typeof submissionRuleSchema>;
export type SubmissionRuleInput = z.input<typeof submissionRuleSchema>;

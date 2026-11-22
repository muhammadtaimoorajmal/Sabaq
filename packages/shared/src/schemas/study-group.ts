import { z } from 'zod';
import { idSchema, isoDateTimeSchema, longText, shortText, webUrlSchema } from './common.js';
import { courseSessionSchema } from './course.js';
import { userSummarySchema } from './user.js';

export const meetingPlaceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('in_person'), location: shortText(120) }),
  z.object({ kind: z.literal('online'), url: webUrlSchema }),
]);

const groupFields = {
  courseId: idSchema,
  name: shortText(80),
  topic: longText(500).default(''),
  capacity: z.number().int().min(2).max(50).default(6),
  place: meetingPlaceSchema,
  /** Regular meeting times; reuses the weekly session shape from courses. */
  meetings: z.array(courseSessionSchema).max(7).default([]),
  /** When false, people must request to join and the owner approves. */
  openToJoin: z.boolean().default(true),
};

export const studyGroupSchema = z.object({
  id: idSchema,
  classId: idSchema,
  owner: userSummarySchema,
  members: z.array(userSummarySchema),
  ...groupFields,
  createdAt: isoDateTimeSchema,
});
export type StudyGroup = z.infer<typeof studyGroupSchema>;

export const createStudyGroupInputSchema = z.object(groupFields);
export type CreateStudyGroupInput = z.infer<typeof createStudyGroupInputSchema>;

export const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;

export const joinRequestSchema = z.object({
  id: idSchema,
  groupId: idSchema,
  user: userSummarySchema,
  message: longText(300),
  status: z.enum(JOIN_REQUEST_STATUSES),
  createdAt: isoDateTimeSchema,
});
export type JoinRequest = z.infer<typeof joinRequestSchema>;

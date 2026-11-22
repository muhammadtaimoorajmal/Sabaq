import { z } from 'zod';
import { isValidJoinCode, normalizeJoinCode } from '../domain/join-code.js';
import { idSchema, isoDateTimeSchema, shortText, timeZoneSchema } from './common.js';
import { userSummarySchema } from './user.js';

export const MEMBERSHIP_ROLES = ['student', 'class_rep', 'instructor'] as const;
export const membershipRoleSchema = z.enum(MEMBERSHIP_ROLES);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

/** A join code as typed by a person; normalized to its canonical form. */
export const joinCodeSchema = z
  .string()
  .transform(normalizeJoinCode)
  .refine(isValidJoinCode, { error: 'Check the code and try again' });

/**
 * A class is a group of students who take the same courses together,
 * for example "BS Computer Science · Section A · Fall 2026".
 */
export const classSchema = z.object({
  id: idSchema,
  name: shortText(80),
  program: shortText(120),
  term: shortText(60),
  institution: shortText(120).nullable(),
  timeZone: timeZoneSchema,
  memberCount: z.number().int().min(0),
  createdAt: isoDateTimeSchema,
});
export type Class = z.infer<typeof classSchema>;

/** The class as seen by one of its members, including that member's role. */
export const classForMemberSchema = classSchema.extend({
  role: membershipRoleSchema,
  /** Only present for roles allowed to see it (see the permission matrix). */
  joinCode: z.string().nullable(),
});
export type ClassForMember = z.infer<typeof classForMemberSchema>;

export const createClassInputSchema = z.object({
  name: shortText(80),
  program: shortText(120),
  term: shortText(60),
  institution: shortText(120).optional(),
  timeZone: timeZoneSchema,
});
export type CreateClassInput = z.infer<typeof createClassInputSchema>;

export const updateClassInputSchema = createClassInputSchema.partial();
export type UpdateClassInput = z.infer<typeof updateClassInputSchema>;

export const joinClassInputSchema = z.object({ code: joinCodeSchema });
export type JoinClassInput = z.infer<typeof joinClassInputSchema>;

export const memberSchema = z.object({
  user: userSummarySchema,
  role: membershipRoleSchema,
  joinedAt: isoDateTimeSchema,
});
export type Member = z.infer<typeof memberSchema>;

export const changeMemberRoleInputSchema = z.object({ role: membershipRoleSchema });
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleInputSchema>;

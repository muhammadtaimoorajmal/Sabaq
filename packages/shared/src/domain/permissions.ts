import type { MembershipRole } from '../schemas/class.js';
import type { PlatformRole } from '../schemas/user.js';

/** Everything a member of a class can be allowed to do. */
export const CLASS_ACTIONS = [
  'class.view',
  'class.update',
  'class.delete',
  'class.view_join_code',
  'class.regenerate_join_code',
  'class.manage_members',
  'course.manage',
  'announcement.create',
  'announcement.manage_any',
  'announcement.view_receipts',
  'task.create_for_class',
  'task.manage_any',
  'workload.view_class',
  'study_group.create',
] as const;
export type ClassAction = (typeof CLASS_ACTIONS)[number];

const STUDENT: readonly ClassAction[] = [
  'class.view',
  'class.view_join_code',
  'workload.view_class',
  'study_group.create',
];

/**
 * Class representatives run the class day to day: courses, announcements, the roster and the
 * join code. Only instructors can change or remove other instructors (enforced by the API).
 */
const CLASS_REP: readonly ClassAction[] = [
  ...STUDENT,
  'class.update',
  'class.regenerate_join_code',
  'class.manage_members',
  'course.manage',
  'announcement.create',
  'announcement.view_receipts',
  'task.create_for_class',
];

const INSTRUCTOR: readonly ClassAction[] = CLASS_ACTIONS;

/**
 * The permission matrix. Class representatives can post and organize, but only instructors
 * can change the class itself, manage members, or edit other people's posts.
 */
export const PERMISSIONS: Readonly<Record<MembershipRole, ReadonlySet<ClassAction>>> = {
  student: new Set(STUDENT),
  class_rep: new Set(CLASS_REP),
  instructor: new Set(INSTRUCTOR),
};

export interface Actor {
  platformRole: PlatformRole;
  /** The actor's role in the class in question, or null if they are not a member. */
  membershipRole: MembershipRole | null;
}

/** Whether `actor` may perform `action` in a class. Platform admins may do everything. */
export function can(actor: Actor, action: ClassAction): boolean {
  if (actor.platformRole === 'admin') return true;
  if (actor.membershipRole === null) return false;
  return PERMISSIONS[actor.membershipRole].has(action);
}

/**
 * Whether `actor` may edit or delete a specific item (announcement, task) authored by
 * `authorId`. Authors may manage their own items while they can still create them.
 */
export function canManageItem(
  actor: Actor & { userId: string },
  authorId: string,
  kind: 'announcement' | 'task',
): boolean {
  if (can(actor, kind === 'announcement' ? 'announcement.manage_any' : 'task.manage_any')) {
    return true;
  }
  const createAction: ClassAction =
    kind === 'announcement' ? 'announcement.create' : 'task.create_for_class';
  return actor.userId === authorId && can(actor, createAction);
}

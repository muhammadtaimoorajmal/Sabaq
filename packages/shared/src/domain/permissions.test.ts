import { describe, expect, it } from 'vitest';
import { can, CLASS_ACTIONS, canManageItem, type Actor } from './permissions.js';

const member = (membershipRole: Actor['membershipRole']): Actor => ({
  platformRole: 'user',
  membershipRole,
});

describe('can', () => {
  it('lets students view and collaborate, but not post or manage', () => {
    const student = member('student');
    expect(can(student, 'class.view')).toBe(true);
    expect(can(student, 'workload.view_class')).toBe(true);
    expect(can(student, 'study_group.create')).toBe(true);
    expect(can(student, 'announcement.create')).toBe(false);
    expect(can(student, 'class.manage_members')).toBe(false);
  });

  it('lets class representatives run the class, but not delete it or manage others’ posts', () => {
    const rep = member('class_rep');
    expect(can(rep, 'announcement.create')).toBe(true);
    expect(can(rep, 'announcement.view_receipts')).toBe(true);
    expect(can(rep, 'course.manage')).toBe(true);
    expect(can(rep, 'class.update')).toBe(true);
    expect(can(rep, 'class.manage_members')).toBe(true);
    expect(can(rep, 'class.regenerate_join_code')).toBe(true);
    expect(can(rep, 'announcement.manage_any')).toBe(false);
    expect(can(rep, 'class.delete')).toBe(false);
  });

  it('lets instructors do everything in their class', () => {
    for (const action of CLASS_ACTIONS) expect(can(member('instructor'), action)).toBe(true);
  });

  it('denies non-members and allows platform admins everywhere', () => {
    expect(can(member(null), 'class.view')).toBe(false);
    expect(can({ platformRole: 'admin', membershipRole: null }, 'class.delete')).toBe(true);
  });
});

describe('canManageItem', () => {
  const as = (membershipRole: Actor['membershipRole'], userId = 'me') => ({
    ...member(membershipRole),
    userId,
  });

  it('lets authors manage their own items while they still may create them', () => {
    expect(canManageItem(as('class_rep'), 'me', 'announcement')).toBe(true);
    expect(canManageItem(as('class_rep'), 'me', 'task')).toBe(true);
  });

  it("does not let class representatives edit someone else's items", () => {
    expect(canManageItem(as('class_rep'), 'someone-else', 'announcement')).toBe(false);
  });

  it('does not let former posters manage items after losing the right to post', () => {
    expect(canManageItem(as('student'), 'me', 'announcement')).toBe(false);
  });

  it('lets instructors manage any item', () => {
    expect(canManageItem(as('instructor'), 'someone-else', 'announcement')).toBe(true);
    expect(canManageItem(as('instructor'), 'someone-else', 'task')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  changePasswordInputSchema,
  courseSessionSchema,
  createAnnouncementInputSchema,
  createCourseInputSchema,
  createStudyGroupInputSchema,
  createStudySlotInputSchema,
  createTaskInputSchema,
  DEFAULT_PREFERENCES,
  idSchema,
  isValidTimeZone,
  joinClassInputSchema,
  loginInputSchema,
  notificationSchema,
  paginationSchema,
  preferencesUpdateSchema,
  registerInputSchema,
  submissionRuleSchema,
  timeOfDaySchema,
  timeZoneSchema,
  userSchema,
  webUrlSchema,
} from '../index.js';

const ID = '6741f0c2a1b2c3d4e5f60718';

describe('common', () => {
  it('validates identifiers, times, time zones and URLs', () => {
    expect(idSchema.safeParse(ID).success).toBe(true);
    expect(idSchema.safeParse('123').success).toBe(false);
    expect(timeOfDaySchema.safeParse('23:59').success).toBe(true);
    expect(timeOfDaySchema.safeParse('24:00').success).toBe(false);
    expect(isValidTimeZone('Asia/Karachi')).toBe(true);
    expect(timeZoneSchema.safeParse('Mars/Olympus').success).toBe(false);
    expect(webUrlSchema.safeParse('https://example.com/a').success).toBe(true);
    expect(webUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(webUrlSchema.safeParse('ftp://example.com').success).toBe(false);
  });

  it('coerces pagination query strings with sensible defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationSchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
    expect(paginationSchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('auth', () => {
  it('normalizes email addresses so the same person cannot register twice', () => {
    const input = registerInputSchema.parse({
      name: '  Ayesha Khan ',
      email: '  Ayesha@Example.COM ',
      password: 'correct horse battery',
    });
    expect(input).toEqual({
      name: 'Ayesha Khan',
      email: 'ayesha@example.com',
      password: 'correct horse battery',
    });
  });

  it('enforces length-based password rules only', () => {
    const base = { name: 'Ali', email: 'ali@example.com' };
    expect(registerInputSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(registerInputSchema.safeParse({ ...base, password: '          ' }).success).toBe(false);
    expect(registerInputSchema.safeParse({ ...base, password: 'x'.repeat(129) }).success).toBe(
      false,
    );
    expect(registerInputSchema.safeParse({ ...base, password: 'alllowercase' }).success).toBe(true);
  });

  it('does not apply the password policy at login', () => {
    expect(loginInputSchema.safeParse({ email: 'a@b.co', password: 'old' }).success).toBe(true);
  });

  it('requires a different new password', () => {
    const result = changePasswordInputSchema.safeParse({
      currentPassword: 'same password',
      newPassword: 'same password',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['newPassword']);
  });
});

describe('users and preferences', () => {
  it('gives new accounts accessible, neutral defaults', () => {
    expect(DEFAULT_PREFERENCES).toEqual({
      theme: 'system',
      textScale: 1,
      density: 'comfortable',
      language: 'en',
      motion: 'system',
      timeFormat: '12h',
      weekStartsOn: 1,
      timeZone: 'UTC',
      notifications: {
        digest: 'immediate',
        email: false,
        quietHours: { enabled: false, start: '22:00', end: '07:00' },
      },
    });
  });

  it('accepts partial, nested preference updates and rejects out-of-range text sizes', () => {
    expect(
      preferencesUpdateSchema.parse({ notifications: { quietHours: { enabled: true } } }),
    ).toEqual({ notifications: { quietHours: { enabled: true } } });
    expect(preferencesUpdateSchema.safeParse({ textScale: 3 }).success).toBe(false);
  });

  it('parses a full user', () => {
    const user = {
      id: ID,
      name: 'Ali Raza',
      email: 'ali@example.com',
      emailVerified: true,
      studentId: 'FA24-BCS-001',
      avatarUrl: null,
      platformRole: 'user',
      preferences: DEFAULT_PREFERENCES,
      createdAt: '2026-11-22T05:00:00.000Z',
    };
    expect(userSchema.parse(user)).toEqual(user);
    expect(userSchema.safeParse({ ...user, studentId: 'has spaces' }).success).toBe(false);
  });
});

describe('classes and courses', () => {
  it('normalizes typed join codes', () => {
    expect(joinClassInputSchema.parse({ code: 'k7mq-3xra' })).toEqual({ code: 'K7MQ3XRA' });
    expect(joinClassInputSchema.safeParse({ code: 'nope' }).success).toBe(false);
  });

  it('requires sessions to end after they start', () => {
    const session = { kind: 'lab', dayOfWeek: 3, start: '08:00', end: '11:00', venue: 'E-102' };
    expect(courseSessionSchema.safeParse(session).success).toBe(true);
    const reversed = courseSessionSchema.safeParse({ ...session, end: '07:00' });
    expect(reversed.error?.issues[0]?.path).toEqual(['end']);
  });

  it('fills course defaults', () => {
    expect(
      createCourseInputSchema.parse({ code: 'SE-301', title: 'Interaction Design', color: 'teal' }),
    ).toEqual({
      code: 'SE-301',
      title: 'Interaction Design',
      color: 'teal',
      instructorName: null,
      schedule: [],
    });
  });
});

describe('submission rules', () => {
  it('fills defaults and normalizes extensions', () => {
    expect(
      submissionRuleSchema.parse({
        namingPattern: ' Lab{TASK_NO}_{STUDENT_ID} ',
        allowedExtensions: ['.PDF', 'pdf', 'Docx'],
        channel: { kind: 'lms' },
      }),
    ).toEqual({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}',
      caseSensitive: false,
      allowedExtensions: ['pdf', 'docx'],
      maxSizeMB: null,
      channel: { kind: 'lms', label: null, url: null },
      latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
    });
  });

  it('explains invalid naming patterns with a message code', () => {
    const result = submissionRuleSchema.safeParse({
      namingPattern: 'Lab{GRADE}',
      channel: { kind: 'lms' },
    });
    expect(result.error?.issues[0]?.message).toBe('pattern.unknown_token');
  });

  it('requires a penalty percentage for penalty policies', () => {
    const rule = { channel: { kind: 'email' }, latePolicy: { kind: 'penalty', graceMinutes: 0 } };
    expect(submissionRuleSchema.safeParse(rule).success).toBe(false);
  });
});

describe('tasks, announcements, planner, groups, notifications', () => {
  it('fills task defaults', () => {
    expect(
      createTaskInputSchema.parse({ title: 'Lab 11', type: 'lab', dueAt: '2026-11-25T18:59:00Z' }),
    ).toEqual({
      title: 'Lab 11',
      type: 'lab',
      dueAt: '2026-11-25T18:59:00Z',
      description: '',
      courseId: null,
      effort: null,
      submissionRule: null,
    });
  });

  it('requires the fields that make each announcement type actionable', () => {
    const base = { title: 'Lab 11' };
    expect(createAnnouncementInputSchema.safeParse({ type: 'deadline', ...base }).success).toBe(
      false,
    );
    expect(
      createAnnouncementInputSchema.parse({
        type: 'deadline',
        ...base,
        dueAt: '2026-11-25T18:59:00+05:00',
      }),
    ).toMatchObject({ taskType: 'assignment', submissionRule: null, pinned: false, links: [] });
    expect(
      createAnnouncementInputSchema.safeParse({
        type: 'venue_change',
        ...base,
        startsAt: '2026-11-25T08:00:00Z',
      }).success,
    ).toBe(false);
    expect(createAnnouncementInputSchema.safeParse({ type: 'general', ...base }).success).toBe(
      true,
    );
  });

  it('limits study slots to positive durations of at most 12 hours', () => {
    const slot = { title: 'Revise', start: '2026-11-22T10:00:00Z', end: '2026-11-22T12:00:00Z' };
    expect(createStudySlotInputSchema.safeParse(slot).success).toBe(true);
    expect(createStudySlotInputSchema.safeParse({ ...slot, end: slot.start }).success).toBe(false);
    expect(
      createStudySlotInputSchema.safeParse({ ...slot, end: '2026-11-23T10:00:00Z' }).success,
    ).toBe(false);
  });

  it('accepts in-person or online study groups', () => {
    const group = { courseId: ID, name: 'Exam prep' };
    expect(
      createStudyGroupInputSchema.parse({
        ...group,
        place: { kind: 'online', url: 'https://meet.example.com/x' },
      }),
    ).toMatchObject({ capacity: 6, openToJoin: true, meetings: [] });
    expect(
      createStudyGroupInputSchema.safeParse({ ...group, place: { kind: 'online' } }).success,
    ).toBe(false);
  });

  it('keeps notification links inside the app', () => {
    const notification = {
      id: ID,
      type: 'task.due_soon',
      params: { title: 'Lab 11', hours: 2 },
      link: '/tasks/1',
      createdAt: '2026-11-22T05:00:00Z',
      deliverAt: '2026-11-22T05:00:00Z',
      readAt: null,
    };
    expect(notificationSchema.safeParse(notification).success).toBe(true);
    expect(
      notificationSchema.safeParse({ ...notification, link: 'https://evil.example' }).success,
    ).toBe(false);
  });
});

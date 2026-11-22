import { DEFAULT_PREFERENCES } from '@sabaq/shared';
import { type Document, Error as MongooseError, Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import {
  AnnouncementReceiptModel,
  ClassModel,
  CourseModel,
  JoinRequestModel,
  MembershipModel,
  NOTIFICATION_RETENTION_DAYS,
  NotificationModel,
  StudyGroupModel,
  StudySlotModel,
  TaskCompletionModel,
  TaskModel,
  UserModel,
} from './index.js';

useTestDatabase();

const id = () => new Types.ObjectId();

/** Runs full validation (including document hooks) and returns the errors by field path. */
async function validationErrors(document: Document) {
  try {
    await document.validate();
    return {};
  } catch (error) {
    if (error instanceof MongooseError.ValidationError) return error.errors;
    throw error;
  }
}
const newUser = (email = 'Zara.Ahmed@Example.com') =>
  UserModel.create({ name: 'Zara Ahmed', email, passwordHash: 'hash' });

describe('users', () => {
  it('stores e-mail in lowercase, applies default preferences and hides the password hash', async () => {
    const user = await newUser();
    expect(user.email).toBe('zara.ahmed@example.com');
    expect(user.toObject().preferences).toEqual(DEFAULT_PREFERENCES);

    const json = user.toJSON() as unknown as Record<string, unknown>;
    expect(json.id).toBe(String(user._id));
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
    expect(json).not.toHaveProperty('passwordHash');

    const found = await UserModel.findById(user._id);
    expect(found?.passwordHash).toBeUndefined();
    const withHash = await UserModel.findById(user._id).select('+passwordHash');
    expect(withHash?.passwordHash).toBe('hash');
  });

  it('rejects a second account with the same e-mail in any letter case', async () => {
    await newUser('ali@example.com');
    await expect(newUser('ALI@example.com')).rejects.toMatchObject({ code: 11000 });
  });

  it('validates preference values', async () => {
    const user = new UserModel({
      name: 'Zara Ahmed',
      email: 'z@example.com',
      passwordHash: 'hash',
      preferences: { theme: 'neon', timeZone: 'Mars/Olympus' },
    });
    expect(Object.keys(await validationErrors(user)).sort()).toEqual([
      'preferences.theme',
      'preferences.timeZone',
    ]);
  });
});

describe('classes and memberships', () => {
  it('normalizes join codes and keeps them unique', async () => {
    const createdBy = id();
    const fields = {
      name: '5A',
      program: 'BSCS',
      term: 'Fall',
      timeZone: 'Asia/Karachi',
      createdBy,
    };
    const created = await ClassModel.create({ ...fields, joinCode: 'nrth-5a26' });
    expect(created.joinCode).toBe('NRTH5A26');
    await expect(ClassModel.create({ ...fields, joinCode: 'NRTH5A26' })).rejects.toMatchObject({
      code: 11000,
    });
    await expect(ClassModel.create({ ...fields, joinCode: 'O0O0O0O0' })).rejects.toThrow(
      'Invalid join code',
    );
  });

  it('allows one membership per person per class', async () => {
    const classId = id();
    const userId = id();
    await MembershipModel.create({ classId, userId });
    await expect(
      MembershipModel.create({ classId, userId, role: 'class_rep' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe('courses', () => {
  it('treats course codes as unique within a class regardless of letter case', async () => {
    const classId = id();
    const course = { classId, title: 'Databases', color: 'purple' } as const;
    await CourseModel.create({ ...course, code: 'CS-363' });
    await expect(CourseModel.create({ ...course, code: 'cs-363' })).rejects.toMatchObject({
      code: 11000,
    });
    await expect(
      CourseModel.create({ ...course, classId: id(), code: 'cs-363' }),
    ).resolves.toBeDefined();
  });

  it('requires sessions to end after they start and limits their number', async () => {
    const session = { kind: 'lecture', dayOfWeek: 1, start: '11:00', end: '10:00' };
    const backwards = new CourseModel({
      classId: id(),
      code: 'X',
      title: 'X',
      color: 'red',
      schedule: [session],
    });
    await expect(backwards.validate()).rejects.toThrow('The session must end after it starts');
    const tooMany = new CourseModel({
      classId: id(),
      code: 'Y',
      title: 'Y',
      color: 'red',
      schedule: Array.from({ length: 15 }, () => ({ ...session, end: '12:00' })),
    });
    expect((await validationErrors(tooMany)).schedule?.message).toBe('Too many sessions');
  });
});

describe('tasks', () => {
  const task = { title: 'Lab 10', type: 'lab' as const, dueAt: new Date(), createdBy: id() };

  it('belongs to a class or to one person, never both or neither', async () => {
    await expect(TaskModel.create({ ...task, classId: id() })).resolves.toBeDefined();
    await expect(TaskModel.create({ ...task, ownerId: id() })).resolves.toBeDefined();
    await expect(TaskModel.create(task)).rejects.toThrow('either to a class or to one person');
    await expect(TaskModel.create({ ...task, classId: id(), ownerId: id() })).rejects.toThrow(
      'either to a class or to one person',
    );
  });

  it('stores submission rules with their defaults', async () => {
    const created = await TaskModel.create({
      ...task,
      classId: id(),
      submissionRule: { allowedExtensions: ['pdf'], channel: { kind: 'lms' } },
    });
    expect(created.toObject().submissionRule).toEqual({
      namingPattern: null,
      caseSensitive: false,
      allowedExtensions: ['pdf'],
      maxSizeMB: null,
      channel: { kind: 'lms', label: null, url: null },
      latePolicy: { kind: 'not_accepted', graceMinutes: 0, penaltyPercent: null },
    });
  });
});

describe('receipts and completions', () => {
  it('record the current time by default and only once per person', async () => {
    const before = Date.now();
    const receipt = await AnnouncementReceiptModel.create({
      announcementId: id(),
      classId: id(),
      userId: id(),
    });
    const completion = await TaskCompletionModel.create({ taskId: id(), userId: id() });
    expect(receipt.seenAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(completion.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    await expect(
      TaskCompletionModel.create({ taskId: completion.taskId, userId: completion.userId }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe('study slots', () => {
  const slot = (hours: number) => {
    const start = new Date('2026-11-23T10:00:00Z');
    return new StudySlotModel({
      userId: id(),
      title: 'Revise',
      start,
      end: new Date(start.getTime() + hours * 3_600_000),
    });
  };

  it('must last more than zero and at most twelve hours', async () => {
    await expect(slot(2).validate()).resolves.toBeUndefined();
    await expect(slot(0).validate()).rejects.toThrow('at most 12 hours');
    await expect(slot(13).validate()).rejects.toThrow('at most 12 hours');
  });

  it('reports missing times through the required rules', async () => {
    const errors = await validationErrors(new StudySlotModel({ userId: id(), title: 'Revise' }));
    expect(errors.start?.kind).toBe('required');
    expect(errors.end?.kind).toBe('required');
  });
});

describe('study groups', () => {
  it('cannot have more members than its capacity', async () => {
    const group = new StudyGroupModel({
      classId: id(),
      courseId: id(),
      ownerId: id(),
      memberIds: [id(), id(), id()],
      name: 'Group',
      capacity: 2,
      place: { kind: 'online', url: 'https://meet.example.com/x' },
    });
    await expect(group.validate()).rejects.toThrow('The group is full');
  });

  it('allows one pending join request per person, but a new one after a decision', async () => {
    const request = { groupId: id(), userId: id() };
    const first = await JoinRequestModel.create(request);
    await expect(JoinRequestModel.create(request)).rejects.toMatchObject({ code: 11000 });
    await first.updateOne({ status: 'declined', decidedAt: new Date() });
    await expect(JoinRequestModel.create(request)).resolves.toBeDefined();
  });
});

describe('notifications', () => {
  it('expire automatically and keep empty parameters', async () => {
    const indexes = await NotificationModel.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(ttl?.expireAfterSeconds).toBe(NOTIFICATION_RETENTION_DAYS * 86_400);

    const created = await NotificationModel.create({
      userId: id(),
      type: 'task.due_soon',
      link: '/tasks/1',
    });
    expect(created.toObject().params).toEqual({});
    await expect(
      NotificationModel.create({
        userId: id(),
        type: 'task.due_soon',
        link: 'https://evil.example',
      }),
    ).rejects.toThrow();
  });
});

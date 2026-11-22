import { assessDueDate, dayKeyOf, submissionRuleSchema, urgencyOf } from '@sabaq/shared';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/database.js';
import {
  AnnouncementModel,
  AnnouncementReceiptModel,
  ClassModel,
  MembershipModel,
  TaskCompletionModel,
  TaskModel,
  UserModel,
} from '../models/index.js';
import { DEMO_STUDENT, DEMO_TIME_ZONE } from './demo-data.js';
import { prepareForSeed, seedDemoData, termOf } from './seed.js';

useTestDatabase();

const NOW = new Date('2026-11-22T10:00:00Z');

describe('seedDemoData', () => {
  it('creates a consistent demo institution and reports what it created', async () => {
    const summary = await seedDemoData({ passwordHash: 'hash', now: NOW });

    expect(await UserModel.countDocuments()).toBe(summary.users);
    expect(await MembershipModel.countDocuments()).toBe(summary.memberships);
    expect(await TaskModel.countDocuments()).toBe(summary.tasks);
    expect(await AnnouncementModel.countDocuments()).toBe(summary.announcements);
    expect(await AnnouncementReceiptModel.countDocuments()).toBe(summary.receipts);
    expect(await TaskCompletionModel.countDocuments()).toBe(summary.completions);

    const demoClass = await ClassModel.findOne();
    expect(demoClass).toMatchObject({ term: 'Fall 2026', timeZone: DEMO_TIME_ZONE });
  });

  it('dates nothing in the future that has already happened', async () => {
    await seedDemoData({ passwordHash: 'hash', now: NOW });
    const latest = async (model: mongoose.Model<never>, field: string) => {
      const [doc] = await model
        .find()
        .sort({ [field]: -1 })
        .limit(1)
        .lean<Record<string, Date>[]>();
      return doc?.[field]?.getTime() ?? 0;
    };
    expect(await latest(AnnouncementModel as never, 'createdAt')).toBeLessThan(NOW.getTime());
    expect(await latest(AnnouncementReceiptModel as never, 'seenAt')).toBeLessThan(NOW.getTime());
    expect(await latest(TaskCompletionModel as never, 'completedAt')).toBeLessThan(NOW.getTime());
  });

  it('shows the situations the interface must handle', async () => {
    await seedDemoData({ passwordHash: 'hash', now: NOW });
    const demoClass = await ClassModel.findOne().orFail();
    const classTasks = await TaskModel.find({ classId: demoClass._id }).lean();
    const student = await UserModel.findOne({ email: DEMO_STUDENT.email }).orFail();
    const done = new Set(
      (await TaskCompletionModel.find({ userId: student._id }).lean()).map((c) => String(c.taskId)),
    );

    // Something overdue, something due today, and an overloaded day that triggers a clash warning.
    const urgencies = classTasks
      .filter((task) => !done.has(String(task._id)))
      .map((task) => urgencyOf(task.dueAt, NOW, DEMO_TIME_ZONE));
    expect(urgencies).toContain('today');
    expect(urgencies).toContain('next_7_days');

    // An instructor adding one more assignment on the crunch day gets a clash warning.
    const crunchTask = classTasks.find((task) => task.title.startsWith('Assignment 2'));
    if (!crunchTask) throw new Error('The crunch-day assignment is missing');
    const crunch = crunchTask.dueAt;
    const assessment = assessDueDate(
      classTasks.map((task) => ({ type: task.type, dueAt: task.dueAt, effort: task.effort })),
      { type: 'assignment', dueAt: crunch },
      { timeZone: DEMO_TIME_ZONE, now: NOW },
    );
    expect(assessment.isClash).toBe(true);
    expect(assessment.suggestions.length).toBeGreaterThan(0);
    expect(dayKeyOf(crunch, DEMO_TIME_ZONE)).toBe('2026-11-25');

    // Every stored submission rule is valid by the shared rules the interface uses.
    const rules = classTasks.flatMap((task) => (task.submissionRule ? [task.submissionRule] : []));
    expect(rules.length).toBeGreaterThan(5);
    for (const rule of rules) {
      expect(submissionRuleSchema.safeParse(rule).error).toBeUndefined();
    }

    // The demo student has unseen announcements and an edited one with its history.
    const seen = await AnnouncementReceiptModel.countDocuments({ userId: student._id });
    expect(seen).toBeLessThan(await AnnouncementModel.countDocuments());
    expect(await AnnouncementModel.countDocuments({ 'edits.0': { $exists: true } })).toBe(1);
  });
});

describe('termOf', () => {
  it.each([
    ['2026-02-10', 'Spring 2026'],
    ['2026-06-15', 'Summer 2026'],
    ['2026-09-01', 'Fall 2026'],
  ])('%s is in %s', (date, term) => {
    expect(termOf(new Date(date))).toBe(term);
  });
});

describe('prepareForSeed', () => {
  it('seeds an empty database, refuses to overwrite data, and resets on request', async () => {
    expect(await prepareForSeed({ reset: false })).toEqual({ ok: true, cleared: false });
    await seedDemoData({ passwordHash: 'hash', now: NOW });

    const refused = await prepareForSeed({ reset: false });
    expect(refused).toMatchObject({ ok: false });
    expect(!refused.ok && refused.reason).toContain('--reset');

    expect(await prepareForSeed({ reset: true })).toEqual({ ok: true, cleared: true });
    expect(await UserModel.countDocuments()).toBe(0);
  });

  it('never touches a database that holds other applications’ data', async () => {
    await mongoose.connection.db?.collection('memorials').insertOne({ name: 'not ours' });
    const result = await prepareForSeed({ reset: true });
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.reason).toContain('memorials');
    expect(await mongoose.connection.db?.collection('memorials').countDocuments()).toBe(1);
    await mongoose.connection.db?.dropCollection('memorials');
  });

  it('requires a connection', async () => {
    const { db } = mongoose.connection;
    Object.defineProperty(mongoose.connection, 'db', { value: undefined, configurable: true });
    await expect(prepareForSeed({ reset: false })).rejects.toThrow('Not connected');
    Object.defineProperty(mongoose.connection, 'db', { value: db, configurable: true });
  });
});

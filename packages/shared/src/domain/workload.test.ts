import { describe, expect, it } from 'vitest';
import {
  assessDueDate,
  computeDailyLoad,
  effortOf,
  loadLevelOf,
  type WorkloadTask,
} from './workload.js';

const ZONE = 'Asia/Karachi';
/** Sunday 22 November 2026, 10:00 in Karachi. */
const NOW = '2026-11-22T05:00:00Z';
/** 18:00 in Karachi on the given November day. */
const at = (day: number) => `2026-11-${String(day).padStart(2, '0')}T13:00:00Z`;

describe('effort and load levels', () => {
  it('uses the default effort for a task type unless overridden', () => {
    expect(effortOf({ type: 'exam' })).toBe(5);
    expect(effortOf({ type: 'reading', effort: null })).toBe(1);
    expect(effortOf({ type: 'exam', effort: 2 })).toBe(2);
  });

  it.each([
    [0, 'none'],
    [1, 'light'],
    [3, 'light'],
    [4, 'moderate'],
    [6, 'moderate'],
    [7, 'heavy'],
    [9, 'heavy'],
    [10, 'extreme'],
  ] as const)('treats a load of %i as %s', (load, level) => {
    expect(loadLevelOf(load)).toBe(level);
  });
});

describe('computeDailyLoad', () => {
  it('returns every day of the range, counting tasks in the class time zone', () => {
    const tasks: WorkloadTask[] = [
      { dueAt: at(23), type: 'exam' },
      { dueAt: at(23), type: 'lab' },
      // 23:30 Karachi on the 24th, although it is still the 24th in UTC too
      { dueAt: '2026-11-24T18:30:00Z', type: 'assignment' },
      // 00:30 Karachi on the 25th, although UTC says the 24th
      { dueAt: '2026-11-24T19:30:00Z', type: 'quiz', effort: 1 },
      // outside the range
      { dueAt: at(30), type: 'project' },
    ];
    expect(
      computeDailyLoad(tasks, { from: '2026-11-22', to: '2026-11-25', timeZone: ZONE }),
    ).toEqual([
      { date: '2026-11-22', taskCount: 0, load: 0, level: 'none' },
      { date: '2026-11-23', taskCount: 2, load: 7, level: 'heavy' },
      { date: '2026-11-24', taskCount: 1, load: 3, level: 'light' },
      { date: '2026-11-25', taskCount: 1, load: 1, level: 'light' },
    ]);
  });

  it('rejects reversed and oversized ranges', () => {
    expect(() =>
      computeDailyLoad([], { from: '2026-11-25', to: '2026-11-22', timeZone: ZONE }),
    ).toThrow('end on or after');
    expect(() =>
      computeDailyLoad([], { from: '2026-01-01', to: '2027-02-05', timeZone: ZONE }),
    ).toThrow('at most 400 days');
  });
});

describe('assessDueDate', () => {
  const existing: WorkloadTask[] = [
    { id: 'exam', dueAt: at(25), type: 'exam' }, // 5
    { id: 'lab', dueAt: at(25), type: 'lab' }, // 2
    { id: 'assignment', dueAt: at(24), type: 'assignment' }, // 3
    { id: 'quiz', dueAt: at(28), type: 'quiz' }, // 3
  ];

  it('flags a clash and suggests the lightest, closest days, preferring later ones on ties', () => {
    const result = assessDueDate(
      existing,
      { dueAt: at(25), type: 'project' },
      { timeZone: ZONE, now: NOW },
    );
    expect(result).toMatchObject({
      date: '2026-11-25',
      existingLoad: 7,
      existingTaskCount: 2,
      projectedLoad: 11,
      projectedLevel: 'extreme',
      isClash: true,
    });
    expect(result.suggestions).toEqual([
      { date: '2026-11-26', offsetDays: 1, projectedLoad: 4, level: 'moderate' },
      { date: '2026-11-27', offsetDays: 2, projectedLoad: 4, level: 'moderate' },
      { date: '2026-11-23', offsetDays: -2, projectedLoad: 4, level: 'moderate' },
    ]);
  });

  it('never suggests avoided weekdays or days in the past', () => {
    const avoidThursday = assessDueDate(
      existing,
      { dueAt: at(25), type: 'project' },
      { timeZone: ZONE, now: NOW, avoidDaysOfWeek: [4] },
    );
    expect(avoidThursday.suggestions.map((day) => day.date)).toEqual([
      '2026-11-27',
      '2026-11-23',
      '2026-11-22',
    ]);

    const midweek = assessDueDate(
      existing,
      { dueAt: at(25), type: 'project' },
      { timeZone: ZONE, now: '2026-11-25T05:00:00Z', maxSuggestions: 10 },
    );
    expect(midweek.suggestions.map((day) => day.date)).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);
  });

  it('ignores the task being edited', () => {
    const result = assessDueDate(
      existing,
      { dueAt: at(25), type: 'exam' },
      { timeZone: ZONE, now: NOW, ignoreTaskId: 'exam' },
    );
    expect(result).toMatchObject({ existingLoad: 2, projectedLoad: 7, isClash: true });
  });

  it('returns no suggestions when the day stays manageable', () => {
    const result = assessDueDate(
      existing,
      { dueAt: at(26), type: 'reading' },
      { timeZone: ZONE, now: NOW },
    );
    expect(result).toMatchObject({
      projectedLoad: 1,
      projectedLevel: 'light',
      isClash: false,
      suggestions: [],
    });
  });

  it('respects the window and suggestion limits', () => {
    const result = assessDueDate(
      existing,
      { dueAt: at(25), type: 'project' },
      { timeZone: ZONE, now: NOW, windowDays: 1, maxSuggestions: 1 },
    );
    expect(result.suggestions).toEqual([
      { date: '2026-11-26', offsetDays: 1, projectedLoad: 4, level: 'moderate' },
    ]);
  });
});

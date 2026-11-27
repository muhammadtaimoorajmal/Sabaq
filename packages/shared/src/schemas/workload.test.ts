import { describe, expect, it } from 'vitest';
import { workloadQuerySchema, workloadSchema } from './workload.js';

describe('workload contract', () => {
  it('accepts a term and refuses ranges that are backwards or too long', () => {
    expect(workloadQuerySchema.safeParse({ from: '2026-09-01', to: '2027-01-31' }).success).toBe(
      true,
    );
    expect(workloadQuerySchema.safeParse({ from: '2026-12-01', to: '2026-11-30' }).success).toBe(
      false,
    );
    expect(workloadQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(
      false,
    );
  });

  it('describes days and the tasks behind them', () => {
    const parsed = workloadSchema.parse({
      timeZone: 'Asia/Karachi',
      from: '2026-11-30',
      to: '2026-11-30',
      days: [{ date: '2026-11-30', taskCount: 1, load: 3, level: 'light' }],
      items: [
        {
          id: '6741f0c2a1b2c3d4e5f60c02',
          title: 'Assignment 2',
          type: 'assignment',
          dueAt: '2026-11-30T18:59:00.000Z',
          effort: null,
          course: null,
          classId: null,
          className: null,
        },
      ],
    });
    expect(parsed.days[0]?.level).toBe('light');
  });
});

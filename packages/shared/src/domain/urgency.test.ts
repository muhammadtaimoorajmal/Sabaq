import { describe, expect, it } from 'vitest';
import { groupByUrgency, urgencyOf } from './urgency.js';

const ZONE = 'Asia/Karachi';
/** Sunday 22 November 2026, 10:00 in Karachi. */
const NOW = '2026-11-22T05:00:00Z';

describe('urgencyOf', () => {
  it.each([
    ['2026-11-22T04:59:59Z', 'overdue'], // one second ago
    ['2026-11-22T05:00:00Z', 'today'], // exactly now is not yet overdue
    ['2026-11-22T18:59:00Z', 'today'], // 23:59 Karachi
    ['2026-11-22T19:30:00Z', 'tomorrow'], // still the 22nd in UTC, but the 23rd in Karachi
    ['2026-11-29T18:00:00Z', 'next_7_days'], // 23:00 on the 29th: seven days away
    ['2026-11-30T05:00:00Z', 'later'], // eight days away
  ] as const)('classifies %s as %s', (dueAt, expected) => {
    expect(urgencyOf(dueAt, NOW, ZONE)).toBe(expected);
  });
});

describe('groupByUrgency', () => {
  it('groups items and orders each group by due time, keeping ties stable', () => {
    const items = [
      { id: 'later', dueAt: '2026-12-15T05:00:00Z' },
      { id: 'today-b', dueAt: '2026-11-22T12:00:00Z' },
      { id: 'overdue', dueAt: '2026-11-21T05:00:00Z' },
      { id: 'today-a', dueAt: '2026-11-22T08:00:00Z' },
      { id: 'today-c', dueAt: '2026-11-22T12:00:00Z' },
      { id: 'tomorrow', dueAt: '2026-11-23T05:00:00Z' },
    ];
    const groups = groupByUrgency(items, (item) => item.dueAt, NOW, ZONE);
    const ids = (key: keyof typeof groups) => groups[key].map((item) => item.id);

    expect(ids('overdue')).toEqual(['overdue']);
    expect(ids('today')).toEqual(['today-a', 'today-b', 'today-c']);
    expect(ids('tomorrow')).toEqual(['tomorrow']);
    expect(ids('next_7_days')).toEqual([]);
    expect(ids('later')).toEqual(['later']);
  });
});

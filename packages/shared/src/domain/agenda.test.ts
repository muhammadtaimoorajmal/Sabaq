import { describe, expect, it } from 'vitest';
import { type AgendaCourseInput, plannedSessions, type SessionChange } from './agenda.js';

const KARACHI = 'Asia/Karachi'; // UTC+5
const HCI: AgendaCourseInput = {
  id: 'hci',
  classId: 'c1',
  timeZone: KARACHI,
  schedule: [
    { kind: 'lecture', dayOfWeek: 1, start: '09:00', end: '10:30', venue: 'B-204' },
    { kind: 'lab', dayOfWeek: 1, start: '14:00', end: '16:00', venue: 'Lab 3' },
    { kind: 'lecture', dayOfWeek: 3, start: '11:00', end: '12:30', venue: null },
  ],
};
const DB: AgendaCourseInput = {
  id: 'db',
  classId: 'c1',
  timeZone: KARACHI,
  schedule: [{ kind: 'lecture', dayOfWeek: 1, start: '11:00', end: '12:00', venue: 'E-102' }],
};
// Monday 30 November 2026 and Wednesday 2 December 2026.
const change = (overrides: Partial<SessionChange>): SessionChange => ({
  id: 'a1',
  classId: 'c1',
  courseId: 'hci',
  type: 'cancellation',
  startsAt: '2026-11-30T04:00:00.000Z',
  venue: null,
  ...overrides,
});

describe('plannedSessions', () => {
  it('lists every meeting in the range, in order, on the viewer’s days', () => {
    const sessions = plannedSessions([HCI, DB], [], '2026-11-30', '2026-12-02', KARACHI);
    expect(sessions.map((session) => [session.courseId, session.day, session.startsAt])).toEqual([
      ['hci', '2026-11-30', '2026-11-30T04:00:00.000Z'],
      ['db', '2026-11-30', '2026-11-30T06:00:00.000Z'],
      ['hci', '2026-11-30', '2026-11-30T09:00:00.000Z'],
      ['hci', '2026-12-02', '2026-12-02T06:00:00.000Z'],
    ]);
    expect(sessions[0]).toMatchObject({
      kind: 'lecture',
      endsAt: '2026-11-30T05:30:00.000Z',
      venue: 'B-204',
      status: 'scheduled',
      originalVenue: null,
      changeId: null,
    });
  });

  it('places meetings on the viewer’s calendar when time zones differ', () => {
    // 09:00 Monday in Karachi is 04:00 Monday in London, but 13:00 Monday in Tokyo; a
    // Karachi Wednesday 11:00 meeting stays out of a Monday-only range anywhere.
    const tokyo = plannedSessions([HCI], [], '2026-11-30', '2026-11-30', 'Asia/Tokyo');
    expect(tokyo).toHaveLength(2);
    const losAngeles = plannedSessions(
      [HCI],
      [],
      '2026-11-29',
      '2026-11-29',
      'America/Los_Angeles',
    );
    // 09:00 Monday in Karachi is 20:00 Sunday in Los Angeles.
    expect(losAngeles.map((session) => session.day)).toEqual(['2026-11-29']);
  });

  it('cancels the meeting closest to the announced time', () => {
    const sessions = plannedSessions(
      [HCI, DB],
      [change({ startsAt: '2026-11-30T08:30:00.000Z' })],
      '2026-11-30',
      '2026-11-30',
      KARACHI,
    );
    expect(sessions.map((session) => [session.courseId, session.status])).toEqual([
      ['hci', 'scheduled'],
      ['db', 'scheduled'],
      ['hci', 'cancelled'],
    ]);
    expect(sessions[2]?.changeId).toBe('a1');
  });

  it('cancels every meeting of the class for a whole-class cancellation', () => {
    const sessions = plannedSessions(
      [HCI, DB],
      [change({ courseId: null })],
      '2026-11-30',
      '2026-12-02',
      KARACHI,
    );
    expect(sessions.map((session) => session.status)).toEqual([
      'cancelled',
      'cancelled',
      'cancelled',
      'scheduled',
    ]);
  });

  it('moves a meeting and remembers its usual room, even after two changes', () => {
    const sessions = plannedSessions(
      [HCI],
      [
        change({ id: 'a2', type: 'venue_change', venue: 'Hall A' }),
        change({
          id: 'a3',
          type: 'venue_change',
          venue: 'Hall B',
          startsAt: '2026-11-30T04:05:00.000Z',
        }),
      ],
      '2026-11-30',
      '2026-11-30',
      KARACHI,
    );
    expect(sessions[0]).toMatchObject({
      venue: 'Hall B',
      originalVenue: 'B-204',
      status: 'moved',
      changeId: 'a3',
    });
  });

  it('ignores changes for other classes, days without meetings and unknown classes', () => {
    const sessions = plannedSessions(
      [HCI],
      [
        change({ classId: 'other' }),
        change({ startsAt: '2026-12-01T04:00:00.000Z' }),
        change({ courseId: 'db' }),
      ],
      '2026-11-30',
      '2026-12-01',
      KARACHI,
    );
    expect(sessions.every((session) => session.status === 'scheduled')).toBe(true);
  });
});

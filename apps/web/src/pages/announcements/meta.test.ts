import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n';
import { createInput, updateInput } from './AnnouncementComposer';
import { keyFact } from './meta';

const i18n = createI18n('en');
const t = i18n.t.bind(i18n);
const display = { language: 'en', timeZone: 'Asia/Karachi', timeFormat: '24h' as const };
const NOW = new Date('2026-11-26T08:00:00.000Z');
const WHEN = '2026-11-27T04:00:00.000Z'; // 09:00 in Karachi
const base = { dueAt: null, startsAt: null, venue: null, taskType: null };

describe('keyFact', () => {
  it('describes each type in one line', () => {
    expect(keyFact({ ...base, type: 'deadline', dueAt: WHEN }, t, display, NOW)).toBe(
      'Due Friday, November 27 at 09:00',
    );
    expect(
      keyFact(
        { ...base, type: 'assessment', dueAt: WHEN, taskType: 'exam', venue: 'Hall A' },
        t,
        display,
        NOW,
      ),
    ).toBe('Exam on Friday, November 27 at 09:00 · Venue: Hall A');
    expect(keyFact({ ...base, type: 'assessment', dueAt: WHEN }, t, display, NOW)).toBe(
      'Quiz on Friday, November 27 at 09:00',
    );
    expect(
      keyFact({ ...base, type: 'venue_change', startsAt: WHEN, venue: 'Lab 3' }, t, display, NOW),
    ).toBe('Friday, November 27 at 09:00: moves to Lab 3');
    expect(keyFact({ ...base, type: 'venue_change', startsAt: WHEN }, t, display, NOW)).toBe(
      'Friday, November 27 at 09:00: moves to ',
    );
    expect(keyFact({ ...base, type: 'cancellation', startsAt: WHEN }, t, display, NOW)).toBe(
      'Friday, November 27 at 09:00: cancelled',
    );
  });

  it('has nothing to say for types without a date', () => {
    expect(keyFact({ ...base, type: 'material' }, t, display, NOW)).toBeNull();
    expect(keyFact({ ...base, type: 'deadline' }, t, display, NOW)).toBeNull();
    expect(keyFact({ ...base, type: 'cancellation' }, t, display, NOW)).toBeNull();
  });
});

describe('composer requests', () => {
  const draft = {
    classId: 'c',
    courseId: '',
    title: ' Week 12 ',
    body: ' Slides ',
    dueAt: WHEN,
    startsAt: WHEN,
    venue: ' ',
    taskType: 'quiz' as const,
    links: [{ label: ' Slides ', url: ' https://example.com/s.pdf ' }],
    pinned: true,
  };

  it('sends only the fields each type has', () => {
    expect(createInput({ ...draft, type: 'material' })).toEqual({
      type: 'material',
      courseId: null,
      title: 'Week 12',
      body: 'Slides',
      links: [{ label: 'Slides', url: 'https://example.com/s.pdf' }],
      pinned: true,
    });
    expect(createInput({ ...draft, type: 'assessment' })).toMatchObject({
      dueAt: WHEN,
      taskType: 'quiz',
      venue: null,
    });
    expect(createInput({ ...draft, type: 'cancellation' })).toMatchObject({ startsAt: WHEN });
    expect(createInput({ ...draft, type: 'venue_change', venue: 'Lab 3' })).toMatchObject({
      startsAt: WHEN,
      venue: 'Lab 3',
    });
  });

  it('never sends the type in an edit', () => {
    expect(updateInput({ ...draft, type: 'general' })).not.toHaveProperty('type');
  });
});

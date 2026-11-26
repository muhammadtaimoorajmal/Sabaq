import { describe, expect, it } from 'vitest';
import { changedAnnouncementFields, deliveryTime, isImportantChange } from './announcements.js';

describe('changedAnnouncementFields', () => {
  const current = {
    title: 'Lab 11',
    body: '',
    dueAt: '2026-11-28T18:59:00.000Z',
    venue: null,
    links: [{ label: 'Handout', url: 'https://example.com/lab11.pdf' }],
  };

  it('lists only fields whose value really changes, in a stable order', () => {
    expect(
      changedAnnouncementFields(current, {
        venue: 'Lab 3',
        title: 'Lab 11',
        dueAt: '2026-11-29T18:59:00.000Z',
        body: undefined,
      }),
    ).toEqual(['dueAt', 'venue']);
  });

  it('compares lists by their contents', () => {
    expect(changedAnnouncementFields(current, { links: [...current.links] })).toEqual([]);
    expect(changedAnnouncementFields(current, { links: [] })).toEqual(['links']);
  });

  it('treats a missing and a null value as the same', () => {
    expect(changedAnnouncementFields({}, { venue: null })).toEqual([]);
  });
});

describe('isImportantChange', () => {
  it('flags changes to when or where, not to wording', () => {
    expect(isImportantChange(['venue'])).toBe(true);
    expect(isImportantChange(['dueAt', 'title'])).toBe(true);
    expect(isImportantChange(['title', 'body'])).toBe(false);
  });
});

describe('deliveryTime', () => {
  const KARACHI = 'Asia/Karachi'; // UTC+5, no daylight saving time
  const overnight = { enabled: true, start: '22:00', end: '07:00' };

  it('delivers at once outside quiet hours, or when they are off', () => {
    const noon = '2026-11-26T07:00:00.000Z'; // 12:00 in Karachi
    expect(deliveryTime(noon, overnight, KARACHI).toISOString()).toBe(noon);
    const late = '2026-11-26T18:00:00.000Z'; // 23:00 in Karachi
    expect(deliveryTime(late, { ...overnight, enabled: false }, KARACHI).toISOString()).toBe(late);
    expect(
      deliveryTime(late, { enabled: true, start: '09:00', end: '09:00' }, KARACHI).toISOString(),
    ).toBe(late);
  });

  it('waits until the next morning for overnight quiet hours that began this evening', () => {
    // 23:00 on 26 November in Karachi → 07:00 on 27 November (02:00 UTC).
    expect(deliveryTime('2026-11-26T18:00:00.000Z', overnight, KARACHI).toISOString()).toBe(
      '2026-11-27T02:00:00.000Z',
    );
  });

  it('waits until later the same morning after midnight', () => {
    // 03:00 on 27 November in Karachi → 07:00 the same day.
    expect(deliveryTime('2026-11-26T22:00:00.000Z', overnight, KARACHI).toISOString()).toBe(
      '2026-11-27T02:00:00.000Z',
    );
  });

  it('handles daytime quiet hours', () => {
    const lectures = { enabled: true, start: '09:00', end: '13:00' };
    // 10:30 in Karachi → 13:00 the same day.
    expect(deliveryTime('2026-11-26T05:30:00.000Z', lectures, KARACHI).toISOString()).toBe(
      '2026-11-26T08:00:00.000Z',
    );
    // 14:00 is after them.
    expect(deliveryTime('2026-11-26T09:00:00.000Z', lectures, KARACHI).toISOString()).toBe(
      '2026-11-26T09:00:00.000Z',
    );
  });
});

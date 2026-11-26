import { describe, expect, it } from 'vitest';
import { parseNamingPattern } from './submission.js';
import { parsePastedMessage, type PasteCourse } from './paste.js';
import { dayKeyOf } from './time.js';

/** Thursday 26 November 2026, 10:00 in Karachi. */
const NOW = '2026-11-26T05:00:00.000Z';
const TIME_ZONE = 'Asia/Karachi';

const parse = (message: string, courses: PasteCourse[] = []) =>
  parsePastedMessage(message, { now: NOW, timeZone: TIME_ZONE, courses });
const local = (iso: string | null) =>
  iso
    ? `${dayKeyOf(iso, TIME_ZONE)} ${new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso))}`
    : null;

describe('dates', () => {
  it('reads two-digit and four-digit years, and month names with years', () => {
    expect(local(parse('Report due 28/11/26').when)).toBe('2026-11-28 23:59');
    expect(local(parse('Report due 5 January 2027').when)).toBe('2027-01-05 23:59');
    expect(local(parse('Report due January 6, 2027').when)).toBe('2027-01-06 23:59');
  });

  it('moves a date that has passed this year to next year', () => {
    expect(local(parse('Report due 3 Jan').when)).toBe('2027-01-03 23:59');
    expect(local(parse('Report due Nov 2').when)).toBe('2027-11-02 23:59');
  });

  it('ignores impossible dates', () => {
    for (const message of [
      'Report due 31/11',
      'Report due 5/13',
      'Report due 0/12',
      'Report due 5/0',
    ]) {
      expect(parse(message).when).toBeNull();
    }
  });

  it('reads "this" weekday as this week, including today', () => {
    expect(local(parse('Report due this Thursday').when)).toBe('2026-11-26 23:59');
    expect(local(parse('Report due Thursday').when)).toBe('2026-12-03 23:59');
  });

  it('uses today or tomorrow for a time alone, whichever comes first', () => {
    expect(local(parse('Report due by 5pm').when)).toBe('2026-11-26 17:00');
    expect(local(parse('Report due by 8am').when)).toBe('2026-11-27 08:00');
  });
});

describe('times', () => {
  it('reads noon, impossible times and bare afternoon hours', () => {
    expect(local(parse('Report due tomorrow at noon').when)).toBe('2026-11-27 12:00');
    expect(local(parse('Report due tomorrow 25:00').when)).toBe('2026-11-27 23:59');
    expect(parse('Report due tomorrow 25:00').timeAssumed).toBe(true);
    expect(local(parse('Report due tomorrow 10:75').when)).toBe('2026-11-27 23:59');
    expect(local(parse('Quiz tomorrow 3:30').when)).toBe('2026-11-27 15:30');
    expect(local(parse('Report due tomorrow 12 am').when)).toBe('2026-11-27 00:00');
  });

  it('uses the time alone for quizzes and coursework', () => {
    expect(parse('Quiz at 2').type).toBe('assessment');
    expect(parse('Report 3 by 5pm').type).toBe('deadline');
  });
});

describe('types and tasks', () => {
  it('tells readings from assignments', () => {
    expect(parse('Submit chapter 4 reading notes by Friday').taskType).toBe('reading');
    expect(parse('Submit the assignment on chapter 4 by Friday').taskType).toBe('assignment');
  });

  it('treats an assessment without a date as general news', () => {
    expect(parse('Midterm schedule released').type).toBe('general');
  });
});

describe('courses', () => {
  it('copes with codes without letters or digits and shared first words', () => {
    const courses: PasteCourse[] = [
      { id: 'a', code: '—', title: 'Advanced Programming' },
      { id: 'b', code: 'CS-401', title: 'Advanced Databases' },
      { id: 'c', code: 'XX', title: 'The' },
    ];
    expect(parse('Advanced quiz tomorrow', courses).courseId).toBeNull();
    expect(parse('Advanced Programming quiz tomorrow', courses).courseId).toBe('a');
  });
});

describe('submission rules', () => {
  it('reads patterns without an extension, and lists each extension once', () => {
    const result = parse('Submit report by Friday as Report_RollNo, PDF only, a pdf file');
    expect(result.namingPattern).toBe('Report_{STUDENT_ID}');
    expect(result.allowedExtensions).toEqual(['pdf']);
    expect(parseNamingPattern(result.namingPattern as string).ok).toBe(true);
  });

  it('ignores underscores that are not file names', () => {
    expect(parse('Submit my_report_final by Friday').namingPattern).toBeNull();
  });
});

describe('titles', () => {
  it('shortens long first sentences at a word boundary', () => {
    const message =
      'Please remember that the department seminar on research ethics is open to every student in the program';
    const title = parse(message).title;
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(81);
  });

  it('falls back to a plain title when nothing is left after the greeting', () => {
    expect(parse('Hello everyone!').title).toBe('Announcement');
  });

  it('marks where each detail came from, in order', () => {
    const result = parse('HCI Lab 11 report due next Wed 11pm', [
      { id: 'hci', code: 'CS-341', title: 'Human-Computer Interaction' },
    ]);
    expect(result.matches.map((match) => [match.field, match.text])).toEqual([
      ['course', 'HCI'],
      ['type', 'due'],
      ['date', 'next Wed'],
      ['time', '11pm'],
    ]);
  });
});

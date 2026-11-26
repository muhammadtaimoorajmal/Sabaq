import { describe, expect, it } from 'vitest';
import { parsePastedMessage } from './paste.js';
import { dayKeyOf } from './time.js';
import { COURSES } from './paste-corpus.test.js';

/**
 * Messages written after the parser, in phrasings the main corpus does not use, to estimate
 * accuracy on wording the parser was not shaped around. "Now" is Thursday 26 November 2026,
 * 10:00 in Karachi.
 */
const NOW = '2026-11-26T05:00:00.000Z';
const TIME_ZONE = 'Asia/Karachi';

const HOLDOUT: [string, Record<string, string | null>][] = [
  [
    'SE assignment 6 submission on LMS before 9 pm Saturday',
    { type: 'deadline', course: 'se', date: '2026-11-28', time: '21:00', channel: 'lms' },
  ],
  ['Tomorrow no HCI lecture', { type: 'cancellation', course: 'hci', date: '2026-11-27' }],
  [
    'DBMS quiz will be conducted on 1st Dec',
    { type: 'assessment', course: 'db', date: '2026-12-01' },
  ],
  [
    'Operating Systems class venue changed to C-12',
    { type: 'venue_change', course: 'os', venue: 'C-12' },
  ],
  [
    'Upload the HCI prototype video by 4 December',
    { type: 'deadline', course: 'hci', date: '2026-12-04', time: '23:59' },
  ],
  [
    'Database Systems final exam: 20/12 9am',
    { type: 'assessment', course: 'db', date: '2026-12-20', time: '09:00' },
  ],
  ['lab 6 report kal tak jama karwa dein', { type: 'deadline', date: '2026-11-27', time: '23:59' }],
  ['SE-310 class is off on Monday', { type: 'cancellation', course: 'se', date: '2026-11-30' }],
  [
    'Quiz 4 of OS next Tuesday 12:30',
    { type: 'assessment', course: 'os', date: '2026-12-01', time: '12:30' },
  ],
  [
    'HCI project final submission: 12/12/2026 at 5 PM',
    { type: 'deadline', course: 'hci', date: '2026-12-12', time: '17:00' },
  ],
  ['Lecture notes for week 10 shared on Google Classroom', { type: 'material' }],
  [
    'Software Engineering presentation on 9 Dec in Room 12',
    { type: 'assessment', course: 'se', date: '2026-12-09', venue: 'Room 12' },
  ],
  ['Make up class of CS-352 on Saturday at 10 in E-102', { type: 'general', course: 'db' }],
  [
    'Assignment 1 must be emailed by 11:00 pm today, file name Assign1_RegNo.pdf',
    {
      type: 'deadline',
      date: '2026-11-26',
      time: '23:00',
      namingPattern: 'Assign1_{STUDENT_ID}',
      channel: 'email',
    },
  ],
  [
    'Midterm of Database Systems shifted to 3rd December',
    { type: 'assessment', course: 'db', date: '2026-12-03' },
  ],
];

const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

describe('paste-to-structure on unseen wording', () => {
  it('reads most details right', () => {
    let correct = 0;
    let total = 0;
    const misses: string[] = [];
    for (const [message, expected] of HOLDOUT) {
      const result = parsePastedMessage(message, {
        now: NOW,
        timeZone: TIME_ZONE,
        courses: COURSES,
      });
      const actual: Record<string, string | null> = {
        type: result.type,
        course: result.courseId,
        date: result.when ? dayKeyOf(result.when, TIME_ZONE) : null,
        time: result.when ? clock(result.when) : null,
        venue: result.venue,
        namingPattern: result.namingPattern,
        channel: result.channel,
      };
      for (const [field, value] of Object.entries(expected)) {
        total += 1;
        if (actual[field] === value) correct += 1;
        else
          misses.push(
            `"${message}" ${field}: expected ${String(value)}, got ${String(actual[field])}`,
          );
      }
    }
    const summary = `Unseen wording ${correct}/${total}: ${misses.join(' | ')}`;
    expect(correct / total, summary).toBeGreaterThanOrEqual(0.8);
  });
});

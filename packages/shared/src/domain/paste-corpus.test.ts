import { describe, expect, it } from 'vitest';
import { parsePastedMessage, type PasteCourse } from './paste.js';
import { dayKeyOf } from './time.js';

/**
 * A corpus of realistic class messages, written to mirror how instructors and class
 * representatives post in chat groups (in English and in Roman Urdu), with the details each
 * one should produce. It is synthetic: no real messages, names or identifiers.
 *
 * "Now" is Thursday 26 November 2026, 10:00 in Karachi.
 */
const NOW = '2026-11-26T05:00:00.000Z';
const TIME_ZONE = 'Asia/Karachi';

export const COURSES: PasteCourse[] = [
  {
    id: 'hci',
    code: 'CS-341',
    title: 'Human-Computer Interaction',
    schedule: [
      { dayOfWeek: 1, start: '09:00', venue: 'B-204' },
      { dayOfWeek: 3, start: '11:00', venue: 'Lab 3' },
    ],
  },
  {
    id: 'db',
    code: 'CS-352',
    title: 'Database Systems',
    schedule: [{ dayOfWeek: 2, start: '10:00', venue: 'E-102' }],
  },
  {
    id: 'se',
    code: 'SE-310',
    title: 'Software Engineering',
    schedule: [{ dayOfWeek: 4, start: '14:00', venue: 'Hall A' }],
  },
  { id: 'os', code: 'CS-330', title: 'Operating Systems' },
];

interface Expected {
  type: string;
  taskType?: string | null;
  course?: string | null;
  date?: string | null;
  time?: string;
  venue?: string | null;
  namingPattern?: string | null;
  channel?: string | null;
}

export const CORPUS: [string, Expected][] = [
  [
    'AoA everyone! HCI Lab 11 report is due next Wed 11pm. Name your file Lab11_RollNo_Section.pdf and upload on LMS.',
    {
      type: 'deadline',
      taskType: 'lab',
      course: 'hci',
      date: '2026-12-02',
      time: '23:00',
      namingPattern: 'Lab11_{STUDENT_ID}_{SECTION}',
      channel: 'lms',
    },
  ],
  [
    'Reminder: Database assignment 3 submission deadline is 28 Nov at 11:59 PM',
    { type: 'deadline', taskType: 'assignment', course: 'db', date: '2026-11-28', time: '23:59' },
  ],
  [
    'Quiz 2 of SE on Monday in Hall A',
    {
      type: 'assessment',
      taskType: 'quiz',
      course: 'se',
      date: '2026-11-30',
      time: '09:00',
      venue: 'Hall A',
    },
  ],
  [
    'CS-341 class is cancelled tomorrow',
    { type: 'cancellation', course: 'hci', date: '2026-11-27' },
  ],
  [
    "Tomorrow's HCI class has been shifted to Lab 3",
    { type: 'venue_change', course: 'hci', date: '2026-11-27', venue: 'Lab 3' },
  ],
  [
    'Operating Systems midterm will be held on 5th December at 9:30 am in Room 204',
    {
      type: 'assessment',
      taskType: 'exam',
      course: 'os',
      date: '2026-12-05',
      time: '09:30',
      venue: 'Room 204',
    },
  ],
  [
    'Slides for lecture 12 of Database Systems have been uploaded on the portal',
    { type: 'material', course: 'db', date: null },
  ],
  [
    'Dear students, please submit Assignment 4 (SE) by Friday 5pm via email',
    {
      type: 'deadline',
      taskType: 'assignment',
      course: 'se',
      date: '2026-11-27',
      time: '17:00',
      channel: 'email',
    },
  ],
  ['kal HCI ki class nahi hogi', { type: 'cancellation', course: 'hci', date: '2026-11-27' }],
  [
    'OS lab 5 jama karwana hai parson raat 11 baje tak',
    { type: 'deadline', taskType: 'lab', course: 'os', date: '2026-11-28', time: '23:00' },
  ],
  [
    'Project proposal due 15-12-2026, one PDF per group',
    { type: 'deadline', taskType: 'project', date: '2026-12-15', time: '23:59' },
  ],
  [
    'Presentation for HCI project on 3/12 in Lab 3',
    {
      type: 'assessment',
      taskType: 'presentation',
      course: 'hci',
      date: '2026-12-03',
      venue: 'Lab 3',
    },
  ],
  [
    'No class of Software Engineering today',
    { type: 'cancellation', course: 'se', date: '2026-11-26', time: '14:00' },
  ],
  [
    'Database class moved to E-102 from next week',
    { type: 'venue_change', course: 'db', venue: 'E-102', date: null },
  ],
  [
    'Lab 7 of CS-352 must be submitted by Dec 3, 11:59pm',
    { type: 'deadline', taskType: 'lab', course: 'db', date: '2026-12-03', time: '23:59' },
  ],
  [
    'Midterm exams start on Monday. Check the schedule on the portal.',
    { type: 'assessment', taskType: 'exam', date: '2026-11-30' },
  ],
  [
    "HCI reading: chapter 4 of the textbook before Wednesday's class",
    { type: 'material', course: 'hci' },
  ],
  [
    'Viva of OS lab will be taken tomorrow at 2',
    {
      type: 'assessment',
      taskType: 'presentation',
      course: 'os',
      date: '2026-11-27',
      time: '14:00',
    },
  ],
  [
    'Assignment 2 deadline extended till 30th November',
    { type: 'deadline', taskType: 'assignment', course: null, date: '2026-11-30', time: '23:59' },
  ],
  [
    'Final exam of Database Systems on 18 Dec at 10am, Hall B',
    {
      type: 'assessment',
      taskType: 'exam',
      course: 'db',
      date: '2026-12-18',
      time: '10:00',
      venue: 'Hall B',
    },
  ],
  ['Quiz tomorrow', { type: 'assessment', taskType: 'quiz', date: '2026-11-27' }],
  [
    'SE-310 lecture on Thursday is cancelled due to a seminar',
    { type: 'cancellation', course: 'se', date: '2026-12-03', time: '14:00' },
  ],
  [
    'Submit your HCI usability report on LMS by tonight 11:59 pm',
    {
      type: 'deadline',
      taskType: 'assignment',
      course: 'hci',
      date: '2026-11-26',
      time: '23:59',
      channel: 'lms',
    },
  ],
  [
    'Lab 9 report (Operating Systems) due Monday 9am. File name: Lab9_ID_Name.docx',
    {
      type: 'deadline',
      taskType: 'lab',
      course: 'os',
      date: '2026-11-30',
      time: '09:00',
      namingPattern: 'Lab9_{STUDENT_ID}_{STUDENT_NAME}',
    },
  ],
  [
    'Class will be held in Room 305 instead of B-204 today',
    { type: 'venue_change', venue: 'Room 305', date: '2026-11-26' },
  ],
  [
    'Database quiz 3 on 2/12 at 10:30',
    { type: 'assessment', taskType: 'quiz', course: 'db', date: '2026-12-02', time: '10:30' },
  ],
  [
    'Assalam o Alaikum class, Software Engineering project demo on 10 December',
    {
      type: 'assessment',
      taskType: 'presentation',
      course: 'se',
      date: '2026-12-10',
      time: '14:00',
    },
  ],
  ['HCI handouts are shared in the WhatsApp group', { type: 'material', course: 'hci' }],
  [
    "Important: tomorrow's DB lab is called off",
    { type: 'cancellation', course: null, date: '2026-11-27' },
  ],
  [
    'Please bring your laptops for the HCI lab on Wednesday',
    { type: 'general', course: 'hci', date: null },
  ],
  [
    'Assignment 5 is due in 3 days',
    { type: 'deadline', taskType: 'assignment', date: '2026-11-29', time: '23:59' },
  ],
  [
    'OS class shifted to Lab 2 on Monday at 11',
    { type: 'venue_change', course: 'os', venue: 'Lab 2', date: '2026-11-30', time: '11:00' },
  ],
  [
    'Mid term of HCI will be on 7th Dec at 2 pm in the auditorium',
    {
      type: 'assessment',
      taskType: 'exam',
      course: 'hci',
      date: '2026-12-07',
      time: '14:00',
      venue: 'Auditorium',
    },
  ],
  [
    'Submit lab 10 by Sunday midnight',
    { type: 'deadline', taskType: 'lab', date: '2026-11-29', time: '23:59' },
  ],
  [
    'CS-341 Assignment 3: due 2026-12-04 at 23:59. Upload as A3_StudentID.pdf',
    {
      type: 'deadline',
      taskType: 'assignment',
      course: 'hci',
      date: '2026-12-04',
      time: '23:59',
      namingPattern: 'A3_{STUDENT_ID}',
    },
  ],
  [
    "Today's Software Engineering class will be in Hall A",
    { type: 'venue_change', course: 'se', venue: 'Hall A', date: '2026-11-26', time: '14:00' },
  ],
  [
    'HCI quiz postponed to next Monday',
    {
      type: 'assessment',
      taskType: 'quiz',
      course: 'hci',
      date: '2026-11-30',
      time: '09:00',
      venue: 'B-204',
    },
  ],
  ['Database Systems lecture slides 1-5 uploaded', { type: 'material', course: 'db', date: null }],
  [
    'Deadline for OS project: Friday 11:59 pm, hard copy in class',
    {
      type: 'deadline',
      taskType: 'project',
      course: 'os',
      date: '2026-11-27',
      time: '23:59',
      channel: 'in_person',
    },
  ],
  [
    'Lab 4 (SE) evaluation on Tuesday in Lab 3',
    { type: 'assessment', taskType: 'quiz', course: 'se', date: '2026-12-01', venue: 'Lab 3' },
  ],
];

const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

/** Compares one message's result with what it should be; returns [correct, total, misses]. */
function score(message: string, expected: Expected): [number, number, string[]] {
  const result = parsePastedMessage(message, { now: NOW, timeZone: TIME_ZONE, courses: COURSES });
  const actual: Record<keyof Expected, unknown> = {
    type: result.type,
    taskType: result.taskType,
    course: result.courseId,
    date: result.when ? dayKeyOf(result.when, TIME_ZONE) : null,
    time: result.when ? clock(result.when) : undefined,
    venue: result.venue,
    namingPattern: result.namingPattern,
    channel: result.channel,
  };
  const misses: string[] = [];
  let correct = 0;
  const fields = Object.keys(expected) as (keyof Expected)[];
  for (const field of fields) {
    if (actual[field] === expected[field]) correct += 1;
    else misses.push(`${field}: expected ${String(expected[field])}, got ${String(actual[field])}`);
  }
  return [correct, fields.length, misses];
}

describe('paste-to-structure corpus', () => {
  it('extracts at least 90% of fields correctly', () => {
    let correct = 0;
    let total = 0;
    const report: string[] = [];
    for (const [message, expected] of CORPUS) {
      const [right, count, misses] = score(message, expected);
      correct += right;
      total += count;
      if (misses.length > 0) report.push(`"${message}"\n    ${misses.join('\n    ')}`);
    }
    const accuracy = correct / total;
    const summary = `Field accuracy ${correct}/${total}. Misses: ${report.join(' | ')}`;
    expect(CORPUS.length).toBeGreaterThanOrEqual(40);
    expect(accuracy, summary).toBeGreaterThanOrEqual(0.9);
  });

  it('gets the type of every message right', () => {
    const wrong = CORPUS.filter(
      ([message, expected]) =>
        parsePastedMessage(message, { now: NOW, timeZone: TIME_ZONE, courses: COURSES }).type !==
        expected.type,
    ).map(([message]) => message);
    expect(wrong).toEqual([]);
  });
});

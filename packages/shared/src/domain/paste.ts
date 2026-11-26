import type { AnnouncementType } from '../schemas/announcement.js';
import type { TaskType } from '../schemas/task.js';
import type { NamingToken, SubmissionChannelKind } from './submission.js';
import {
  addDays,
  dayKeyOf,
  dayOfWeekOf,
  type Instant,
  toTimestamp,
  zonedDateTime,
} from './time.js';

/**
 * Paste-to-structure: turns a chat-style message ("HCI lab 11 report due next Wed 11pm, name
 * it Lab11_RollNo_Section.pdf") into a draft announcement. It never posts anything; every
 * detected detail comes with the span of text it came from, so the interface can highlight
 * it for the sender to confirm.
 *
 * Conventions, chosen for how classes write in practice:
 * - Numeric dates are day first (28/11 is 28 November).
 * - A weekday ("Wed", "next Wednesday") means its next occurrence after today.
 * - "Kal" (Urdu) means tomorrow in announcements; "parson" the day after.
 * - A time without am/pm from 1 to 7 is in the afternoon (classes rarely start at 3 am).
 * - "Midnight" means the end of that day (23:59), which is what "due by midnight" intends.
 */

export interface PasteCourse {
  id: string;
  code: string;
  title: string;
  schedule?: readonly { dayOfWeek: number; start: string; venue: string | null }[];
}

export interface PasteContext {
  now: Instant;
  /** The class's time zone: dates and times in the message are read there. */
  timeZone: string;
  courses: readonly PasteCourse[];
}

export const PASTE_FIELDS = [
  'type',
  'course',
  'date',
  'time',
  'venue',
  'namingPattern',
  'extensions',
  'channel',
] as const;
export type PasteField = (typeof PASTE_FIELDS)[number];

/** Where in the message a detail was found. */
export interface PasteMatch {
  field: PasteField;
  start: number;
  end: number;
  text: string;
}

export interface PastedAnnouncement {
  type: AnnouncementType;
  taskType: TaskType | null;
  courseId: string | null;
  title: string;
  body: string;
  /** The due time (deadlines, assessments) or start time (venue changes, cancellations). */
  when: string | null;
  /** True when the time of day was not in the message and was assumed. */
  timeAssumed: boolean;
  venue: string | null;
  namingPattern: string | null;
  allowedExtensions: string[];
  channel: SubmissionChannelKind | null;
  matches: PasteMatch[];
}

interface Found {
  start: number;
  end: number;
  text: string;
  groups: (string | undefined)[];
}

const find = (text: string, pattern: RegExp): Found | null => {
  const match = pattern.exec(text);
  if (!match) return null;
  return {
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
    groups: match.slice(1),
  };
};

const findAll = (text: string, pattern: RegExp): Found[] =>
  [...text.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))].map(
    (match) => ({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      groups: match.slice(1),
    }),
  );

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const pad = (value: number) => String(value).padStart(2, '0');

// ---- Type ---------------------------------------------------------------------------------

const CANCELLATION =
  /\b(?:cancel(?:l?ed)?|called off|no (?:[a-z]+(?:-\d+)?\s+)?(?:class|lecture|lab)(?:es|s)?|(?:will not|won'?t) be (?:held|taken)|class (?:is )?off|nahi?n? ho(?:gi|ga)|off hai|chutti)\b/i;
const VENUE_CHANGE =
  /\b(?:shifted|moved|relocated|(?:venue|room) (?:is |has been )?chang(?:ed|e)|will be (?:held )?in\b|instead of|shift ho)/i;
const DEADLINE =
  /\b(?:due|deadline|submit(?:ted|ting)?|submission|upload(?:ed)? (?:it|your|the)|last date|jama|hand in|turn in)\b/i;
const ASSESSMENT =
  /\b(?:quiz(?:zes)?|exams?|mid[- ]?terms?|mids|finals?|tests?|viva|presentations?|demos?|evaluations?|postponed)\b/i;
const WORK = /\b(?:assignments?|reports?|projects?|homework|hw|lab\s*\d+)\b/i;
const MATERIAL =
  /\b(?:slides?|lecture notes|notes|uploaded|shared|readings?|chapters?|handouts?|recordings?|material)\b/i;

const EXAM = /\b(?:exams?|mid[- ]?terms?|mids|finals?|tests?)\b/i;
const PRESENTATION = /\b(?:presentations?|viva|demos?)\b/i;

function taskTypeOf(type: AnnouncementType, text: string): TaskType | null {
  if (type === 'assessment') {
    if (EXAM.test(text)) return 'exam';
    return PRESENTATION.test(text) ? 'presentation' : 'quiz';
  }
  if (type !== 'deadline') return null;
  if (/\blabs?\b/i.test(text)) return 'lab';
  if (/\bprojects?\b/i.test(text)) return 'project';
  return /\b(?:readings?|chapters?)\b/i.test(text) && !/\bassignments?\b/i.test(text)
    ? 'reading'
    : 'assignment';
}

// ---- Dates and times ----------------------------------------------------------------------

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

const RELATIVE: Record<string, number> = {
  today: 0,
  tonight: 0,
  aaj: 0,
  aj: 0,
  tomorrow: 1,
  tomorow: 1,
  tmrw: 1,
  tmr: 1,
  kal: 1,
  parson: 2,
  parso: 2,
  'day after tomorrow': 2,
};

interface DateCandidate extends Found {
  day: string;
}

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** The day key of a calendar date, choosing the next occurrence when the year is missing. */
function calendarDay(day: number, month: number, year: number | null, today: string) {
  const thisYear = Number(today.slice(0, 4));
  const resolvedYear = year === null ? thisYear : year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(resolvedYear, month)) return null;
  const key = `${resolvedYear}-${pad(month)}-${pad(day)}`;
  if (year === null && key < today) return calendarDay(day, month, thisYear + 1, today);
  return key;
}

function dateCandidates(text: string, today: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const add = (found: Found, day: string | null) => {
    if (day) candidates.push({ ...found, day });
  };

  for (const found of findAll(
    text,
    /\b(day after tomorrow|tomorrow|tomorow|tmrw|tmr|tonight|today|parson|parso|kal|aaj|aj)\b/i,
  )) {
    add(found, addDays(today, RELATIVE[(found.groups[0] as string).toLowerCase()] as number));
  }
  for (const found of findAll(text, /\b(?:in|within)\s+(\d{1,2})\s+days?\b/i)) {
    add(found, addDays(today, Number(found.groups[0])));
  }
  const weekday = Object.keys(WEEKDAYS).join('|');
  for (const found of findAll(
    text,
    new RegExp(`\\b(?:(next|this|coming)\\s+)?(${weekday})\\b`, 'i'),
  )) {
    const target = WEEKDAYS[(found.groups[1] as string).toLowerCase()] as number;
    const ahead = (target - dayOfWeekOf(today) + 7) % 7;
    const thisWeek = found.groups[0]?.toLowerCase() === 'this';
    add(found, addDays(today, ahead === 0 && !thisWeek ? 7 : ahead));
  }
  for (const found of findAll(text, /\b(\d{4})-(\d{2})-(\d{2})\b/)) {
    const [year, month, day] = found.groups.map(Number) as [number, number, number];
    add(found, calendarDay(day, month, year, today));
  }
  for (const found of findAll(text, /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)) {
    const [day, month, year] = found.groups;
    add(found, calendarDay(Number(day), Number(month), year ? Number(year) : null, today));
  }
  for (const found of findAll(
    text,
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}(?:,?\\s+(\\d{4}))?`, 'i'),
  )) {
    const [day, month, year] = found.groups;
    const index = MONTHS.indexOf((month as string).toLowerCase()) + 1;
    add(found, calendarDay(Number(day), index, year ? Number(year) : null, today));
  }
  for (const found of findAll(
    text,
    new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i'),
  )) {
    const [month, day, year] = found.groups;
    const index = MONTHS.indexOf((month as string).toLowerCase()) + 1;
    add(found, calendarDay(Number(day), index, year ? Number(year) : null, today));
  }
  return candidates.sort((a, b) => a.start - b.start);
}

/** Words that introduce the date that matters: "due Friday", "by 28 Nov", "moved to Monday". */
const LEADS_IN =
  /(?:due|by|before|deadline|till|until|last date|on|to|for)\s*[:-]?\s*(?:the\s+)?$/i;

function pickDate(text: string, candidates: DateCandidate[]): DateCandidate | null {
  const introduced = candidates.find((candidate) =>
    LEADS_IN.test(text.slice(Math.max(0, candidate.start - 20), candidate.start)),
  );
  return introduced ?? candidates[0] ?? null;
}

interface TimeCandidate extends Found {
  time: string;
}

function findTime(text: string): TimeCandidate | null {
  const found = find(
    text,
    /\b(?:(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?\b|(\d{1,2})[:](\d{2})\b|(\d{1,2})\s*([ap])\.?m\.?\b|(noon|midday|midnight)\b|(\d{1,2})\s*baje\b|at\s+(\d{1,2})\b(?![:/.-]?\d))/i,
  );
  if (!found) return null;
  const [h1, m1, ap1, h2, m2, h3, ap3, word, h4, h5] = found.groups;
  let hours: number;
  let minutes = 0;
  let meridiem: string | undefined;
  if (word) {
    const midnight = word.toLowerCase() === 'midnight';
    return { ...found, time: midnight ? '23:59' : '12:00' };
  }
  if (h1 !== undefined) {
    hours = Number(h1);
    minutes = Number(m1);
    meridiem = ap1;
  } else if (h2 !== undefined) {
    hours = Number(h2);
    minutes = Number(m2);
  } else if (h3 !== undefined) {
    hours = Number(h3);
    meridiem = ap3;
  } else {
    hours = Number(h4 ?? h5);
  }
  // "raat 11 baje" (11 at night), "shaam 6 baje" (6 in the evening).
  const evening = /(?:raat|shaam|sham|night|evening)\s*$/i.test(
    text.slice(Math.max(0, found.start - 8), found.start),
  );
  if (evening && !meridiem && hours < 12) meridiem = 'p';
  if (meridiem) {
    const pm = meridiem.toLowerCase() === 'p';
    hours = (hours % 12) + (pm ? 12 : 0);
  } else if (hours >= 1 && hours <= 7) {
    hours += 12;
  }
  if (hours > 23 || minutes > 59) return null;
  return { ...found, time: `${pad(hours)}:${pad(minutes)}` };
}

const clockOf = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

// ---- Course, venue and submission rules ----------------------------------------------------

const STOPWORDS = new Set(['and', 'of', 'the', 'to', 'in', 'for', 'with', 'a', 'an']);

const firstWord = (course: PasteCourse) =>
  course.title.split(/[\s-]+/).find((word) => !STOPWORDS.has(word.toLowerCase())) ?? '';

function findCourse(text: string, courses: readonly PasteCourse[]) {
  let best: { course: PasteCourse; found: Found } | null = null;
  const firstWords = courses.map((course) => firstWord(course).toLowerCase());
  for (const course of courses) {
    // A distinctive first word, such as "Database" for "Database Systems", if no other course
    // starts with it.
    const first = firstWord(course);
    const unique =
      first.length >= 5 && firstWords.filter((word) => word === first.toLowerCase()).length === 1;
    const parts = course.code.match(/[a-z]+|\d+/gi) ?? [];
    const words = course.title.split(/[\s-]+/).filter(Boolean);
    const initials = words
      .filter((word) => !STOPWORDS.has(word.toLowerCase()))
      .map((word) => word.charAt(0))
      .join('');
    const patterns = [
      parts.length > 0 ? new RegExp(`\\b${parts.map(escape).join('[\\s-]*')}\\b`, 'i') : null,
      new RegExp(`\\b${words.map(escape).join('[\\s-]+')}\\b`, 'i'),
      initials.length >= 3 ? new RegExp(`\\b${escape(initials)}\\b`, 'i') : null,
      initials.length === 2 ? new RegExp(`\\b${escape(initials.toUpperCase())}\\b`) : null,
      unique ? new RegExp(`\\b${escape(first)}\\b`, 'i') : null,
    ];
    for (const pattern of patterns) {
      const found = pattern ? find(text, pattern) : null;
      if (found && (!best || found.start < best.found.start)) best = { course, found };
    }
  }
  return best;
}

const VENUE_PLACE =
  '((?:room|lab|hall|auditorium|block|class\\s*room)\\s*(?:no\\.?\\s*|#\\s*)?[a-z]?\\d+[a-z]?(?:-[a-z0-9]+)?|(?:room|lab|hall)\\s+[a-z]\\b|auditorium\\b|[a-z]{1,2}-\\d{1,3}[a-z]?)';
const VENUE_AFTER = new RegExp(
  `\\b(?:in|at|to|venue\\s*:?|room\\s*:)\\s+(?:the\\s+)?${VENUE_PLACE}`,
  'i',
);
const ROOM_ALONE =
  /\b((?:room|hall)\s*(?:no\.?|number|#)?\s*(?:[a-z]?-?\d{1,4}[a-z]?|[a-z])|auditorium)\b/i;

function findVenue(text: string) {
  const found = find(text, VENUE_AFTER) ?? find(text, ROOM_ALONE);
  if (!found) return null;
  const venue = (found.groups[0] as string).replace(/\s+/g, ' ').trim();
  const start = found.start + found.text.lastIndexOf(found.groups[0] as string);
  return { venue: capitalize(venue), match: { start, end: start + venue.length, text: venue } };
}

const TOKEN_ALIASES: Record<string, NamingToken> = {
  studentid: 'STUDENT_ID',
  id: 'STUDENT_ID',
  rollno: 'STUDENT_ID',
  rollnumber: 'STUDENT_ID',
  roll: 'STUDENT_ID',
  regno: 'STUDENT_ID',
  registrationno: 'STUDENT_ID',
  sapid: 'STUDENT_ID',
  sap: 'STUDENT_ID',
  name: 'STUDENT_NAME',
  fullname: 'STUDENT_NAME',
  studentname: 'STUDENT_NAME',
  yourname: 'STUDENT_NAME',
  section: 'SECTION',
  sec: 'SECTION',
  coursecode: 'COURSE_CODE',
  course: 'COURSE_CODE',
  taskno: 'TASK_NO',
  labno: 'TASK_NO',
  assignmentno: 'TASK_NO',
};

function findNamingPattern(text: string) {
  for (const found of findAll(
    text,
    /(?<![\w<>{}[\]-])[\w<>{}[\]-]+(?:_[\w<>{}[\]-]+)+(?:\.([a-z\d]{2,5}))?\b/i,
  )) {
    const extension = found.groups[0]?.toLowerCase() ?? null;
    const stem = extension ? found.text.slice(0, -(extension.length + 1)) : found.text;
    let tokens = 0;
    const pattern = stem
      .split('_')
      .map((part) => {
        const token = TOKEN_ALIASES[part.replace(/[^a-z\d]/gi, '').toLowerCase()];
        if (!token) return part.replace(/[<>{}[\]]/g, '');
        tokens += 1;
        return `{${token}}`;
      })
      .join('_');
    // Built only from letters, digits, dashes and known tokens, so it is always a valid pattern.
    if (tokens > 0) {
      return { pattern, extension, match: found };
    }
  }
  return null;
}

const EXTENSIONS =
  /\b(pdf|docx?|pptx?|xlsx?|zip|rar|ipynb|py|java|cpp|txt)\b(?=\s*(?:files?|format|only|form|per|documents?|copy|\.|,|$|\)))/gi;

const CHANNELS: [RegExp, SubmissionChannelKind][] = [
  [/\b(?:lms|portal|moodle|google classroom|classroom)\b/i, 'lms'],
  [/\be-?mail(?:ed)?\b/i, 'email'],
  [/\b(?:hard ?copy|printed|in person|in class)\b/i, 'in_person'],
];

// ---- Titles ---------------------------------------------------------------------------------

const GREETING =
  /^(?:[\s*_~"'#>\-–—•.!:,]+|(?:assalam[\s-]*o?[\s-]*alaikum|aoa|salam|hello|hi|hey|dear (?:students|class|all|everyone)|good (?:morning|afternoon|evening)|attention|reminder|important|update|note|everyone|all|class)\b)+/i;
const ITEM =
  /\b(lab|assignment|quiz|project|presentation|exam|mid-?term|final|report|homework|hw|test|viva)\s*(?:no\.?\s*|#\s*)?(\d{1,2})\b/i;
const TASK_LABEL: Record<TaskType, string> = {
  assignment: 'Assignment',
  lab: 'Lab',
  quiz: 'Quiz',
  exam: 'Exam',
  project: 'Project',
  presentation: 'Presentation',
  reading: 'Reading',
  other: 'Task',
};

/** The first sentence, without greetings, shortened at a word boundary. */
function firstSentence(text: string): string {
  const cleaned = text.replace(GREETING, '').trim();
  const sentence = cleaned
    .split(/(?<=[.!?])\s|\n/, 1)
    .join('')
    .replace(/[.!?:]+$/, '')
    .trim();
  if (sentence.length <= 80) return capitalize(sentence);
  return `${capitalize(sentence.slice(0, 80).replace(/\s+\S*$/, ''))}…`;
}

function titleFor(
  type: AnnouncementType,
  taskType: TaskType | null,
  text: string,
  code: string | null,
  venue: string | null,
) {
  const prefix = code ? `${code} ` : '';
  const subject = code ?? 'Class';
  if (type === 'cancellation') return `${subject} cancelled`;
  if (type === 'venue_change')
    // A venue change is only recognised when the new place is named.
    return `${subject} moves to ${String(venue)}`;
  if (type === 'deadline' || type === 'assessment') {
    const item = find(text, ITEM);
    let name = item
      ? `${capitalize((item.groups[0] as string).toLowerCase().replace('hw', 'homework'))} ${item.groups[1] as string}`
      : TASK_LABEL[taskType as TaskType];
    if (type === 'deadline' && /\breport\b/i.test(text) && !/report/i.test(name)) name += ' report';
    return `${prefix}${name}`;
  }
  return firstSentence(text) || 'Announcement';
}

// ---- Putting it together --------------------------------------------------------------------

/** Reads a pasted message into a draft announcement, with the source of every detail. */
export function parsePastedMessage(message: string, context: PasteContext): PastedAnnouncement {
  const text = message.trim();
  const now = new Date(toTimestamp(context.now));
  const today = dayKeyOf(now, context.timeZone);
  const matches: PasteMatch[] = [];
  const record = (field: PasteField, found: { start: number; end: number; text: string }) => {
    matches.push({ field, start: found.start, end: found.end, text: found.text });
  };

  const date = pickDate(text, dateCandidates(text, today));
  const time = findTime(text);

  // Type, by the strongest signal first.
  const cancellation = find(text, CANCELLATION);
  // "Shifted" or "moved" is a venue change only when a place is named ("moved to Lab 3");
  // "midterm shifted to 3rd December" is a new date.
  const venueChange = cancellation || !findVenue(text) ? null : find(text, VENUE_CHANGE);
  const deadline = find(text, DEADLINE);
  const assessment = find(text, ASSESSMENT);
  const material = find(text, MATERIAL);
  // Coursework with a date is due then, even without "due" or "submit".
  const work = find(text, WORK);
  let type: AnnouncementType;
  let typeMatch: Found | null;
  if (cancellation) [type, typeMatch] = ['cancellation', cancellation];
  else if (venueChange) [type, typeMatch] = ['venue_change', venueChange];
  else if (deadline) [type, typeMatch] = ['deadline', deadline];
  else if (assessment && (date || time)) [type, typeMatch] = ['assessment', assessment];
  else if (work && (date || time)) [type, typeMatch] = ['deadline', work];
  else if (material) [type, typeMatch] = ['material', material];
  else [type, typeMatch] = ['general', null];
  if (typeMatch) record('type', typeMatch);
  const taskType = taskTypeOf(type, text);

  const courseFound = findCourse(text, context.courses);
  const course = courseFound?.course ?? null;
  if (courseFound) record('course', courseFound.found);

  const venueFound = type === 'deadline' || type === 'material' ? null : findVenue(text);
  if (venueFound) record('venue', venueFound.match);

  // When: the date in the message (or today/tomorrow for a time alone), at the stated time,
  // the course's class time on that day, or a sensible default.
  let when: string | null = null;
  let timeAssumed = false;
  let venue = venueFound?.venue ?? null;
  const dated = type !== 'material' && type !== 'general';
  if (dated && (date || time)) {
    if (date) record('date', date);
    if (time) record('time', time);
    const day =
      date?.day ??
      (clockOf(now, context.timeZone) < (time as TimeCandidate).time ? today : addDays(today, 1));
    const session = course?.schedule?.find((item) => item.dayOfWeek === dayOfWeekOf(day));
    let clock = time?.time;
    if (!clock) {
      timeAssumed = true;
      clock = type === 'deadline' ? '23:59' : (session?.start ?? '09:00');
    }
    if (!venue && type !== 'deadline' && type !== 'venue_change') venue = session?.venue ?? null;
    when = zonedDateTime(day, clock, context.timeZone).toISOString();
  }

  // Submission rules matter only for work handed in.
  let namingPattern: string | null = null;
  const allowedExtensions: string[] = [];
  let channel: SubmissionChannelKind | null = null;
  if (type === 'deadline') {
    const naming = findNamingPattern(text);
    if (naming) {
      namingPattern = naming.pattern;
      record('namingPattern', naming.match);
      if (naming.extension) allowedExtensions.push(naming.extension);
    }
    for (const found of findAll(text, EXTENSIONS)) {
      // The extension of a naming pattern is already counted.
      if (naming && found.start >= naming.match.start && found.end <= naming.match.end) continue;
      const extension = (found.groups[0] as string).toLowerCase();
      if (!allowedExtensions.includes(extension)) allowedExtensions.push(extension);
      record('extensions', found);
    }
    for (const [pattern, kind] of CHANNELS) {
      const found = find(text, pattern);
      if (found) {
        channel = kind;
        record('channel', found);
        break;
      }
    }
  }

  return {
    type,
    taskType,
    courseId: course?.id ?? null,
    title: titleFor(type, taskType, text, course?.code ?? null, venue).slice(0, 140),
    body: text,
    when,
    timeAssumed,
    venue,
    namingPattern,
    allowedExtensions,
    channel,
    matches: matches.sort((a, b) => a.start - b.start),
  };
}

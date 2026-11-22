/**
 * A fictional institution used for demos, local development and usability tests.
 * Names, e-mail addresses and links are invented; `.example` domains are reserved and
 * can never receive mail.
 */
import type { AnnouncementType, ColorToken, TaskType } from '@sabaq/shared';
import type { SubmissionRuleRecord } from '../models/task.js';
import type { WeeklySession } from '../schema-helpers.js';

export const DEMO_PASSWORD = 'sabaq-demo';
export const DEMO_TIME_ZONE = 'Asia/Karachi';
export const DEMO_DOMAIN = 'northfield.example';
export const DEMO_JOIN_CODE = 'NRTH5A26';

export interface DemoPerson {
  name: string;
  email: string;
  studentId: string | null;
}

const person = (name: string, studentNumber: number | null): DemoPerson => ({
  name,
  email: `${name
    .replace(/^Dr\. /, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .join('.')}@${DEMO_DOMAIN}`,
  studentId: studentNumber === null ? null : `NU-24-${String(studentNumber).padStart(4, '0')}`,
});

export const DEMO_ADMIN: DemoPerson = {
  name: 'Sana Malik',
  email: `admin@${DEMO_DOMAIN}`,
  studentId: null,
};
export const DEMO_INSTRUCTOR = person('Dr. Ayesha Siddiqui', null);
export const DEMO_CLASS_REP = person('Hamza Khan', 1);
/** The student whose point of view the demo is designed around. */
export const DEMO_STUDENT = person('Zara Ahmed', 2);

export const OTHER_STUDENTS: DemoPerson[] = [
  'Ali Raza',
  'Fatima Noor',
  'Omar Farooq',
  'Ayesha Tariq',
  'Bilal Ahmed',
  'Hira Shah',
  'Usman Ali',
  'Maryam Iqbal',
  'Daniyal Hussain',
  'Sara Javed',
  'Hassan Mirza',
  'Noor Fatima',
  'Ahmed Sheikh',
  'Iqra Aslam',
  'Saad Butt',
  'Mahnoor Rehman',
  'Talha Saeed',
  'Amna Yousaf',
  'Zain Abbas',
  'Laiba Khalid',
  'Hamid Nawaz',
  'Eman Zahid',
].map((name, index) => person(name, index + 3));

export interface DemoCourse {
  code: string;
  title: string;
  instructorName: string;
  color: ColorToken;
  schedule: WeeklySession[];
}

const lecture = (dayOfWeek: number, start: string, end: string, venue: string): WeeklySession => ({
  kind: 'lecture',
  dayOfWeek,
  start,
  end,
  venue,
});
const lab = (dayOfWeek: number, start: string, end: string, venue: string): WeeklySession => ({
  kind: 'lab',
  dayOfWeek,
  start,
  end,
  venue,
});

export const DEMO_COURSES: DemoCourse[] = [
  {
    code: 'CS-341',
    title: 'Human-Computer Interaction',
    instructorName: DEMO_INSTRUCTOR.name,
    color: 'blue',
    schedule: [
      lecture(1, '09:00', '10:30', 'Room B-204'),
      lecture(3, '09:00', '10:30', 'Room B-204'),
      lab(4, '14:00', '17:00', 'Interaction Lab'),
    ],
  },
  {
    code: 'CS-352',
    title: 'Software Engineering',
    instructorName: 'Imran Qureshi',
    color: 'teal',
    schedule: [
      lecture(2, '11:00', '12:30', 'Room A-110'),
      lecture(4, '11:00', '12:30', 'Room A-110'),
    ],
  },
  {
    code: 'CS-363',
    title: 'Database Systems',
    instructorName: 'Dr. Farah Naz',
    color: 'purple',
    schedule: [
      lecture(1, '11:00', '12:30', 'Room C-302'),
      lecture(3, '11:00', '12:30', 'Room C-302'),
      lab(5, '09:00', '12:00', 'Data Lab'),
    ],
  },
  {
    code: 'CS-374',
    title: 'Operating Systems',
    instructorName: 'Usman Tariq',
    color: 'orange',
    schedule: [
      lecture(2, '09:00', '10:30', 'Room B-105'),
      lecture(4, '09:00', '10:30', 'Room B-105'),
    ],
  },
  {
    code: 'CS-385',
    title: 'Computer Networks',
    instructorName: 'Dr. Bilal Hassan',
    color: 'green',
    schedule: [
      lecture(1, '14:00', '15:30', 'Room A-201'),
      lab(2, '14:00', '17:00', 'Networks Lab'),
    ],
  },
  {
    code: 'HU-210',
    title: 'Technical Writing',
    instructorName: 'Maria Khan',
    color: 'pink',
    schedule: [lecture(5, '14:00', '15:30', 'Room D-010')],
  },
];

const portal = { kind: 'lms' as const, label: 'Course portal', url: null };

const rule = (
  overrides: Partial<SubmissionRuleRecord> & Pick<SubmissionRuleRecord, 'allowedExtensions'>,
): SubmissionRuleRecord => ({
  namingPattern: null,
  caseSensitive: false,
  maxSizeMB: 10,
  channel: portal,
  latePolicy: { kind: 'not_accepted', graceMinutes: 0, penaltyPercent: null },
  ...overrides,
});

export interface DemoTask {
  key: string;
  course: string;
  title: string;
  type: TaskType;
  /** Days from today, in the class's time zone; negative values are in the past. */
  day: number;
  time: string;
  description: string;
  submissionRule: SubmissionRuleRecord | null;
  /** Who posts the announcement that creates the task; `null` for tasks without one. */
  announcedBy: 'instructor' | 'class_rep' | null;
  /** Share of students who have completed it, from 0 to 1. */
  completedShare: number;
}

export const DEMO_TASKS: DemoTask[] = [
  {
    key: 'db-lab-9',
    course: 'CS-363',
    title: 'Lab 9: Entity-relationship diagrams',
    type: 'lab',
    day: -5,
    time: '23:59',
    description: 'Draw the ER diagram for the library case study and map it to tables.',
    submissionRule: rule({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}',
      allowedExtensions: ['pdf'],
    }),
    announcedBy: 'class_rep',
    completedShare: 0.9,
  },
  {
    key: 'tw-reading-6',
    course: 'HU-210',
    title: 'Reading: Chapter 6, Writing for the web',
    type: 'reading',
    day: -1,
    time: '14:00',
    description: 'Read chapter 6 before class and note two examples from websites you use.',
    submissionRule: null,
    announcedBy: null,
    completedShare: 0.6,
  },
  {
    key: 'db-lab-10',
    course: 'CS-363',
    title: 'Lab 10: Normalization exercises',
    type: 'lab',
    day: 0,
    time: '23:59',
    description:
      'Normalize the five relations in the handout to third normal form. Show each step.',
    submissionRule: rule({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}',
      allowedExtensions: ['pdf'],
      maxSizeMB: 5,
    }),
    announcedBy: 'class_rep',
    completedShare: 0.35,
  },
  {
    key: 'os-quiz-3',
    course: 'CS-374',
    title: 'Quiz 3: Process scheduling',
    type: 'quiz',
    day: 1,
    time: '09:00',
    description: 'In class, 20 minutes. Covers FCFS, SJF, round robin and priority scheduling.',
    submissionRule: null,
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'hci-a2',
    course: 'CS-341',
    title: 'Assignment 2: Heuristic evaluation',
    type: 'assignment',
    day: 3,
    time: '23:59',
    description:
      'Evaluate the university admissions website against Nielsen’s ten heuristics. Rate every problem’s severity from 0 to 4.',
    submissionRule: rule({
      namingPattern: 'A{TASK_NO}_{STUDENT_ID}_{SECTION}',
      allowedExtensions: ['pdf', 'docx'],
      latePolicy: { kind: 'penalty', graceMinutes: 60, penaltyPercent: 10 },
    }),
    announcedBy: 'instructor',
    completedShare: 0.1,
  },
  {
    key: 'se-sprint-2',
    course: 'CS-352',
    title: 'Sprint 2 demo',
    type: 'presentation',
    day: 3,
    time: '11:00',
    description: 'Ten-minute team demo of the sprint 2 increment, followed by questions.',
    submissionRule: null,
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'cn-a3',
    course: 'CS-385',
    title: 'Assignment 3: Subnetting',
    type: 'assignment',
    day: 3,
    time: '17:00',
    description: 'Solve the twelve subnetting problems. Handwritten solutions must be scanned.',
    submissionRule: rule({
      namingPattern: 'CN_A{TASK_NO}_{STUDENT_ID}',
      allowedExtensions: ['pdf'],
      channel: { kind: 'email', label: 'bilal.hassan@northfield.example', url: null },
    }),
    announcedBy: 'class_rep',
    completedShare: 0.05,
  },
  {
    key: 'db-quiz-2',
    course: 'CS-363',
    title: 'Quiz 2: SQL joins',
    type: 'quiz',
    day: 3,
    time: '09:00',
    description: 'Fifteen minutes at the start of the lab.',
    submissionRule: null,
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'tw-proposal',
    course: 'HU-210',
    title: 'Project proposal: first draft',
    type: 'assignment',
    day: 5,
    time: '12:00',
    description: 'Two pages, using the proposal template. Peer review happens in class.',
    submissionRule: rule({
      allowedExtensions: ['docx'],
      latePolicy: { kind: 'accepted', graceMinutes: 0, penaltyPercent: null },
    }),
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'hci-lab-11',
    course: 'CS-341',
    title: 'Lab 11: Usability test plan',
    type: 'lab',
    day: 7,
    time: '23:59',
    description: 'Write the test plan for your project: participants, tasks, metrics and consent.',
    submissionRule: rule({
      namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
      allowedExtensions: ['pdf', 'docx'],
      maxSizeMB: 20,
    }),
    announcedBy: 'instructor',
    completedShare: 0,
  },
  {
    key: 'os-a2',
    course: 'CS-374',
    title: 'Assignment 2: Synchronization',
    type: 'assignment',
    day: 10,
    time: '23:59',
    description: 'Implement the bounded-buffer problem with semaphores and explain each choice.',
    submissionRule: rule({ allowedExtensions: ['zip'], maxSizeMB: 25 }),
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'db-midterm',
    course: 'CS-363',
    title: 'Midterm exam',
    type: 'exam',
    day: 14,
    time: '09:00',
    description: 'Covers weeks 1 to 7. Bring your student card.',
    submissionRule: null,
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'se-milestone',
    course: 'CS-352',
    title: 'Project milestone 2: design document',
    type: 'project',
    day: 17,
    time: '23:59',
    description: 'Architecture, data model and interface sketches for your team project.',
    submissionRule: rule({ allowedExtensions: ['pdf'], maxSizeMB: 30 }),
    announcedBy: 'class_rep',
    completedShare: 0,
  },
  {
    key: 'hci-prototype',
    course: 'CS-341',
    title: 'Project phase 4: high-fidelity prototype',
    type: 'project',
    day: 21,
    time: '23:59',
    description: 'Interactive prototype that addresses the findings from your formative tests.',
    submissionRule: rule({
      allowedExtensions: ['pdf', 'zip'],
      maxSizeMB: 100,
      latePolicy: { kind: 'penalty', graceMinutes: 0, penaltyPercent: 20 },
    }),
    announcedBy: 'instructor',
    completedShare: 0,
  },
];

/** Personal tasks that only the demo student sees. */
export const DEMO_PERSONAL_TASKS: Pick<DemoTask, 'key' | 'title' | 'type' | 'day' | 'time'>[] = [
  {
    key: 'own-slides',
    title: 'Prepare my part of the sprint demo slides',
    type: 'other',
    day: 2,
    time: '20:00',
  },
  {
    key: 'own-revise',
    title: 'Revise subnetting with Ali',
    type: 'reading',
    day: 2,
    time: '18:00',
  },
];

export interface DemoAnnouncement {
  type: Exclude<AnnouncementType, 'deadline' | 'assessment'>;
  course: string | null;
  title: string;
  body: string;
  /** Days from today when it was posted (negative) or when it takes effect. */
  postedDay: number;
  /** Venue changes and cancellations apply to the course's next timetabled session. */
  appliesToNextSession?: boolean;
  venue?: string;
  links?: { label: string; url: string }[];
  pinned?: boolean;
  by: 'instructor' | 'class_rep';
}

export const DEMO_ANNOUNCEMENTS: DemoAnnouncement[] = [
  {
    type: 'general',
    course: null,
    title: 'Midterm schedule released',
    body: 'Midterms run over two weeks. Each exam is in the course’s usual room unless announced otherwise.',
    postedDay: -6,
    pinned: true,
    by: 'class_rep',
  },
  {
    type: 'material',
    course: 'CS-341',
    title: 'Week 9 slides: evaluation methods',
    body: 'Slides and the heuristic evaluation template are now available.',
    postedDay: -4,
    links: [
      { label: 'Week 9 slides', url: 'https://northfield.example/hci/week-9-slides.pdf' },
      {
        label: 'Evaluation template',
        url: 'https://northfield.example/hci/heuristics-template.docx',
      },
    ],
    by: 'instructor',
  },
  {
    type: 'cancellation',
    course: 'CS-385',
    title: 'Next Networks session cancelled',
    body: 'Dr. Hassan is at a conference. Use the time to start Assignment 3.',
    postedDay: -2,
    appliesToNextSession: true,
    by: 'class_rep',
  },
  {
    type: 'venue_change',
    course: 'CS-341',
    title: 'Next HCI session moves to Auditorium 2',
    body: 'The next session is in Auditorium 2 because of a guest talk on accessibility.',
    postedDay: 0,
    appliesToNextSession: true,
    venue: 'Auditorium 2',
    by: 'instructor',
  },
];

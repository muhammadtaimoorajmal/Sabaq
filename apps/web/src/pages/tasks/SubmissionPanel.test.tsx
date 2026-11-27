import type { AgendaTask, NamingValues, SubmissionRule } from '@sabaq/shared';
import { screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { formatSize, readFileKind } from '../../lib/files';
import { renderWithProviders } from '../../test/render';
import { SubmissionChecker } from './SubmissionPanel';

const MB = 1024 * 1024;
const DUE = '2026-11-26T18:59:00.000Z';
const BEFORE = new Date('2026-11-26T05:00:00.000Z');
const TWO_HOURS_LATE = new Date('2026-11-26T20:59:00.000Z');

const RULE: SubmissionRule = {
  namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
  caseSensitive: false,
  allowedExtensions: ['pdf', 'docx'],
  maxSizeMB: 10,
  channel: { kind: 'email', label: null, url: 'https://forms.example.edu/lab-11' },
  latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
};
const VALUES: NamingValues = { TASK_NO: '11', STUDENT_ID: 'NU', SECTION: '5A' };

const ascii = (text: string) => new Uint8Array(Array.from(text, (c) => c.charCodeAt(0)));
const PDF = ascii('%PDF-1.7\n');
const RAR = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
const ELF = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01]);

const task = (rule: SubmissionRule): AgendaTask => ({
  id: '6741f0c2a1b2c3d4e5f60c02',
  classId: null,
  ownerId: null,
  announcementId: null,
  title: 'Lab 11',
  type: 'lab',
  dueAt: DUE,
  description: '',
  courseId: null,
  effort: null,
  submissionRule: rule,
  createdAt: DUE,
  updatedAt: DUE,
  completedAt: null,
  course: null,
  className: null,
  classSection: null,
  canManage: false,
  canEditRule: false,
});

interface Case {
  name: string;
  rule?: Partial<SubmissionRule>;
  file: string;
  bytes?: Uint8Array<ArrayBuffer>;
  size?: number;
  now?: Date;
  values?: NamingValues;
  verdict: string;
  texts: string[];
}

const CASES: Case[] = [
  {
    name: 'capital letters that must match',
    rule: { caseSensitive: true },
    file: 'lab11_nu_5a.pdf',
    verdict: 'Fix 1 problem before submitting',
    texts: ['Capital letters must match exactly: Lab11_NU_5A.'],
  },
  {
    name: 'capital letters that may differ',
    file: 'lab11_nu_5a.pdf',
    verdict: 'Ready to submit',
    texts: ['Capital letters differ from Lab11_NU_5A, which is allowed.'],
  },
  {
    name: 'no extension',
    file: 'Lab11_NU_5A',
    verdict: 'Fix 1 problem before submitting',
    texts: [
      'The file has no extension. Accepted: PDF or DOCX.',
      'Save or export it as PDF from the program you made it in. Renaming a file does not change its format.',
    ],
  },
  {
    name: 'a type that is not accepted',
    file: 'Lab11_NU_5A.rar',
    bytes: RAR,
    verdict: 'Fix 1 problem before submitting',
    texts: ['RAR files are not accepted. Accepted: PDF or DOCX.', 'Lab11_NU_5A.pdf'],
  },
  {
    name: 'a file over the limit',
    file: 'Lab11_NU_5A.pdf',
    size: 11 * MB,
    verdict: 'Fix 1 problem before submitting',
    texts: [
      'The file is 11 MB, over the 10 MB limit.',
      'Compress the images in it, or export it at a lower quality, then check again.',
    ],
  },
  {
    name: 'a compiled file instead of source code',
    rule: { namingPattern: null, allowedExtensions: ['py'], maxSizeMB: null },
    file: 'main.py',
    bytes: ELF,
    verdict: 'Check 1 thing before submitting',
    texts: [
      'This does not look like a plain text file.',
      'Make sure you chose the source file, not a compiled or exported one.',
      'Size 6 bytes.',
    ],
  },
  {
    name: 'a closed deadline',
    file: 'Lab11_NU_5A.pdf',
    now: TWO_HOURS_LATE,
    verdict: 'Fix 1 problem before submitting',
    texts: [
      'The deadline passed 2 hours ago and late work is not accepted.',
      'Contact your instructor before submitting.',
    ],
  },
  {
    name: 'a late penalty',
    rule: { latePolicy: { kind: 'penalty', graceMinutes: 0, penaltyPercent: 10 } },
    file: 'Lab11_NU_5A.pdf',
    now: TWO_HOURS_LATE,
    verdict: 'Check 1 thing before submitting',
    texts: ['Late: the deadline passed 2 hours ago. A 10% penalty applies.'],
  },
  {
    name: 'the grace period',
    rule: { latePolicy: { kind: 'not_accepted', graceMinutes: 30 } },
    file: 'Lab11_NU_5A.pdf',
    now: new Date('2026-11-26T19:04:00.000Z'),
    verdict: 'Check 1 thing before submitting',
    texts: ['The deadline passed 5 minutes ago, but within the grace period.'],
  },
  {
    name: 'accepted late work',
    rule: { latePolicy: { kind: 'accepted', graceMinutes: 0 } },
    file: 'Lab11_NU_5A.pdf',
    now: TWO_HOURS_LATE,
    verdict: 'Check 1 thing before submitting',
    texts: ['Late: the deadline passed 2 hours ago. Late work is still accepted.'],
  },
  {
    name: 'a name that cannot match without the student’s details',
    file: 'homework.pdf',
    values: { TASK_NO: '11', SECTION: '5A' },
    verdict: 'Fix 1 problem before submitting',
    texts: [
      'The file name does not follow the rule Lab{TASK_NO}_{STUDENT_ID}_{SECTION}.',
      'Add your student ID in your profile to check the name fully.',
    ],
  },
  {
    name: 'a section the class has not set',
    file: 'Lab11_NU_5B.pdf',
    values: { TASK_NO: '11', STUDENT_ID: 'NU', SECTION: null },
    verdict: 'Check 1 thing before submitting',
    texts: [
      'The name looks right, but the section could not be checked.',
      'Ask your class representative to set the section for this task.',
    ],
  },
  {
    name: 'a correct file, with a link to where it goes',
    file: 'Lab11_NU_5A.pdf',
    verdict: 'Ready to submit',
    texts: ['Size 9 bytes, within the 10 MB limit.', 'Submit it by e-mail.'],
  },
];

describe('the Submission Checker in words', () => {
  it.each(CASES)('explains $name', async (item) => {
    const { user, container } = renderWithProviders(
      <MemoryRouter>
        <SubmissionChecker
          task={task({ ...RULE, ...item.rule })}
          values={item.values ?? VALUES}
          now={item.now ?? BEFORE}
        />
      </MemoryRouter>,
    );
    const file = new File([item.bytes ?? PDF], item.file);
    if (item.size !== undefined) Object.defineProperty(file, 'size', { value: item.size });
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, file);
    const verdict = await screen.findByRole('heading', { name: item.verdict });
    const results = verdict.closest('section') as HTMLElement;
    for (const text of item.texts) expect(within(results).getByText(text)).toBeVisible();
  });

  it('links to the submission page from the results', async () => {
    const { user, container } = renderWithProviders(
      <MemoryRouter>
        <SubmissionChecker task={task(RULE)} values={VALUES} now={BEFORE} />
      </MemoryRouter>,
    );
    await user.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      new File([PDF], 'Lab11_NU_5A.pdf'),
    );
    await screen.findByRole('heading', { name: 'Ready to submit' });
    expect(screen.getByRole('link', { name: 'Open the submission page' })).toHaveAttribute(
      'href',
      'https://forms.example.edu/lab-11',
    );
  });
});

describe('reading files on the device', () => {
  it('reads the real kind from the first bytes, and gives up quietly when it cannot', async () => {
    expect(await readFileKind(new Blob([PDF]))).toBe('pdf');
    const unreadable = new Blob([PDF]);
    unreadable.slice = () => {
      throw new Error('The file could not be read.');
    };
    expect(await readFileKind(unreadable)).toBeUndefined();
  });

  it('formats sizes the way people read them', () => {
    expect(formatSize(900, 'en')).toBe('900 bytes');
    expect(formatSize(1, 'en')).toBe('1 byte');
    expect(formatSize(1536, 'en')).toBe('1.5 kB');
    expect(formatSize(640 * 1024, 'en')).toBe('640 kB');
    expect(formatSize(2.44 * MB, 'en')).toBe('2.4 MB');
    expect(formatSize(25 * MB, 'en')).toBe('25 MB');
  });
});

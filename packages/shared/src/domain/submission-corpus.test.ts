/**
 * The Submission Checker's acceptance suite: the mistakes students really make, and files that
 * follow the rules. Every violation must be caught, and no correct file may raise an alarm
 * (a false alarm teaches people to ignore the checker).
 */
import { describe, expect, it } from 'vitest';
import { FILE_BYTES } from '../test/file-samples.js';
import { type FileKind, sniffFileKind } from './file-kind.js';
import {
  checkSubmission,
  namingValues,
  type NamingValues,
  type SubmissionRuleLike,
} from './submission.js';

const MB = 1024 * 1024;
const DUE = '2026-11-27T18:59:00Z';
const BEFORE = new Date('2026-11-27T10:00:00Z');

const LAB: SubmissionRuleLike = {
  namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
  caseSensitive: false,
  allowedExtensions: ['pdf'],
  maxSizeMB: 10,
  channel: { kind: 'lms', label: 'Week 11 folder', url: null },
  latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
};
const PROJECT: SubmissionRuleLike = {
  namingPattern: '{COURSE_CODE}_Project_{STUDENT_NAME}',
  caseSensitive: true,
  allowedExtensions: ['zip', 'pdf'],
  maxSizeMB: 25,
  channel: { kind: 'email', label: null, url: null },
  latePolicy: { kind: 'penalty', graceMinutes: 15, penaltyPercent: 10 },
};
const CODE: SubmissionRuleLike = {
  namingPattern: null,
  caseSensitive: false,
  allowedExtensions: ['py', 'ipynb'],
  maxSizeMB: 2,
  channel: { kind: 'lms', label: null, url: null },
  latePolicy: { kind: 'accepted', graceMinutes: 0 },
};
const REPORT: SubmissionRuleLike = {
  namingPattern: 'A{TASK_NO}_{STUDENT_ID}',
  caseSensitive: false,
  allowedExtensions: ['docx', 'pdf'],
  maxSizeMB: 5,
  channel: { kind: 'in_person', label: null, url: null },
  latePolicy: { kind: 'not_accepted', graceMinutes: 10 },
};

const STUDENT = { studentId: '70012345', name: 'Ayesha Khan', section: '5A' };
const values = (title: string, courseCode: string | null = 'CS301'): NamingValues =>
  namingValues({ ...STUDENT, courseCode, title });

interface Case {
  name: string;
  rule: SubmissionRuleLike;
  title: string;
  file: string;
  kind: FileKind;
  size?: number;
  now?: Date;
}
interface Violation extends Case {
  /** Every problem the checker must report, as `check.code`. */
  expect: string[];
}

const kindOf = (kind: FileKind) => (kind === 'empty' ? 'empty' : sniffFileKind(FILE_BYTES[kind]));

function run(item: Case) {
  return checkSubmission({
    file: { name: item.file, size: item.size ?? 2 * MB, kind: kindOf(item.kind) },
    rule: item.rule,
    dueAt: DUE,
    now: item.now ?? BEFORE,
    values: values(item.title),
  });
}

const flagged = (result: ReturnType<typeof run>) =>
  result.checks
    .filter((check) => check.status === 'fail' || check.status === 'warn')
    .map((check) => check.code);

const VIOLATIONS: Violation[] = [
  {
    name: 'spaces instead of underscores',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11 70012345 5A.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'dashes instead of underscores',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11-70012345-5A.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'a second download, "(1)"',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A (1).pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'a copy made by the file manager',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A - Copy.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'the extension typed twice',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'the wrong lab number',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab10_70012345_5A.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'a classmate’s student ID',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012399_5A.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'the section left out',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'the default name from the editor',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Document1.pdf',
    kind: 'pdf',
    expect: ['name.mismatch'],
  },
  {
    name: 'a Word file where PDF is required',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.docx',
    kind: 'docx',
    expect: ['extension.not_allowed'],
  },
  {
    name: 'a Word file renamed to .pdf',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'docx',
    expect: ['content.mismatch'],
  },
  {
    name: 'a phone photo renamed to .pdf',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'jpeg',
    expect: ['content.mismatch'],
  },
  {
    name: 'no extension at all',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A',
    kind: 'pdf',
    expect: ['extension.missing'],
  },
  {
    name: 'a scan that is too large',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'pdf',
    size: 14 * MB,
    expect: ['size.too_large'],
  },
  {
    name: 'an empty file',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'empty',
    size: 0,
    expect: ['size.empty'],
  },
  {
    name: 'after a deadline that accepts no late work',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'pdf',
    now: new Date('2026-11-27T19:30:00Z'),
    expect: ['deadline.closed'],
  },
  {
    name: 'several mistakes at once',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'lab 11 final.docx',
    kind: 'docx',
    size: 12 * MB,
    expect: ['name.mismatch', 'extension.not_allowed', 'size.too_large'],
  },
  {
    name: 'capital letters where the rule is case-sensitive',
    rule: PROJECT,
    title: 'Final project',
    file: 'cs301_project_ayeshakhan.zip',
    kind: 'zip',
    expect: ['name.case_mismatch'],
  },
  {
    name: 'the name written with a space',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_Ayesha Khan.zip',
    kind: 'zip',
    expect: ['name.mismatch'],
  },
  {
    name: 'a RAR archive where ZIP or PDF is required',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.rar',
    kind: 'rar',
    expect: ['extension.not_allowed'],
  },
  {
    name: 'a RAR archive renamed to .zip',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.zip',
    kind: 'rar',
    expect: ['content.mismatch'],
  },
  {
    name: 'late, with a penalty',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.zip',
    kind: 'zip',
    now: new Date('2026-11-27T20:00:00Z'),
    expect: ['deadline.late_penalty'],
  },
  {
    name: 'a few minutes late, within the grace period',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.zip',
    kind: 'zip',
    now: new Date('2026-11-27T19:05:00Z'),
    expect: ['deadline.grace_period'],
  },
  {
    name: 'a notebook exported as a PDF but named .ipynb',
    rule: CODE,
    title: 'Exercise 4',
    file: 'exercise4.ipynb',
    kind: 'pdf',
    expect: ['content.mismatch'],
  },
  {
    name: 'a compiled file named .py',
    rule: CODE,
    title: 'Exercise 4',
    file: 'exercise4.py',
    kind: 'binary',
    expect: ['content.not_text'],
  },
  {
    name: 'a zipped folder where code files are required',
    rule: CODE,
    title: 'Exercise 4',
    file: 'exercise4.zip',
    kind: 'zip',
    expect: ['extension.not_allowed'],
  },
  {
    name: 'code that is too large (data files included)',
    rule: CODE,
    title: 'Exercise 4',
    file: 'exercise4.ipynb',
    kind: 'text',
    size: 3 * MB,
    expect: ['size.too_large'],
  },
  {
    name: 'late when late work is accepted',
    rule: CODE,
    title: 'Exercise 4',
    file: 'exercise4.py',
    kind: 'text',
    now: new Date('2026-11-28T08:00:00Z'),
    expect: ['deadline.late_accepted'],
  },
  {
    name: 'an old .doc file renamed to .docx',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A3_70012345.docx',
    kind: 'legacy_office',
    expect: ['content.mismatch'],
  },
  {
    name: 'a spreadsheet renamed to .docx',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A3_70012345.docx',
    kind: 'xlsx',
    expect: ['content.mismatch'],
  },
  {
    name: 'the assignment number missing',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A_70012345.docx',
    kind: 'docx',
    expect: ['name.mismatch'],
  },
  {
    name: 'past the grace period',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A3_70012345.pdf',
    kind: 'pdf',
    now: new Date('2026-11-27T19:10:00Z'),
    expect: ['deadline.closed'],
  },
];

const CORRECT: Case[] = [
  {
    name: 'the lab report',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'pdf',
  },
  {
    name: 'small letters where case does not matter',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'lab11_70012345_5a.pdf',
    kind: 'pdf',
  },
  {
    name: 'the extension in capitals',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.PDF',
    kind: 'pdf',
  },
  {
    name: 'a path added by the browser',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'C:\\fakepath\\Lab11_70012345_5A.pdf',
    kind: 'pdf',
  },
  {
    name: 'exactly at the size limit',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'pdf',
    size: 10 * MB,
  },
  {
    name: 'one minute before the deadline',
    rule: LAB,
    title: 'Lab 11: Joins',
    file: 'Lab11_70012345_5A.pdf',
    kind: 'pdf',
    now: new Date('2026-11-27T18:58:00Z'),
  },
  {
    name: 'a lab whose title has a time in it',
    rule: LAB,
    title: 'Lab 4 (due 11:59 PM)',
    file: 'Lab4_70012345_5A.pdf',
    kind: 'pdf',
  },
  {
    name: 'the project archive',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.zip',
    kind: 'zip',
  },
  {
    name: 'the project report as a PDF',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.pdf',
    kind: 'pdf',
  },
  {
    name: 'a Word document submitted as a ZIP',
    rule: PROJECT,
    title: 'Final project',
    file: 'CS301_Project_AyeshaKhan.zip',
    kind: 'docx',
  },
  { name: 'a Python file', rule: CODE, title: 'Exercise 4', file: 'exercise4.py', kind: 'text' },
  {
    name: 'a notebook with any name',
    rule: CODE,
    title: 'Exercise 4',
    file: 'my notebook (final).ipynb',
    kind: 'text',
  },
  {
    name: 'a Word report',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A3_70012345.docx',
    kind: 'docx',
  },
  {
    name: 'a Word report from a program that orders files differently',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'A3_70012345.docx',
    kind: 'zip',
  },
  {
    name: 'a PDF report',
    rule: REPORT,
    title: 'Assignment 3: Literature review',
    file: 'a3_70012345.pdf',
    kind: 'pdf',
  },
];

describe('the Submission Checker acceptance suite', () => {
  it.each(VIOLATIONS)('catches $name', (item) => {
    const result = run(item);
    expect(flagged(result)).toEqual(item.expect);
    expect(result.verdict).not.toBe('ready');
  });

  it.each(CORRECT)('raises no alarm for $name', (item) => {
    const result = run(item);
    expect(flagged(result)).toEqual([]);
    expect(result.verdict).toBe('ready');
  });

  it('catches every violation, with zero false alarms', () => {
    const caught = VIOLATIONS.filter((item) =>
      item.expect.every((code) => flagged(run(item)).includes(code)),
    ).length;
    const falseAlarms = CORRECT.filter((item) => run(item).verdict !== 'ready').length;
    expect({ caught, of: VIOLATIONS.length, falseAlarms }).toEqual({
      caught: VIOLATIONS.length,
      of: VIOLATIONS.length,
      falseAlarms: 0,
    });
  });

  it('gives the exact name to use and why the name is wrong', () => {
    const hint = (file: string) =>
      run({ name: '', rule: LAB, title: 'Lab 11', file, kind: 'pdf' }).checks[0]?.params.hint;
    expect(hint('Lab11_70012345_5A (1).pdf')).toBe('duplicate_suffix');
    expect(hint('Lab11_70012345_5A - Copy.pdf')).toBe('duplicate_suffix');
    expect(hint('Lab11_70012345_5A_copy.pdf')).toBe('duplicate_suffix');
    expect(hint('Lab11_70012345_5A.pdf.pdf')).toBe('double_extension');
    expect(hint('Lab11 70012345 5A.pdf')).toBe('whitespace');
    expect(hint('Lab11-70012345-5A.pdf')).toBe('separators');
    expect(hint('Document1.pdf')).toBeNull();

    const fixed = run({
      name: '',
      rule: LAB,
      title: 'Lab 11',
      file: 'lab 11.docx',
      kind: 'docx',
    });
    expect(fixed.expectedFileName).toBe('Lab11_70012345_5A.pdf');
  });

  it('suggests the extension that matches the real content', () => {
    const result = run({
      name: '',
      rule: LAB,
      title: 'Lab 11',
      file: 'Lab11_70012345_5A.pdf',
      kind: 'jpeg',
    });
    expect(result.checks.find((check) => check.id === 'content')?.params).toEqual({
      extension: 'pdf',
      actual: 'jpeg',
      suggested: 'jpg',
    });
  });
});

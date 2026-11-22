import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './analyze-survey.mjs';
import {
  QUESTIONS,
  barChart,
  evaluateHypotheses,
  matchMultiple,
  matchSingle,
  median,
  parseCsv,
  readResponses,
  renderReport,
} from './survey.mjs';

const HEADER = QUESTIONS.map((question) => question.id);

/**
 * Builds a CSV from partial synthetic rows (test fixtures only, not research data).
 * @param {Record<string, string>[]} rows
 */
function csv(rows) {
  /** @param {string} value */
  const quote = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [
    HEADER.join(','),
    ...rows.map((row) => HEADER.map((column) => quote(row[column] ?? '')).join(',')),
  ].join('\n');
}

/** @param {Record<string, string>[]} rows */
const responsesOf = (rows) => readResponses(parseCsv(csv(rows)));

/**
 * `count` synthetic students who all answer the same way.
 * @param {number} count @param {Record<string, string>} answers
 * @returns {Record<string, string>[]}
 */
const students = (count, answers) =>
  Array.from({ length: count }, (_, index) => ({
    response_id: String(index + 1),
    q1_role: 'Student',
    ...answers,
  }));

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, line breaks in fields, CRLF and a byte-order mark', () => {
    const text = '\uFEFFa,b,c\r\n1,"two, with comma","say ""hi"""\r\n3,"multi\nline",\n\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, with comma', 'say "hi"'],
      ['3', 'multi\nline', ''],
    ]);
  });

  it('keeps a final row without a trailing line break', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('matching answers', () => {
  it('ignores case, spacing and dash styles', () => {
    expect(matchSingle(' 2-3 TIMES ', ['Never', '2–3 times'])).toBe('2–3 times');
    expect(matchSingle('sometimes', ['Never', 'Often'])).toBeNull();
  });

  it('finds choices whose labels contain commas, and reports leftovers', () => {
    const options = ['Email', 'Chat groups (WhatsApp, Telegram …)', 'Said in class'];
    expect(matchMultiple('Chat groups (WhatsApp, Telegram ...), Email', options)).toEqual({
      selected: ['Email', 'Chat groups (WhatsApp, Telegram …)'],
      unknown: [],
    });
    expect(matchMultiple('Email; carrier pigeon', options)).toEqual({
      selected: ['Email'],
      unknown: ['carrier pigeon'],
    });
  });

  it('computes medians', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('readResponses', () => {
  it('reports missing and unknown columns, invalid answers and missing roles', () => {
    const table = parseCsv(
      'response_id,q1_role,q8_late_awareness,q10_know_next_7_days,email\n1,Student,Sometimes,7,a@b.c\n2,,Never,3,',
    );
    const { problems } = readResponses(table);
    const messages = problems.map(
      (problem) => `${problem.row}:${problem.column}:${problem.message}`,
    );
    expect(messages).toContain('1:q2_year:column is missing');
    expect(messages).toContain(
      '1:email:unknown column (remove identifying columns before committing)',
    );
    expect(messages).toContain('2:q8_late_awareness:"Sometimes" is not an option');
    expect(messages).toContain('2:q10_know_next_7_days:"7" is not a whole number from 1 to 5');
    expect(messages).toContain('3:q1_role:role is required');
  });
});

describe('evaluateHypotheses', () => {
  const verdicts = (/** @type {Record<string, string>[]} */ rows) =>
    Object.fromEntries(
      evaluateHypotheses(responsesOf(rows).responses).map((h) => [h.id, h.verdict]),
    );

  it('supports every hypothesis when the thresholds are met', () => {
    const rows = [
      ...students(12, {
        q8_late_awareness: '2–3 times',
        q9_missed_deadline: 'No',
        q10_know_next_7_days: '2',
        q11_marks_lost_for: 'Wrong file name, Late by only a few minutes',
        q13_confident_follow_instructions: '3',
        q14_deadline_clusters: 'Often',
        q16_see_busy_weeks: '2',
        q21_why_stopped: 'Too much manual entry, Too complicated',
      }),
      ...Array.from({ length: 3 }, () => ({
        q1_role: 'Instructor or teaching staff',
        q17_know_who_saw: "I don't know",
        q18_repeat_questions_per_week: '1–5',
        q19_confident_reach: '3',
      })),
    ];
    expect(verdicts(rows)).toEqual({
      H1: 'supported',
      H2: 'supported',
      H3: 'supported',
      H4: 'supported',
      H5: 'supported',
    });
  });

  it('rejects hypotheses when the data contradicts them', () => {
    const rows = [
      ...students(12, {
        q8_late_awareness: 'Never',
        q9_missed_deadline: 'No',
        q10_know_next_7_days: '5',
        q11_marks_lost_for: 'None of these',
        q13_confident_follow_instructions: '5',
        q14_deadline_clusters: 'Rarely',
        q16_see_busy_weeks: '4',
        q21_why_stopped: 'Too complicated, No useful reminders',
      }),
      ...Array.from({ length: 3 }, () => ({
        q1_role: 'Instructor or teaching staff',
        q17_know_who_saw: 'LMS statistics',
        q18_repeat_questions_per_week: 'None',
        q19_confident_reach: '5',
      })),
    ];
    expect(verdicts(rows)).toEqual({
      H1: 'not supported',
      H2: 'not supported',
      H3: 'not supported',
      H4: 'not supported',
      H5: 'not supported',
    });
  });

  it('accepts either alternative of an "or" rule, but still requires the median', () => {
    const missedOnly = students(12, {
      q8_late_awareness: 'Never',
      q9_missed_deadline: 'Once',
      q10_know_next_7_days: '3',
    });
    expect(verdicts(missedOnly).H1).toBe('supported');
    const confident = students(12, {
      q8_late_awareness: '4 or more times',
      q10_know_next_7_days: '4',
    });
    expect(verdicts(confident).H1).toBe('not supported');
  });

  it('counts class representatives as both students and senders', () => {
    const reps = Array.from({ length: 3 }, () => ({
      q1_role: 'Class representative',
      q18_repeat_questions_per_week: '16 or more',
      q19_confident_reach: '2',
    }));
    expect(verdicts(reps).H4).toBe('supported');
  });

  it('refuses a verdict when too few people answered', () => {
    const few = students(4, { q8_late_awareness: '4 or more times', q10_know_next_7_days: '1' });
    expect(verdicts(few)).toEqual({
      H1: 'insufficient data',
      H2: 'insufficient data',
      H3: 'insufficient data',
      H4: 'insufficient data',
      H5: 'insufficient data',
    });
  });

  it('treats ties for second place as among the two most selected reasons', () => {
    const rows = [
      ...students(5, { q21_why_stopped: 'I forgot to keep it updated' }),
      ...students(3, { q21_why_stopped: 'Too complicated' }),
      ...students(3, { q21_why_stopped: 'Information changed and it became wrong' }),
      ...students(2, { q21_why_stopped: 'I still use one' }),
    ];
    const result = evaluateHypotheses(responsesOf(rows).responses).find((h) => h.id === 'H5');
    expect(result?.respondents).toBe(11);
    expect(result?.verdict).toBe('supported');
  });
});

describe('renderReport', () => {
  it('writes verdicts, charts, tables, open answers and data problems', () => {
    const rows = students(2, {
      q8_late_awareness: 'Once',
      q10_know_next_7_days: '4',
      q25_biggest_frustration: 'Deadlines are lost in the group chat',
    });
    rows.push({ response_id: '9', q1_role: 'Student', q8_late_awareness: 'Sometimes' });
    const { responses, problems } = responsesOf(rows);
    const report = renderReport(responses, problems);
    expect(report).toContain('**Respondents:** 3');
    expect(report).toContain('Fewer than the planned 30 responses');
    expect(report).toContain('| **H1** Students learn about deadlines late');
    expect(report).toContain('xychart-beta');
    // The invalid third answer does not count as answered.
    expect(report).toContain('| Once | 2 | 100% |');
    expect(report).toContain('- **R1-Q25** Deadlines are lost in the group chat');
    expect(report).toContain('## Data problems');
    expect(report).not.toMatch(/\n{3,}/);
  });

  it('shortens long chart labels', () => {
    expect(barChart('T', [['A label that is far too long to fit on an axis', 1]])).toContain(
      '"A label that is far too lon…"',
    );
  });
});

describe('runCli', () => {
  let directory = '';
  /** @type {string[]} */
  let lines = [];
  const output = {
    /** @param {string} message */
    log: (message) => lines.push(message),
    /** @param {string} message */
    error: (message) => lines.push(`error: ${message}`),
  };

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), 'survey-'));
    lines = [];
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it('explains how to add data when there is none', () => {
    expect(runCli([path.join(directory, 'missing.csv')], output)).toBe(1);
    expect(lines[0]).toContain('No survey data');
  });

  it('writes the report and fails while the data has problems', () => {
    const input = path.join(directory, 'responses.csv');
    const report = path.join(directory, 'out', 'report.md');
    writeFileSync(input, csv(students(3, { q8_late_awareness: 'Never' })));
    expect(runCli([input, report], output)).toBe(0);
    expect(lines[0]).toContain('3 responses (3 students, 0 senders)');
    expect(readFileSync(report, 'utf8')).toContain('# Survey analysis');

    writeFileSync(input, csv(students(1, { q8_late_awareness: 'Sometimes' })));
    expect(runCli([input, report], output)).toBe(1);
    expect(lines.at(-1)).toContain('"Sometimes" is not an option');
  });
});

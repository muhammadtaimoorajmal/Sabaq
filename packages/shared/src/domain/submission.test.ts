import { describe, expect, it } from 'vitest';
import {
  checkSubmission,
  fillNamingPattern,
  normalizeExtension,
  parseNamingPattern,
  splitFileName,
  type SubmissionCheckInput,
  type SubmissionRuleLike,
} from './submission.js';

const MB = 1024 * 1024;

const RULE: SubmissionRuleLike = {
  namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}_{SECTION}',
  caseSensitive: false,
  allowedExtensions: ['pdf', 'docx'],
  maxSizeMB: 10,
  channel: { kind: 'lms', label: 'Upload on the LMS', url: null },
  latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
};

const DUE = '2026-11-25T18:59:00Z';

function run(overrides: Partial<SubmissionCheckInput> & { name?: string; size?: number } = {}) {
  const { name = 'Lab11_12345_CS5-1.pdf', size = MB, ...rest } = overrides;
  return checkSubmission({
    file: { name, size },
    rule: RULE,
    dueAt: DUE,
    now: new Date('2026-11-24T10:00:00Z'),
    values: { TASK_NO: '11', STUDENT_ID: '12345', SECTION: 'CS5-1' },
    ...rest,
  });
}

const byId = (result: ReturnType<typeof run>, id: string) =>
  result.checks.find((check) => check.id === id);

describe('checkSubmission: the happy path', () => {
  it('approves a file that follows every rule', () => {
    const result = run();
    expect(result.verdict).toBe('ready');
    expect(result.expectedFileName).toBe('Lab11_12345_CS5-1.pdf');
    expect(result.checks.map(({ id, status, code }) => ({ id, status, code }))).toEqual([
      { id: 'name', status: 'pass', code: 'name.ok' },
      { id: 'extension', status: 'pass', code: 'extension.ok' },
      { id: 'size', status: 'pass', code: 'size.ok' },
      { id: 'deadline', status: 'pass', code: 'deadline.on_time' },
      { id: 'channel', status: 'info', code: 'channel.lms' },
    ]);
    expect(byId(result, 'deadline')?.params.remainingMs).toBe(
      Date.parse(DUE) - Date.parse('2026-11-24T10:00:00Z'),
    );
    expect(byId(result, 'channel')?.params).toEqual({ label: 'Upload on the LMS', url: null });
  });

  it('ignores directory prefixes that some browsers add', () => {
    expect(run({ name: 'C:\\fakepath\\Lab11_12345_CS5-1.pdf' }).verdict).toBe('ready');
    expect(run({ name: 'uploads/Lab11_12345_CS5-1.pdf' }).verdict).toBe('ready');
  });

  it('treats composed and decomposed accents as the same name', () => {
    const result = run({
      name: 'Jose\u0301.pdf',
      rule: { ...RULE, namingPattern: '{STUDENT_NAME}' },
      values: { STUDENT_NAME: 'Jos\u00e9' },
    });
    expect(byId(result, 'name')?.code).toBe('name.ok');
  });
});

describe('checkSubmission: file names', () => {
  it('warns about capitalization when the rule is not case-sensitive', () => {
    const result = run({ name: 'lab11_12345_cs5-1.pdf' });
    expect(byId(result, 'name')).toMatchObject({ status: 'warn', code: 'name.case_mismatch' });
    expect(result.verdict).toBe('review');
  });

  it('fails capitalization differences when the rule is case-sensitive', () => {
    const result = run({ name: 'lab11_12345_cs5-1.pdf', rule: { ...RULE, caseSensitive: true } });
    expect(byId(result, 'name')).toMatchObject({ status: 'fail', code: 'name.case_mismatch' });
    expect(result.verdict).toBe('fix');
  });

  it.each([
    ['Lab11 12345 CS5-1.pdf', 'whitespace'],
    ['Lab11-12345-CS5-1.PDF', 'separators'],
    ['final version.pdf', 'whitespace'],
    ['final.pdf', null],
  ])('explains why %s is wrong (%s)', (name, hint) => {
    const result = run({ name });
    expect(byId(result, 'name')).toMatchObject({
      status: 'fail',
      code: 'name.mismatch',
      params: { expected: 'Lab11_12345_CS5-1', hint },
    });
    expect(result.expectedFileName).toBe('Lab11_12345_CS5-1.pdf');
  });

  it('checks the pattern shape when some values are unknown', () => {
    const values = { TASK_NO: '11', SECTION: 'CS5-1' };
    const close = run({ name: 'lab11_99999_cs5-1.pdf', values });
    expect(byId(close, 'name')).toMatchObject({
      status: 'warn',
      code: 'name.unverified',
      params: { missing: 'STUDENT_ID' },
    });
    expect(close.expectedFileName).toBeNull();

    const strict = run({
      name: 'lab11_99999_cs5-1.pdf',
      values,
      rule: { ...RULE, caseSensitive: true },
    });
    expect(byId(strict, 'name')?.code).toBe('name.pattern_mismatch');

    const wrong = run({ name: 'homework.pdf', values: {} });
    expect(byId(wrong, 'name')).toMatchObject({
      status: 'fail',
      code: 'name.pattern_mismatch',
      params: { missing: 'TASK_NO,STUDENT_ID,SECTION' },
    });
  });

  it('skips the name check when there is no naming rule', () => {
    const result = run({ name: 'anything.pdf', rule: { ...RULE, namingPattern: null } });
    expect(byId(result, 'name')).toMatchObject({ status: 'skipped', code: 'name.no_rule' });
    expect(result.expectedFileName).toBeNull();
  });

  it('skips the name check when the stored rule is broken', () => {
    const result = run({ rule: { ...RULE, namingPattern: 'Lab{UNKNOWN}' } });
    expect(byId(result, 'name')).toMatchObject({
      status: 'skipped',
      code: 'name.invalid_rule',
      params: { reason: 'pattern.unknown_token' },
    });
  });
});

describe('checkSubmission: extensions', () => {
  it('rejects types that are not allowed and suggests an allowed one', () => {
    const result = run({ name: 'Lab11_12345_CS5-1.zip' });
    expect(byId(result, 'extension')).toMatchObject({
      status: 'fail',
      code: 'extension.not_allowed',
      params: { actual: 'zip', allowed: 'pdf, docx' },
    });
    expect(result.expectedFileName).toBe('Lab11_12345_CS5-1.pdf');
  });

  it('reports files without an extension', () => {
    const result = run({ name: 'Lab11_12345_CS5-1' });
    expect(byId(result, 'name')?.code).toBe('name.ok');
    expect(byId(result, 'extension')?.code).toBe('extension.missing');
    expect(result.expectedFileName).toBe('Lab11_12345_CS5-1.pdf');
  });

  it('recognizes multi-part extensions', () => {
    const result = run({
      name: 'Lab11_12345_CS5-1.tar.gz',
      rule: { ...RULE, allowedExtensions: ['zip', '.TAR.GZ'] },
    });
    expect(byId(result, 'extension')).toMatchObject({
      status: 'pass',
      params: { extension: 'tar.gz' },
    });
    expect(byId(result, 'name')?.code).toBe('name.ok');
  });

  it('handles patterns ending in text and files without any extension', () => {
    const result = run({
      name: '12345_report',
      rule: { ...RULE, namingPattern: '{STUDENT_ID}_report', allowedExtensions: [] },
    });
    expect(byId(result, 'name')?.code).toBe('name.ok');
    expect(result.expectedFileName).toBe('12345_report');
  });

  it('prefers the longest matching extension', () => {
    expect(splitFileName('Lab11_12345_CS5-1.tar.gz', ['gz', 'tar.gz'])).toEqual({
      base: 'Lab11_12345_CS5-1',
      extension: 'tar.gz',
    });
  });

  it('ignores blank entries in the allowed list', () => {
    const result = run({
      name: 'notes.txt',
      rule: { ...RULE, namingPattern: null, allowedExtensions: [' ', '.'] },
    });
    expect(byId(result, 'extension')?.code).toBe('extension.no_rule');
  });

  it('accepts any type when the rule lists none', () => {
    const result = run({ name: 'Lab11_12345_CS5-1.png', rule: { ...RULE, allowedExtensions: [] } });
    expect(byId(result, 'extension')).toMatchObject({
      status: 'skipped',
      code: 'extension.no_rule',
    });
    expect(result.expectedFileName).toBe('Lab11_12345_CS5-1.png');
  });
});

describe('checkSubmission: size', () => {
  it('rejects empty files', () => {
    expect(byId(run({ size: 0 }), 'size')).toMatchObject({ status: 'fail', code: 'size.empty' });
  });

  it('rejects files over the limit with both sizes in megabytes', () => {
    expect(byId(run({ size: 11.5 * MB }), 'size')).toMatchObject({
      status: 'fail',
      code: 'size.too_large',
      params: { actualMB: 11.5, maxMB: 10 },
    });
  });

  it('accepts any size when there is no limit', () => {
    const result = run({ size: 900 * MB, rule: { ...RULE, maxSizeMB: null } });
    expect(byId(result, 'size')).toMatchObject({ status: 'pass', params: { actualMB: 900 } });
  });
});

describe('checkSubmission: deadline', () => {
  const after = (minutes: number) => new Date(Date.parse(DUE) + minutes * 60_000);

  it('skips the check when there is no deadline', () => {
    expect(byId(run({ dueAt: null }), 'deadline')?.code).toBe('deadline.none');
  });

  it('warns inside the grace period', () => {
    const result = run({
      now: after(5),
      rule: { ...RULE, latePolicy: { kind: 'not_accepted', graceMinutes: 10 } },
    });
    expect(byId(result, 'deadline')).toMatchObject({
      status: 'warn',
      code: 'deadline.grace_period',
      params: { lateMs: 300_000 },
    });
  });

  it('fails once late submissions are no longer accepted', () => {
    expect(byId(run({ now: after(1) }), 'deadline')).toMatchObject({
      status: 'fail',
      code: 'deadline.closed',
    });
  });

  it('warns about late penalties', () => {
    const result = run({
      now: after(60),
      rule: { ...RULE, latePolicy: { kind: 'penalty', graceMinutes: 0, penaltyPercent: 20 } },
    });
    expect(byId(result, 'deadline')).toMatchObject({
      status: 'warn',
      code: 'deadline.late_penalty',
      params: { penaltyPercent: 20 },
    });
  });

  it('warns when late work is accepted without penalty', () => {
    const result = run({
      now: after(60),
      rule: { ...RULE, latePolicy: { kind: 'accepted', graceMinutes: 0 } },
    });
    expect(byId(result, 'deadline')).toMatchObject({
      status: 'warn',
      code: 'deadline.late_accepted',
    });
  });
});

describe('parseNamingPattern', () => {
  it('splits literals and tokens, accepting lower-case token names', () => {
    expect(parseNamingPattern('Lab{task_no}_{ STUDENT_ID }')).toEqual({
      ok: true,
      segments: [
        { kind: 'literal', value: 'Lab' },
        { kind: 'token', token: 'TASK_NO' },
        { kind: 'literal', value: '_' },
        { kind: 'token', token: 'STUDENT_ID' },
      ],
    });
  });

  it.each([
    ['   ', { code: 'pattern.empty' }],
    ['Lab{TASK_NO', { code: 'pattern.unbalanced_brace' }],
    ['Lab{{TASK_NO}', { code: 'pattern.unbalanced_brace' }],
    ['Lab}', { code: 'pattern.unbalanced_brace' }],
    ['Lab{GRADE}', { code: 'pattern.unknown_token', token: 'GRADE' }],
    ['Lab/{TASK_NO}', { code: 'pattern.invalid_character', character: '/' }],
  ])('rejects %j', (pattern, error) => {
    expect(parseNamingPattern(pattern)).toEqual({ ok: false, error });
  });
});

describe('helpers', () => {
  it('lists each missing token once', () => {
    const parsed = parseNamingPattern('{STUDENT_ID}-{STUDENT_ID}-{SECTION}');
    if (!parsed.ok) throw new Error('pattern should parse');
    expect(fillNamingPattern(parsed.segments, { SECTION: ' A ', STUDENT_ID: '  ' })).toEqual({
      name: '--A',
      missing: ['STUDENT_ID'],
    });
  });

  it('normalizes extensions', () => {
    expect(normalizeExtension(' .PDF ')).toBe('pdf');
  });

  it.each([
    ['report.final.PDF', [], { base: 'report.final', extension: 'pdf' }],
    ['.gitignore', [], { base: '.gitignore', extension: '' }],
    ['trailing.', [], { base: 'trailing.', extension: '' }],
    ['.pdf', ['pdf'], { base: '.pdf', extension: '' }],
    ['docs/archive.TAR.GZ', ['tar.gz'], { base: 'archive', extension: 'tar.gz' }],
  ])('splits %j', (name, known, expected) => {
    expect(splitFileName(name, known)).toEqual(expected);
  });
});

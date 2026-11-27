/**
 * The Submission Checker compares a file against an assignment's submission rules
 * *before* the student uploads it, so avoidable mistakes never cost marks.
 *
 * Every result is a machine-readable `code` with `params`, never an English sentence,
 * so the interface can present it in any language.
 */
import { expectedKinds, type FileKind, usualExtension } from './file-kind.js';

/** Placeholders an instructor can use in a file-naming pattern, e.g. `Lab{TASK_NO}_{STUDENT_ID}`. */
export const NAMING_TOKENS = [
  'STUDENT_ID',
  'STUDENT_NAME',
  'SECTION',
  'COURSE_CODE',
  'TASK_NO',
] as const;
export type NamingToken = (typeof NAMING_TOKENS)[number];
export type NamingValues = Partial<Record<NamingToken, string | null>>;

export type PatternSegment =
  { kind: 'literal'; value: string } | { kind: 'token'; token: NamingToken };

export type PatternError =
  | { code: 'pattern.empty' }
  | { code: 'pattern.unbalanced_brace' }
  | { code: 'pattern.unknown_token'; token: string }
  | { code: 'pattern.invalid_character'; character: string };

export type PatternParseResult =
  { ok: true; segments: PatternSegment[] } | { ok: false; error: PatternError };

/** Characters that are not allowed in file names on common operating systems. */
const INVALID_FILE_NAME_CHARACTER = /[\\/:*?"<>|\p{Cc}]/u;

function isNamingToken(value: string): value is NamingToken {
  return (NAMING_TOKENS as readonly string[]).includes(value);
}

/** Splits a naming pattern into literal text and tokens, validating it on the way. */
export function parseNamingPattern(pattern: string): PatternParseResult {
  if (pattern.trim() === '') return { ok: false, error: { code: 'pattern.empty' } };

  const segments: PatternSegment[] = [];
  let literal = '';
  let index = 0;
  while (index < pattern.length) {
    const character = pattern.charAt(index);
    if (character === '{') {
      const close = pattern.indexOf('}', index);
      const nextOpen = pattern.indexOf('{', index + 1);
      if (close === -1 || (nextOpen !== -1 && nextOpen < close)) {
        return { ok: false, error: { code: 'pattern.unbalanced_brace' } };
      }
      const name = pattern
        .slice(index + 1, close)
        .trim()
        .toUpperCase();
      if (!isNamingToken(name)) {
        return { ok: false, error: { code: 'pattern.unknown_token', token: name } };
      }
      if (literal) segments.push({ kind: 'literal', value: literal });
      literal = '';
      segments.push({ kind: 'token', token: name });
      index = close + 1;
      continue;
    }
    if (character === '}') return { ok: false, error: { code: 'pattern.unbalanced_brace' } };
    if (INVALID_FILE_NAME_CHARACTER.test(character)) {
      return { ok: false, error: { code: 'pattern.invalid_character', character } };
    }
    literal += character;
    index += 1;
  }
  if (literal) segments.push({ kind: 'literal', value: literal });
  return { ok: true, segments };
}

/** Example values for previewing a pattern while it is being written. */
export const SAMPLE_NAMING_VALUES: Record<NamingToken, string> = {
  STUDENT_ID: '70012345',
  STUDENT_NAME: 'AyeshaKhan',
  SECTION: '5A',
  COURSE_CODE: 'CS301',
  TASK_NO: '3',
};

/**
 * The task's number from its title: "Lab 10: Normalization" gives `10`, "Assignment #3" gives
 * `3`. A number after a task word wins over other numbers ("Week 11 lab 4" gives `4`).
 */
export function taskNumberFromTitle(title: string): string | null {
  const keyed =
    /\b(?:lab|assignment|assgn|asgn|quiz|project|homework|hw|task|exercise|sheet|tutorial|problem set|ps)\s*(?:no\.?|number|#)?\s*(\d{1,3})(?!\d)/iu.exec(
      title,
    );
  if (keyed) return String(keyed[1]);
  return /(?:^|[^\d:/.])(\d{1,3})(?![\d:/])/u.exec(title)?.[1] ?? null;
}

/**
 * The values a student's file name is checked against. Spaces are removed, since file-naming
 * rules join their parts without spaces ("Ayesha Khan" becomes `AyeshaKhan`).
 */
export function namingValues(input: {
  studentId: string | null;
  name: string | null;
  section: string | null;
  courseCode: string | null;
  title: string;
}): NamingValues {
  const compact = (value: string | null) => value?.replace(/\s+/gu, '') || null;
  return {
    STUDENT_ID: compact(input.studentId),
    STUDENT_NAME: compact(input.name),
    SECTION: compact(input.section),
    COURSE_CODE: compact(input.courseCode),
    TASK_NO: taskNumberFromTitle(input.title),
  };
}

/** Fills a parsed pattern with the student's values. Lists tokens that have no value. */
export function fillNamingPattern(
  segments: readonly PatternSegment[],
  values: NamingValues,
): { name: string; missing: NamingToken[] } {
  const missing: NamingToken[] = [];
  let name = '';
  for (const segment of segments) {
    if (segment.kind === 'literal') {
      name += segment.value;
      continue;
    }
    const value = values[segment.token]?.trim();
    if (value) name += value;
    else if (!missing.includes(segment.token)) missing.push(segment.token);
  }
  return { name, missing };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegExp(
  segments: readonly PatternSegment[],
  values: NamingValues,
  caseSensitive: boolean,
): RegExp {
  const source = segments
    .map((segment) => {
      if (segment.kind === 'literal') return escapeRegExp(segment.value);
      const value = values[segment.token]?.trim();
      return value ? escapeRegExp(value) : '.+';
    })
    .join('');
  return new RegExp(`^${source}$`, caseSensitive ? 'u' : 'iu');
}

/** Lower-case extension without a dot, e.g. `pdf` or `tar.gz`. */
export function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\.+/, '').toLowerCase();
}

/**
 * Splits a file name into its base and extension. Directory parts (as some browsers add,
 * e.g. `C:\fakepath\`) are removed. Multi-part extensions listed in `knownExtensions`
 * (such as `tar.gz`) are recognized.
 */
export function splitFileName(
  fileName: string,
  knownExtensions: readonly string[] = [],
): { base: string; extension: string } {
  const name = fileName.slice(Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\')) + 1);
  const lower = name.toLowerCase();
  const known = knownExtensions
    .map(normalizeExtension)
    .filter((extension) => extension && lower.endsWith(`.${extension}`))
    .sort((a, b) => b.length - a.length)[0];
  if (known && name.length > known.length + 1) {
    return { base: name.slice(0, -(known.length + 1)), extension: known };
  }
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return { base: name, extension: '' };
  return { base: name.slice(0, dot), extension: name.slice(dot + 1).toLowerCase() };
}

export const SUBMISSION_CHANNELS = ['lms', 'email', 'in_person', 'other'] as const;
export type SubmissionChannelKind = (typeof SUBMISSION_CHANNELS)[number];

export type LatePolicy =
  | { kind: 'not_accepted'; graceMinutes: number }
  | { kind: 'penalty'; graceMinutes: number; penaltyPercent: number }
  | { kind: 'accepted'; graceMinutes: number };

export interface SubmissionRuleLike {
  namingPattern: string | null;
  caseSensitive: boolean;
  allowedExtensions: readonly string[];
  maxSizeMB: number | null;
  channel: { kind: SubmissionChannelKind; label: string | null; url: string | null };
  latePolicy: LatePolicy;
}

export interface SubmissionCheckInput {
  /** `kind` is what the file's first bytes show it really is (see `sniffFileKind`). */
  file: { name: string; size: number; kind?: FileKind };
  rule: SubmissionRuleLike;
  dueAt: Date | string | null;
  now: Date;
  values: NamingValues;
}

export type CheckId = 'name' | 'extension' | 'content' | 'size' | 'deadline' | 'channel';
export type CheckStatus = 'pass' | 'info' | 'warn' | 'fail' | 'skipped';
export type CheckParams = Record<string, string | number | null>;

export interface SubmissionCheck {
  id: CheckId;
  status: CheckStatus;
  /** Message key for the interface, e.g. `name.mismatch`. */
  code: string;
  params: CheckParams;
}

export type SubmissionVerdict = 'ready' | 'review' | 'fix';

export interface SubmissionCheckResult {
  verdict: SubmissionVerdict;
  checks: SubmissionCheck[];
  /** The exact file name to use, when it can be determined. */
  expectedFileName: string | null;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MINUTE_MS = 60_000;

function check(id: CheckId, status: CheckStatus, code: string, params: CheckParams = {}) {
  return { id, status, code, params };
}

function joinName(base: string, extension: string): string {
  return extension ? `${base}.${extension}` : base;
}

export type NameHint = 'double_extension' | 'duplicate_suffix' | 'whitespace' | 'separators';

/** What a browser or file manager adds to a second copy: " (1)", " - Copy", "_copy". */
const COPY_SUFFIX = /(?:\s*\(\d+\)|\s*-\s*copy(?:\s*\(\d+\))?|[\s_]copy(?:\s*\(\d+\))?)$/iu;

/** Explains *why* two names differ, so the fix is obvious. */
function mismatchHint(expected: string, actual: string): NameHint | null {
  const lowerExpected = expected.toLowerCase();
  const lowerActual = actual.toLowerCase();
  const inner = /\.([a-z\d]{1,5})$/iu.exec(actual);
  if (
    inner &&
    expectedKinds(normalizeExtension(String(inner[1]))) &&
    lowerActual.slice(0, inner.index) === lowerExpected
  ) {
    return 'double_extension';
  }
  if (COPY_SUFFIX.test(actual) && lowerActual.replace(COPY_SUFFIX, '') === lowerExpected) {
    return 'duplicate_suffix';
  }
  const compact = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (/\s/.test(actual) && !/\s/.test(expected)) return 'whitespace';
  if (compact(expected) === compact(actual)) return 'separators';
  return null;
}

/** Compares the file's real format with its extension: renaming never converts a file. */
function checkContent(extension: string, kind: FileKind | undefined): SubmissionCheck {
  if (kind === undefined) return check('content', 'skipped', 'content.not_read');
  if (kind === 'empty') return check('content', 'skipped', 'content.empty');
  const expected = extension ? expectedKinds(extension) : null;
  if (!expected) return check('content', 'skipped', 'content.unknown_type', { extension });
  if (expected.includes(kind)) return check('content', 'pass', 'content.ok', { extension });
  // Unusual bytes in a text file may still be fine (for example an unusual encoding).
  if (expected.includes('text') && kind === 'binary') {
    return check('content', 'warn', 'content.not_text', { extension });
  }
  return check('content', 'fail', 'content.mismatch', {
    extension,
    actual: kind,
    suggested: usualExtension(kind),
  });
}

function checkExtension(rule: SubmissionRuleLike, extension: string): SubmissionCheck {
  const allowed = rule.allowedExtensions.map(normalizeExtension).filter(Boolean);
  if (allowed.length === 0) return check('extension', 'skipped', 'extension.no_rule');
  const list = allowed.join(', ');
  if (!extension) return check('extension', 'fail', 'extension.missing', { allowed: list });
  if (allowed.includes(extension)) return check('extension', 'pass', 'extension.ok', { extension });
  return check('extension', 'fail', 'extension.not_allowed', { actual: extension, allowed: list });
}

function checkSize(rule: SubmissionRuleLike, size: number): SubmissionCheck {
  if (size <= 0) return check('size', 'fail', 'size.empty');
  const actualMB = Math.round((size / BYTES_PER_MEGABYTE) * 100) / 100;
  if (rule.maxSizeMB !== null && size > rule.maxSizeMB * BYTES_PER_MEGABYTE) {
    return check('size', 'fail', 'size.too_large', { actualMB, maxMB: rule.maxSizeMB });
  }
  return check('size', 'pass', 'size.ok', { actualMB });
}

function checkDeadline(
  policy: LatePolicy,
  dueAt: Date | string | null,
  now: Date,
): SubmissionCheck {
  if (dueAt === null) return check('deadline', 'skipped', 'deadline.none');
  const due = new Date(dueAt).getTime();
  const remainingMs = due - now.getTime();
  if (remainingMs > 0) return check('deadline', 'pass', 'deadline.on_time', { remainingMs });

  const lateMs = -remainingMs;
  if (lateMs <= policy.graceMinutes * MINUTE_MS) {
    return check('deadline', 'warn', 'deadline.grace_period', { lateMs });
  }
  switch (policy.kind) {
    case 'not_accepted':
      return check('deadline', 'fail', 'deadline.closed', { lateMs });
    case 'penalty':
      return check('deadline', 'warn', 'deadline.late_penalty', {
        lateMs,
        penaltyPercent: policy.penaltyPercent,
      });
    case 'accepted':
      return check('deadline', 'warn', 'deadline.late_accepted', { lateMs });
  }
}

function checkName(
  rule: SubmissionRuleLike,
  parts: { base: string; extension: string },
  values: NamingValues,
): { result: SubmissionCheck; expectedBase: string | null } {
  if (rule.namingPattern === null) {
    return { result: check('name', 'skipped', 'name.no_rule'), expectedBase: null };
  }
  const parsed = parseNamingPattern(rule.namingPattern);
  if (!parsed.ok) {
    return {
      result: check('name', 'skipped', 'name.invalid_rule', { reason: parsed.error.code }),
      expectedBase: null,
    };
  }

  const { name: expected, missing } = fillNamingPattern(parsed.segments, values);
  const actual = parts.base.normalize('NFC');

  if (missing.length > 0) {
    const matches = patternToRegExp(parsed.segments, values, rule.caseSensitive).test(actual);
    return {
      result: check(
        'name',
        matches ? 'warn' : 'fail',
        matches ? 'name.unverified' : 'name.pattern_mismatch',
        {
          pattern: rule.namingPattern,
          missing: missing.join(','),
        },
      ),
      expectedBase: null,
    };
  }

  const expectedNormalized = expected.normalize('NFC');
  if (actual === expectedNormalized) {
    return { result: check('name', 'pass', 'name.ok'), expectedBase: expectedNormalized };
  }
  if (actual.toLowerCase() === expectedNormalized.toLowerCase()) {
    return {
      result: check('name', rule.caseSensitive ? 'fail' : 'info', 'name.case_mismatch', {
        expected: expectedNormalized,
        actual,
      }),
      expectedBase: expectedNormalized,
    };
  }
  return {
    result: check('name', 'fail', 'name.mismatch', {
      expected: expectedNormalized,
      actual,
      hint: mismatchHint(expectedNormalized, actual),
    }),
    expectedBase: expectedNormalized,
  };
}

/** Runs every check for one file. Pure and synchronous: safe to run in the browser. */
export function checkSubmission(input: SubmissionCheckInput): SubmissionCheckResult {
  const { file, rule, dueAt, now, values } = input;
  const parts = splitFileName(file.name, rule.allowedExtensions);
  const allowed = rule.allowedExtensions.map(normalizeExtension).filter(Boolean);

  const name = checkName(rule, parts, values);
  const checks: SubmissionCheck[] = [
    name.result,
    checkExtension(rule, parts.extension),
    checkContent(parts.extension, file.kind),
    checkSize(rule, file.size),
    checkDeadline(rule.latePolicy, dueAt, now),
    check('channel', 'info', `channel.${rule.channel.kind}`, {
      label: rule.channel.label,
      url: rule.channel.url,
    }),
  ];

  let expectedFileName: string | null = null;
  if (name.expectedBase !== null) {
    // Keep the student's extension when it is acceptable; otherwise suggest the first allowed one.
    const extension =
      allowed.length === 0 || allowed.includes(parts.extension)
        ? parts.extension
        : allowed.slice(0, 1).join('');
    expectedFileName = joinName(name.expectedBase, extension);
  }

  const verdict: SubmissionVerdict = checks.some((item) => item.status === 'fail')
    ? 'fix'
    : checks.some((item) => item.status === 'warn')
      ? 'review'
      : 'ready';

  return { verdict, checks, expectedFileName };
}

import {
  extensionSchema,
  fillNamingPattern,
  type LatePolicy,
  normalizeExtension,
  parseNamingPattern,
  SAMPLE_NAMING_VALUES,
  type SubmissionChannelKind,
  type SubmissionRuleInput,
  webUrlSchema,
} from '@sabaq/shared';

/** File types offered as one-tap choices; anything else goes in "Other types". */
export const COMMON_TYPES = ['pdf', 'docx', 'pptx', 'xlsx', 'zip', 'ipynb', 'py', 'jpg'] as const;

/** The rule as it is being edited: text fields stay text until the rule is saved. */
export interface RuleDraft {
  namingPattern: string;
  caseSensitive: boolean;
  types: string[];
  otherTypes: string;
  maxSizeMB: string;
  channelKind: SubmissionChannelKind;
  channelLabel: string;
  channelUrl: string;
  lateKind: LatePolicy['kind'];
  graceMinutes: string;
  penaltyPercent: string;
}

export const EMPTY_RULE_DRAFT: RuleDraft = {
  namingPattern: '',
  caseSensitive: false,
  types: [],
  otherTypes: '',
  maxSizeMB: '',
  channelKind: 'lms',
  channelLabel: '',
  channelUrl: '',
  lateKind: 'not_accepted',
  graceMinutes: '0',
  penaltyPercent: '10',
};

const isCommon = (type: string) => (COMMON_TYPES as readonly string[]).includes(type);

export function draftFromRule(rule: {
  namingPattern: string | null;
  allowedExtensions: readonly string[];
  caseSensitive?: boolean;
  maxSizeMB?: number | null;
  channel?: { kind: SubmissionChannelKind; label?: string | null; url?: string | null };
  latePolicy?: LatePolicy;
}): RuleDraft {
  const types = rule.allowedExtensions.map(normalizeExtension);
  return {
    namingPattern: rule.namingPattern ?? '',
    caseSensitive: rule.caseSensitive ?? false,
    types: types.filter(isCommon),
    otherTypes: types.filter((type) => !isCommon(type)).join(', '),
    maxSizeMB: rule.maxSizeMB ? String(rule.maxSizeMB) : '',
    channelKind: rule.channel?.kind ?? 'lms',
    channelLabel: rule.channel?.label ?? '',
    channelUrl: rule.channel?.url ?? '',
    lateKind: rule.latePolicy?.kind ?? 'not_accepted',
    graceMinutes: String(rule.latePolicy?.graceMinutes ?? 0),
    penaltyPercent: String(
      rule.latePolicy?.kind === 'penalty' ? rule.latePolicy.penaltyPercent : 10,
    ),
  };
}

export type RuleField = 'pattern' | 'other-types' | 'size' | 'channel-url' | 'grace' | 'penalty';

/** A problem with one field: a message key under `submission.editor` and its values. */
export interface RuleIssue {
  field: RuleField;
  key: string;
  params?: Record<string, string | number>;
}

/** The types typed into "Other types", split on commas and spaces. */
const splitTypes = (text: string) =>
  text
    .split(/[\s,;]+/u)
    .map((type) => type.trim())
    .filter(Boolean);

const wholeNumber = (text: string, min: number, max: number) => {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
};

/** Turns the draft into a rule the API accepts, or explains what to fix. */
export function parseRuleDraft(draft: RuleDraft): {
  rule: SubmissionRuleInput | null;
  issues: RuleIssue[];
} {
  const issues: RuleIssue[] = [];

  const pattern = draft.namingPattern.trim();
  if (pattern) {
    const parsed = parseNamingPattern(pattern);
    if (!parsed.ok) {
      const { code, ...params } = parsed.error;
      issues.push({ field: 'pattern', key: `errors.${code.replace('pattern.', '')}`, params });
    }
  }

  const other: string[] = [];
  for (const type of splitTypes(draft.otherTypes)) {
    const result = extensionSchema.safeParse(type);
    if (result.success) other.push(result.data);
    else issues.push({ field: 'other-types', key: 'invalidType', params: { type } });
  }

  let maxSizeMB: number | null = null;
  if (draft.maxSizeMB.trim()) {
    const value = Number(draft.maxSizeMB.trim().replace(',', '.'));
    if (Number.isFinite(value) && value >= 0.1 && value <= 1024) maxSizeMB = value;
    else issues.push({ field: 'size', key: 'invalidSize' });
  }

  const url = draft.channelUrl.trim();
  if (url && !webUrlSchema.safeParse(url).success) {
    issues.push({ field: 'channel-url', key: 'invalidUrl' });
  }

  const graceMinutes = wholeNumber(draft.graceMinutes || '0', 0, 1440);
  if (graceMinutes === null) {
    issues.push({ field: 'grace', key: 'invalidNumber', params: { min: 0, max: 1440 } });
  }
  const penaltyPercent = wholeNumber(draft.penaltyPercent, 1, 100);
  if (draft.lateKind === 'penalty' && penaltyPercent === null) {
    issues.push({ field: 'penalty', key: 'invalidNumber', params: { min: 1, max: 100 } });
  }

  if (issues.length > 0) return { rule: null, issues };
  const grace = graceMinutes ?? 0;
  return {
    rule: {
      namingPattern: pattern || null,
      caseSensitive: Boolean(pattern) && draft.caseSensitive,
      allowedExtensions: [...new Set([...draft.types, ...other])],
      maxSizeMB,
      channel: {
        kind: draft.channelKind,
        label: draft.channelLabel.trim() || null,
        url: url || null,
      },
      latePolicy:
        draft.lateKind === 'penalty'
          ? { kind: 'penalty', graceMinutes: grace, penaltyPercent: penaltyPercent ?? 10 }
          : { kind: draft.lateKind, graceMinutes: grace },
    },
    issues: [],
  };
}

/** What a student would see for this pattern, with example details. */
export function previewName(draft: Pick<RuleDraft, 'namingPattern' | 'types' | 'otherTypes'>) {
  const parsed = parseNamingPattern(draft.namingPattern.trim());
  if (!parsed.ok) return null;
  const extension = draft.types[0] ?? splitTypes(draft.otherTypes)[0];
  const { name } = fillNamingPattern(parsed.segments, SAMPLE_NAMING_VALUES);
  return extension ? `${name}.${normalizeExtension(extension)}` : name;
}

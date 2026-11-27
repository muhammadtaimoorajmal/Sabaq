import { describe, expect, it } from 'vitest';
import { draftFromRule, EMPTY_RULE_DRAFT, parseRuleDraft, previewName } from './rule-draft';

describe('rule drafts', () => {
  it('splits a saved rule into one-tap types and other types', () => {
    expect(
      draftFromRule({
        namingPattern: 'A{TASK_NO}',
        allowedExtensions: ['PDF', 'sql', 'docx'],
        caseSensitive: true,
        maxSizeMB: 5,
        channel: { kind: 'email', label: 'ta@example.edu', url: null },
        latePolicy: { kind: 'penalty', graceMinutes: 10, penaltyPercent: 20 },
      }),
    ).toEqual({
      namingPattern: 'A{TASK_NO}',
      caseSensitive: true,
      types: ['pdf', 'docx'],
      otherTypes: 'sql',
      maxSizeMB: '5',
      channelKind: 'email',
      channelLabel: 'ta@example.edu',
      channelUrl: '',
      lateKind: 'penalty',
      graceMinutes: '10',
      penaltyPercent: '20',
    });
  });

  it('fills sensible defaults for a rule read from a message', () => {
    expect(draftFromRule({ namingPattern: null, allowedExtensions: [] })).toEqual(EMPTY_RULE_DRAFT);
  });

  it('turns an empty draft into a rule that only says where to submit', () => {
    expect(parseRuleDraft({ ...EMPTY_RULE_DRAFT, caseSensitive: true })).toEqual({
      rule: {
        namingPattern: null,
        // Capital letters only matter when there is a name rule.
        caseSensitive: false,
        allowedExtensions: [],
        maxSizeMB: null,
        channel: { kind: 'lms', label: null, url: null },
        latePolicy: { kind: 'not_accepted', graceMinutes: 0 },
      },
      issues: [],
    });
  });

  it('accepts sizes with a decimal comma and an empty grace period', () => {
    const { rule } = parseRuleDraft({
      ...EMPTY_RULE_DRAFT,
      maxSizeMB: '2,5',
      graceMinutes: '',
      lateKind: 'accepted',
      types: ['pdf'],
      otherTypes: 'pdf; .ZIP',
    });
    expect(rule).toMatchObject({
      maxSizeMB: 2.5,
      allowedExtensions: ['pdf', 'zip'],
      latePolicy: { kind: 'accepted', graceMinutes: 0 },
    });
  });

  it('ignores the penalty field unless late work has a penalty', () => {
    expect(parseRuleDraft({ ...EMPTY_RULE_DRAFT, penaltyPercent: 'x' }).issues).toEqual([]);
  });

  it('lists every problem with its field', () => {
    expect(
      parseRuleDraft({
        ...EMPTY_RULE_DRAFT,
        namingPattern: 'Lab{WEEK}',
        otherTypes: 'ok, b@d',
        maxSizeMB: '0',
        channelUrl: 'not a link',
        graceMinutes: '2.5',
        lateKind: 'penalty',
        penaltyPercent: '0',
      }).issues,
    ).toEqual([
      { field: 'pattern', key: 'errors.unknown_token', params: { token: 'WEEK' } },
      { field: 'other-types', key: 'invalidType', params: { type: 'b@d' } },
      { field: 'size', key: 'invalidSize' },
      { field: 'channel-url', key: 'invalidUrl' },
      { field: 'grace', key: 'invalidNumber', params: { min: 0, max: 1440 } },
      { field: 'penalty', key: 'invalidNumber', params: { min: 1, max: 100 } },
    ]);
  });

  it('previews the pattern with example details and the first type', () => {
    const draft = { namingPattern: 'Lab{TASK_NO}_{STUDENT_ID}', types: [], otherTypes: '' };
    expect(previewName(draft)).toBe('Lab3_70012345');
    expect(previewName({ ...draft, otherTypes: '.SQL, py' })).toBe('Lab3_70012345.sql');
    expect(previewName({ ...draft, types: ['docx'] })).toBe('Lab3_70012345.docx');
    expect(previewName({ ...draft, namingPattern: 'Lab{' })).toBeNull();
  });
});

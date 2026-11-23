import { registerInputSchema } from '@sabaq/shared';
import { describe, expect, it } from 'vitest';
import { issueKey, serverErrors, validate } from './validation';

describe('issueKey', () => {
  it.each([
    ['name', 'too_small', '', 'auth.validation.nameRequired'],
    ['name', 'too_small', 'Z', 'auth.validation.nameShort'],
    ['name', 'too_big', 'Z'.repeat(81), 'auth.validation.nameLong'],
    ['email', 'invalid_format', '', 'auth.validation.emailRequired'],
    ['email', 'invalid_format', 'nope', 'auth.validation.emailInvalid'],
    ['password', 'too_small', '', 'auth.validation.passwordRequired'],
    ['password', 'too_small', 'short', 'auth.validation.passwordShort'],
    ['newPassword', 'too_big', 'x'.repeat(129), 'auth.validation.passwordLong'],
    ['password', 'custom', '        ', 'auth.validation.passwordBlank'],
    ['currentPassword', 'too_small', '', 'auth.validation.currentPasswordRequired'],
    ['currentPassword', 'incorrect', 'x', 'auth.validation.currentPasswordWrong'],
    ['studentId', 'invalid_format', 'NU 24', 'auth.validation.studentIdInvalid'],
    ['studentId', 'too_big', 'x'.repeat(33), 'auth.validation.studentIdLong'],
    ['somethingElse', 'custom', 'x', 'auth.validation.invalid'],
  ])('%s · %s · %j → %s', (field, code, value, expected) => {
    expect(issueKey(field, code, value)).toBe(expected);
  });

  it('recognizes the "same password" rule by its message', () => {
    expect(
      issueKey('newPassword', 'custom', 'same', 'Choose a password different from the current one'),
    ).toBe('auth.validation.passwordSame');
  });
});

describe('validate', () => {
  it('reports one message per field, using the shared rules', () => {
    expect(
      validate(
        registerInputSchema,
        { name: '', email: 'x', password: 'short', studentId: '' },
        (values) => ({
          ...values,
          studentId: values.studentId || undefined,
        }),
      ),
    ).toEqual({
      name: 'auth.validation.nameRequired',
      email: 'auth.validation.emailInvalid',
      password: 'auth.validation.passwordShort',
    });
  });

  it('maps API field issues, ignoring unknown fields', () => {
    expect(
      serverErrors(
        [
          { path: 'email', code: 'invalid_format', message: '' },
          { path: 'email', code: 'other', message: '' },
          { path: 'unknown', code: 'x', message: '' },
        ],
        { email: 'x@y' },
      ),
    ).toEqual({ email: 'auth.validation.emailInvalid' });
  });
});

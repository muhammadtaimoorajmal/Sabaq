import type { FieldIssue } from '@sabaq/shared';
import type { ParseKeys } from 'i18next';
import type { z } from 'zod';

type Key = ParseKeys & `auth.validation.${string}`;

const PASSWORD_FIELDS = new Set(['password', 'newPassword']);

/**
 * Turns a validation problem (from the shared schemas in the browser, or from the API) into a
 * plain-language message key. Empty fields get "Enter …" messages, never technical ones.
 */
export function issueKey(field: string, code: string, value: string, message = ''): Key {
  if (value.trim() === '' && !PASSWORD_FIELDS.has(field) && field !== 'currentPassword') {
    if (field === 'name') return 'auth.validation.nameRequired';
    if (field === 'email') return 'auth.validation.emailRequired';
  }
  if (field === 'name') {
    return code === 'too_big' ? 'auth.validation.nameLong' : 'auth.validation.nameShort';
  }
  if (field === 'email') return 'auth.validation.emailInvalid';
  if (field === 'currentPassword') {
    return code === 'incorrect'
      ? 'auth.validation.currentPasswordWrong'
      : 'auth.validation.currentPasswordRequired';
  }
  if (PASSWORD_FIELDS.has(field)) {
    if (value === '') return 'auth.validation.passwordRequired';
    if (code === 'too_small') return 'auth.validation.passwordShort';
    if (code === 'too_big') return 'auth.validation.passwordLong';
    return /different/i.test(message)
      ? 'auth.validation.passwordSame'
      : 'auth.validation.passwordBlank';
  }
  if (field === 'studentId') {
    return code === 'too_big'
      ? 'auth.validation.studentIdLong'
      : 'auth.validation.studentIdInvalid';
  }
  return 'auth.validation.invalid';
}

export type FieldErrors<Field extends string> = Partial<Record<Field, Key>>;

/** Validates form values with a shared schema; one message per field, in field order. */
export function validate<Field extends string>(
  schema: z.ZodType,
  values: Record<Field, string>,
  /** Turns form values into the schema's input, for example "" into "not given". */
  prepare: (values: Record<Field, string>) => unknown = (input) => input,
): FieldErrors<Field> {
  const result = schema.safeParse(prepare(values));
  if (result.success) return {};
  const errors: FieldErrors<Field> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '') as Field;
    if (!(field in values) || errors[field]) continue;
    errors[field] = issueKey(field, issue.code, values[field], issue.message);
  }
  return errors;
}

/** Maps the API's field issues onto the same messages. */
export function serverErrors<Field extends string>(
  issues: FieldIssue[],
  values: Record<Field, string>,
): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  for (const issue of issues) {
    const field = issue.path.split('.')[0] as Field;
    if (!(field in values) || errors[field]) continue;
    errors[field] = issueKey(field, issue.code, values[field], issue.message);
  }
  return errors;
}

import type { FieldIssue } from '@sabaq/shared';
import type { z } from 'zod';
import { AppError } from './errors.js';

/** Converts Zod issues into the API's field issue format. */
export function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    code: issue.code,
    message: issue.message,
  }));
}

/** Validates untrusted input, throwing a 400 `validation_failed` error that lists every field. */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.output<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('validation_failed', 'Some fields are not valid.', {
      issues: toFieldIssues(result.error),
    });
  }
  return result.data;
}

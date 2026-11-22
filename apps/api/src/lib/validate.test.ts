import { registerInputSchema } from '@sabaq/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from './errors.js';
import { parseInput } from './validate.js';

describe('parseInput', () => {
  it('returns the parsed, normalized value', () => {
    const schema = z.object({ email: z.string().trim().toLowerCase() });
    expect(parseInput(schema, { email: '  Ali@Example.COM ' })).toEqual({
      email: 'ali@example.com',
    });
  });

  it('throws a validation error that lists every invalid field with its path', () => {
    let error: unknown;
    try {
      parseInput(registerInputSchema, { email: 'not-an-email', password: 'short' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError).toMatchObject({ code: 'validation_failed', status: 400 });
    expect(appError.issues?.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
  });
});

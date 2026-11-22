import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthSchema, readinessSchema } from '../index.js';

describe('API contract', () => {
  it('accepts a validation error with field issues', () => {
    const body = {
      error: {
        code: 'validation_failed',
        message: 'Some fields are not valid.',
        requestId: 'req-1',
        issues: [{ path: 'email', code: 'invalid_format', message: 'Invalid email address' }],
      },
    };
    expect(apiErrorSchema.parse(body)).toEqual(body);
  });

  it('rejects unknown error codes', () => {
    const body = { error: { code: 'oops', message: 'x', requestId: 'r' } };
    expect(apiErrorSchema.safeParse(body).success).toBe(false);
  });

  it('describes health and readiness', () => {
    expect(
      healthSchema.safeParse({
        status: 'ok',
        version: 'dev',
        uptimeSeconds: 3.2,
        time: '2026-11-22T10:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      readinessSchema.safeParse({
        status: 'not_ready',
        checks: { database: { status: 'down', latencyMs: 2000 } },
      }).success,
    ).toBe(true);
    expect(
      healthSchema.safeParse({ status: 'ok', version: 'dev', uptimeSeconds: -1 }).success,
    ).toBe(false);
  });
});

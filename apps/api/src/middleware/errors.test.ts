import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { memoryLogger } from '../test/helpers.js';
import { errorHandler, toAppError } from './errors.js';
import { httpLogger } from './http-logger.js';

/** A minimal app whose only route throws the given error. */
function throwing(error: unknown) {
  const { logger, entries } = memoryLogger();
  const app = express();
  app.use(httpLogger(logger));
  app.get('/boom', () => {
    throw error;
  });
  app.use(errorHandler);
  return { send: () => request(app).get('/boom').set('X-Request-Id', 'req-1'), entries };
}

describe('errorHandler', () => {
  it('sends application errors with their status, code and field issues', async () => {
    const issues = [{ path: 'email', code: 'invalid_format', message: 'Invalid email address' }];
    const { send } = throwing(
      new AppError('validation_failed', 'Some fields are not valid.', { issues }),
    );
    const response = await send().expect(400);
    expect(response.body).toEqual({
      error: {
        code: 'validation_failed',
        message: 'Some fields are not valid.',
        requestId: 'req-1',
        issues,
      },
    });
  });

  it('hides unexpected errors from clients but logs them in full', async () => {
    const { send, entries } = throwing(new Error('database password is hunter2'));
    const response = await send().expect(500);
    expect(response.body.error).toEqual({
      code: 'internal_error',
      message: 'Something went wrong on our side. Please try again.',
      requestId: 'req-1',
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    const logged = entries.find((entry) => entry.level === 50) as { err: { message: string } };
    expect(logged.err.message).toBe('database password is hunter2');
  });

  it('wraps thrown non-Error values so they are still logged', async () => {
    const { send, entries } = throwing('plain string');
    await send().expect(500);
    const logged = entries.find((entry) => entry.level === 50) as { err: { message: string } };
    expect(logged.err.message).toBe('plain string');
  });

  it('leaves responses that already started to Express', async () => {
    const { logger } = memoryLogger();
    const app = express();
    app.use(httpLogger(logger));
    app.get('/partial', (_req, res, next) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('partial');
      next(new Error('failed mid-stream'));
    });
    app.use(errorHandler);
    // Express's final handler destroys the socket; the client sees a broken response.
    await expect(request(app).get('/partial')).rejects.toThrow();
  });
});

describe('toAppError', () => {
  it('maps Zod and body-parser errors, and leaves unknown errors alone', () => {
    const zod = z.object({ name: z.string() }).safeParse({});
    expect(toAppError(zod.error)).toMatchObject({
      code: 'validation_failed',
      issues: [{ path: 'name', code: 'invalid_type' }],
    });
    expect(toAppError({ type: 'charset.unsupported', status: 415 })?.code).toBe(
      'unsupported_media_type',
    );
    expect(toAppError({ type: 'encoding.unsupported', status: 415 })?.code).toBe(
      'unsupported_media_type',
    );
    expect(toAppError({ type: 'request.aborted', status: 400 })?.code).toBe('bad_request');
    expect(toAppError({ status: 502 })).toBeUndefined();
    expect(toAppError(new Error('x'))).toBeUndefined();
    expect(toAppError(null)).toBeUndefined();
  });
});

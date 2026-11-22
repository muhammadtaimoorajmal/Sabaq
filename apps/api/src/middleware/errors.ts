import type { ApiError } from '@sabaq/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { toFieldIssues } from '../lib/validate.js';

/** Errors raised by Express's body parser carry a `type` and an HTTP status. */
interface HttpError {
  type?: unknown;
  status?: unknown;
}

function isHttpError(error: unknown): error is HttpError {
  return typeof error === 'object' && error !== null && ('type' in error || 'status' in error);
}

/** Maps known failures to client-safe errors; returns `undefined` for unexpected ones. */
export function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError('validation_failed', 'Some fields are not valid.', {
      issues: toFieldIssues(error),
    });
  }
  if (!isHttpError(error)) return undefined;
  switch (error.type) {
    case 'entity.parse.failed':
      return new AppError('invalid_json', 'The request body is not valid JSON.', { cause: error });
    case 'entity.too.large':
      return new AppError('payload_too_large', 'The request body is too large.', { cause: error });
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return new AppError('unsupported_media_type', 'The request encoding is not supported.', {
        cause: error,
      });
  }
  if (typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
    return new AppError('bad_request', 'The request could not be processed.', { cause: error });
  }
  return undefined;
}

/** Turns unmatched routes into a `not_found` error. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('not_found', `No route matches ${req.method} ${req.path}.`));
};

/**
 * Sends every error in the same shape: `{ error: { code, message, requestId, issues? } }`.
 * Unexpected errors are logged in full but never exposed to the client.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const known =
    toAppError(error) ??
    new AppError('internal_error', 'Something went wrong on our side. Please try again.');
  if (known.status >= 500) {
    // pino-http logs the response once, at error level, including this error and its stack.
    res.err = error instanceof Error ? error : new Error(String(error));
  }
  const body: ApiError = {
    error: {
      code: known.code,
      message: known.message,
      requestId: String(req.id),
      ...(known.issues && { issues: known.issues }),
    },
  };
  res.status(known.status).json(body);
};

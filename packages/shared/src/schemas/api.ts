import { z } from 'zod';
import { isoDateTimeSchema } from './common.js';

/**
 * Machine-readable error codes returned by the API. The web app maps each code
 * to a translated message; the `message` field is for developers and logs.
 */
export const API_ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'invalid_json',
  'unauthorized',
  'session_expired',
  'invalid_credentials',
  'invalid_token',
  'forbidden',
  'not_found',
  'conflict',
  'email_taken',
  'payload_too_large',
  'unsupported_media_type',
  'rate_limited',
  'account_locked',
  'internal_error',
  'service_unavailable',
] as const;
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/** One invalid input field: a dotted path such as `sessions.0.start`, a code and a message. */
export const fieldIssueSchema = z.object({
  path: z.string(),
  code: z.string(),
  message: z.string(),
});
export type FieldIssue = z.infer<typeof fieldIssueSchema>;

/** The body of every unsuccessful API response. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    issues: z.array(fieldIssueSchema).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** `GET /api/health`: the process is up. Cheap enough to use as a wake-up ping. */
export const healthSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  time: isoDateTimeSchema,
});
export type Health = z.infer<typeof healthSchema>;

export const DEPENDENCY_STATUSES = ['up', 'down'] as const;

/** `GET /api/health/ready`: whether every dependency (such as the database) is reachable. */
export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.record(
    z.string(),
    z.object({
      status: z.enum(DEPENDENCY_STATUSES),
      latencyMs: z.number().nonnegative(),
    }),
  ),
});
export type Readiness = z.infer<typeof readinessSchema>;

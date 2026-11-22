import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Short, log-safe identifiers only; anything else is replaced to keep logs trustworthy. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Reuses a well-formed incoming request ID (for example from a proxy) so one request
 * can be followed across systems; otherwise generates a new one.
 */
export function resolveRequestId(incoming: string | string[] | undefined): string {
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

import type { RequestHandler, Response } from 'express';
import { AppError } from '../lib/errors.js';
import type { AuthService } from './service.js';
import { verifyAccessToken } from './tokens.js';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

/**
 * Requires `Authorization: Bearer <access token>` for a session that is still active, so
 * signing out (on any device) takes effect immediately, not when the token expires.
 */
export function requireAuth({
  service,
  secret,
  now = () => new Date(),
}: {
  service: Pick<AuthService, 'isSessionActive'>;
  secret: string;
  now?: () => Date;
}): RequestHandler {
  return async (req, res, next) => {
    const token = /^Bearer (\S+)$/.exec(req.get('authorization') ?? '')?.[1];
    if (!token) throw new AppError('unauthorized', 'Sign in to continue.');
    const result = await verifyAccessToken(token, { secret, now: now() });
    if (!result.ok) {
      throw result.reason === 'expired'
        ? new AppError('session_expired', 'Your session has expired. Please sign in again.')
        : new AppError('unauthorized', 'Sign in to continue.');
    }
    if (!(await service.isSessionActive(result.userId, result.sessionId))) {
      throw new AppError('session_expired', 'Your session has ended. Please sign in again.');
    }
    res.locals.auth = { userId: result.userId, sessionId: result.sessionId } satisfies AuthContext;
    next();
  };
}

/** The signed-in user of a request that passed `requireAuth`. */
export function authOf(res: Response): AuthContext {
  const auth = res.locals.auth as AuthContext | undefined;
  if (!auth) throw new Error('authOf() used on a route without requireAuth');
  return auth;
}

/**
 * Cross-site request forgery protection for routes authenticated by cookie: browsers always
 * send `Origin` on such requests, and it must be one of ours. (The cookie is also SameSite.)
 */
export function requireTrustedOrigin(trusted: ReadonlySet<string>): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin !== undefined && !trusted.has(origin)) {
      throw new AppError('forbidden', 'Requests from this site are not allowed.');
    }
    next();
  };
}

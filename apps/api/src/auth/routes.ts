import {
  type AuthResponse,
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  resendVerificationInputSchema,
  resetPasswordInputSchema,
  verifyEmailInputSchema,
} from '@sabaq/shared';
import { type CookieOptions, type Request, type Response, Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Config } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { parseInput } from '../lib/validate.js';
import { describeDevice } from './device.js';
import { authOf, requireAuth, requireTrustedOrigin } from './middleware.js';
import type { AuthService, IssuedSession } from './service.js';

export const REFRESH_COOKIE = 'sabaq_refresh';

/** The refresh cookie is unreadable by scripts, HTTPS-only in production and sent only to auth routes. */
export function refreshCookieOptions(config: Pick<Config, 'isProduction'>): CookieOptions {
  return { httpOnly: true, secure: config.isProduction, sameSite: 'strict', path: '/api/auth' };
}

/**
 * Authentication endpoints, mounted at `/api/auth`. Responses for sign-up, sign-in and refresh
 * follow `authResponseSchema`; everything else answers 202 or 204.
 */
export function authRouter({
  service,
  config,
  now,
}: {
  service: AuthService;
  config: Pick<Config, 'isProduction' | 'auth' | 'corsOrigins' | 'appUrl'>;
  now?: () => Date;
}): Router {
  const router = Router();
  const authenticated = requireAuth({ service, secret: config.auth.jwtSecret, now });
  const trustedOrigin = requireTrustedOrigin(new Set([...config.corsOrigins, config.appUrl]));
  const cookie = refreshCookieOptions(config);

  // Stricter limits where passwords are guessed or e-mails are triggered.
  const sensitive = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.auth.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new AppError('rate_limited', 'Too many attempts. Please wait a few minutes and try again.'),
      );
    },
  });

  const send = (res: Response, status: number, issued: IssuedSession) => {
    if (issued.refreshToken) {
      res.cookie(REFRESH_COOKIE, issued.refreshToken, {
        ...cookie,
        expires: issued.refreshTokenExpiresAt,
      });
    }
    const body: AuthResponse = {
      user: issued.user,
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.accessTokenExpiresAt.toISOString(),
    };
    res.status(status).json(body);
  };
  const device = (req: Request) => describeDevice(req.get('user-agent'));
  const refreshCookie = (req: Request) =>
    (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE];

  router.post('/register', sensitive, async (req, res) => {
    send(res, 201, await service.register(parseInput(registerInputSchema, req.body), device(req)));
  });

  router.post('/login', sensitive, async (req, res) => {
    send(res, 200, await service.login(parseInput(loginInputSchema, req.body), device(req)));
  });

  router.post('/refresh', trustedOrigin, async (req, res) => {
    try {
      send(res, 200, await service.refresh(refreshCookie(req)));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, cookie);
      throw error;
    }
  });

  router.post('/logout', trustedOrigin, async (req, res) => {
    await service.logout(refreshCookie(req));
    res.clearCookie(REFRESH_COOKIE, cookie);
    res.status(204).end();
  });

  router.post('/logout-all', authenticated, async (_req, res) => {
    await service.logoutEverywhere(authOf(res).userId);
    res.clearCookie(REFRESH_COOKIE, cookie);
    res.status(204).end();
  });

  router.get('/me', authenticated, async (_req, res) => {
    res.json(await service.currentUser(authOf(res).userId));
  });

  router.get('/sessions', authenticated, async (_req, res) => {
    const { userId, sessionId } = authOf(res);
    res.json(await service.listSessions(userId, sessionId));
  });

  router.delete('/sessions/:sessionId', authenticated, async (req, res) => {
    await service.revokeSession(authOf(res).userId, req.params.sessionId as string);
    res.status(204).end();
  });

  router.post('/verify-email', sensitive, async (req, res) => {
    await service.verifyEmail(parseInput(verifyEmailInputSchema, req.body).token);
    res.status(204).end();
  });

  router.post('/resend-verification', sensitive, async (req, res) => {
    await service.resendVerification(parseInput(resendVerificationInputSchema, req.body).email);
    res.status(202).end();
  });

  router.post('/forgot-password', sensitive, async (req, res) => {
    await service.forgotPassword(parseInput(forgotPasswordInputSchema, req.body).email);
    res.status(202).end();
  });

  router.post('/reset-password', sensitive, async (req, res) => {
    await service.resetPassword(parseInput(resetPasswordInputSchema, req.body));
    res.clearCookie(REFRESH_COOKIE, cookie);
    res.status(204).end();
  });

  router.post('/change-password', authenticated, async (req, res) => {
    const { userId, sessionId } = authOf(res);
    await service.changePassword(
      userId,
      sessionId,
      parseInput(changePasswordInputSchema, req.body),
    );
    res.status(204).end();
  });

  return router;
}

import { apiErrorSchema, authResponseSchema, sessionInfoSchema } from '@sabaq/shared';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { SessionModel, UserModel } from '../db/models/index.js';
import { useTestDatabase } from '../test/database.js';
import { MemoryMailer, memoryLogger, testConfig } from '../test/helpers.js';
import { LOCK_DURATION_MS, MAX_FAILED_LOGINS, ROTATION_GRACE_MS } from './service.js';

useTestDatabase();

const EMAIL = 'zara.ahmed@example.com';
const PASSWORD = 'correct horse battery';
const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36';
const APP_URL = 'https://sabaq.example.com';

let app: Express;
let mailer: MemoryMailer;
let clock: Date;
const advance = (milliseconds: number) => {
  clock = new Date(clock.getTime() + milliseconds);
};

function build(env: Record<string, string> = {}) {
  mailer = new MemoryMailer();
  const config = testConfig({ APP_URL, AUTH_RATE_LIMIT_MAX: '1000', ...env });
  app = createApp({ config, logger: memoryLogger().logger, mailer, now: () => clock });
}

beforeEach(() => {
  clock = new Date('2026-11-22T10:00:00Z');
  build();
});

const post = (path: string, body?: object) =>
  request(app).post(`/api/auth${path}`).set('User-Agent', CHROME).send(body);
const register = (overrides: object = {}) =>
  post('/register', { name: 'Zara Ahmed', email: EMAIL, password: PASSWORD, ...overrides });
const login = (password = PASSWORD) => post('/login', { email: EMAIL, password });
const bearer = (response: Response) => `Bearer ${String(response.body.accessToken)}`;
const me = (authorization: string) =>
  request(app).get('/api/auth/me').set('Authorization', authorization);

/** The `name=value` part of the refresh cookie set by a response. */
function refreshCookie(response: Response): string {
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = header.find(
    (value) => value.startsWith('sabaq_refresh=') && !value.startsWith('sabaq_refresh=;'),
  );
  if (!cookie) throw new Error('No refresh cookie was set');
  return cookie.split(';')[0] as string;
}
const refresh = (cookie?: string) => {
  const call = request(app).post('/api/auth/refresh').set('Origin', APP_URL);
  return cookie ? call.set('Cookie', cookie) : call;
};
const errorCode = (response: Response) => apiErrorSchema.parse(response.body).error.code;

describe('registration', () => {
  it('creates an account, signs it in and sends a verification link', async () => {
    const response = await register({ email: '  Zara.Ahmed@Example.com ' }).expect(201);
    const body = authResponseSchema.parse(response.body);
    expect(body.user).toMatchObject({ name: 'Zara Ahmed', email: EMAIL, emailVerified: false });
    expect(new Date(body.accessTokenExpiresAt).getTime() - clock.getTime()).toBe(15 * 60_000);

    const cookie = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '';
    expect(cookie).toMatch(/^sabaq_refresh=[\w-]{43};/);
    expect(cookie).toContain('Path=/api/auth');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      to: EMAIL,
      subject: 'Confirm your e-mail address for Sabaq',
    });
    expect(mailer.sent[0]?.text).toContain(`${APP_URL}/verify-email#token=`);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
  });

  it('refuses a second account for the same address, in any letter case', async () => {
    await register().expect(201);
    const response = await register({ email: EMAIL.toUpperCase() }).expect(409);
    expect(errorCode(response)).toBe('email_taken');
  });

  it('lists every invalid field', async () => {
    const response = await post('/register', {
      name: 'Z',
      email: 'nope',
      password: 'short',
    }).expect(400);
    const paths = apiErrorSchema.parse(response.body).error.issues?.map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('keeps the account even when the verification e-mail cannot be sent', async () => {
    const failing = { send: () => Promise.reject(new Error('SMTP down')) };
    const { logger, entries } = memoryLogger();
    app = createApp({ config: testConfig({ APP_URL }), logger, mailer: failing, now: () => clock });
    await register().expect(201);
    expect(entries.some((entry) => entry.msg === 'E-mail delivery failed')).toBe(true);
  });
});

describe('signing in', () => {
  beforeEach(async () => {
    await register().expect(201);
  });

  it('returns the user and a session', async () => {
    const response = await login().expect(200);
    expect(authResponseSchema.parse(response.body).user.email).toBe(EMAIL);
    expect(refreshCookie(response)).toMatch(/^sabaq_refresh=/);
    const user = await UserModel.findOne({ email: EMAIL });
    expect(user?.lastLoginAt?.toISOString()).toBe(clock.toISOString());
  });

  it('gives the same answer for a wrong password and an unknown address', async () => {
    const wrongPassword = await login('incorrect password').expect(401);
    const unknown = await post('/login', {
      email: 'nobody@example.com',
      password: PASSWORD,
    }).expect(401);
    expect(wrongPassword.body.error.code).toBe('invalid_credentials');
    expect(unknown.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it(`locks the account for 15 minutes after ${MAX_FAILED_LOGINS} failures`, async () => {
    for (let attempt = 1; attempt < MAX_FAILED_LOGINS; attempt += 1) {
      await login('incorrect password').expect(401);
    }
    const locked = await login('incorrect password').expect(429);
    expect(errorCode(locked)).toBe('account_locked');
    expect(locked.headers['retry-after']).toBe(String(LOCK_DURATION_MS / 1000));
    expect(locked.body.error.message).toContain('15 minutes');

    // Even the right password is refused while locked.
    advance(14 * 60_000);
    const stillLocked = await login().expect(429);
    expect(stillLocked.body.error.message).toContain('1 minute,');

    advance(60_000);
    await login().expect(200);
    expect((await UserModel.findOne({ email: EMAIL }))?.failedLoginCount).toBe(0);
  });

  it('resets the failure count after a successful sign-in', async () => {
    await login('incorrect password').expect(401);
    await login().expect(200);
    expect((await UserModel.findOne({ email: EMAIL }))?.failedLoginCount).toBe(0);
  });
});

describe('access tokens', () => {
  it('identify the user until they expire', async () => {
    const response = await register().expect(201);
    const user = await me(bearer(response)).expect(200);
    expect(user.body.email).toBe(EMAIL);

    advance(15 * 60_000 + 1000);
    expect(errorCode(await me(bearer(response)).expect(401))).toBe('session_expired');
  });

  it('are required, and forged ones are rejected', async () => {
    expect(errorCode(await request(app).get('/api/auth/me').expect(401))).toBe('unauthorized');
    expect(errorCode(await me('Bearer not.a.token').expect(401))).toBe('unauthorized');

    const response = await register().expect(201);
    build({ JWT_SECRET: 'a-completely-different-secret-of-sufficient-length' });
    expect(errorCode(await me(bearer(response)).expect(401))).toBe('unauthorized');
  });

  it('stop working as soon as the session is signed out, before they expire', async () => {
    const response = await register().expect(201);
    await request(app)
      .post('/api/auth/logout')
      .set('Origin', APP_URL)
      .set('Cookie', refreshCookie(response))
      .expect(204);
    expect(errorCode(await me(bearer(response)).expect(401))).toBe('session_expired');
  });
});

describe('refreshing a session', () => {
  it('rotates the refresh token and keeps the user signed in', async () => {
    const first = refreshCookie(await register().expect(201));
    advance(20 * 60_000);
    const response = await refresh(first).expect(200);
    const second = refreshCookie(response);
    expect(second).not.toBe(first);
    await me(bearer(response)).expect(200);
  });

  it('tolerates parallel tabs that use the previous token for a moment', async () => {
    const first = refreshCookie(await register().expect(201));
    await refresh(first).expect(200);
    advance(ROTATION_GRACE_MS - 1000);
    const parallel = await refresh(first).expect(200);
    expect(parallel.headers['set-cookie']).toBeUndefined();
    await me(bearer(parallel)).expect(200);
  });

  it('ends the session when a replaced token is reused later (token theft)', async () => {
    const stolen = refreshCookie(await register().expect(201));
    const current = refreshCookie(await refresh(stolen).expect(200));
    advance(ROTATION_GRACE_MS + 1000);

    expect(errorCode(await refresh(stolen).expect(401))).toBe('session_expired');
    // The legitimate holder is signed out too, because the session can no longer be trusted.
    expect(errorCode(await refresh(current).expect(401))).toBe('session_expired');
  });

  it('requires a cookie, and clears an unknown one', async () => {
    expect(errorCode(await refresh().expect(401))).toBe('session_expired');
    const unknown = await refresh('sabaq_refresh=unknown').expect(401);
    expect(String(unknown.headers['set-cookie'])).toContain('sabaq_refresh=;');
  });

  it('ends after 30 days without use', async () => {
    const cookie = refreshCookie(await register().expect(201));
    advance(30 * 24 * 60 * 60_000 + 1000);
    await refresh(cookie).expect(401);
  });

  it('rejects requests sent from other websites', async () => {
    const cookie = refreshCookie(await register().expect(201));
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .expect(403);
    expect(errorCode(response)).toBe('forbidden');
  });
});

describe('signing out', () => {
  it('ends this session and clears the cookie', async () => {
    const cookie = refreshCookie(await register().expect(201));
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Origin', APP_URL)
      .set('Cookie', cookie)
      .expect(204);
    expect(String(response.headers['set-cookie'])).toContain('sabaq_refresh=;');
    await refresh(cookie).expect(401);
    // Signing out again, or without a cookie, is harmless.
    await request(app).post('/api/auth/logout').set('Origin', APP_URL).expect(204);
  });

  it('can end every session at once', async () => {
    await register().expect(201);
    const laptop = await login().expect(200);
    const phone = await login().expect(200);
    await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', bearer(laptop))
      .expect(204);
    await me(bearer(phone)).expect(401);
    await refresh(refreshCookie(phone)).expect(401);
  });
});

describe('devices', () => {
  it('lists signed-in devices and signs one out', async () => {
    await register().expect(201);
    const laptop = await login().expect(200);
    const phone = await request(app)
      .post('/api/auth/login')
      .set(
        'User-Agent',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1',
      )
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    const list = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', bearer(laptop))
      .expect(200);
    const sessions = sessionInfoSchema.array().parse(list.body);
    expect(sessions).toHaveLength(3);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);
    const iphone = sessions.find((session) => session.device === 'Safari on iOS');
    expect(iphone).toBeDefined();

    await request(app)
      .delete(`/api/auth/sessions/${iphone?.id}`)
      .set('Authorization', bearer(laptop))
      .expect(204);
    await me(bearer(phone)).expect(401);

    const missing = await request(app)
      .delete(`/api/auth/sessions/${iphone?.id}`)
      .set('Authorization', bearer(laptop))
      .expect(404);
    expect(errorCode(missing)).toBe('not_found');
    await request(app)
      .delete('/api/auth/sessions/not-an-id')
      .set('Authorization', bearer(laptop))
      .expect(404);
  });

  it('cannot use or end another person’s session', async () => {
    const zara = await register().expect(201);
    const ali = await register({ email: 'ali@example.com' }).expect(201);
    const aliSession = await SessionModel.findOne({ userId: ali.body.user.id });
    await request(app)
      .delete(`/api/auth/sessions/${String(aliSession?._id)}`)
      .set('Authorization', bearer(zara))
      .expect(404);
  });
});

describe('e-mail verification', () => {
  it('confirms the address with the e-mailed link, once', async () => {
    const response = await register().expect(201);
    const token = mailer.lastToken(EMAIL);
    await post('/verify-email', { token }).expect(204);
    expect((await me(bearer(response)).expect(200)).body.emailVerified).toBe(true);
    expect(errorCode(await post('/verify-email', { token }).expect(400))).toBe('invalid_token');
  });

  it('rejects expired and malformed links', async () => {
    await register().expect(201);
    const token = mailer.lastToken(EMAIL);
    advance(24 * 60 * 60_000 + 1000);
    expect(errorCode(await post('/verify-email', { token }).expect(400))).toBe('invalid_token');
    expect(errorCode(await post('/verify-email', { token: 'short' }).expect(400))).toBe(
      'validation_failed',
    );
  });

  it('resends links at most once a minute, and never reveals whether an account exists', async () => {
    await register().expect(201);
    await post('/resend-verification', { email: EMAIL }).expect(202);
    expect(mailer.sent).toHaveLength(1);

    advance(61_000);
    await post('/resend-verification', { email: EMAIL }).expect(202);
    expect(mailer.sent).toHaveLength(2);
    // Only the newest link works.
    await post('/verify-email', { token: mailer.lastToken(EMAIL) }).expect(204);

    advance(61_000);
    await post('/resend-verification', { email: EMAIL }).expect(202);
    await post('/resend-verification', { email: 'nobody@example.com' }).expect(202);
    expect(mailer.sent).toHaveLength(2);
  });
});

describe('forgotten passwords', () => {
  beforeEach(async () => {
    await register().expect(201);
    mailer.sent.length = 0;
  });

  it('resets the password with a one-hour link and signs out everywhere', async () => {
    const before = await login().expect(200);
    await post('/forgot-password', { email: EMAIL }).expect(202);
    expect(mailer.sent[0]?.subject).toBe('Reset your Sabaq password');
    const token = mailer.lastToken(EMAIL);

    await post('/reset-password', { token, password: 'a brand new password' }).expect(204);
    await me(bearer(before)).expect(401);
    await login().expect(401);
    const after = await login('a brand new password').expect(200);
    expect(after.body.user.emailVerified).toBe(true);
    expect(mailer.sent.at(-1)?.subject).toBe('Your Sabaq password was changed');

    expect(
      errorCode(await post('/reset-password', { token, password: 'another password' }).expect(400)),
    ).toBe('invalid_token');
  });

  it('unlocks a locked account', async () => {
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS; attempt += 1) await login('wrong password');
    await login().expect(429);
    await post('/forgot-password', { email: EMAIL }).expect(202);
    await post('/reset-password', {
      token: mailer.lastToken(EMAIL),
      password: 'a brand new password',
    }).expect(204);
    await login('a brand new password').expect(200);
  });

  it('does not reveal whether an account exists', async () => {
    await post('/forgot-password', { email: 'nobody@example.com' }).expect(202);
    expect(mailer.sent).toHaveLength(0);
  });

  it('expires the link after an hour', async () => {
    await post('/forgot-password', { email: EMAIL }).expect(202);
    advance(60 * 60_000 + 1000);
    await post('/reset-password', {
      token: mailer.lastToken(EMAIL),
      password: 'a brand new password',
    }).expect(400);
  });
});

describe('changing the password', () => {
  it('requires the current password, keeps this device and signs out the others', async () => {
    await register().expect(201);
    const laptop = await login().expect(200);
    const phone = await login().expect(200);
    const change = (body: object) =>
      request(app)
        .post('/api/auth/change-password')
        .set('Authorization', bearer(laptop))
        .send(body);

    const wrong = await change({
      currentPassword: 'not my password',
      newPassword: 'a brand new password',
    }).expect(400);
    expect(wrong.body.error.issues).toEqual([
      { path: 'currentPassword', code: 'incorrect', message: 'The current password is incorrect.' },
    ]);
    const same = await change({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400);
    expect(same.body.error.issues[0].path).toBe('newPassword');

    await change({ currentPassword: PASSWORD, newPassword: 'a brand new password' }).expect(204);
    await me(bearer(laptop)).expect(200);
    await me(bearer(phone)).expect(401);
    await login('a brand new password').expect(200);
    expect(mailer.sent.at(-1)?.subject).toBe('Your Sabaq password was changed');
  });
});

describe('abuse protection', () => {
  it('rate-limits sign-in attempts per client', async () => {
    build({ AUTH_RATE_LIMIT_MAX: '2' });
    await register().expect(201);
    await login('wrong password').expect(401);
    const limited = await login().expect(429);
    expect(errorCode(limited)).toBe('rate_limited');
  });
});

describe('deleted accounts', () => {
  it('end their sessions', async () => {
    const response = await register().expect(201);
    const cookie = refreshCookie(response);
    await UserModel.deleteOne({ email: EMAIL });
    expect(errorCode(await me(bearer(response)).expect(401))).toBe('session_expired');
    await refresh(cookie).expect(401);
  });
});

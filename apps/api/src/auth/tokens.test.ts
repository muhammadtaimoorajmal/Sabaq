import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { describeDevice } from './device.js';
import { hashToken, randomToken, signAccessToken, verifyAccessToken } from './tokens.js';

const SECRET = 'a-test-secret-that-is-at-least-32-characters';
const NOW = new Date('2026-11-22T10:00:00Z');
const claims = { userId: '6741f0c2a1b2c3d4e5f60718', sessionId: '6741f0c2a1b2c3d4e5f60719' };

describe('random tokens', () => {
  it('are 43 URL-safe characters and unique', () => {
    const tokens = new Set(Array.from({ length: 100 }, randomToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(token).toMatch(/^[\w-]{43}$/);
  });

  it('are stored as a stable hash that differs from the token', () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });
});

describe('access tokens', () => {
  it('carry the user and session until they expire', async () => {
    const { token, expiresAt } = await signAccessToken(claims, {
      secret: SECRET,
      ttlSeconds: 900,
      now: NOW,
    });
    expect(expiresAt.toISOString()).toBe('2026-11-22T10:15:00.000Z');
    expect(await verifyAccessToken(token, { secret: SECRET, now: NOW })).toEqual({
      ok: true,
      ...claims,
    });
    expect(
      await verifyAccessToken(token, { secret: SECRET, now: new Date('2026-11-22T10:15:01Z') }),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  it('reject tampering, other secrets and tokens without a session', async () => {
    const { token } = await signAccessToken(claims, { secret: SECRET, ttlSeconds: 900, now: NOW });
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'someone-else', sid: 'x' })).toString(
      'base64url',
    );
    const invalid = { ok: false, reason: 'invalid' };

    expect(
      await verifyAccessToken(`${header}.${forgedPayload}.${signature}`, {
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual(invalid);
    expect(await verifyAccessToken(token, { secret: `${SECRET}-other`, now: NOW })).toEqual(
      invalid,
    );

    const noSession = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer('sabaq-api')
      .setAudience('sabaq-web')
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 60)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyAccessToken(noSession, { secret: SECRET, now: NOW })).toEqual(invalid);
  });
});

describe('describeDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
      'Chrome on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0',
      'Edge on Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      'Safari on macOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
      'Samsung Internet on Android',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox on Linux'],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
      'Chrome on ChromeOS',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 OPR/114.0',
      'Opera on Windows',
    ],
    ['curl/8.5.0', 'Unknown device'],
    ['SomeBot (Windows)', 'Windows'],
    [undefined, 'Unknown device'],
  ])('%s → %s', (userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected);
  });
});

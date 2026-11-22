import { createHash, randomBytes } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';

const ISSUER = 'sabaq-api';
const AUDIENCE = 'sabaq-web';

/** 256 bits of randomness as 43 URL-safe characters: refresh tokens and e-mail links. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only hashes of tokens are stored, so a database leak does not reveal usable tokens.
 * The tokens are random, so a fast hash is sufficient (unlike passwords).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

const keyOf = (secret: string) => new TextEncoder().encode(secret);

/** Signs a short-lived access token (HS256) for one user and session. */
export async function signAccessToken(
  { userId, sessionId }: AccessClaims,
  { secret, ttlSeconds, now }: { secret: string; ttlSeconds: number; now: Date },
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const token = await new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(keyOf(secret));
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

export type AccessTokenResult =
  ({ ok: true } & AccessClaims) | { ok: false; reason: 'expired' | 'invalid' };

/** Verifies signature, issuer, audience, algorithm and expiry. Never throws. */
export async function verifyAccessToken(
  token: string,
  { secret, now }: { secret: string; now: Date },
): Promise<AccessTokenResult> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, userId: payload.sub, sessionId: payload.sid };
  } catch (error) {
    return { ok: false, reason: error instanceof errors.JWTExpired ? 'expired' : 'invalid' };
  }
}

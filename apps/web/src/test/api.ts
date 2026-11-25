import { DEFAULT_PREFERENCES, type AuthResponse, type User } from '@sabaq/shared';
import { vi } from 'vitest';
import { clientState } from '../api/client';

export const TEST_USER: User = {
  id: '6741f0c2a1b2c3d4e5f60718',
  name: 'Zara Ahmed',
  email: 'zara.ahmed@northfield.example',
  emailVerified: true,
  studentId: 'NU-24-0002',
  avatarUrl: null,
  platformRole: 'user',
  preferences: { ...DEFAULT_PREFERENCES, timeZone: 'Asia/Karachi' },
  onboardedAt: '2026-09-01T09:05:00.000Z',
  createdAt: '2026-09-01T09:00:00.000Z',
};

export const session = (user: User = TEST_USER): AuthResponse => ({
  user,
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-11-22T10:15:00.000Z',
});

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

export const apiError = (status: number, code: string, message = code) =>
  json(status, { error: { code, message, requestId: 'req-test' } });

type Handler = (request: {
  method: string;
  body: unknown;
  headers: Record<string, string>;
}) => Response | Promise<Response>;

/** Routes keyed as "METHOD /path", for example "POST /api/auth/login". */
export type Handlers = Record<string, Handler>;

const DEFAULTS: Handlers = {
  'GET /api/health': () => json(200, { status: 'ok' }),
  'POST /api/auth/refresh': () => apiError(401, 'session_expired'),
  'POST /api/auth/logout': () => json(204),
  'GET /api/classes': () => json(200, []),
};

/**
 * Replaces `fetch` with an in-memory API. Unknown routes answer 404, so a test fails loudly
 * when the app calls something unexpected. Returns the mock to inspect calls.
 */
export function mockApi(handlers: Handlers = {}) {
  const routes = { ...DEFAULTS, ...handlers };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init.method ?? 'GET';
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) return apiError(404, 'not_found', `No mock for ${method} ${url.pathname}`);
    return handler({
      method,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Calls made to one route. */
export function callsTo(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      new URL(String(input), 'http://localhost').pathname === path &&
      (init?.method ?? 'GET') === method,
  );
}

export function resetClient() {
  clientState.setSession(null);
}

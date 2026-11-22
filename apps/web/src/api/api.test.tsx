import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiError, callsTo, json, mockApi, session } from '../test/api';
import { api, ApiRequestError, clientState, refreshSession } from './client';
import { ConnectionProvider, RETRY_DELAYS_MS, useConnection, WAKING_AFTER_MS } from './connection';
import { createQueryClient } from './query-client';

describe('api', () => {
  it('sends JSON with the access token and parses the response', async () => {
    const fetchMock = mockApi({
      'POST /api/things': ({ body, headers }) => json(201, { body, auth: headers.Authorization }),
    });
    clientState.setSession(session());
    await expect(api('/things', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      body: { a: 1 },
      auth: 'Bearer access-token',
    });
    expect(callsTo(fetchMock, 'POST', '/api/things')[0]?.[1]).toMatchObject({
      credentials: 'include',
    });
  });

  it('refreshes an expired access token once and retries the request', async () => {
    let calls = 0;
    const fetchMock = mockApi({
      'GET /api/me': () =>
        calls++ === 0 ? apiError(401, 'session_expired') : json(200, { ok: true }),
      'POST /api/auth/refresh': () => json(200, session()),
    });
    clientState.setSession(session());
    await expect(api('/me')).resolves.toEqual({ ok: true });
    expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(1);
  });

  it('shares one refresh between parallel requests', async () => {
    const fetchMock = mockApi({ 'POST /api/auth/refresh': () => json(200, session()) });
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(callsTo(fetchMock, 'POST', '/api/auth/refresh')).toHaveLength(1);
  });

  it('ends the session when the refresh fails', async () => {
    mockApi({ 'GET /api/me': () => apiError(401, 'session_expired') });
    const listener = vi.fn();
    clientState.setSession(session());
    const stop = clientState.onSessionChange(listener);
    await expect(api('/me')).rejects.toMatchObject({ code: 'session_expired', status: 401 });
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(clientState.accessToken).toBeNull();
    stop();
  });

  it('turns API errors, unexpected bodies and network failures into ApiRequestError', async () => {
    mockApi({
      'POST /api/fail': () => apiError(400, 'validation_failed', 'Some fields are not valid.'),
      'GET /api/odd': () => new Response('<html>', { status: 502 }),
    });
    await expect(api('/fail', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'validation_failed',
      requestId: 'req-test',
    });
    await expect(api('/odd')).rejects.toMatchObject({ code: 'unknown', status: 502 });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const network = vi.fn();
    const stop = clientState.onNetwork(network);
    await expect(api('/anything')).rejects.toBeInstanceOf(ApiRequestError);
    expect(network).toHaveBeenCalledWith(false);
    stop();
  });

  it('passes cancellation through and returns nothing for empty responses', async () => {
    mockApi({
      'DELETE /api/thing': () => json(204),
      'GET /api/empty': () => new Response('', { status: 200 }),
    });
    await expect(api('/thing', { method: 'DELETE' })).resolves.toBeUndefined();
    await expect(api('/empty')).resolves.toBeUndefined();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );
    await expect(api('/slow')).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('query client', () => {
  it('never retries client errors but retries server and network errors twice', () => {
    const retry = createQueryClient().getDefaultOptions().queries?.retry as (
      failures: number,
      error: unknown,
    ) => boolean;
    expect(retry(0, new ApiRequestError(404, 'not_found', 'x'))).toBe(false);
    expect(retry(0, new ApiRequestError(500, 'internal_error', 'x'))).toBe(true);
    expect(retry(1, new ApiRequestError(0, 'network', 'x'))).toBe(true);
    expect(retry(2, new Error('x'))).toBe(false);
  });
});

function Status() {
  const { status, retry } = useConnection();
  return (
    <button type="button" onClick={retry}>
      {status}
    </button>
  );
}

describe('ConnectionProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a slow server as waking, then online', async () => {
    vi.useFakeTimers();
    let answer: (ok: boolean) => void = () => undefined;
    const ping = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    render(
      <ConnectionProvider ping={ping}>
        <Status />
      </ConnectionProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('checking');
    await act(() => vi.advanceTimersByTimeAsync(WAKING_AFTER_MS));
    expect(screen.getByRole('button')).toHaveTextContent('waking');
    await act(async () => answer(true));
    expect(screen.getByRole('button')).toHaveTextContent('online');
  });

  it('keeps retrying an unreachable server and can retry on request', async () => {
    vi.useFakeTimers();
    const ping = vi.fn(() => Promise.resolve(false));
    render(
      <ConnectionProvider ping={ping}>
        <Status />
      </ConnectionProvider>,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('button')).toHaveTextContent('waking');
    await act(() => vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] ?? 0));
    expect(ping).toHaveBeenCalledTimes(2);

    ping.mockResolvedValue(true);
    await act(async () => screen.getByRole('button').click());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByRole('button')).toHaveTextContent('online');
  });

  it('follows the browser going offline and online, and API calls that succeed or fail', async () => {
    const ping = vi.fn(() => Promise.resolve(true));
    render(
      <ConnectionProvider ping={ping}>
        <Status />
      </ConnectionProvider>,
    );
    await screen.findByText('online');
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('button')).toHaveTextContent('offline');
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(screen.getByRole('button')).toHaveTextContent('online');

    act(() => clientState.reportNetwork(false));
    await screen.findByText('online');
    act(() => clientState.reportNetwork(true));
    expect(screen.getByRole('button')).toHaveTextContent('online');
  });

  it('must be used inside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Status />)).toThrow(
      'useConnection must be used inside <ConnectionProvider>',
    );
  });
});

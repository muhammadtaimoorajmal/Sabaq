import {
  type ApiErrorCode,
  apiErrorSchema,
  type AuthResponse,
  type FieldIssue,
} from '@sabaq/shared';

/** Same origin by default: the host forwards /api to the API server. */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/** A failed API call: the API's error code (or "network"), message, field issues and request ID. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | 'network' | 'unknown',
    message: string,
    readonly issues: FieldIssue[] = [],
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type Listener<T> = (value: T) => void;

/** Shared state of the client: the in-memory access token and connection events. */
class ClientState {
  accessToken: string | null = null;
  private refreshing: Promise<AuthResponse | null> | null = null;
  private readonly sessionListeners = new Set<Listener<AuthResponse | null>>();
  private readonly networkListeners = new Set<Listener<boolean>>();

  onSessionChange(listener: Listener<AuthResponse | null>) {
    this.sessionListeners.add(listener);
    return () => void this.sessionListeners.delete(listener);
  }

  onNetwork(listener: Listener<boolean>) {
    this.networkListeners.add(listener);
    return () => void this.networkListeners.delete(listener);
  }

  setSession(session: AuthResponse | null) {
    this.accessToken = session?.accessToken ?? null;
    for (const listener of this.sessionListeners) listener(session);
  }

  reportNetwork(reachable: boolean) {
    for (const listener of this.networkListeners) listener(reachable);
  }

  /** One refresh at a time: parallel requests that all expire wait for the same refresh. */
  refreshOnce(run: () => Promise<AuthResponse | null>) {
    this.refreshing ??= run().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
}

export const clientState = new ClientState();

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the access token and refresh it once if it has expired. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, { method = 'GET', body, auth = true, signal }: RequestOptions) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && clientState.accessToken) headers.Authorization = `Bearer ${clientState.accessToken}`;
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
    clientState.reportNetwork(true);
    return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    clientState.reportNetwork(false);
    throw new ApiRequestError(0, 'network', 'The server could not be reached.');
  }
}

async function toError(response: Response): Promise<ApiRequestError> {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return new ApiRequestError(
      response.status,
      'unknown',
      `Request failed with status ${response.status}.`,
    );
  }
  const { code, message, issues, requestId } = parsed.data.error;
  return new ApiRequestError(response.status, code, message, issues, requestId);
}

/** Exchanges the refresh cookie for a new session; `null` when there is no valid session. */
export function refreshSession(): Promise<AuthResponse | null> {
  return clientState.refreshOnce(async () => {
    const response = await send('/auth/refresh', { method: 'POST', auth: false });
    if (!response.ok) {
      clientState.setSession(null);
      return null;
    }
    const session = (await response.json()) as AuthResponse;
    clientState.setSession(session);
    return session;
  });
}

/**
 * Calls the API and returns the parsed JSON body (or `undefined` for empty responses). An
 * expired access token is refreshed once and the request retried, so people are never asked to
 * sign in again while their session is still valid.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  const auth = options.auth ?? true;
  if (response.status === 401 && auth && clientState.accessToken) {
    const session = await refreshSession();
    if (session) response = await send(path, options);
  }
  if (!response.ok) throw await toError(response);
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

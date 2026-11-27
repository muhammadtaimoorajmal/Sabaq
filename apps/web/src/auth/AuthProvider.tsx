import type { AuthResponse, User } from '@sabaq/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, clientState, refreshSession } from '../api/client';
import { useConnection } from '../api/connection';
import { clearOfflineData, loadOfflineUser, saveOfflineUser } from '../api/offline';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason: 'initial' | 'expired' | 'signed-out' }
  /** `offline`: opened without a connection, from what this device remembers. */
  | { status: 'authenticated'; user: User; offline?: boolean };

interface AuthValue {
  state: AuthState;
  /** Stores a session returned by sign-up or sign-in. */
  signIn: (session: AuthResponse) => void;
  /** Ends this device's session on the server and locally. */
  signOut: () => Promise<void>;
  /** Forgets the session locally after it was ended elsewhere (for example "all devices"). */
  endLocally: () => void;
  /** Replaces the signed-in user after a change, such as a confirmed e-mail address. */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Restores the session from the refresh cookie on load, and notices when it ends: a session
 * that expires while someone is working leads them back to sign-in with an explanation.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const { status: connection } = useConnection();
  const endingOnPurpose = useRef(false);

  useEffect(() => {
    const stop = clientState.onSessionChange((session) => {
      if (session) {
        saveOfflineUser(session.user);
        setState({ status: 'authenticated', user: session.user });
        return;
      }
      // The session is over (not merely unreachable): forget what was kept for offline use.
      clearOfflineData();
      setState((current) =>
        current.status === 'authenticated'
          ? { status: 'anonymous', reason: endingOnPurpose.current ? 'signed-out' : 'expired' }
          : {
              status: 'anonymous',
              reason: current.status === 'anonymous' ? current.reason : 'initial',
            },
      );
      endingOnPurpose.current = false;
    });
    refreshSession().catch(() => {
      // No connection: open with what this device remembers, if anything.
      const remembered = loadOfflineUser();
      setState(
        remembered
          ? { status: 'authenticated', user: remembered, offline: true }
          : { status: 'anonymous', reason: 'initial' },
      );
    });
    return stop;
  }, []);

  // Back online after opening offline: restore the real session (or learn that it ended).
  const offline = state.status === 'authenticated' && state.offline === true;
  useEffect(() => {
    if (offline && connection === 'online') refreshSession().catch(() => undefined);
  }, [offline, connection]);

  const signIn = useCallback((session: AuthResponse) => clientState.setSession(session), []);

  const endLocally = useCallback(() => {
    endingOnPurpose.current = true;
    clientState.setSession(null);
    queryClient.clear();
  }, [queryClient]);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
    endLocally();
  }, [endLocally]);

  const updateUser = useCallback((user: User) => {
    saveOfflineUser(user);
    setState((current) =>
      current.status === 'authenticated' ? { status: 'authenticated', user } : current,
    );
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, endLocally, updateUser }),
    [state, signIn, signOut, endLocally, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in user; only for screens behind `RequireAuth`. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated')
    throw new Error('useCurrentUser used without a signed-in user');
  return state.user;
}

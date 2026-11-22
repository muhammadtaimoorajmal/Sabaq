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
import { API_BASE, clientState } from './client';

/**
 * - `checking`: first contact in progress.
 * - `waking`: the server is taking a while, typically because a free host is starting it up.
 * - `online`: the API answers.
 * - `offline`: the device has no connection or the API cannot be reached.
 */
export type ConnectionStatus = 'checking' | 'waking' | 'online' | 'offline';

/** After this long without an answer, people are told the server is waking up. */
export const WAKING_AFTER_MS = 2500;
export const RETRY_DELAYS_MS = [3000, 6000, 12_000, 20_000];

interface ConnectionValue {
  status: ConnectionStatus;
  retry: () => void;
}

const ConnectionContext = createContext<ConnectionValue | null>(null);

const defaultPing = () =>
  fetch(`${API_BASE}/health`, { cache: 'no-store' }).then((response) => response.ok);

/**
 * Watches whether the API is reachable and says so honestly: a free-tier server can need up to
 * a minute to wake, which is far better explained than left as a mysterious spinner.
 */
export function ConnectionProvider({
  children,
  ping = defaultPing,
}: {
  children: ReactNode;
  ping?: () => Promise<boolean>;
}) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  // Changing this restarts the checks (the "Try again" button).
  const [round, setRound] = useState(0);
  const pingRef = useRef(ping);

  useEffect(() => {
    pingRef.current = ping;
  }, [ping]);

  useEffect(() => {
    let active = true;
    let attempt = 0;
    const timers = new Set<number>();
    const later = (run: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        run();
      }, delay);
      timers.add(timer);
      return timer;
    };

    async function check() {
      const waking = later(
        () => setStatus((current) => (current === 'online' ? current : 'waking')),
        WAKING_AFTER_MS,
      );
      const reachable = await pingRef.current().catch(() => false);
      window.clearTimeout(waking);
      timers.delete(waking);
      if (!active) return;
      if (reachable) {
        attempt = 0;
        setStatus('online');
        return;
      }
      setStatus(navigator.onLine === false ? 'offline' : 'waking');
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 20_000;
      attempt += 1;
      later(() => void check(), delay);
    }

    void check();
    const goOffline = () => setStatus('offline');
    const goOnline = () => void check();
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    const stop = clientState.onNetwork((reachable) => {
      if (reachable) setStatus('online');
      else void check();
    });
    return () => {
      active = false;
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      stop();
    };
  }, [round]);

  const retry = useCallback(() => {
    setStatus('checking');
    setRound((current) => current + 1);
  }, []);

  const value = useMemo(() => ({ status, retry }), [status, retry]);
  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionValue {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnection must be used inside <ConnectionProvider>');
  return context;
}

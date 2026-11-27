import type { User } from '@sabaq/shared';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/** Where the last server answers are kept on this device, for use without a connection. */
export const CACHE_KEY = 'sabaq.cache';
/** The signed-in person, so the app can open offline. Never contains a token. */
export const OFFLINE_USER_KEY = 'sabaq.offlineUser';
/** Saved answers older than this are not used. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Only what is needed offline is saved: the agenda, classes and announcements. */
const SAVED_QUERIES = new Set(['agenda', 'classes', 'announcements']);

export const browserStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export function persistOptions(
  storage: Storage,
  buster: string,
): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createSyncStoragePersister({ storage, key: CACHE_KEY, throttleTime: 250 }),
    maxAge: OFFLINE_MAX_AGE_MS,
    buster,
    dehydrateOptions: {
      shouldDehydrateQuery: (query: Query) =>
        query.state.status === 'success' && SAVED_QUERIES.has(String(query.queryKey[0])),
    },
  };
}

export function saveOfflineUser(user: User, storage = browserStorage()) {
  try {
    storage?.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  } catch {
    // A full or blocked storage only means the app cannot open offline.
  }
}

export function loadOfflineUser(storage = browserStorage()): User | null {
  try {
    const saved = storage?.getItem(OFFLINE_USER_KEY);
    return saved ? (JSON.parse(saved) as User) : null;
  } catch {
    return null;
  }
}

/** Removes everything kept for offline use; called when someone signs out. */
export function clearOfflineData(storage = browserStorage()) {
  try {
    storage?.removeItem(OFFLINE_USER_KEY);
    storage?.removeItem(CACHE_KEY);
  } catch {
    // Nothing was saved.
  }
}

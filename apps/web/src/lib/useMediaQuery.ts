import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query currently matches, updating as the viewport changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Screens at least this wide show the sidebar; narrower ones show the bottom bar. */
export const WIDE_SCREEN = '(min-width: 64rem)';

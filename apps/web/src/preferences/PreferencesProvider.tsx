import type { Preferences, PreferencesUpdate } from '@sabaq/shared';
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
import { useTranslation } from 'react-i18next';
import {
  applyPreferences,
  loadPreferences,
  mergePreferences,
  readSystemSettings,
  savePreferences,
  SYSTEM_QUERIES,
  type SystemSettings,
} from './preferences';

/** Receives each change the person makes, for example to save it to their account. */
export type PreferencesListener = (change: PreferencesUpdate) => void;

interface PreferencesContextValue {
  preferences: Preferences;
  system: SystemSettings;
  /** A change made by the person; applied instantly and passed to the listener. */
  update: (update: PreferencesUpdate) => void;
  /** Takes over preferences saved elsewhere (the person's account) without echoing them back. */
  adopt: (preferences: Preferences) => void;
  /** Sets the one listener for changes, or removes it with `null`. */
  listen: (listener: PreferencesListener | null) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const browserStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const media = (query: string) => window.matchMedia(query).matches;

/**
 * Holds the person's display preferences, applies them to the page, remembers them on this
 * device and follows system settings (dark mode, contrast, reduced motion) as they change.
 */
export function PreferencesProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Preferences;
}) {
  const { i18n } = useTranslation();
  const [preferences, setPreferences] = useState(
    () => initial ?? loadPreferences(browserStorage()),
  );
  const [system, setSystem] = useState(() => readSystemSettings(media));

  useEffect(() => {
    const lists = Object.values(SYSTEM_QUERIES).map((query) => window.matchMedia(query));
    const refresh = () => setSystem(readSystemSettings(media));
    for (const list of lists) list.addEventListener('change', refresh);
    return () => {
      for (const list of lists) list.removeEventListener('change', refresh);
    };
  }, []);

  useEffect(() => {
    applyPreferences(document.documentElement, preferences, system);
    savePreferences(browserStorage(), preferences);
    if (i18n.language !== preferences.language) void i18n.changeLanguage(preferences.language);
  }, [preferences, system, i18n]);

  const listener = useRef<PreferencesListener | null>(null);
  const update = useCallback((change: PreferencesUpdate) => {
    setPreferences((current) => mergePreferences(current, change));
    listener.current?.(change);
  }, []);
  const adopt = useCallback((next: Preferences) => setPreferences(next), []);
  const listen = useCallback((next: PreferencesListener | null) => {
    listener.current = next;
  }, []);

  const value = useMemo(
    () => ({ preferences, system, update, adopt, listen }),
    [preferences, system, update, adopt, listen],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return context;
}

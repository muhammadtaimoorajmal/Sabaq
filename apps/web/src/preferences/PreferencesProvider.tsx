import type { Preferences, PreferencesUpdate } from '@sabaq/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

interface PreferencesContextValue {
  preferences: Preferences;
  system: SystemSettings;
  update: (update: PreferencesUpdate) => void;
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

  const update = useCallback((change: PreferencesUpdate) => {
    setPreferences((current) => mergePreferences(current, change));
  }, []);

  const value = useMemo(() => ({ preferences, system, update }), [preferences, system, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return context;
}

import {
  DEFAULT_PREFERENCES,
  type Preferences,
  type PreferencesUpdate,
  preferencesUpdateSchema,
  RTL_LANGUAGES,
} from '@sabaq/shared';

export const STORAGE_KEY = 'sabaq.preferences';

export type ResolvedTheme = 'light' | 'dark' | 'high-contrast';

/** What the operating system asks for; read through `matchMedia`. */
export interface SystemSettings {
  dark: boolean;
  moreContrast: boolean;
  reducedMotion: boolean;
}

export const SYSTEM_QUERIES = {
  dark: '(prefers-color-scheme: dark)',
  moreContrast: '(prefers-contrast: more)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
} as const;

export function readSystemSettings(media: (query: string) => boolean): SystemSettings {
  return {
    dark: media(SYSTEM_QUERIES.dark),
    moreContrast: media(SYSTEM_QUERIES.moreContrast),
    reducedMotion: media(SYSTEM_QUERIES.reducedMotion),
  };
}

/** "System" follows the operating system: high contrast first, then dark or light. */
export function resolveTheme(theme: Preferences['theme'], system: SystemSettings): ResolvedTheme {
  if (theme !== 'system') return theme;
  if (system.moreContrast) return 'high-contrast';
  return system.dark ? 'dark' : 'light';
}

export function resolveMotion(motion: Preferences['motion'], system: SystemSettings) {
  if (motion === 'system') return system.reducedMotion ? 'reduce' : 'full';
  return motion;
}

/** Applies display preferences to the document root (kept in sync with index.html). */
export function applyPreferences(
  root: HTMLElement,
  preferences: Preferences,
  system: SystemSettings,
): void {
  root.dataset.theme = resolveTheme(preferences.theme, system);
  root.dataset.density = preferences.density;
  root.dataset.motion = resolveMotion(preferences.motion, system);
  root.style.setProperty('--text-scale', String(preferences.textScale));
  root.lang = preferences.language;
  root.dir = RTL_LANGUAGES.includes(preferences.language) ? 'rtl' : 'ltr';
}

/** Applies a partial update, including nested notification settings. */
export function mergePreferences(base: Preferences, update: PreferencesUpdate): Preferences {
  const { notifications, ...rest } = update;
  return {
    ...base,
    ...rest,
    notifications: {
      ...base.notifications,
      ...notifications,
      quietHours: { ...base.notifications.quietHours, ...notifications?.quietHours },
    },
  };
}

/** Reads saved preferences, ignoring anything invalid or unreadable. */
export function loadPreferences(storage: Pick<Storage, 'getItem'> | undefined): Preferences {
  try {
    const parsed = preferencesUpdateSchema.safeParse(
      JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}'),
    );
    return parsed.success
      ? mergePreferences(DEFAULT_PREFERENCES, parsed.data)
      : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(
  storage: Pick<Storage, 'setItem'> | undefined,
  preferences: Preferences,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private browsing or a full disk: preferences simply last for this visit.
  }
}

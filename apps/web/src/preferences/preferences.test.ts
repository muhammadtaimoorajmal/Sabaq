import { DEFAULT_PREFERENCES } from '@sabaq/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  applyPreferences,
  loadPreferences,
  mergePreferences,
  readSystemSettings,
  resolveMotion,
  resolveTheme,
  savePreferences,
  STORAGE_KEY,
} from './preferences';

const plainSystem = { dark: false, moreContrast: false, reducedMotion: false };

describe('resolveTheme', () => {
  it('follows the device when set to "system", preferring high contrast', () => {
    expect(resolveTheme('system', plainSystem)).toBe('light');
    expect(resolveTheme('system', { ...plainSystem, dark: true })).toBe('dark');
    expect(resolveTheme('system', { ...plainSystem, dark: true, moreContrast: true })).toBe(
      'high-contrast',
    );
  });

  it('respects an explicit choice over the device', () => {
    expect(resolveTheme('light', { ...plainSystem, dark: true })).toBe('light');
    expect(resolveTheme('high-contrast', plainSystem)).toBe('high-contrast');
  });
});

describe('resolveMotion', () => {
  it('follows the device unless chosen explicitly', () => {
    expect(resolveMotion('system', { ...plainSystem, reducedMotion: true })).toBe('reduce');
    expect(resolveMotion('system', plainSystem)).toBe('full');
    expect(resolveMotion('full', { ...plainSystem, reducedMotion: true })).toBe('full');
  });
});

describe('applyPreferences', () => {
  it('sets theme, density, motion, text size, language and direction on the root', () => {
    const root = document.createElement('html');
    applyPreferences(
      root,
      {
        ...DEFAULT_PREFERENCES,
        theme: 'dark',
        density: 'compact',
        textScale: 1.25,
        language: 'ur',
        motion: 'reduce',
      },
      plainSystem,
    );
    expect(root.dataset).toMatchObject({ theme: 'dark', density: 'compact', motion: 'reduce' });
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.25');
    expect(root.lang).toBe('ur');
    expect(root.dir).toBe('rtl');

    applyPreferences(root, DEFAULT_PREFERENCES, plainSystem);
    expect(root.dir).toBe('ltr');
  });
});

describe('readSystemSettings', () => {
  it('asks the browser for each setting', () => {
    const media = vi.fn((query: string) => query.includes('dark'));
    expect(readSystemSettings(media)).toEqual({
      dark: true,
      moreContrast: false,
      reducedMotion: false,
    });
    expect(media).toHaveBeenCalledTimes(3);
  });
});

describe('mergePreferences', () => {
  it('merges nested notification settings without losing siblings', () => {
    const merged = mergePreferences(DEFAULT_PREFERENCES, {
      theme: 'dark',
      notifications: { quietHours: { enabled: true } },
    });
    expect(merged.theme).toBe('dark');
    expect(merged.notifications.quietHours).toEqual({
      enabled: true,
      start: '22:00',
      end: '07:00',
    });
    expect(merged.notifications.digest).toBe(DEFAULT_PREFERENCES.notifications.digest);
  });
});

describe('storage', () => {
  it('saves and loads preferences', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    savePreferences(storage, { ...DEFAULT_PREFERENCES, textScale: 1.5 });
    expect(loadPreferences(storage).textScale).toBe(1.5);
  });

  it('falls back to defaults for missing, corrupt, invalid or unavailable storage', () => {
    expect(loadPreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences({ getItem: () => '{not json' })).toEqual(DEFAULT_PREFERENCES);
    expect(loadPreferences({ getItem: () => JSON.stringify({ textScale: 9 }) })).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      loadPreferences({
        getItem: () => {
          throw new Error('denied');
        },
      }),
    ).toEqual(DEFAULT_PREFERENCES);
    expect(() =>
      savePreferences(
        {
          setItem: () => {
            throw new Error('quota');
          },
        },
        DEFAULT_PREFERENCES,
      ),
    ).not.toThrow();
    expect(STORAGE_KEY).toBe('sabaq.preferences');
  });
});

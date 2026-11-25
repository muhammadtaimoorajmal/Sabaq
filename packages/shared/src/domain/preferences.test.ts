import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../schemas/user.js';
import { changedPreferencePaths, mergePreferences } from './preferences.js';

describe('mergePreferences', () => {
  it('changes only the given fields, including nested quiet hours', () => {
    const merged = mergePreferences(DEFAULT_PREFERENCES, {
      theme: 'dark',
      notifications: { quietHours: { start: '23:00' } },
    });
    expect(merged.theme).toBe('dark');
    expect(merged.notifications.quietHours).toEqual({
      enabled: false,
      start: '23:00',
      end: '07:00',
    });
    expect(merged.notifications.digest).toBe('immediate');
  });

  it('leaves everything as it was for an empty update', () => {
    expect(mergePreferences(DEFAULT_PREFERENCES, {})).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('changedPreferencePaths', () => {
  it('lists dotted paths for nested values and skips missing ones', () => {
    expect(
      changedPreferencePaths({
        textScale: 1.25,
        language: undefined,
        notifications: { email: true, quietHours: { enabled: true } },
      }),
    ).toEqual({
      'preferences.textScale': 1.25,
      'preferences.notifications.email': true,
      'preferences.notifications.quietHours.enabled': true,
    });
  });

  it('uses the given prefix', () => {
    expect(changedPreferencePaths({ theme: 'light' }, 'p')).toEqual({ 'p.theme': 'light' });
  });
});

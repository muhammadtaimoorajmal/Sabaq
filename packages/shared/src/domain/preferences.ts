import type { Preferences, PreferencesUpdate } from '../schemas/user.js';

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

/**
 * The fields a partial update changes, as dotted paths such as
 * `notifications.quietHours.start`, so a database update touches only those fields.
 */
export function changedPreferencePaths(
  update: PreferencesUpdate,
  prefix = 'preferences',
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  const visit = (value: object, path: string) => {
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) continue;
      if (typeof entry === 'object' && entry !== null) visit(entry, `${path}.${key}`);
      else paths[`${path}.${key}`] = entry;
    }
  };
  visit(update, prefix);
  return paths;
}

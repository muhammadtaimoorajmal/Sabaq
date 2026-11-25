import { mergePreferences, type PreferencesUpdate } from '@sabaq/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { savePreferences } from '../api/account';
import { useAuth } from '../auth/AuthProvider';
import { usePreferences } from './PreferencesProvider';

/** Changes made in quick succession (dragging the text size slider) are saved together. */
export const SAVE_DELAY_MS = 600;

/** Combines two partial updates, the later one winning field by field. */
export function combineUpdates(first: PreferencesUpdate, second: PreferencesUpdate) {
  const { notifications: a, ...restA } = first;
  const { notifications: b, ...restB } = second;
  const combined: PreferencesUpdate = { ...restA, ...restB };
  if (a || b) {
    combined.notifications = { ...a, ...b };
    if (a?.quietHours || b?.quietHours) {
      combined.notifications.quietHours = { ...a?.quietHours, ...b?.quietHours };
    }
  }
  return combined;
}

/**
 * Makes display preferences follow the person between devices: on sign-in the account's
 * preferences replace this device's, and every change made while signed in is saved to the
 * account a moment later. Without a connection the change still applies on this device.
 */
export function PreferencesSync() {
  const { t } = useTranslation();
  const { state, updateUser } = useAuth();
  const { adopt, listen } = usePreferences();
  const adoptedFor = useRef<string | null>(null);
  const userId = state.status === 'authenticated' ? state.user.id : null;

  useEffect(() => {
    if (state.status !== 'authenticated') {
      adoptedFor.current = null;
      return;
    }
    if (adoptedFor.current === state.user.id) return;
    adoptedFor.current = state.user.id;
    adopt(mergePreferences(state.user.preferences, {}));
  }, [state, adopt]);

  useEffect(() => {
    if (!userId) return;
    let pending: PreferencesUpdate = {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warned = false;
    const flush = (silent = false) => {
      const change = pending;
      pending = {};
      timer = undefined;
      savePreferences(change).then(
        (user) => {
          warned = false;
          updateUser(user);
        },
        () => {
          if (warned || silent) return;
          warned = true;
          toast.error(t('preferences.syncFailed'));
        },
      );
    };
    listen((change) => {
      pending = combineUpdates(pending, change);
      clearTimeout(timer);
      timer = setTimeout(() => flush(), SAVE_DELAY_MS);
    });
    return () => {
      listen(null);
      if (timer) {
        // Leaving (for example signing out) right after a change: still save it, quietly.
        clearTimeout(timer);
        flush(true);
      }
    };
  }, [userId, listen, updateUser, t]);

  return null;
}

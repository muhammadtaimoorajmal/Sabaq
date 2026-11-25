import { type Preferences, RTL_LANGUAGES } from '@sabaq/shared';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import { Direction } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { ConnectionProvider } from '../api/connection';
import { createQueryClient } from '../api/query-client';
import { AuthProvider } from '../auth/AuthProvider';
import { Toaster, TooltipProvider } from '../components/ui';
import { PreferencesProvider, usePreferences } from '../preferences/PreferencesProvider';
import { PreferencesSync } from '../preferences/PreferencesSync';

/** Tells every component the reading direction, so arrow keys follow it in Urdu too. */
function ReadingDirection({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  return (
    <Direction.Provider dir={RTL_LANGUAGES.includes(preferences.language) ? 'rtl' : 'ltr'}>
      {children}
    </Direction.Provider>
  );
}

/**
 * Everything every screen needs: translations, display preferences, server data, the
 * connection status, the session, tooltips and toasts.
 */
export function AppProviders({
  i18n,
  preferences,
  queryClient,
  children,
}: {
  i18n: i18n;
  preferences?: Preferences;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <I18nextProvider i18n={i18n}>
      <PreferencesProvider initial={preferences}>
        <ReadingDirection>
          <QueryClientProvider client={client}>
            <ConnectionProvider>
              <AuthProvider>
                <PreferencesSync />
                <TooltipProvider>
                  {children}
                  <Toaster />
                </TooltipProvider>
              </AuthProvider>
            </ConnectionProvider>
          </QueryClientProvider>
        </ReadingDirection>
      </PreferencesProvider>
    </I18nextProvider>
  );
}

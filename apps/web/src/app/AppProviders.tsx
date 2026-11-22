import { type Preferences, RTL_LANGUAGES } from '@sabaq/shared';
import type { i18n } from 'i18next';
import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Toaster, TooltipProvider } from '../components/ui';
import { PreferencesProvider, usePreferences } from '../preferences/PreferencesProvider';

/** Tells every component the reading direction, so arrow keys follow it in Urdu too. */
function ReadingDirection({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  return (
    <Direction.Provider dir={RTL_LANGUAGES.includes(preferences.language) ? 'rtl' : 'ltr'}>
      {children}
    </Direction.Provider>
  );
}

/** Everything every screen needs: translations, display preferences, tooltips and toasts. */
export function AppProviders({
  i18n,
  preferences,
  children,
}: {
  i18n: i18n;
  preferences?: Preferences;
  children: ReactNode;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <PreferencesProvider initial={preferences}>
        <ReadingDirection>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ReadingDirection>
      </PreferencesProvider>
    </I18nextProvider>
  );
}

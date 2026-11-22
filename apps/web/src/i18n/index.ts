import { API_ERROR_CODES, type ApiErrorCode, type Language } from '@sabaq/shared';
import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { ur } from './locales/ur';

export const resources = { en: { translation: en }, ur: { translation: ur } } as const;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}

/** Creates an i18next instance; each test can have its own. */
export function createI18n(language: Language = 'en'): i18n {
  const instance = i18next.createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}

/** The translation key for an API error code, falling back to a generic message. */
export function errorKey(
  code: string | undefined,
): `errors.${ApiErrorCode | 'network' | 'unknown'}` {
  if (code === 'network') return 'errors.network';
  return (API_ERROR_CODES as readonly string[]).includes(code ?? '')
    ? `errors.${code as ApiErrorCode}`
    : 'errors.unknown';
}

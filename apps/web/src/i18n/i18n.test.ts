import { API_ERROR_CODES } from '@sabaq/shared';
import { describe, expect, it } from 'vitest';
import { createI18n, errorKey } from './index';
import { en } from './locales/en';
import { ur } from './locales/ur';

/** Every key path in a nested message object, such as "common.close". */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value as object, `${prefix}${key}.`),
  );
}

describe('translations', () => {
  it('have the same keys in English and Urdu, and no empty messages', () => {
    expect(keys(ur).sort()).toEqual(keys(en).sort());
    const t = createI18n('ur').t;
    for (const key of keys(ur)) expect(String(t(key as never)).trim()).not.toBe('');
  });

  it('explain every error code the API can return, in both languages', () => {
    for (const language of ['en', 'ur'] as const) {
      const t = createI18n(language).t;
      for (const code of API_ERROR_CODES) {
        const message = t(errorKey(code));
        expect(message, `${language}: ${code}`).not.toBe(errorKey(code));
      }
    }
  });

  it('fall back to a generic message for unknown codes', () => {
    expect(errorKey('something_new')).toBe('errors.unknown');
    expect(errorKey(undefined)).toBe('errors.unknown');
    expect(errorKey('email_taken')).toBe('errors.email_taken');
  });

  it('use correct plural forms', () => {
    const t = createI18n('en').t;
    expect(t('form.errorSummaryTitle', { count: 1 })).toBe('There is 1 problem to fix');
    expect(t('form.errorSummaryTitle', { count: 3 })).toBe('There are 3 problems to fix');
    expect(createI18n('ur').t('form.charactersLeft', { count: 5 })).toBe('5 حروف باقی ہیں');
  });
});

import { DEFAULT_PREFERENCES, type Preferences, type PreferencesUpdate } from '@sabaq/shared';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import type { ReactElement, ReactNode } from 'react';
import { AppProviders } from '../app/AppProviders';
import { createI18n } from '../i18n';
import { mergePreferences } from '../preferences/preferences';

/** Renders inside every app provider, with optional preference overrides. */
export function renderWithProviders(
  ui: ReactElement,
  preferences: PreferencesUpdate = {},
): RenderResult & { user: ReturnType<typeof userEvent.setup>; preferences: Preferences } {
  const merged = mergePreferences(DEFAULT_PREFERENCES, preferences);
  const user = userEvent.setup();
  const i18n = createI18n(merged.language);
  // A wrapper (not a parent element) keeps the providers in place when tests rerender.
  const result = render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppProviders i18n={i18n} preferences={merged}>
        {children}
      </AppProviders>
    ),
  });
  return { ...result, user, preferences: merged };
}

/**
 * Runs axe-core and returns readable violations. Color contrast is checked separately in
 * tokens.test.ts, because jsdom cannot compute rendered colors.
 */
export async function accessibilityViolations(
  container: Element = document.body,
): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
    resultTypes: ['violations'],
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
}

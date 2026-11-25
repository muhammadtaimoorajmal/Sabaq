import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** A demo account created by the API's demo data (see docs/data-model.md). */
export const DEMO = {
  email: 'zara.ahmed@northfield.example',
  password: 'sabaq-demo',
  firstName: 'Zara',
};

/** Display preferences applied before the app loads, as if chosen on an earlier visit. */
export async function usePreferences(page: Page, preferences: Record<string, unknown>) {
  await page.addInitScript((saved) => {
    window.localStorage.setItem('sabaq.preferences', JSON.stringify(saved));
  }, preferences);
}

export async function signIn(page: Page, next = '/') {
  await page.goto(`/sign-in${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`);
  await page.locator('#sign-in-email').fill(DEMO.email);
  await page.locator('#sign-in-password').fill(DEMO.password);
  await page.getByRole('button', { name: /^Sign in$|^سائن ان کریں$/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/Sign in|سائن ان/);
}

/** Every WCAG 2.2 A and AA rule axe knows, including color contrast, which needs a real browser. */
export async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(' ')).join(', ')})`,
  );
  expect(summary).toEqual([]);
}

/** A unique address for an account created by a test. */
export const newEmail = () =>
  `student.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;

export const NEW_PASSWORD = 'a quiet library afternoon';

/**
 * Creates a fresh account with these display preferences, signs this browser in and opens
 * `next`. Signing in applies the account's preferences, so tests of a display (dark, Urdu …)
 * need an account that has it, and must never change the shared demo accounts.
 */
export async function signUp(
  page: Page,
  preferences: Record<string, unknown> = {},
  next = '/',
): Promise<{ email: string }> {
  const email = newEmail();
  const response = await page.request.post('/api/auth/register', {
    data: { name: 'Sara Javed', email, password: NEW_PASSWORD, preferences },
  });
  expect(response.status()).toBe(201);
  await page.goto(next);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/^Sign in$|^سائن ان/);
  return { email };
}

/** True when the page needs horizontal scrolling, which breaks reflow (WCAG 1.4.10). */
export function scrollsSideways(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
}

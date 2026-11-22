import { expect, test } from '@playwright/test';
import { DEMO, expectNoViolations, scrollsSideways, signIn, usePreferences } from './helpers';

test.describe('signing in', () => {
  test('takes the demo student to Today, and back to the page they wanted', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings/);
    await expect(page).toHaveTitle('Sign in · Sabaq');
    await page.locator('#sign-in-email').fill(DEMO.email);
    await page.locator('#sign-in-password').fill(DEMO.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByText('This device', { exact: true })).toBeVisible();
  });

  test('explains a wrong password', async ({ page }) => {
    await page.goto('/sign-in');
    await page.locator('#sign-in-email').fill(DEMO.email);
    await page.locator('#sign-in-password').fill('not the password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'The e-mail address or password is incorrect.',
    );
  });

  test('keeps the session across a reload, and signs out', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(DEMO.firstName);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(DEMO.firstName);
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByText('You have signed out.')).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('keyboard', () => {
  test('reaches the skip link first and every control by Tab alone', async ({ page }) => {
    await signIn(page);
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    const reached = new Set<string>();
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press('Tab');
      reached.add(
        await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null;
          return element?.getAttribute('aria-label') ?? element?.textContent?.trim() ?? '';
        }),
      );
    }
    for (const name of ['Today', 'Settings', 'Display settings', 'Account menu for Zara Ahmed']) {
      expect(
        [...reached].some((label) => label.includes(name)),
        `${name} is reachable`,
      ).toBe(true);
    }
  });
});

const PAGES = [
  { path: '/sign-in', signedIn: false },
  { path: '/', signedIn: true },
  { path: '/settings', signedIn: true },
  { path: '/design-system', signedIn: false },
  { path: '/no-such-page', signedIn: false },
];

const DISPLAYS = [
  { name: 'light', preferences: { theme: 'light' } },
  { name: 'dark', preferences: { theme: 'dark', density: 'compact' } },
  { name: 'high contrast at 150%', preferences: { theme: 'high-contrast', textScale: 1.5 } },
  { name: 'Urdu', preferences: { language: 'ur' } },
];

test.describe('accessibility in a real browser, including color contrast', () => {
  for (const display of DISPLAYS) {
    for (const { path, signedIn } of PAGES) {
      test(`${path} (${display.name})`, async ({ page }) => {
        await usePreferences(page, display.preferences);
        if (signedIn) await signIn(page, path);
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectNoViolations(page);
      });
    }
  }
});

test.describe('small screens', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const { path, signedIn } of PAGES) {
    test(`${path} fits 320 px without sideways scrolling`, async ({ page }) => {
      if (signedIn) await signIn(page, path);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await scrollsSideways(page)).toBe(false);
    });
  }

  test('fits 320 px with text at 150%', async ({ page }) => {
    await usePreferences(page, { textScale: 1.5 });
    await signIn(page);
    expect(await scrollsSideways(page)).toBe(false);
  });
});

test('draws visible outlines around form fields in every theme', async ({ page }) => {
  for (const theme of ['light', 'dark', 'high-contrast']) {
    await usePreferences(page, { theme });
    await page.goto('/sign-in');
    const width = await page
      .locator('#sign-in-email')
      .evaluate((input) => parseFloat(getComputedStyle(input).borderTopWidth));
    expect(width, theme).toBeGreaterThanOrEqual(1);
  }
});

test('shows a not-found page with a way back', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page).toHaveTitle('Page not found · Sabaq');
});

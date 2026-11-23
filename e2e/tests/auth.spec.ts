import { expect, type Page, test } from '@playwright/test';
import { API_URL } from '../playwright.config';

/** A fresh address per test, so tests never share accounts. */
const newEmail = (label: string) =>
  `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`;

/** The link in the newest e-mail to `to`, from the development mailbox. */
async function emailLink(to: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const messages = (await (
      await fetch(`${API_URL}/api/dev/mail?to=${encodeURIComponent(to)}`)
    ).json()) as {
      text: string;
    }[];
    const link = messages
      .map((message) => new RegExp(`https?://\\S+/${path}#token=[\\w-]+`).exec(message.text)?.[0])
      .find(Boolean);
    if (link) return new URL(link).pathname + new URL(link).hash;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ${path} e-mail reached ${to}`);
}

async function signUp(page: Page, email: string, password: string) {
  await page.goto('/sign-up');
  await page.locator('#sign-up-name').fill('Ali Raza');
  await page.locator('#sign-up-email').fill(email);
  await page.locator('#sign-up-password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ali');
}

test.describe('creating an account', () => {
  test('lists every problem in plain language before contacting the server', async ({ page }) => {
    await page.goto('/sign-up');
    await page.getByRole('button', { name: 'Create account' }).click();
    const summary = page.getByRole('alert');
    await expect(summary).toContainText('There are 3 problems to fix');
    await summary.getByRole('link', { name: 'Enter your e-mail address.' }).click();
    await expect(page.locator('#sign-up-email')).toBeFocused();
  });

  test('signs up, then confirms the address from the e-mailed link', async ({ page }) => {
    const email = newEmail('signup');
    await signUp(page, email, 'a quiet library afternoon');
    await expect(page.getByText('Confirm your e-mail address')).toBeVisible();

    await page.goto(await emailLink(email, 'verify-email'));
    await expect(page.getByRole('heading', { name: 'E-mail address confirmed' })).toBeVisible();
    await expect(page).toHaveURL(/\/verify-email$/);
    await page.getByRole('link', { name: 'Continue to Sabaq' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ali');
    await expect(page.getByText('Confirm your e-mail address')).toHaveCount(0);
  });

  test('rates the password as it is typed', async ({ page }) => {
    await page.goto('/sign-up');
    await page.locator('#sign-up-password').fill('password1');
    await expect(page.getByText('Password strength: weak')).toBeVisible();
    await page.locator('#sign-up-password').fill('a quiet library afternoon');
    await expect(page.getByText('Password strength: strong')).toBeVisible();
  });

  test('offers to sign in when the address already has an account', async ({ page }) => {
    await page.goto('/sign-up');
    await page.locator('#sign-up-name').fill('Zara Ahmed');
    await page.locator('#sign-up-email').fill('zara.ahmed@northfield.example');
    await page.locator('#sign-up-password').fill('a quiet library afternoon');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('link', { name: 'Sign in instead' }).click();
    await expect(page.locator('#sign-in-email')).toHaveValue('zara.ahmed@northfield.example');
  });
});

test.describe('forgotten passwords', () => {
  test('resets the password from the e-mailed link and signs in with the new one', async ({
    page,
    context,
  }) => {
    const email = newEmail('reset');
    await signUp(page, email, 'the first long password');
    await context.clearCookies();

    await page.goto('/sign-in');
    await page.getByRole('link', { name: 'Forgot your password?' }).first().click();
    await page.locator('#forgot-email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

    await page.goto(await emailLink(email, 'reset-password'));
    await page.locator('#reset-password').fill('a brand new long password');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByText('Your password has been changed.')).toBeVisible();

    await page.locator('#sign-in-email').fill(email);
    await page.locator('#sign-in-password').fill('a brand new long password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Ali');
  });
});

test('signs in with a demo account in one tap', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Instructor' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ayesha');
});

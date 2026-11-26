import { expect, type Page, test } from '@playwright/test';
import { expectNoViolations, NEW_PASSWORD, newEmail } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';

/** A brand-new student with a unique name, signed in and joined to the demo class. */
async function newStudent(page: Page) {
  const name = `Student ${Math.random().toString(36).slice(2, 8)}`;
  const response = await page.request.post('/api/auth/register', {
    data: { name, email: newEmail(), password: NEW_PASSWORD },
  });
  expect(response.status()).toBe(201);
  await page.goto(`/join?code=${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
  return name;
}

async function signInAsClassRep(page: Page) {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Class representative' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hamza');
}

test('a post reaches every member and its receipts update live', async ({ page, browser }) => {
  const title = `Lab report ${Date.now()}`;

  // A student joins the class.
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  const studentName = await newStudent(student);

  // The class representative posts a deadline.
  await signInAsClassRep(page);
  await page.getByRole('link', { name: 'Classes' }).first().click();
  await page.getByRole('link', { name: /BS Computer Science/ }).click();
  await page.getByRole('button', { name: 'Post announcement' }).click();
  const composer = page.getByRole('dialog', { name: 'Post an announcement' });
  await composer.getByLabel(/^Title/).fill(title);
  await composer.getByRole('button', { name: 'Tomorrow' }).click();
  await expect(composer.getByRole('article', { name: title })).toBeVisible();
  await composer.getByRole('button', { name: 'Post announcement' }).click();
  await expect(page.getByText(/Posted to BS Computer Science/)).toBeVisible();

  // Before the student looks, they are listed under "Not seen", live.
  const card = page.getByRole('article', { name: title });
  await card.getByRole('button', { name: /Seen by 0 of/ }).click();
  const receipts = page.getByRole('dialog', { name: 'Who has seen it' });
  await expect(receipts.getByText(studentName)).toBeVisible();

  // The student sees it in their inbox, with the unread count in the navigation.
  await student.goto('/inbox');
  const nav = student.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: /^Inbox \(\d+ unread\)$/ })).toBeVisible();
  const studentCard = student.getByRole('article', { name: title });
  await expect(studentCard).toBeVisible();
  await expect(studentCard.getByText('Due', { exact: false })).toBeVisible();
  // It counts as seen only once it has actually been on screen.
  await studentCard.scrollIntoViewIfNeeded();
  await expect(studentCard.getByText('Unread')).toBeHidden({ timeout: 15_000 });

  // Without reloading, the class representative's list moves the student to "Seen".
  await receipts.getByRole('tab', { name: /^Seen/ }).click();
  await expect(receipts.getByText(studentName)).toBeVisible({ timeout: 20_000 });
  await expectNoViolations(page);
  await studentContext.close();
});

test('the inbox and the composer have no accessibility problems', async ({ page }) => {
  await signInAsClassRep(page);
  await page.goto('/inbox');
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible();
  await expect(page.getByRole('article').first()).toBeVisible();
  await expectNoViolations(page);
  await page.getByRole('button', { name: 'Post announcement' }).click();
  await expect(page.getByRole('dialog', { name: 'Post an announcement' })).toBeVisible();
  await expectNoViolations(page);
});

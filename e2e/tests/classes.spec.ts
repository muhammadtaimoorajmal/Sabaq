import { expect, test } from '@playwright/test';
import { expectNoViolations, newEmail, scrollsSideways, signIn } from './helpers';

/** The demo class's join code (see the API's demo data). */
const DEMO_CODE = 'NRTH-5A26';

test('a new student joins a class from a shared link in under 30 seconds', async ({ page }) => {
  await page.goto('/sign-up');
  await page.locator('#sign-up-name').fill('Sara Javed');
  await page.locator('#sign-up-email').fill(newEmail());
  await page.locator('#sign-up-password').fill('a quiet library afternoon');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sara');

  // The clock starts when the student opens the link shared by their class representative.
  const started = Date.now();
  await page.goto(`/join?code=${DEMO_CODE}`);
  await expect(page.getByLabel(/Join code/)).toHaveValue(DEMO_CODE);
  await page.getByRole('button', { name: 'Join class' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Computer Science · 5A' }),
  ).toBeVisible();
  // The class opens on its announcements; the courses are one tab away.
  await expect(page.getByRole('tab', { name: 'Announcements', selected: true })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(30_000);
  await page.getByRole('tab', { name: 'Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Human-Computer Interaction' })).toBeVisible();

  // Students see the class, but not its management tools.
  await expect(page.getByRole('tab', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Get a new code' })).toHaveCount(0);
});

test('an instructor creates a class, adds a course and sees the invite card', async ({ page }) => {
  await signIn(page);
  await page.goto('/classes/new');
  await page.locator('#create-class-name').fill('BS Software Engineering');
  await page.locator('#create-class-section').fill('3B');
  await page.locator('#create-class-term').fill('Spring 2027');
  await page.locator('#create-class-program').fill('BS Software Engineering');
  await page.getByRole('radio', { name: 'I am the instructor' }).click();
  await page.getByRole('button', { name: 'Create class' }).click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'BS Software Engineering' }),
  ).toBeVisible();
  await expect(page.getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)).toBeVisible();

  await page.getByRole('tab', { name: 'Courses' }).click();
  await page.getByRole('button', { name: 'Add a course' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Add a course' });
  await sheet.getByLabel(/Course code/).fill('SE-210');
  await sheet.getByLabel(/Course title/).fill('Requirements Engineering');
  await sheet.getByRole('button', { name: 'Add a session' }).click();
  await sheet.getByRole('button', { name: 'Save course' }).click();
  await expect(page.getByRole('heading', { name: 'Requirements Engineering' })).toBeVisible();

  await page.getByRole('button', { name: 'Show QR code' }).click();
  await expect(page.getByRole('img', { name: /QR code that opens the join link/ })).toBeVisible();
  await expectNoViolations(page);
});

test('the class representative manages the demo class', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Class representative' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hamza');
  await page.getByRole('link', { name: 'Classes' }).first().click();
  await page.getByRole('link', { name: /BS Computer Science/ }).click();
  await expect(page.getByText(DEMO_CODE)).toBeVisible();

  await page.getByRole('tab', { name: 'Members' }).click();
  await expect(page.getByText('Zara Ahmed')).toBeVisible();
  await expectNoViolations(page);

  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.locator('#edit-class-name')).toHaveValue('BS Computer Science · 5A');
  await expectNoViolations(page);
});

test.describe('a class on a small screen', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('fits 320 px without sideways scrolling, with every tab reachable', async ({ page }) => {
    await signIn(page);
    await page.getByRole('link', { name: 'Classes' }).first().click();
    await page.getByRole('link', { name: /BS Computer Science/ }).click();
    await expect(page.getByRole('tab', { name: 'Announcements', selected: true })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    await page.getByRole('tab', { name: 'Members' }).click();
    await expect(page.getByRole('tab', { name: 'Members', selected: true })).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
  });
});

test.describe('accessibility of class pages', () => {
  for (const path of ['/classes', '/join', '/classes/new']) {
    test(path, async ({ page }) => {
      await signIn(page, path);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoViolations(page);
    });
  }
});

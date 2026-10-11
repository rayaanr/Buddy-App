import { expect, signIn, test } from '../fixtures';

test('signs in with an email code and lands on Discover', async ({ page }) => {
  await page.goto('/');
  await page.getByText('I already have an account').click();
  // Google sign-in isn't set up for the tests, so its button stays hidden.
  await expect(page.getByText('Send code', { exact: true })).toBeVisible();
  await expect(page.getByText(/Continue with Google/)).toHaveCount(0);

  await signIn(page, 'amaya@buddy.test');
  await expect(page.getByLabel('Picked for you')).toBeVisible();
});

test('an unknown link says so and leads back to Discover', async ({ page }) => {
  await signIn(page, 'sanduni@buddy.test');
  await page.goto('/no-such-page');
  await expect(page.getByText('This page doesn’t exist')).toBeVisible();
  await page.getByText('Go to Discover').click();
  await expect(page.getByText('What’s happening')).toBeVisible();
});

import { ADMIN } from '../env';
import { expect, signIn, test } from '../fixtures';

test('only the Buddy team sees the team tools', async ({ page }) => {
  await signIn(page, 'ishara@buddy.test');
  await page.goto('/settings');
  await expect(page.getByText('Blocked people')).toBeVisible();
  await expect(page.getByText('Buddy team')).toHaveCount(0);
});

test('the Buddy team can suspend someone and let them back in', async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto('/settings');
  await page.getByText('Dashboard', { exact: true }).click();
  await expect(page.getByText('Signed up')).toBeVisible();

  await page.goto('/settings');
  await page.getByText('People', { exact: true }).click();
  await page.getByLabel('Find a person').fill('dilan');
  await page.getByText('dilan@buddy.test', { exact: false }).click();
  await page.getByText('Suspend Dilan', { exact: true }).click();
  await page.getByText('Suspend', { exact: true }).click();
  await expect(page.getByText('Dilan is suspended.')).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true })).toBeVisible();

  await page.getByText('dilan@buddy.test', { exact: false }).click();
  await page.getByText('Lift suspension').click();
  await expect(page.getByText('Dilan can sign in again.')).toBeVisible();
  await expect(page.getByText('Suspended', { exact: true })).toHaveCount(0);
});

import type { ActivityDetail } from '@buddy/shared';

import { api, expect, signIn, sql, test } from '../fixtures';

test('hosts an activity with one of Buddy’s pictures as its cover', async ({ page }) => {
  await signIn(page, 'ravindu@buddy.test');
  await page.goto('/create');
  const title = `Board games night ${Date.now()}`;
  await page.getByPlaceholder('What are you doing?').fill(title);
  await page.getByLabel('Where').fill('Barefoot Café');

  // A picture instead of a photo, from the drawer.
  await page.getByText('Choose a picture', { exact: true }).click();
  await page.getByLabel('Picture activity social 03').click();

  await page.getByText('Publish activity').click();
  await expect(page.getByText('Published. It’s live on Discover.')).toBeVisible();

  // It's in Your activities; its page shows it.
  const [row] = await sql(`select id from activities where title = $1`, title);
  const id = row!.id as string;
  await page.goto(`/activity/${id}`);
  await expect(page.getByText(title).first()).toBeVisible();
  const saved = await api<ActivityDetail>(page, `/v1/activities/${id}`);
  expect(saved.coverUrl).toMatch(/\/fallbacks\/activity-social-03\.svg$/);
});

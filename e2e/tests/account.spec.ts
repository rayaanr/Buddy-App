import type { Me } from '@buddy/shared';

import { api, expect, signIn, sql, test } from '../fixtures';

test('picks an avatar from the set for their gender', async ({ page }) => {
  await sql(
    `update profiles set gender = 'woman' where user_id = (select id from "user" where email = 'malsha@buddy.test')`,
  );
  await signIn(page, 'malsha@buddy.test');
  await page.goto('/edit-profile');
  await page.getByLabel('Change photo').click();
  await page.getByText('Choose an avatar', { exact: true }).click();
  // Only women's avatars to choose from.
  await expect(page.getByLabel(/^Picture woman \d+$/)).toHaveCount(8);
  await expect(page.getByLabel(/^Picture man \d+$/)).toHaveCount(0);
  await page.getByLabel('Picture woman 04').click();
  await page.getByText('Save', { exact: true }).click();
  await expect(page.getByText('Profile saved.')).toBeVisible();
  const me = await api<Me>(page, '/v1/me');
  expect(me.avatarUrl).toMatch(/\/fallbacks\/woman-04\.svg$/);
});

test('deletes their account and lands back at the start', async ({ page }) => {
  await signIn(page, 'kasun@buddy.test');
  await page.goto('/settings');
  await page.getByText('Delete account', { exact: true }).click();
  await expect(page.getByText('Delete your account?')).toBeVisible();
  await page.getByText('Delete my account', { exact: true }).click();
  await expect(page.getByText('I already have an account')).toBeVisible({ timeout: 15_000 });
  expect(await sql(`select 1 from "user" where email = 'kasun@buddy.test'`)).toHaveLength(0);
});

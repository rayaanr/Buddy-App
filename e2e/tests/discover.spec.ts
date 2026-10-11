import { expect, signIn, test } from '../fixtures';

test('switches Discover between the list and the map', async ({ page }) => {
  await signIn(page, 'shehani@buddy.test');
  await page.getByLabel('Show on a map').click();
  await expect(page.getByLabel('Full-screen map')).toBeVisible();
  await expect(page.getByLabel('Zoom in')).toBeVisible();

  await page.getByLabel('Show as a list').click();
  await expect(page.getByLabel('Full-screen map')).toHaveCount(0);
});

test('search says when nothing matches', async ({ page }) => {
  await signIn(page, 'ashan@buddy.test');
  await page.getByLabel('Search activities').fill('zzzz nothing like this');
  await expect(page.getByText('Nothing matches “zzzz nothing like this”')).toBeVisible();
});

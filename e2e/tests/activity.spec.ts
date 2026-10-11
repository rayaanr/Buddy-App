import type { ActivitySummary } from '@buddy/shared';

import { api, expect, signIn, test } from '../fixtures';

test('joins an activity and says hi in its chat', async ({ page }) => {
  await signIn(page, 'nethmi@buddy.test');
  const { activities } = await api<{ activities: ActivitySummary[] }>(page, '/v1/activities');
  const open = activities.find(
    (a) => !a.viewer.joined && !a.viewer.hosting && a.goingCount < a.capacity,
  );
  expect(open, 'an activity with space to join').toBeTruthy();

  await page.goto(`/activity/${open!.id}`);
  await page.getByText('Join activity').click();
  await expect(page.getByText('You’re in. Say hi in the group chat.')).toBeVisible();

  await page.goto(`/activity/${open!.id}/chat`);
  const hello = `Hi all, see you there! ${Date.now()}`;
  await page.getByPlaceholder('Message the group').fill(hello);
  await page.getByLabel('Send').click();
  await expect(page.getByText(hello)).toBeVisible();
});

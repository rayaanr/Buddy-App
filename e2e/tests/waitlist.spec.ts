import type { ActivityDetail } from '@buddy/shared';

import { api, expect, host, signIn, test } from '../fixtures';

test('waits for a full activity and gets the spot when someone leaves', async ({
  page,
  person,
}) => {
  const hostPage = await person('fathima@buddy.test');
  const { id } = await host(hostPage, { title: `Two-player chess ${Date.now()}`, capacity: 2 });
  const guest = await person('ishara@buddy.test');
  await api(guest, `/v1/activities/${id}/membership`, { method: 'POST' });

  // Full: the waitlist instead.
  await signIn(page, 'tharindu@buddy.test');
  await page.goto(`/activity/${id}`);
  await page.getByText('Join waitlist', { exact: true }).click();
  await expect(
    page.getByText('You’re on the waitlist. We’ll let you know if a spot opens.'),
  ).toBeVisible();

  // The guest drops out: first in line gets the spot.
  await api(guest, `/v1/activities/${id}/membership`, { method: 'DELETE' });
  const mine = await api<ActivityDetail>(page, `/v1/activities/${id}`);
  expect(mine.viewer.joined).toBe(true);
  await page.reload();
  await expect(page.getByText('Leave', { exact: true })).toBeVisible();
});

import { api, expect, host, signIn, sql, test } from '../fixtures';

test('the host marks who came, once it has started', async ({ page, person }) => {
  await signIn(page, 'malsha@buddy.test');
  const { id } = await host(page, { title: `Sunset run ${Date.now()}`, group: 'Running' });
  const guest = await person('chamod@buddy.test');
  await api(guest, `/v1/activities/${id}/membership`, { method: 'POST' });
  // It happened two hours ago (they signed up the day before).
  await sql(`update activities set starts_at = now() - interval '2 hours' where id = $1`, id);
  await sql(
    `update activity_members set joined_at = now() - interval '1 day' where activity_id = $1`,
    id,
  );

  await page.goto(`/activity/${id}/roll-call`);
  await expect(page.getByText('Who came?')).toBeVisible();
  await page.getByLabel('Chamod came').click();
  await page.getByText('Save roll call').click();
  await expect(page.getByText('Roll call saved: 1 of 1 came.')).toBeVisible();

  const [row] = await sql(
    `select attended from activity_members m join "user" u on u.id = m.user_id where m.activity_id = $1 and u.email = 'chamod@buddy.test'`,
    id,
  );
  expect(row?.attended).toBe(true);
});

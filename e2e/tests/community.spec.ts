import { expect, signIn, sql, test } from '../fixtures';

test('joins a community and talks in its group chat', async ({ page }) => {
  await signIn(page, 'pasindu@buddy.test');
  // A community Pasindu isn't in yet.
  const [community] = await sql(
    `select c.id, c.name from communities c
     where not exists (select 1 from community_members m join "user" u on u.id = m.user_id
                       where m.community_id = c.id and u.email = 'pasindu@buddy.test')
     order by c.name limit 1`,
  );
  await page.goto(`/community/${community!.id}`);
  await page.getByText('Join community', { exact: true }).click();
  await expect(page.getByText('You’re a member')).toBeVisible();

  await page.getByText(/^Group chat/).click();
  const hello = `Hello from a new member ${Date.now()}`;
  await page.getByPlaceholder('Message the group').fill(hello);
  await page.getByLabel('Send').click();
  await expect(page.getByText(hello)).toBeVisible();
});

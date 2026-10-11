import { expect, signIn, sql, test } from '../fixtures';

test('reports someone and blocks them in one go', async ({ page }) => {
  await signIn(page, 'dinithi@buddy.test');
  const [target] = await sql(`select id from "user" where email = 'pasindu@buddy.test'`);
  await page.goto(`/user/${target!.id}`);
  await page.getByLabel('More options').click();
  await page.getByText('Report Pasindu', { exact: true }).click();

  await page.getByText('Spam or scam', { exact: true }).click();
  await page
    .getByPlaceholder('Tell us what happened')
    .fill('Keeps sending links to a crypto group.');
  // "Also block": off by default when reporting a person.
  await page.getByRole('checkbox').click();
  await page.getByText('Send report', { exact: true }).click();
  await expect(
    page.getByText('Reported and blocked Pasindu. We’ll review it within 24 hours.'),
  ).toBeVisible();

  const reports = await sql(
    `select r.reason from reports r join "user" u on u.id = r.target_user_id where u.email = 'pasindu@buddy.test'`,
  );
  expect(reports.map((r) => r.reason)).toContain('spam');
  const blocks = await sql(
    `select 1 from blocks b join "user" a on a.id = b.blocker_id join "user" c on c.id = b.blocked_id
     where a.email = 'dinithi@buddy.test' and c.email = 'pasindu@buddy.test'`,
  );
  expect(blocks).toHaveLength(1);
});

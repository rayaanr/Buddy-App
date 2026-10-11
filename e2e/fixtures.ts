import { readFileSync } from 'node:fs';

import { test as base, expect, type Page } from '@playwright/test';

import { API_URL, OUTBOX } from './env';

/** The newest sign-in code emailed to this address (from the API's outbox file). */
function latestCode(email: string): string | null {
  let lines: string[];
  try {
    lines = readFileSync(OUTBOX, 'utf8').trim().split('\n');
  } catch {
    return null;
  }
  for (const line of lines.reverse()) {
    const mail = JSON.parse(line) as { to: string; subject: string };
    const code = mail.to === email && /^(\d{6}) is your Buddy code/.exec(mail.subject)?.[1];
    if (code) return code;
  }
  return null;
}

/** Signs in with an email code, the way a person would, and waits for Discover. */
export async function signIn(page: Page, email: string) {
  await page.goto('/');
  await page.getByText('I already have an account').click();
  await page.getByPlaceholder('you@example.com').fill(email);
  const before = latestCode(email);
  await page.getByText('Send code', { exact: true }).click();
  await expect(page.getByText('Check your email')).toBeVisible();
  let code: string | null = null;
  await expect
    .poll(() => {
      code = latestCode(email);
      return code && code !== before;
    })
    .toBeTruthy();
  // Signing in opens the "Picked for you" deck when there are picks.
  const picks = page.waitForResponse((r) => r.url().includes('/v1/activities/picks'));
  await page.getByLabel('Sign-in code').fill(code!);
  await expect(page.getByText('What’s happening')).toBeVisible({ timeout: 20_000 });
  const { picks: cards } = (await (await picks).json()) as { picks: unknown[] };
  if (cards.length) {
    const deck = page.getByText(/Picked for you · \d+ of/i);
    await expect(deck).toBeVisible();
    await page.getByLabel('Close', { exact: true }).click();
    await expect(deck).toHaveCount(0);
  }
}

/** Calls the API as whoever is signed in on this page (for setup and checks). */
export async function api<T>(page: Page, path: string, init?: { method?: string; data?: unknown }) {
  const res = await page.request.fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    data: init?.data,
  });
  expect(res.ok(), `${init?.method ?? 'GET'} ${path} → ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

export const test = base.extend<{ errors: string[] }>({
  // Every test fails on an uncaught error in the page.
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // Photos and map tiles come from the internet: serve a blank image instead.
      await page.route(/img\.buddy\.test|cartocdn|unsplash|randomuser/, (route) =>
        route.fulfill({ contentType: 'image/png', body: PIXEL }),
      );
      await use(errors);
      expect(errors, 'errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

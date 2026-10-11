import { readFileSync } from 'node:fs';

import { test as base, type BrowserContext, devices, expect, type Page } from '@playwright/test';
import postgres from 'postgres';

import { API_URL, DATABASE_URL, OUTBOX, WEB_URL } from './env';

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
  // Signing in opens the "Picked for you" deck over Discover when there are
  // picks: close it, then Discover is what's showing.
  const picks = page.waitForResponse((r) => r.url().includes('/v1/activities/picks'), {
    timeout: 30_000,
  });
  await page.getByLabel('Sign-in code').fill(code!);
  const { picks: cards } = (await (await picks).json()) as { picks: unknown[] };
  if (cards.length) {
    const deck = page.getByText(/Picked for you · \d+ of/i);
    await expect(deck).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Close', { exact: true }).click();
    await expect(deck).toHaveCount(0);
  }
  await expect(page.getByText('What’s happening')).toBeVisible({ timeout: 20_000 });
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

/** Blank images for the internet ones, and every page error collected. */
async function watch(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  // Photos and map tiles come from the internet: serve a blank image instead.
  await page.route(/img\.buddy\.test|cartocdn|unsplash|randomuser/, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
}

export const test = base.extend<{
  errors: string[];
  /** Someone else, signed in on their own phone (a separate browser). */
  person: (email: string) => Promise<Page>;
}>({
  // Every test fails on an uncaught error in any of its pages.
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      await watch(page, errors);
      await use(errors);
      expect(errors, 'errors in the page').toEqual([]);
    },
    { auto: true },
  ],
  person: async ({ browser, errors }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (email) => {
      const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: WEB_URL });
      contexts.push(context);
      const page = await context.newPage();
      await watch(page, errors);
      await signIn(page, email);
      return page;
    });
    for (const context of contexts) await context.close();
  },
});

/** Changes the test database directly, for what the app can't do (e.g. time passing). */
export async function sql(query: string, ...params: (string | number)[]) {
  const db = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    return await db.unsafe(query, params);
  } finally {
    await db.end();
  }
}

/** Hosts an activity through the API as whoever is signed in on this page. */
export const host = (page: Page, body: Record<string, unknown> = {}) =>
  api<{ id: string; title: string }>(page, '/v1/activities', {
    method: 'POST',
    data: {
      title: `Test activity ${Date.now()}`,
      group: 'Social',
      startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      place: 'Barefoot Café',
      capacity: 6,
      ...body,
    },
  });

export { expect };

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

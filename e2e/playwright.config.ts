import { defineConfig, devices } from '@playwright/test';

import { ADMIN, API_PORT, API_URL, DATABASE_URL, OUTBOX, WEB_PORT, WEB_URL } from './env';

/**
 * Buddy in a phone-sized browser, against a real API and database.
 *
 *   bun run e2e                      from the repo root (Postgres must be up)
 *   bunx playwright install chromium  once, to download the browser
 *   bun run e2e -- tests/admin.spec.ts --headed
 *
 * Starts its own API (:7410) and web app (:7491) unless they're already running.
 */
export default defineConfig({
  testDir: './tests',
  // One shared database: tests run one at a time, each as its own person.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  outputDir: 'results',
  use: {
    ...devices['Pixel 7'],
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      // Fresh database first, then the API with emails written to the outbox.
      command: 'bun prepare-db.ts && cd ../apps/api && bunx tsx src/server.ts',
      url: `${API_URL}/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'warn',
        PORT: String(API_PORT),
        DATABASE_URL,
        BETTER_AUTH_URL: API_URL,
        BETTER_AUTH_SECRET: 'e2e-only-secret-e2e-only-secret-0000',
        WEB_ORIGINS: WEB_URL,
        ADMIN_EMAILS: ADMIN,
        DEV_OUTBOX: OUTBOX,
        // Placeholders: the API needs R2 settings to start. Photos aren't tested.
        R2_ACCOUNT_ID: 'e2e',
        R2_ACCESS_KEY_ID: 'e2e',
        R2_SECRET_ACCESS_KEY: 'e2e',
        R2_BUCKET: 'e2e',
        R2_PUBLIC_URL: 'https://img.buddy.test',
      },
    },
    {
      command: `bunx expo start --web --port ${WEB_PORT}`,
      cwd: '../apps/mobile',
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      env: { CI: '1', EXPO_PUBLIC_API_URL: API_URL, EXPO_NO_TELEMETRY: '1' },
    },
  ],
});

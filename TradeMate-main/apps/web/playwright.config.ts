import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env.TRADEMATE_E2E_BASE_URL?.replace(/\/+$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI, also emit GitHub annotations so each failing assertion is visible on the run page.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  ...(externalBaseURL ? {} : {
    webServer: {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000/app',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
});

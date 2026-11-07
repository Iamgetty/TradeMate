import { expect, test } from '@playwright/test';

async function isolateApi(page: import('@playwright/test').Page) {
  // Browser smoke tests must not depend on, mutate, or authenticate against a live API.
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'API intentionally unavailable in browser smoke tests' }),
  }));
}

async function expectAppShell(page: import('@playwright/test').Page) {
  await expect(page.locator('#app .view').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#nav')).toBeAttached();
  await expect.poll(() => page.locator('#nav').evaluate(node => node.children.length)).toBeGreaterThan(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
}

test('root route redirects to a rendered TradeMate app shell without API access', async ({ page }) => {
  await isolateApi(page);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(/\/app\/?$/);
  await expectAppShell(page);
  expect(pageErrors, 'the app should not emit uncaught browser exceptions').toEqual([]);
});

test('direct app route renders the shell on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await isolateApi(page);
  await page.goto('/app');
  await expectAppShell(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
});

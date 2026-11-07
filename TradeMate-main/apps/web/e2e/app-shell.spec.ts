import { expect, test } from '@playwright/test';

async function isolateApi(page: import('@playwright/test').Page) {
  // Browser smoke tests must not depend on, mutate, or authenticate against a live API.
  await page.route('**/api/**', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: 'API intentionally unavailable in browser smoke tests' }),
  }));
}

async function expectPublicLanding(page: import('@playwright/test').Page) {
  await expect(page.locator('#land')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#land nav button[data-login="in"]')).toBeVisible();
  await expect(page.locator('#land nav button[data-login="up"]')).toBeVisible();
  const startupDiagnostic = page.getByRole('alert');
  const diagnosticCount = await startupDiagnostic.count();
  if (diagnosticCount > 0) {
    throw new Error(`Unexpected startup diagnostic overlay: ${(await startupDiagnostic.first().innerText()).replaceAll('\n', ' ').trim()}`);
  }
}

test('root route redirects to the public TradeMate landing without API access', async ({ page }) => {
  await isolateApi(page);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(url => url.pathname === '/app' || url.pathname === '/app/');
  await expectPublicLanding(page);
  expect(pageErrors, 'the app should not emit uncaught browser exceptions').toEqual([]);
});

test('direct app route renders the public landing on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await isolateApi(page);
  await page.goto('/app');
  await expectPublicLanding(page);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
});

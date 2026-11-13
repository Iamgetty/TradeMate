import { devices, expect, test } from '@playwright/test';

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

  // Next.js inserts its own visually-hidden route announcer with role="alert".
  // TradeMate's startup-failure screen is specifically a full-screen <main>.
  await expect(page.locator('main[role="alert"]')).toHaveCount(0);
}

test('root route redirects to the desktop TradeMate landing without API access', async ({ page }) => {
  await isolateApi(page);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveURL(url => url.pathname === '/app' || url.pathname === '/app/');
  await expectPublicLanding(page);
  await expect(page.locator('html')).toHaveClass(/tm-desktop/);
  await expect(page.locator('link[href^="/tm/desktop.css"]')).toHaveCount(1);
  await expect(page.locator('link[href^="/tm/mobileweb.css"]')).toHaveAttribute('media', '(max-width:899px)');
  expect(pageErrors, 'the app should not emit uncaught browser exceptions').toEqual([]);
});

test('direct app route renders on a real mobile-user-agent context', async ({ browser }) => {
  // A narrow viewport alone is not enough: the legacy runtime selects its
  // mobile-web JavaScript branch from user-agent/touch capability.
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  try {
    const page = await context.newPage();
    await isolateApi(page);
    await page.goto('/app');
    await expectPublicLanding(page);
    await expect(page.locator('html')).toHaveClass(/tm-mw/);
    // Connected-mode auth gating intentionally keeps app chrome hidden until a session is verified.
    // The mobile runtime should still create its header on the public landing.
    await expect(page.locator('#mwbar')).toHaveCount(1);
    await expect(page.locator('link[href^="/tm/mobileweb.css"]')).toHaveCount(1);
    await expect(page.locator('link[href^="/tm/desktop.css"]')).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  } finally {
    await context.close();
  }
});

test('the core app still renders when the optional exchange-feed browser helper is unavailable', async ({ page }) => {
  await isolateApi(page);
  await page.route('**/tm/feed-client.js*', route => route.abort());
  await page.goto('/app');
  await expectPublicLanding(page);
  await expect(page.locator('main[role="alert"]')).toHaveCount(0);
});

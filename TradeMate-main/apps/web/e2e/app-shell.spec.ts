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

test('homepage shortcut cards do not use the legacy view-entry animation after load or refresh', async ({ page }) => {
  await isolateApi(page);

  async function expectHomepageEntranceAnimationRemoved() {
    const response = await page.request.get('/tm/app.js');
    expect(response.ok(), 'the deployed legacy app bundle should be available').toBeTruthy();
    const source = await response.text();

    // The Home view uses .mk-card for its marketplace shortcut tiles. Keep
    // the market-page animations scoped to their own components, but never
    // animate those Home tiles through the shared .view.enter class.
    expect(source).not.toMatch(/\.view\.enter\s+\.mk-card\s*\{/);
    expect(source).not.toMatch(/\.view\.enter\s*>\s*\*/);
  }

  await page.goto('/app');
  await expectPublicLanding(page);
  await expectHomepageEntranceAnimationRemoved();

  await page.reload();
  await expectPublicLanding(page);
  await expectHomepageEntranceAnimationRemoved();
});

test('Scout map image is preloaded before the legacy app bundle', async ({ page }) => {
  await isolateApi(page);
  const requestedAssets: string[] = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/tm/img/scout-map.jpg' || pathname === '/tm/app.js') {
      requestedAssets.push(pathname);
    }
  });
  const mapResponsePromise = page.waitForResponse(response =>
    new URL(response.url()).pathname === '/tm/img/scout-map.jpg',
  );

  await page.goto('/app');
  await expectPublicLanding(page);

  const preload = page.locator('link[rel="preload"][as="image"][href="/tm/img/scout-map.jpg?v=2"]');
  await expect(preload).toHaveCount(1);
  await expect(preload).toHaveAttribute('fetchpriority', 'high');

  const mapResponse = await mapResponsePromise;
  expect(mapResponse.ok(), 'the Scout map image should load successfully').toBeTruthy();
  expect(mapResponse.headers()['content-type']).toMatch(/^image\//);
  expect(requestedAssets.indexOf('/tm/img/scout-map.jpg')).toBeGreaterThanOrEqual(0);
  expect(requestedAssets.indexOf('/tm/img/scout-map.jpg')).toBeLessThan(
    requestedAssets.indexOf('/tm/app.js'),
  );
});

test('CoinGecko metadata helper loads before the app and reports a successful refresh', async ({ page }) => {
  await isolateApi(page);
  await page.route('https://api.coingecko.com/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));

  await page.goto('/app');
  await expectPublicLanding(page);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { tmMarketMetadataStatus?: { state: string } }).tmMarketMetadataStatus?.state,
  )).toBe('fresh');
});

test('the core app remains available and skips CoinGecko when its metadata helper is unavailable', async ({ page }) => {
  await isolateApi(page);
  let metadataRequests = 0;
  await page.route('**/tm/market-metadata.js*', route => route.abort());
  await page.route('https://api.coingecko.com/**', route => {
    metadataRequests += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/app');
  await expectPublicLanding(page);
  await expect(page.locator('main[role="alert"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { tmMarketMetadataStatus?: { state: string } }).tmMarketMetadataStatus?.state,
  )).toBe('unavailable');
  expect(metadataRequests, 'the unguarded legacy provider fallback must not run').toBe(0);
});

test('the core app still renders when the optional exchange-feed browser helper is unavailable', async ({ page }) => {
  await isolateApi(page);
  await page.route('**/tm/feed-client.js*', route => route.abort());
  await page.goto('/app');
  await expectPublicLanding(page);
  await expect(page.locator('main[role="alert"]')).toHaveCount(0);
});

test('an unrelated unhandled promise rejection does not replace the rendered app with a startup failure', async ({ page }) => {
  await isolateApi(page);
  await page.goto('/app');
  await expectPublicLanding(page);

  // Simulate a rejection from an unrelated feature request while the app is
  // already running. It must not be misclassified as a boot-script failure.
  await page.evaluate(() => {
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', {
      value: new Error('Synthetic unrelated feature rejection'),
    });
    window.dispatchEvent(event);
  });

  await expect(page.locator('main[role="alert"]')).toHaveCount(0);
  await expect(page.locator('#land')).toBeVisible();
});


test('Pick page module uses explicit live-state dependencies', async ({ page }) => {
  await page.goto('/app');
  await page.addScriptTag({ url: '/tm/pick-page-module.js' });

  const result = await page.evaluate(() => {
    const renderCalls: Array<{ offer: unknown; pageMode: boolean; eligible: unknown[] }> = [];
    let connected = true;
    let items: Array<{ name: string; srv?: boolean }> = [
      { name: 'Private', srv: false },
      { name: 'First service', srv: true },
      { name: 'Second service', srv: true },
    ];
    let selected = 'Second service';
    const module = window.TM_PICK_PAGE_MODULE;
    if (!module || typeof module.create !== 'function') throw new Error('Pick module did not initialize');

    const pageModule = module.create({
      isConnected: () => connected,
      getItems: () => items,
      getSelectedOffer: () => selected,
      resolveOffer: (name: unknown) => items.find(item => item.name === name) || null,
      renderProposal: (offer: unknown, pageMode: boolean, eligible: unknown[]) => {
        renderCalls.push({ offer, pageMode, eligible });
        return 'rendered';
      },
    });

    const first = pageModule.render();
    selected = 'missing';
    const second = pageModule.render();
    connected = false;
    const third = pageModule.render();

    return {
      first,
      second,
      third,
      calls: renderCalls.map(call => ({
        offer: call.offer && (call.offer as { name: string }).name,
        pageMode: call.pageMode,
        eligible: call.eligible.map(item => (item as { name: string }).name),
      })),
    };
  });

  expect(result.first).toBe('rendered');
  expect(result.second).toBe('rendered');
  expect(result.third).toBe('rendered');
  expect(result.calls).toEqual([
    { offer: 'Second service', pageMode: true, eligible: ['First service', 'Second service'] },
    { offer: 'First service', pageMode: true, eligible: ['First service', 'Second service'] },
    { offer: null, pageMode: true, eligible: [] },
  ]);
});

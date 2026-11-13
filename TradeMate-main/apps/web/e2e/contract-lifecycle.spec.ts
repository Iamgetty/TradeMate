import { expect, test, type Page, type Route } from '@playwright/test';

type ContractFixture = {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'completed';
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
};

async function solveLoginPuzzle(page: Page) {
  const captcha = page.locator('#cap');
  await expect(captcha).not.toHaveClass(/hide/, { timeout: 5_000 });
  await expect(captcha.locator('#tk')).toBeVisible({ timeout: 5_000 });
  const puzzle = await captcha.evaluate(root => {
    const track = root.querySelector('#tk');
    const handle = root.querySelector('#hd');
    const hole = root.querySelector('#ho');
    const board = root.querySelector('#pz');
    if (!(track instanceof HTMLElement) || !(handle instanceof HTMLElement) ||
        !(hole instanceof HTMLElement) || !(board instanceof HTMLElement)) {
      return {
        diagnostic: [track, handle, hole, board].map(el =>
          el ? { tag: el.tagName, className: el.className, rect: el.getBoundingClientRect().toJSON() } : null
        ),
      };
    }
    const h = handle.getBoundingClientRect();
    const b = board.getBoundingClientRect();
    const holeLeft = hole.getBoundingClientRect().left;
    const startInset = Math.round(board.clientWidth * 0.04);
    return {
      x: h.left + h.width / 2,
      y: h.top + h.height / 2,
      delta: holeLeft - b.left - startInset,
    };
  });
  if (!('x' in puzzle) || typeof puzzle.x !== 'number' ||
      typeof puzzle.y !== 'number' || typeof puzzle.delta !== 'number') {
    throw new Error('Captcha elements missing: ' + JSON.stringify(puzzle));
  }
  await page.mouse.move(puzzle.x, puzzle.y);
  await page.mouse.down();
  await page.mouse.move(puzzle.x + puzzle.delta, puzzle.y, { steps: 16 });
  await page.mouse.up();
  await expect(captcha).toHaveClass(/hide/, { timeout: 5_000 });
}

async function login(page: Page, email: string) {
  console.log(`[contract-e2e] ${email}: opening app`);
  await page.goto('/app');
  await expect(page.locator('#land')).toBeVisible({ timeout: 20_000 });
  console.log(`[contract-e2e] ${email}: landing ready; opening login`);
  await page.locator('#land nav button[data-login="in"]').click();
  await page.locator('#id').fill(email);
  await page.locator('#login button[data-k="next"]').click();
  await expect(page.locator('#pw')).toBeVisible();
  await page.locator('#pw').fill('TradeMate-test-password-2026');
  await page.locator('#login button[data-k="next"]').click();
  console.log(`[contract-e2e] ${email}: password submitted; solving visible login puzzle`);
  await solveLoginPuzzle(page);
  console.log(`[contract-e2e] ${email}: puzzle accepted; waiting for authenticated app`);
  await expect(page.locator('#app .view')).toBeVisible({ timeout: 15_000 });
  console.log(`[contract-e2e] ${email}: authenticated app visible`);
}

async function expectNoHorizontalOverflow(page: Page, surface: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(
    dimensions.document,
    surface + ' must not introduce horizontal page overflow on mobile',
  ).toBeLessThanOrEqual(dimensions.viewport + 2);
}

test('two separate accounts complete a contract through the Clients and Alpha UI', async ({ browser }) => {
  test.setTimeout(90_000);

  const authenticated: Record<'buyer' | 'seller', boolean> = { buyer: false, seller: false };
  let buyerListingRequests = 0;
  const contract: ContractFixture = {
    id: 'contract-e2e-001',
    title: 'Two-account UI acceptance fixture',
    status: 'proposed',
    buyer_confirmed_at: null,
    seller_confirmed_at: null,
  };

  const buyerContext = await browser.newContext();
  const sellerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  const seller = await sellerContext.newPage();

  async function mockApi(route: Route, account: 'buyer' | 'seller') {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      if (authenticated[account]) {
        await route.fulfill({ status: 200, json: { user: {
          id: account === 'buyer' ? 'buyer-user-001' : 'seller-user-001',
          email: account === 'buyer' ? 'buyer@example.test' : 'seller@example.test',
          display_name: account === 'buyer' ? 'Buyer Test' : 'Seller Test',
          country_code: 'NG',
        } } });
      } else {
        await route.fulfill({ status: 401, json: { message: 'No active session' } });
      }
      return;
    }
    if (path === '/market/listings' && method === 'GET' && account === 'buyer') {
      buyerListingRequests += 1;
      if (buyerListingRequests === 1) {
        await route.fulfill({ status: 503, json: { message: 'Marketplace listings temporarily unavailable' } });
      } else {
        await route.fulfill({
          status: 200,
          json: { data: [{
            id: 'listing-e2e-retry-001',
            listing_type: 'service',
            title: 'Retry recovered service',
            currency_code: 'NGN',
            price_minor_units: 450000,
            country_code: 'NG',
            seller_name: 'Seller Test',
            description: 'A listing returned after retry.',
          }] },
        });
      }
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated[account] = true;
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: account === 'buyer' ? 'buyer-user-001' : 'seller-user-001',
            email: account === 'buyer' ? 'buyer@example.test' : 'seller@example.test',
            display_name: account === 'buyer' ? 'Buyer Test' : 'Seller Test',
            country_code: 'NG',
          },
        },
      });
      return;
    }
    if (path === '/market/contracts/mine' && method === 'GET') {
      await route.fulfill({
        status: 200,
        json: { data: [{
          id: contract.id,
          direction: account === 'buyer' ? 'sent' : 'received',
          title: contract.title,
          status: contract.status,
          buyer_name: 'Buyer Test',
          seller_name: 'Seller Test',
          buyer_member_role: 'owner',
          seller_member_role: 'owner',
          amount_minor_units: 125000,
          currency_code: 'NGN',
          scope: 'Deliver the agreed service and provide the completed work.',
          terms: 'Both parties review the deliverables and confirm fulfilment.',
          created_at: '2026-11-07T10:00:00.000Z',
          buyer_confirmed_at: contract.buyer_confirmed_at,
          seller_confirmed_at: contract.seller_confirmed_at,
        }] },
      });
      return;
    }
    if (path === `/market/contracts/${contract.id}/messages` && method === 'GET') {
      await route.fulfill({ status: 200, json: { data: { messages: [] } } });
      return;
    }
    if (path === `/market/contracts/${contract.id}/respond` && method === 'PATCH') {
      const body = request.postDataJSON() as { decision?: string };
      if (account !== 'seller' || body.decision !== 'accept' || contract.status !== 'proposed') {
        await route.fulfill({ status: 403, json: { message: 'Transition not permitted in test fixture' } });
        return;
      }
      contract.status = 'accepted';
      await route.fulfill({ status: 200, json: { data: { id: contract.id, status: contract.status } } });
      return;
    }
    if (path === `/market/contracts/${contract.id}/confirm-completion` && method === 'PATCH') {
      if (contract.status !== 'accepted') {
        await route.fulfill({ status: 409, json: { message: 'Contract must be accepted first' } });
        return;
      }
      const timestamp = '2026-11-07T11:00:00.000Z';
      if (account === 'buyer') contract.buyer_confirmed_at = timestamp;
      else contract.seller_confirmed_at = timestamp;
      if (contract.buyer_confirmed_at && contract.seller_confirmed_at) contract.status = 'completed';
      await route.fulfill({ status: 200, json: { data: { id: contract.id, status: contract.status } } });
      return;
    }

    // Other account bootstrap requests are intentionally isolated from live services.
    await route.fulfill({ status: 200, json: {} });
  }

  await buyer.route('**/api/**', route => mockApi(route, 'buyer'));
  await seller.route('**/api/**', route => mockApi(route, 'seller'));

  try {
    console.log('[contract-e2e] buyer login starting');
    await login(buyer, 'buyer@example.test');
    await expect.poll(() => buyerListingRequests, { timeout: 10_000 }).toBe(1);
    await expect(buyer.locator('#sbar [data-tab="Markets"]')).toBeVisible();
    await buyer.locator('#sbar [data-tab="Markets"]').click();
    await expect(buyer.locator('#app [data-mm="Services"]')).toBeVisible();
    await buyer.locator('#app [data-mm="Services"]').first().click();
    await expect(buyer.getByText('Could not load marketplace listings')).toBeVisible();
    await buyer.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(buyer.getByText('Retry recovered service')).toBeVisible();
    expect(buyerListingRequests).toBe(2);
    console.log('[contract-e2e] marketplace listing failure recovered after retry; opening contract');
    await buyer.locator('#sbar [data-f="Contracts"]').click();
    await buyer.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await expect(buyer.getByText('Awaiting response')).toBeVisible();
    await buyer.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(buyer, 'Clients contract detail');

    console.log('[contract-e2e] seller login starting');
    await login(seller, 'seller@example.test');
    console.log('[contract-e2e] seller login complete; switching to Alpha');
    await seller.locator('#app .top button[data-pg="profile"]').click();
    await seller.locator('[data-act="mode"]').click();
    await seller.locator('#sbar [data-f="Contracts"]').click();
    await seller.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await seller.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(seller, 'Alpha contract detail');
    await seller.getByRole('button', { name: 'Accept and agree' }).click();
    await expect(seller.getByText('Accepted', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(seller, 'Alpha accepted contract');
    await seller.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' }).click();
    await expect(seller.getByText('Waiting for the other party')).toBeVisible();

    console.log('[contract-e2e] seller accepted and confirmed; reloading buyer');
    await buyer.setViewportSize({ width: 1280, height: 900 });
    await buyer.reload();
    await expect(buyer.locator('#app .view')).toBeVisible();
    await buyer.locator('#sbar [data-f="Contracts"]').click();
    await buyer.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await buyer.setViewportSize({ width: 390, height: 844 });
    await expect(buyer.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' })).toBeVisible();
    await buyer.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' }).click();
    await expect(buyer.getByText('Completed', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(buyer, 'Clients completed contract');
    expect(contract.status).toBe('completed');
    expect(contract.buyer_confirmed_at).not.toBeNull();
    expect(contract.seller_confirmed_at).not.toBeNull();
  } finally {
    await Promise.allSettled([buyerContext.close(), sellerContext.close()]);
  }
});


test('organization documents and own-offer screens recover after transient API failures', async ({ browser }) => {
  test.setTimeout(75_000);
  let authenticated = false;
  let organizationRequests = 0;
  let documentRequests = 0;
  let ownOfferRequests = 0;
  let organizationFailuresRemaining = 0;
  let documentFailureArmed = false;
  let ownOfferFailureArmed = false;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => console.log('[contract-e2e] organization pageerror:', error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('[contract-e2e] organization console error:', message.text()); });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      await route.fulfill(authenticated
        ? { status: 200, json: { user: { id: 'seller-retry-001', email: 'seller@example.test', display_name: 'Seller Test', country_code: 'NG' } } }
        : { status: 401, json: { message: 'No active session' } });
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ status: 200, json: { user: { id: 'seller-retry-001', email: 'seller@example.test', display_name: 'Seller Test', country_code: 'NG' } } });
      return;
    }
    if (path === '/organizations/mine' && method === 'GET') {
      organizationRequests += 1;
      if (organizationFailuresRemaining > 0) {
        organizationFailuresRemaining -= 1;
        await route.fulfill({ status: 503, json: { message: 'Organization service temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { organization: {
          id: 'org-retry-001', name: 'Retry Test Services', organization_type: 'service_provider',
          country_code: 'NG', default_currency: 'NGN', status: 'pending', member_role: 'owner',
          created_at: '2026-11-07T10:00:00.000Z',
        } } });
      }
      return;
    }
    if (path === '/organizations/org-retry-001/documents' && method === 'GET') {
      documentRequests += 1;
      if (documentFailureArmed) {
        documentFailureArmed = false;
        await route.fulfill({ status: 503, json: { message: 'Document service temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { documents: [] } });
      }
      return;
    }
    if (path === '/market/listings/mine' && method === 'GET') {
      ownOfferRequests += 1;
      if (ownOfferFailureArmed) {
        ownOfferFailureArmed = false;
        await route.fulfill({ status: 503, json: { message: 'Your offers are temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { data: [] } });
      }
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  try {
    // Fail both authenticated bootstrap and the Organization-page refresh.
    // The page wrapper performs a second loadOrg() when the page is opened;
    // both failures are required to reach the empty-state error UI. Retry then succeeds.
    organizationFailuresRemaining = 2;
    documentFailureArmed = true;
    await login(page, 'seller@example.test');
    console.log('[contract-e2e] organization recovery: authenticated; bootstrap requests', { organizationRequests, documentRequests, ownOfferRequests });
    await expect.poll(() => organizationRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    console.log('[contract-e2e] organization recovery: opening profile and switching to Alpha');
    await page.locator('#app .top button[data-pg="profile"]').click({ force: true });
    await page.locator('[data-act="mode"]').click({ force: true });
    console.log('[contract-e2e] organization recovery: navigating; failure already exercised');
    await page.locator('#sbar [data-f="More"]').click({ force: true, timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'All services' })).toBeVisible({ timeout: 10_000 });
    await page.locator('#pg').getByRole('button', { name: 'Organization', exact: true }).click({ force: true, timeout: 10_000 });
    console.log('[contract-e2e] organization recovery: navigation returned', { organizationRequests, documentRequests });
    await expect(page.getByText('Could not load organization', { exact: true })).toBeVisible({ timeout: 10_000 });
    console.log('[contract-e2e] organization recovery: retrying organization', { organizationRequests, documentRequests });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Retry Test Services' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Could not load verification documents:/)).toBeVisible();
    console.log('[contract-e2e] organization recovery: retrying documents', { organizationRequests, documentRequests });
    await page.getByRole('button', { name: 'Retry document loading' }).click();
    await expect(page.getByText('No documents yet')).toBeVisible({ timeout: 10_000 });
    expect(organizationRequests).toBeGreaterThanOrEqual(3);
    expect(documentRequests).toBe(2);

    ownOfferFailureArmed = true;
    console.log('[contract-e2e] own-offer recovery: opening More; failure armed');
    await page.locator('#sbar [data-f="More"]').click({ force: true, timeout: 10_000 });
    await page.locator('#pg [data-f="Contract approvals"]').click({ force: true, timeout: 10_000 });
    await expect(page.getByText('Could not load your offers', { exact: true })).toBeVisible();
    const failedOfferRequestCount = ownOfferRequests;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(() => ownOfferRequests, { timeout: 10_000 }).toBeGreaterThan(failedOfferRequestCount);
    await expect(page.getByText('No contracts awaiting approval', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(ownOfferRequests).toBeGreaterThanOrEqual(2);
  } finally {
    await context.close().catch(error => console.log('[contract-e2e] organization recovery cleanup:', String(error)));
  }
});


test('contracts and enquiries lists recover after transient API failures', async ({ browser }) => {
  test.setTimeout(75_000);
  let authenticated = false;
  let contractRequests = 0;
  let enquiryRequests = 0;
  // These endpoints are fetched during authenticated bootstrap. Arm failures
  // before login so the first real request exercises the error/retry UI.
  // Fail the initial bootstrap attempts even if the app issues overlapping requests;
  // the explicit Retry action must be the first successful response.
  let contractFailuresRemaining = 2;
  let enquiryFailuresRemaining = 3;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => console.log('[contract-e2e] list recovery pageerror:', error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('[contract-e2e] list recovery console error:', message.text()); });

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      await route.fulfill(authenticated
        ? { status: 200, json: { user: { id: 'retry-user-001', email: 'retry@example.test', display_name: 'Retry User', country_code: 'NG' } } }
        : { status: 401, json: { message: 'No active session' } });
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ status: 200, json: { user: { id: 'retry-user-001', email: 'retry@example.test', display_name: 'Retry User', country_code: 'NG' } } });
      return;
    }
    if (path === '/market/contracts/mine' && method === 'GET') {
      contractRequests += 1;
      if (contractFailuresRemaining > 0) {
        contractFailuresRemaining -= 1;
        await route.fulfill({ status: 503, json: { message: 'Contract service temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { data: [] } });
      }
      return;
    }
    if (path === '/market/enquiries/mine' && method === 'GET') {
      enquiryRequests += 1;
      if (enquiryFailuresRemaining > 0) {
        enquiryFailuresRemaining -= 1;
        await route.fulfill({ status: 503, json: { message: 'Enquiry service temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { data: [] } });
      }
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  try {
    await login(page, 'retry@example.test');
    await expect.poll(() => contractRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(() => enquiryRequests, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

    console.log('[contract-e2e] list recovery: bootstrap request counts', { contractRequests, enquiryRequests });
    await page.locator('#sbar [data-f="Contracts"]').click({ force: true, timeout: 10_000 });
    console.log('[contract-e2e] list recovery: opened Contracts', { contractRequests, enquiryRequests });
    await expect(page.getByText('Could not load contracts', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('No contracts yet', { exact: true })).toBeVisible();
    expect(contractRequests).toBeGreaterThanOrEqual(2);

    console.log('[contract-e2e] list recovery: opening Conversations', { contractRequests, enquiryRequests });
    await page.locator('#sbar [data-f="More"]').click({ force: true, timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'All services' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Conversations', exact: true }).click({ force: true, timeout: 10_000 });
    console.log('[contract-e2e] list recovery: opened Conversations', { contractRequests, enquiryRequests });
    await expect(page.getByText('Could not load conversations', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('No conversations yet.', { exact: true })).toBeVisible();
    expect(enquiryRequests).toBeGreaterThanOrEqual(2);
  } finally {
    await context.close().catch(error => console.log('[contract-e2e] list recovery cleanup:', String(error)));
  }
});

test('individual contract and enquiry messages recover after transient API failures', async ({ browser }) => {
  test.setTimeout(75_000);
  let authenticated = false;
  let contractMessageRequests = 0;
  let enquiryMessageRequests = 0;
  const contractId = 'message-retry-contract-001';
  const enquiryId = 'message-retry-enquiry-001';
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      await route.fulfill(authenticated
        ? { status: 200, json: { user: { id: 'message-retry-user', email: 'messages@example.test', display_name: 'Message Retry User', country_code: 'NG' } } }
        : { status: 401, json: { message: 'No active session' } });
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ status: 200, json: { user: { id: 'message-retry-user', email: 'messages@example.test', display_name: 'Message Retry User', country_code: 'NG' } } });
      return;
    }
    if (path === '/market/contracts/mine' && method === 'GET') {
      await route.fulfill({ status: 200, json: { data: [{
        id: contractId, direction: 'sent', title: 'Contract message retry fixture',
        status: 'proposed', buyer_name: 'Message Retry User', seller_name: 'Seller Fixture',
        buyer_member_role: 'owner', seller_member_role: 'owner', amount_minor_units: 9900,
        currency_code: 'NGN', scope: 'Complete the agreed service.', terms: 'Both parties confirm completion.',
        created_at: '2026-11-08T09:00:00.000Z', buyer_confirmed_at: null, seller_confirmed_at: null,
      }] } });
      return;
    }
    if (path === `/market/contracts/${contractId}/messages` && method === 'GET') {
      contractMessageRequests += 1;
      if (contractMessageRequests === 1) {
        await route.fulfill({ status: 503, json: { message: 'Contract messages temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { data: { messages: [] } } });
      }
      return;
    }
    if (path === '/market/enquiries/mine' && method === 'GET') {
      await route.fulfill({ status: 200, json: { data: [{
        id: enquiryId, listing_id: 'message-retry-listing', listing_title: 'Enquiry message retry fixture',
        seller_name: 'Seller Fixture', buyer_name: 'Message Retry User', direction: 'sent',
        currency_code: 'NGN', price_minor_units: 9900, created_at: '2026-11-08T09:00:00.000Z', unread_count: 0,
      }] } });
      return;
    }
    if (path === `/market/enquiries/${enquiryId}/messages` && method === 'GET') {
      enquiryMessageRequests += 1;
      if (enquiryMessageRequests === 1) {
        await route.fulfill({ status: 503, json: { message: 'Enquiry messages temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { data: { messages: [] } } });
      }
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  try {
    await login(page, 'messages@example.test');

    await page.locator('#sbar [data-f="Contracts"]').click({ force: true, timeout: 10_000 });
    await page.getByRole('button', { name: /Contract message retry fixture/ }).click();
    await expect(page.getByText('Could not load messages', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(contractMessageRequests).toBe(1);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('No contract messages yet.', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(contractMessageRequests).toBe(2);

    await page.locator('#sbar [data-f="More"]').click({ force: true, timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'All services' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Conversations', exact: true }).click({ force: true, timeout: 10_000 });
    await page.getByRole('button', { name: /Enquiry message retry fixture/ }).click();
    await expect(page.getByText('Could not load messages', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(enquiryMessageRequests).toBe(1);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByText('Could not load messages', { exact: true })).toHaveCount(0, { timeout: 10_000 });
    await expect(page.locator('#dm')).toBeVisible();
    expect(enquiryMessageRequests).toBe(2);
  } finally {
    await context.close().catch(() => undefined);
  }
});

test('community Feed recovers after a transient API failure and fits mobile screens', async ({ browser }) => {
  test.setTimeout(75_000);
  let authenticated = false;
  let feedRequests = 0;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      await route.fulfill(authenticated
        ? { status: 200, json: { user: { id: 'feed-mobile-user', email: 'feed@example.test', display_name: 'Feed Mobile User', country_code: 'NG' } } }
        : { status: 401, json: { message: 'No active session' } });
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ status: 200, json: { user: { id: 'feed-mobile-user', email: 'feed@example.test', display_name: 'Feed Mobile User', country_code: 'NG' } } });
      return;
    }
    if (path === '/feed/posts' && method === 'GET') {
      feedRequests += 1;
      if (feedRequests === 1) {
        await route.fulfill({ status: 503, json: { message: 'Community Feed temporarily unavailable' } });
      } else {
        await route.fulfill({ status: 200, json: { posts: [{
          id: 'feed-mobile-post-001', post_type: 'post', author_name: 'Feed QA Member',
          author_user_id: 'feed-qa-author', title: 'Feed retry acceptance post',
          body: 'This post confirms the community Feed recovered after Retry.',
          attachments: [], comment_count: 0, reaction_count: 0, reshare_count: 0,
          pinned: false, created_at: '2026-11-08T09:00:00.000Z',
        }] } });
      }
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  try {
    await login(page, 'feed@example.test');
    await page.locator('#sbar [data-tab="Feed"]').click({ force: true, timeout: 10_000 });
    await expect(page.getByText('Feed unavailable', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(feedRequests).toBe(1);

    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByText('Feed retry acceptance post', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Feed QA Member', { exact: true })).toBeVisible();
    expect(feedRequests).toBe(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('Feed retry acceptance post', { exact: true })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  } finally {
    await context.close().catch(() => undefined);
  }
});


test('notification action marks the item read and opens its internal conversation link', async ({ page }) => {
  test.setTimeout(45_000);
  let authenticated = false;
  let notificationRead = false;
  const enquiryId = 'enquiry-notification-001';

  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.startsWith('/api') ? url.pathname.slice(4) : url.pathname;
    const method = request.method();

    if (path === '/auth/me' && method === 'GET') {
      await route.fulfill(authenticated
        ? { status: 200, json: { user: { id: 'buyer-user-001', email: 'buyer@example.test', display_name: 'Buyer Test', country_code: 'NG' } } }
        : { status: 401, json: { message: 'No active session' } });
      return;
    }
    if (path === '/auth/login' && method === 'POST') {
      authenticated = true;
      await route.fulfill({ status: 200, json: { user: { id: 'buyer-user-001', email: 'buyer@example.test', display_name: 'Buyer Test', country_code: 'NG' } } });
      return;
    }
    if (path === '/notifications' && method === 'GET') {
      await route.fulfill({ status: 200, json: { notifications: [{
        id: 'notification-001',
        category: 'Contracts',
        title: 'New marketplace enquiry',
        body: 'A buyer enquired about a published offer.',
        icon: 'message-square',
        action_url: '/messages/' + enquiryId,
        read_at: null,
        created_at: '2026-11-13T05:00:00.000Z',
      }], unread_count: 1 } });
      return;
    }
    if (path === '/notifications/notification-001/read' && method === 'PATCH') {
      notificationRead = true;
      await route.fulfill({ status: 200, json: { success: true, notification: { id: 'notification-001', read_at: '2026-11-13T05:01:00.000Z' } } });
      return;
    }
    if (path === '/market/enquiries/' + enquiryId + '/messages' && method === 'GET') {
      await route.fulfill({ status: 200, json: { data: {
        enquiry: {
          id: enquiryId,
          listing_id: 'listing-notification-001',
          listing_title: 'Notification navigation fixture',
          buyer_user_id: 'buyer-user-001',
          buyer_name: 'Buyer Test',
          seller_name: 'Seller Test',
          status: 'open',
        },
        messages: [{
          id: 'initial-' + enquiryId,
          sender_user_id: 'buyer-user-001',
          sender_name: 'Buyer Test',
          message: 'Please share the next steps.',
          created_at: '2026-11-13T05:00:00.000Z',
          initial: true,
        }],
      } } });
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });

  await login(page, 'buyer@example.test');
  await page.locator('#app button[data-pg="notif"]').first().click();
  await expect(page.locator('#pg .ncard')).toHaveCount(1);
  await page.locator('#pg .ncard').click();

  await expect(page).toHaveURL(url => url.pathname === '/messages/' + enquiryId);
  await expect(page.getByRole('heading', { name: 'Notification navigation fixture.' })).toBeVisible();
  expect(notificationRead).toBe(true);
});

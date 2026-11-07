import { expect, test, type Page, type Route } from '@playwright/test';

type ContractFixture = {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'completed';
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
};

async function solveLoginPuzzle(page: Page) {
  const puzzle = await page.evaluate(() => {
    const track = document.querySelector('#tk');
    const handle = document.querySelector('#hd');
    const hole = document.querySelector('#ho');
    const board = document.querySelector('#pz');
    if (!(track instanceof HTMLElement) || !(handle instanceof HTMLElement) ||
        !(hole instanceof HTMLElement) || !(board instanceof HTMLElement)) return null;
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
  expect(puzzle, 'login puzzle should render').not.toBeNull();
  await page.mouse.move(puzzle!.x, puzzle!.y);
  await page.mouse.down();
  await page.mouse.move(puzzle!.x + puzzle!.delta, puzzle!.y, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator('#cap')).toHaveClass(/hide/, { timeout: 5_000 });
}

async function login(page: Page, email: string) {
  await page.goto('/app');
  await expect(page.locator('#land')).toBeVisible({ timeout: 20_000 });
  await page.locator('#land nav button[data-login="in"]').click();
  await page.locator('#id').fill(email);
  await page.locator('#login button[data-k="next"]').click();
  await page.locator('#pw').fill('TradeMate-test-password-2026');
  await page.locator('#login button[data-k="next"]').click();
  await solveLoginPuzzle(page);
  await expect(page.locator('#app .view')).toBeVisible();
}

test('two separate accounts complete a contract through the Clients and Alpha UI', async ({ browser }) => {
  test.setTimeout(90_000);

  const authenticated: Record<'buyer' | 'seller', boolean> = { buyer: false, seller: false };
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
    await login(buyer, 'buyer@example.test');
    await buyer.locator('#sbar [data-f="Contracts"]').click();
    await buyer.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await expect(buyer.getByText('Awaiting response')).toBeVisible();

    await login(seller, 'seller@example.test');
    await seller.locator('#sbar [data-pg="profile"]').click();
    await seller.locator('[data-act="mode"]').click();
    await seller.locator('#sbar [data-f="Contracts"]').click();
    await seller.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await seller.getByRole('button', { name: 'Accept contract' }).click();
    await expect(seller.getByText('Accepted')).toBeVisible();
    await seller.getByRole('button', { name: 'Confirm fulfilment' }).click();
    await expect(seller.getByText('Waiting for the other party')).toBeVisible();

    await buyer.reload();
    await expect(buyer.locator('#app .view')).toBeVisible();
    await buyer.locator('#sbar [data-f="Contracts"]').click();
    await buyer.getByRole('button', { name: /Two-account UI acceptance fixture/ }).click();
    await expect(buyer.getByRole('button', { name: 'Confirm fulfilment' })).toBeVisible();
    await buyer.getByRole('button', { name: 'Confirm fulfilment' }).click();
    await expect(buyer.getByText('Completed')).toBeVisible();
    expect(contract.status).toBe('completed');
    expect(contract.buyer_confirmed_at).not.toBeNull();
    expect(contract.seller_confirmed_at).not.toBeNull();
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});

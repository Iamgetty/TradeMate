import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

type Actor = { id: string; email: string; token: string };
type Fixture = {
  buyer: Actor;
  seller: Actor;
  contractId: string;
  contractTitle: string;
};

async function openAuthenticatedApp(browser: Browser, actor: Actor) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:3000' });
  await context.addCookies([{
    name: 'trademate_session',
    value: actor.token,
    url: 'http://127.0.0.1:3000',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000/app');
  await expect(page.locator('#app .view')).toBeVisible({ timeout: 20_000 });
  const session = await page.request.get('/api/auth/me');
  expect(session.status(), 'the browser session must be validated by the real API').toBe(200);
  const payload = await session.json();
  expect(payload.user.email).toBe(actor.email);
  return { context, page };
}

async function openContract(page: Page, title: string) {
  await page.locator('#sbar [data-f="Contracts"]').click();
  await page.locator('#app .view .lr').filter({ hasText: title }).click();
}

async function expectNoHorizontalOverflow(page: Page, surface: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document, surface + ' must not overflow the mobile viewport')
    .toBeLessThanOrEqual(dimensions.viewport + 2);
}

test('two real browser sessions complete one PostgreSQL-backed contract through Clients and Alpha', async ({ browser }) => {
  test.setTimeout(90_000);
  const fixturePath = process.env.TRADEMATE_E2E_FIXTURE;
  if (!fixturePath) throw new Error('TRADEMATE_E2E_FIXTURE must point to the disposable database fixture.');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;

  let buyerContext: BrowserContext | undefined;
  let sellerContext: BrowserContext | undefined;
  try {
    const buyerSession = await openAuthenticatedApp(browser, fixture.buyer);
    buyerContext = buyerSession.context;
    const buyer = buyerSession.page;
    const buyerContractsResponse = await buyer.request.get('/api/market/contracts/mine');
    expect(buyerContractsResponse.status(), 'buyer contract list API must be available').toBe(200);
    const buyerContractsPayload = await buyerContractsResponse.json();
    const seededBuyerContract = (buyerContractsPayload.data || []).find((contract: { id: string }) => contract.id === fixture.contractId);
    console.log('Live buyer contract list diagnostic:', JSON.stringify({
      count: (buyerContractsPayload.data || []).length,
      seededContract: seededBuyerContract ? {
        id: seededBuyerContract.id,
        title: seededBuyerContract.title,
        direction: seededBuyerContract.direction,
        status: seededBuyerContract.status,
      } : null,
    }));
    expect(seededBuyerContract, 'the real API must return the seeded contract to its buyer').toBeTruthy();
    await openContract(buyer, fixture.contractTitle);
    await buyer.setViewportSize({ width: 390, height: 844 });
    await expect(buyer.getByText('Awaiting response')).toBeVisible();
    await expectNoHorizontalOverflow(buyer, 'Clients proposed contract');

    const sellerSession = await openAuthenticatedApp(browser, fixture.seller);
    sellerContext = sellerSession.context;
    const seller = sellerSession.page;
    await seller.locator('#app .top button[data-pg="profile"]').click();
    await seller.locator('[data-act="mode"]').click();
    await openContract(seller, fixture.contractTitle);
    await seller.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(seller, 'Alpha proposed contract');

    await seller.getByRole('button', { name: 'Accept and agree' }).click();
    await expect(seller.getByText('Accepted', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(seller, 'Alpha accepted contract');

    await seller.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' }).click();
    await expect(seller.getByText('Waiting for the other party')).toBeVisible();

    await buyer.reload();
    await expect(buyer.locator('#app .view')).toBeVisible();
    await buyer.setViewportSize({ width: 1280, height: 900 });
    await openContract(buyer, fixture.contractTitle);
    await buyer.setViewportSize({ width: 390, height: 844 });
    await expect(buyer.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' })).toBeVisible();
    await buyer.getByRole('button', { name: 'Reconfirm agreement and confirm fulfilment' }).click();
    await expect(buyer.getByText('Completed', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(buyer, 'Clients completed contract');

    const durableContract = await buyer.request.get('/api/market/contracts/' + fixture.contractId);
    expect(durableContract.status()).toBe(200);
    const result = await durableContract.json();
    expect(result.data.status).toBe('completed');
    expect(result.data.buyer_confirmed_at).toBeTruthy();
    expect(result.data.seller_confirmed_at).toBeTruthy();

    const sellerReload = await seller.request.get('/api/market/contracts/' + fixture.contractId);
    expect(sellerReload.status()).toBe(200);
    expect((await sellerReload.json()).data.status).toBe('completed');
  } finally {
    await Promise.allSettled([buyerContext?.close(), sellerContext?.close()]);
  }
});

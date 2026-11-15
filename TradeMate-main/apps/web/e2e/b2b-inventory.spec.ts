import { expect, test } from '@playwright/test';

const business = {
  name: 'Test Supply Group',
  country_code: 'NG',
  default_currency: 'NGN',
  status: 'active',
};

const b2bOffer = {
  id: '323e4567-e89b-42d3-a456-426614174000',
  title: 'Bulk packaging supply',
  description: 'Wholesale packaging for commercial buyers.',
  listing_type: 'b2b',
  price_minor_units: '125000',
  currency_code: 'NGN',
  country_code: 'NG',
  quantity_available: '1250',
  status: 'draft',
  created_at: '2026-11-15T10:00:00.000Z',
  updated_at: '2026-11-15T10:00:00.000Z',
  seller_name: business.name,
};

async function mockSellerSession(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200,
    json: { user: { id: 'seller-001', email: 'seller@example.test' } },
  }));
  await page.route('**/api/organizations/mine', route => route.fulfill({
    status: 200,
    json: { organization: business },
  }));
}

test('B2B offer creation passes the entered whole-number inventory to the API', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await mockSellerSession(page);
  await page.route('**/api/market/listings', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { listing: { ...b2bOffer, quantity_available: submitted.quantityAvailable } },
    });
  });

  await page.goto('/offers/new');
  await page.getByLabel('What are you offering?').selectOption('b2b');
  await page.getByLabel('Offer title').fill('Bulk packaging supply');
  await page.getByLabel('Description').fill('Wholesale packaging for commercial buyers.');
  await page.getByLabel(/^Price/).fill('1250');
  await page.getByLabel('Quantity available (optional)').fill('1250');
  await page.getByRole('button', { name: /Save offer as draft/ }).click();

  await expect(page.getByRole('heading', { name: /Your offer is/ })).toBeVisible();
  expect(submitted?.listingType).toBe('b2b');
  expect(submitted?.quantityAvailable).toBe('1250');
  await expect(page.getByText('1,250 available')).toBeVisible();
});

test('Services offer creation does not expose or send B2B inventory', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await mockSellerSession(page);
  await page.route('**/api/market/listings', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { listing: { ...b2bOffer, listing_type: 'service', quantity_available: null } },
    });
  });

  await page.goto('/offers/new');
  await expect(page.getByLabel('Quantity available (optional)')).toHaveCount(0);
  await page.getByLabel('Offer title').fill('Business advisory services');
  await page.getByLabel('Description').fill('Commercial advisory and implementation support.');
  await page.getByLabel(/^Price/).fill('1250');
  await page.getByRole('button', { name: /Save offer as draft/ }).click();

  expect(submitted?.listingType).toBe('service');
  expect(submitted?.quantityAvailable).toBeNull();
});

test('editing a B2B draft retains and submits its current inventory value', async ({ page }) => {
  let savedPayload: Record<string, unknown> | undefined;
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200,
    json: { user: { id: 'seller-001', email: 'seller@example.test' } },
  }));
  await page.route('**/api/market/listings/mine', route => route.fulfill({
    status: 200,
    json: { data: [b2bOffer] },
  }));
  await page.route('**/api/market/listings/' + b2bOffer.id, async route => {
    if (route.request().method() === 'PATCH') {
      savedPayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { listing: { ...b2bOffer, quantity_available: savedPayload.quantityAvailable } } });
      return;
    }
    await route.continue();
  });

  await page.goto('/offers');
  await page.getByRole('button', { name: 'Edit draft' }).click();
  const quantity = page.getByLabel('Quantity available (optional)');
  await expect(quantity).toHaveValue('1250');
  await quantity.fill('900');
  await page.getByRole('button', { name: 'Save changes' }).click();

  expect(savedPayload?.listingType).toBe('b2b');
  expect(savedPayload?.quantityAvailable).toBe('900');
});

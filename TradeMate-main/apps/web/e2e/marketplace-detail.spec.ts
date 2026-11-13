import { expect, test } from '@playwright/test';

const listingId = '123e4567-e89b-42d3-a456-426614174000';

test('B2B offer detail displays numeric inventory returned by the API', async ({ page }) => {
  await page.route('**/api/market/listings/' + listingId, async route => {
    await route.fulfill({
      status: 200,
      json: { data: {
        id: listingId,
        title: 'Bulk packaging materials',
        description: 'Supply of packaging materials for wholesale buyers.',
        listing_type: 'b2b',
        price_minor_units: '125000',
        currency_code: 'NGN',
        country_code: 'NG',
        quantity_available: '1250',
        seller_name: 'TradeMate Supply Co.',
        category_name: 'Packaging',
        media: [],
      } },
    });
  });

  await page.goto('/market/' + listingId);
  await expect(page.getByRole('heading', { name: 'Bulk packaging materials' })).toBeVisible();
  await expect(page.getByText('QUANTITY AVAILABLE')).toBeVisible();
  await expect(page.getByText('1,250 available')).toBeVisible();
});

test('B2B offer detail labels missing inventory without inventing a quantity', async ({ page }) => {
  await page.route('**/api/market/listings/' + listingId, async route => {
    await route.fulfill({
      status: 200,
      json: { data: {
        id: listingId,
        title: 'Regional distribution partnership',
        description: 'Distribution opportunity across the region.',
        listing_type: 'b2b',
        price_minor_units: '0',
        currency_code: 'NGN',
        country_code: 'NG',
        quantity_available: null,
        seller_name: 'TradeMate Supply Co.',
        category_name: null,
        media: [],
      } },
    });
  });

  await page.goto('/market/' + listingId);
  await expect(page.getByRole('heading', { name: 'Regional distribution partnership' })).toBeVisible();
  await expect(page.getByText('Quantity not specified')).toBeVisible();
});

import { expect, test } from '@playwright/test';

const listingId = '623e4567-e89b-42d3-a456-426614174000';

const listing = {
  id: listingId,
  title: 'Bulk packaging materials',
  description: 'Supply of packaging materials for wholesale buyers.',
  listing_type: 'b2b' as const,
  price_minor_units: '125000',
  currency_code: 'NGN',
  country_code: 'NG',
  quantity_available: 1250 as number | null,
  seller_name: 'TradeMate Supply Co.',
  category_name: 'Packaging',
  media: [],
};

async function openListing(
  page: import('@playwright/test').Page,
  data: typeof listing | (Omit<typeof listing, 'listing_type'> & { listing_type: 'service'; quantity_available: number | null }),
) {
  await page.route('**/api/market/listings/' + listingId, route => route.fulfill({
    status: 200,
    json: { data },
  }));
  await page.goto('/market/' + listingId);
  await expect(page.getByRole('heading', { name: listing.title })).toBeVisible();
}

test('B2B detail displays zero inventory as zero available', async ({ page }) => {
  await openListing(page, { ...listing, quantity_available: 0 });
  await expect(page.getByText('QUANTITY AVAILABLE')).toBeVisible();
  await expect(page.getByText('0 available')).toBeVisible();
  await expect(page.getByText('Quantity not specified')).toHaveCount(0);
});

test('Services detail does not display B2B inventory labels', async ({ page }) => {
  await openListing(page, { ...listing, listing_type: 'service', quantity_available: null });
  await expect(page.getByText('AVAILABILITY')).toBeVisible();
  await expect(page.getByText('Service offer')).toBeVisible();
  await expect(page.getByText('QUANTITY AVAILABLE')).toHaveCount(0);
  await expect(page.getByText('Quantity not specified')).toHaveCount(0);
});

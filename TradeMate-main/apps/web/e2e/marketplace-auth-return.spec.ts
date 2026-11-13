import { expect, test } from '@playwright/test';

const listingId = '123e4567-e89b-42d3-a456-426614174000';
const enquiryId = '223e4567-e89b-42d3-a456-426614174000';

const listing = {
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
};

async function login(page) {
  await expect(page.getByRole('button', { name: /Sign in/ })).toBeVisible();
  await page.getByLabel('Email address').fill('buyer@example.test');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: /Sign in/ }).click();
}

test('marketplace enquiry draft survives login and returns to its offer', async ({ page }) => {
  let enquiryAttempts = 0;
  await page.route('**/api/market/listings/' + listingId, route => route.fulfill({ status: 200, json: { data: listing } }));
  await page.route('**/api/market/enquiries', async route => {
    enquiryAttempts += 1;
    await route.fulfill(enquiryAttempts === 1
      ? { status: 401, json: { message: 'Authentication required.' } }
      : { status: 201, json: { data: { id: enquiryId } } });
  });
  await page.route('**/api/auth/login', route => route.fulfill({ status: 200, json: { user: { id: 'buyer-001', email: 'buyer@example.test' } } }));

  await page.goto('/market/' + listingId);
  await page.getByLabel('Your message').fill('Please confirm the available delivery schedule.');
  await page.getByRole('button', { name: /Send enquiry/ }).click();
  await expect(page.getByRole('status')).toContainText('saved on this device');
  await page.getByRole('link', { name: 'Log in ↗' }).click();
  await login(page);

  await expect(page).toHaveURL(new RegExp('/market/' + listingId + '$'));
  await expect(page.getByLabel('Your message')).toHaveValue('Please confirm the available delivery schedule.');
  await page.getByRole('button', { name: /Send enquiry/ }).click();
  await expect(page.getByRole('status')).toContainText('Your enquiry has been sent');
  expect(enquiryAttempts).toBe(2);
});

test('conversation login returns to the thread and preserves a reply after session expiry', async ({ page }) => {
  let reads = 0;
  let replies = 0;
  let logins = 0;
  await page.route('**/api/market/enquiries/' + enquiryId + '/messages', async route => {
    if (route.request().method() === 'GET') {
      reads += 1;
      await route.fulfill(reads === 1
        ? { status: 401, json: { message: 'Authentication required.' } }
        : { status: 200, json: { data: {
          enquiry: { id: enquiryId, listing_id: listingId, listing_title: 'Bulk packaging materials', buyer_user_id: 'buyer-001', buyer_name: 'Buyer', seller_name: 'Seller', status: 'open' },
          messages: [{ id: 'm1', sender_user_id: 'buyer-001', sender_name: 'Buyer', message: 'Initial enquiry', created_at: '2026-11-13T05:00:00.000Z', initial: true }],
        } } });
      return;
    }
    replies += 1;
    await route.fulfill(replies === 1
      ? { status: 401, json: { message: 'Session expired.' } }
      : { status: 201, json: { data: { id: 'reply-1' } } });
  });
  await page.route('**/api/auth/login', async route => {
    logins += 1;
    await route.fulfill({ status: 200, json: { user: { id: 'buyer-001', email: 'buyer@example.test' } } });
  });

  await page.goto('/messages/' + enquiryId);
  await login(page);
  await expect(page).toHaveURL(new RegExp('/messages/' + enquiryId + '$'));
  await expect(page.getByRole('heading', { name: 'Bulk packaging materials.' })).toBeVisible();

  await page.getByLabel('Your reply').fill('I can confirm the schedule this afternoon.');
  await page.getByRole('button', { name: /Send reply/ }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login/);
  await login(page);
  await expect(page).toHaveURL(new RegExp('/messages/' + enquiryId + '$'));
  await expect(page.getByLabel('Your reply')).toHaveValue('I can confirm the schedule this afternoon.');
  await page.getByRole('button', { name: /Send reply/ }).click();
  await expect(page.getByRole('status')).toContainText('Reply sent.');
  expect(logins).toBe(2);
  expect(replies).toBe(2);
});


test('same-origin return destination survives the two-factor login challenge', async ({ page }) => {
  await page.route('**/api/market/listings/' + listingId, route => route.fulfill({ status: 200, json: { data: listing } }));
  await page.route('**/api/auth/login', route => route.fulfill({ status: 200, json: { requiresTwoFactor: true, challengeToken: 'challenge-001' } }));
  await page.route('**/api/auth/2fa/verify', route => route.fulfill({ status: 200, json: { success: true } }));

  await page.goto('/auth?mode=login&returnTo=' + encodeURIComponent('/market/' + listingId));
  await login(page);
  await expect(page.getByRole('heading', { name: 'Verify it’s you.' })).toBeVisible();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: /Verify and sign in/ }).click();
  await expect(page).toHaveURL(new RegExp('/market/' + listingId + '$'));
  await expect(page.getByRole('heading', { name: 'Bulk packaging materials' })).toBeVisible();
});

test('external post-login return destinations are rejected', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 200, json: { user: { id: 'buyer-001', email: 'buyer@example.test' } } }));
  await page.goto('/auth?mode=login&returnTo=' + encodeURIComponent('https://outside.example/steal-session'));
  await login(page);
  await expect(page).not.toHaveURL(/outside\\.example/);
});

import { expect, test, type Page } from '@playwright/test';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-09-15T06:00:00.000Z';

const nearbyPlace = {
  id: 'nearby-kasbah', name: 'Kasbah Museum', arabicName: 'متحف القصبة', frenchName: 'Musée de la Kasbah',
  category: 'tourist_poi', subCategory: 'Museum', region: 'Tanger-Tetouan-Al Hoceima', area: 'Tangier',
  coordinates: [35.788, -5.812], address: 'Kasbah, Tangier', photos: [], description: 'Historic museum.',
  rating: null, reviewCount: 0, reviews: [], source: 'external', ownerVerified: false, checkInsCount: 0, prominenceScore: 40,
};

const hotel = { ...nearbyPlace, id: 'marrakech-hotel', name: 'Marrakech Hotel', category: 'accommodation', subCategory: 'Hotel', region: 'Marrakech-Safi', area: 'Marrakech', coordinates: [31.629, -7.981], address: 'Marrakech', description: 'Hotel in Marrakech.' };
const landmark = { ...nearbyPlace, id: 'marrakech-landmark', name: 'Marrakech Landmark', region: 'Marrakech-Safi', area: 'Marrakech', coordinates: [31.632, -7.989], address: 'Marrakech', description: 'Landmark in Marrakech.' };

function authUser() {
  return {
    id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'round4@example.com', email_confirmed_at: NOW, confirmed_at: NOW,
    last_sign_in_at: NOW, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'Round Four Traveler' },
    identities: [], created_at: NOW, updated_at: NOW,
  };
}

async function installAnonymousMocks(page: Page) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not signed in' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/places') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [nearbyPlace] }) });
    if (url.pathname === '/api/nearby-places') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
}

test('home keeps the polished nearby card and See all opens the list', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 35.77, longitude: -5.82 });
  await installAnonymousMocks(page);
  await openApp(page);
  const card = page.locator('section article').first();
  await expect(card).toBeVisible();
  await expect(card).toHaveClass(/rounded-3xl/);
  await expect(card.locator('[data-place-photo-fallback="true"]')).toBeVisible();
  await expect(page.locator('[data-home-greeting="true"]')).toBeVisible();
  await page.locator('#home-nearby-see-all').click();
  await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'List', exact: true })).toHaveCount(0);
});

test('account appearance supports automatic device light and dark modes', async ({ page }) => {
  await installAnonymousMocks(page);
  await openApp(page);
  await page.locator('#tab-profile').click();
  await expect(page.getByText('Appearance', { exact: true })).toBeVisible();
  await page.getByRole('button').filter({ hasText: 'Dark' }).first().click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('sindbad_theme_preference'))).toBe('dark');
  await page.getByRole('button').filter({ hasText: 'Light' }).first().click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('sindbad_theme_preference'))).toBe('light');
  await page.getByRole('button').filter({ hasText: 'Device' }).first().click();
  expect(await page.evaluate(() => localStorage.getItem('sindbad_theme_preference'))).toBe('system');
  await page.getByRole('button').filter({ hasText: 'Automatic' }).first().click();
  expect(await page.evaluate(() => localStorage.getItem('sindbad_theme_preference'))).toBe('auto');
});

test('assistant opens with natural copy instead of instructional filler', async ({ page }) => {
  await installAnonymousMocks(page);
  await openApp(page);
  await page.locator('#tab-ai-assistant').click();
  await expect(page.getByText('Hi, I’m Sindbad. Where would you like to go?', { exact: true })).toBeVisible();
  await expect(page.getByText('Hi. Ask me about travel or My Sindbad.', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Write a message')).toBeVisible();
});

test('sparse Marrakech search offers the city and saves a complete city trip', async ({ page }) => {
  let planPayload: any = null;
  let savedTrip: any = null;
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e-refresh', user: authUser() }) });
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authUser()) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/places' && method === 'GET') return json({ places: url.searchParams.get('query') ? [hotel] : [hotel, landmark] });
    if (url.pathname === '/api/trips' && method === 'GET') return json({ trips: savedTrip ? [savedTrip] : [] });
    if (url.pathname === '/api/ai/plan-trip' && method === 'POST') {
      planPayload = request.postDataJSON();
      return json({ itinerary: { days: [{ day: 1, title: 'Marrakech', dailyCost: 100, items: [{ time: '10:00', activity: 'Explore Marrakech', category: 'sight', estimatedCost: 100, note: 'City exploration.' }] }], totalEstimatedCost: 100, currency: 'MAD', tips: ['Stay hydrated.'] }, overBudget: false, aiGenerated: true });
    }
    if (url.pathname === '/api/trips' && method === 'POST') {
      const payload = request.postDataJSON();
      savedTrip = { id: 'trip-city-1', userId: USER_ID, name: payload.name, destinationId: payload.destinationId || null, destinationName: null, startDate: payload.startDate, endDate: payload.endDate, budget: payload.budget, spentTotal: 0, currency: payload.currency, participantsCount: payload.participantsCount, status: 'planning', preferences: payload.preferences || [], aiItinerary: null, createdAt: NOW, updatedAt: NOW };
      return json({ trip: savedTrip }, 201);
    }
    if (url.pathname === '/api/trips/trip-city-1' && method === 'PATCH') {
      const payload = request.postDataJSON();
      savedTrip = { ...savedTrip, ...payload, updatedAt: NOW };
      return json({ trip: savedTrip });
    }
    return json({});
  });
  await openApp(page);
  await page.evaluate((id) => localStorage.setItem(`sindbad_onboarding_complete:${id}`, 'true'), USER_ID);
  await page.getByRole('button', { name: 'Account' }).first().click();
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.getByPlaceholder('Email address').fill('round4@example.com');
  await page.getByPlaceholder('Password').fill('e2e-test-value');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Welcome Back')).toBeHidden();
  await page.locator('#tab-trips').click();
  await page.locator('#trip-destination-search').fill('Marrakech');
  const city = page.locator('[data-destination-kind="city"]').filter({ hasText: 'Marrakech' }).first();
  await expect(city).toBeVisible();
  await expect(city).toContainText('City');
  await city.click();
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByText('Explore Marrakech')).toBeVisible();
  expect(planPayload?.destinationId).toBeUndefined();
  expect(planPayload?.destination?.name).toBe('Marrakech');
  await page.getByRole('button', { name: 'Save Trip' }).click();
  await page.locator('#tab-trips').click();
  await expect(page.getByText('Trip to Marrakech', { exact: true })).toBeVisible();
  await expect(page.getByText(/Marrakech ·/).first()).toBeVisible();
});

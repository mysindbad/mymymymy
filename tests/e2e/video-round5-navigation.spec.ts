import { expect, test, type Page } from '@playwright/test';

const place = {
  id: 'osm-node-12345',
  name: 'Gran Teatro Cervantes',
  arabicName: 'مسرح سيرفانتس الكبير',
  frenchName: 'Grand Théâtre Cervantès',
  category: 'tourist_poi',
  subCategory: 'Theatre',
  region: 'Tanger-Tetouan-Al Hoceima',
  area: 'Tangier',
  coordinates: [35.7798, -5.8087],
  address: 'Tangier',
  photos: [],
  description: 'Historic theatre in Tangier.',
  rating: null,
  reviewCount: 0,
  reviews: [],
  source: 'external',
  ownerVerified: false,
  checkInsCount: 0,
  dataSource: 'openstreetmap',
  ratingProvenance: 'unrated',
  trustLevel: 'external',
};

async function installMocks(page: Page) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not signed in' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/places' && request.method() === 'GET') return json({ places: [place] });
    if (url.pathname === '/api/nearby-places') return json({ places: [] });
    if (url.pathname === '/api/ai/navigation-guidance') {
      return json({
        destination: place,
        travelMode: 'driving',
        totalDistanceKm: 1.2,
        durationMinutes: 8,
        trafficCondition: 'Unavailable',
        aiSummary: 'Route ready.',
        steps: [{ id: 'step-1', distanceMeters: 50, instruction: 'Arrive at the theatre', roadName: 'Tangier', iconType: 'arrive' }],
        geometry: { coordinates: [[-5.81, 35.78], [-5.8087, 35.7798]] },
      });
    }
    return json({});
  });
}

test('navigation preview keeps the existing rounded card and uses a visual fallback when the place has no photo', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.78, longitude: -5.81 });
  await installMocks(page);
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
  await expect(page.getByText('Gran Teatro Cervantes', { exact: true })).toBeVisible();
  await page.getByText('Gran Teatro Cervantes', { exact: true }).click();
  await page.locator('#modal-start-navigation-btn').click();
  await expect(page.locator('[data-place-photo-fallback="true"]').first()).toBeVisible();
  await expect(page.getByText('Gran Teatro Cervantes', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-place-photo-fallback="true"]').first().locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]')).toBeVisible();
});

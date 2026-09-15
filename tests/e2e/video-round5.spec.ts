import { expect, test, type Page } from '@playwright/test';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-09-15T08:00:00.000Z';

const externalPlace = {
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

function authUser() {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'video5@example.com',
    email_confirmed_at: NOW,
    confirmed_at: NOW,
    last_sign_in_at: NOW,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Video Five Traveler' },
    identities: [],
    created_at: NOW,
    updated_at: NOW,
  };
}

async function installMocks(page: Page) {
  let persistedPlaceId: string | null = null;
  let reviewPayload: any = null;

  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'video5-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'video5-refresh',
          user: authUser(),
        }),
      });
    }
    if (url.pathname.endsWith('/user')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authUser()) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/places' && method === 'GET') return json({ places: [externalPlace] });
    if (path === '/api/nearby-places' && method === 'GET') return json({ places: [] });
    if (path === '/api/places' && method === 'POST') {
      const payload = request.postDataJSON();
      persistedPlaceId = '44444444-4444-4444-8444-444444444444';
      return json({ place: { ...externalPlace, ...payload, id: persistedPlaceId, source: 'community_traveler', dataSource: 'community_submission' } }, 201);
    }
    if (persistedPlaceId && path === `/api/places/${persistedPlaceId}/reviews` && method === 'POST') {
      reviewPayload = request.postDataJSON();
      return json({
        success: true,
        review: { id: 'review-1', ...reviewPayload, date: NOW, photos: [] },
        updatedPlace: {
          ...externalPlace,
          id: persistedPlaceId,
          source: 'community_traveler',
          dataSource: 'community_submission',
          rating: reviewPayload.rating,
          reviewCount: 1,
          reviews: [{ id: 'review-1', authorName: reviewPayload.authorName, authorRole: 'traveler', rating: reviewPayload.rating, date: NOW, text: reviewPayload.text, tags: reviewPayload.tags, photos: [] }],
        },
      }, 201);
    }
    if (path === '/api/ai/navigation-guidance' && method === 'POST') {
      return json({
        destination: externalPlace,
        travelMode: 'driving',
        totalDistanceKm: 1.2,
        durationMinutes: 8,
        trafficCondition: 'Unavailable',
        aiSummary: 'Route ready.',
        steps: [{ id: 'step-1', distanceMeters: 50, instruction: 'Arrive at the theatre', roadName: 'Tangier', iconType: 'arrive' }],
        geometry: { coordinates: [[-5.81, 35.78], [-5.8087, 35.7798]] },
      });
    }
    if (path === '/api/trips' && method === 'GET') return json({ trips: [] });
    return json({});
  });

  return {
    getPersistedPlaceId: () => persistedPlaceId,
    getReviewPayload: () => reviewPayload,
  };
}

async function openWithLocation(page: Page, context: any) {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.78, longitude: -5.81 });
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
  await expect(page.getByText('Gran Teatro Cervantes', { exact: true })).toBeVisible();
}

test('navigation preview keeps a polished visual fallback when a place has no photo', async ({ page, context }) => {
  await installMocks(page);
  await openWithLocation(page, context);
  await page.getByText('Gran Teatro Cervantes', { exact: true }).click();
  await page.locator('#modal-start-navigation-btn').click();
  await expect(page.locator('[data-place-photo-fallback="true"]').first()).toBeVisible();
  await expect(page.getByText('Gran Teatro Cervantes', { exact: true }).first()).toBeVisible();
});

test('Arabic review UI localizes tags and persists an external OSM place before publishing', async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'ar'));
  const state = await installMocks(page);
  await openWithLocation(page, context);

  await page.getByRole('button', { name: 'الحساب' }).first().click();
  await page.getByRole('button', { name: 'لدي حساب بالفعل' }).click();
  await page.getByPlaceholder('البريد الإلكتروني').fill('video5@example.com');
  await page.getByPlaceholder('كلمة المرور').fill('video-five-password');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
  await expect(page.getByText('مرحباً بعودتك')).toBeHidden();

  await page.locator('#tab-home').click();
  await page.getByText('مسرح سيرفانتس الكبير', { exact: true }).click();
  await expect(page.getByText('XP')).toHaveCount(0);
  await page.getByRole('button', { name: /أضف تقييمك/ }).click();
  await expect(page.getByRole('button', { name: 'طعام أصيل' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'النظافة' })).toBeVisible();
  await page.getByRole('button', { name: '5/5' }).click();
  await page.getByText('تجربتك *').locator('..').getByRole('textbox').fill('مكان تاريخي جميل ويستحق الزيارة.');
  await page.getByRole('button', { name: 'مكان مميز' }).click();
  await page.getByRole('button', { name: 'نشر التقييم' }).click();
  await expect(page.getByText('تم النشر', { exact: true })).toBeVisible();
  expect(state.getPersistedPlaceId()).toBeTruthy();
  expect(state.getReviewPayload()?.rating).toBe(5);
  expect(state.getReviewPayload()?.tags).toContain('Hidden Gem');
});

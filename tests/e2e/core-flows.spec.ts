import { expect, test, type Page } from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-09-15T02:00:00.000Z';
const PIXEL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%23dbeafe"/%3E%3C/svg%3E';

const places = [
  {
    id: 'place-tangier', name: 'Kasbah Museum', arabicName: 'متحف القصبة', frenchName: 'Musée de la Kasbah', category: 'tourist_poi',
    region: 'Tanger-Tetouan-Al Hoceima', area: 'Tangier', coordinates: [35.788, -5.812], address: 'Kasbah, Tangier', photos: [PIXEL],
    description: 'Historic museum.', rating: 4.6, reviewCount: 120, reviews: [], source: 'community_traveler', checkInsCount: 12,
  },
  {
    id: 'place-tangier-cafe', name: 'Medina Cafe', category: 'restaurant', region: 'Tanger-Tetouan-Al Hoceima', area: 'Tangier',
    coordinates: [35.786, -5.81], address: 'Tangier', photos: [PIXEL], description: 'Cafe.', rating: 0, reviewCount: 0, reviews: [],
    source: 'community_traveler', checkInsCount: 4,
  },
  {
    id: 'place-agadir', name: 'Agadir Center', arabicName: 'وسط أكادير', category: 'tourist_poi', region: 'Souss-Massa', area: 'Agadir',
    coordinates: [30.4278, -9.5981], address: 'Agadir', photos: [PIXEL], description: 'Agadir destination.', rating: 0, reviewCount: 0, reviews: [],
    source: 'community_traveler', checkInsCount: 0,
  },
  {
    id: 'place-agadir-beach', name: 'Agadir Beach', category: 'tourist_poi', region: 'Souss-Massa', area: 'Agadir',
    coordinates: [30.417, -9.61], address: 'Agadir', photos: [PIXEL], description: 'Beach near Agadir.', rating: 0, reviewCount: 0, reviews: [],
    source: 'community_traveler', checkInsCount: 0,
  },
  {
    id: 'place-akchour', name: 'Akchour Waterfall', category: 'tourist_poi', region: 'Tanger-Tetouan-Al Hoceima', area: 'Akchour',
    coordinates: [35.244, -5.174], address: 'Akchour', photos: [PIXEL], description: 'Waterfall.', rating: 0, reviewCount: 0, reviews: [],
    source: 'initial_seed', checkInsCount: 0, seedData: true,
  },
];

const itinerary = {
  days: [{ day: 1, title: 'Agadir', dailyCost: 180, items: [{ time: '10:00', activity: 'Walk by the beach', category: 'sight', estimatedCost: 0, note: 'Start near the coast.' }] }],
  totalEstimatedCost: 180,
  currency: 'MAD',
  tips: ['Carry water.'],
};

function existingTrip() {
  return {
    id: 'trip-existing', userId: USER_ID, name: 'Tangier Weekend', destinationId: 'place-tangier', destinationName: 'Kasbah Museum',
    startDate: '2026-09-20', endDate: '2026-09-21', budget: 1500, spentTotal: 0, currency: 'MAD', participantsCount: 1,
    status: 'planning' as const, preferences: [], aiItinerary: null, createdAt: NOW, updatedAt: NOW,
  };
}

type MockState = {
  trips: ReturnType<typeof existingTrip>[];
  expenses: Array<{ id: string; tripId: string; category: string; amount: number; currency: string; description: string | null; expenseDate: string; createdByUserId: string; createdAt: string }>;
  placeRequests: URL[];
};

function authUser() {
  return {
    id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'e2e@example.com', email_confirmed_at: NOW, confirmed_at: NOW,
    last_sign_in_at: NOW, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'E2E Traveler' }, identities: [], created_at: NOW, updated_at: NOW,
  };
}

function budgetPayload(state: MockState, trip = state.trips[0]) {
  const expenses = state.expenses.filter((expense) => expense.tripId === trip.id);
  const spentTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return { expenses, budget: trip.budget, currency: trip.currency, spentTotal, remaining: trip.budget - spentTotal, overBudget: spentTotal > trip.budget };
}

async function installMocks(page: Page, seedTrips: ReturnType<typeof existingTrip>[] = []) {
  const state: MockState = { trips: seedTrips.map((trip) => ({ ...trip })), expenses: [], placeRequests: [] };

  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'e2e-access-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e-refresh-token', user: authUser() }) });
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authUser()) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = async (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/places' && method === 'GET') {
      state.placeRequests.push(url);
      const query = (url.searchParams.get('query') || '').trim().toLowerCase();
      const matching = query ? places.filter((place) => [place.name, place.arabicName, place.frenchName, place.area, place.region].filter(Boolean).join(' ').toLowerCase().includes(query)) : places;
      return json({ places: matching });
    }
    if (path === '/api/trips' && method === 'GET') return json({ trips: state.trips });
    if (path === '/api/ai/plan-trip' && method === 'POST') return json({ itinerary, overBudget: false, aiGenerated: true });
    if (path === '/api/ai/chat' && method === 'POST') return json({ text: 'Voice answer from Sindbad.' });

    if (path === '/api/trips' && method === 'POST') {
      const payload = request.postDataJSON();
      const destination = places.find((place) => place.id === payload.destinationId);
      const trip = { id: `trip-${state.trips.length + 1}`, userId: USER_ID, name: payload.name, destinationId: payload.destinationId, destinationName: destination?.name || null, startDate: payload.startDate, endDate: payload.endDate, budget: payload.budget, spentTotal: 0, currency: payload.currency, participantsCount: payload.participantsCount, status: 'planning' as const, preferences: payload.preferences || [], aiItinerary: payload.aiItinerary || null, createdAt: NOW, updatedAt: NOW };
      state.trips.unshift(trip);
      return json({ trip });
    }

    const tripMatch = path.match(/^\/api\/trips\/([^/]+)$/);
    if (tripMatch && method === 'PATCH') {
      const trip = state.trips.find((item) => item.id === tripMatch[1]);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      Object.assign(trip, request.postDataJSON(), { updatedAt: NOW });
      return json({ trip });
    }
    if (tripMatch && method === 'DELETE') {
      state.trips = state.trips.filter((item) => item.id !== tripMatch[1]);
      return json({ success: true });
    }

    const expenseCollection = path.match(/^\/api\/trips\/([^/]+)\/expenses$/);
    if (expenseCollection && method === 'GET') {
      const trip = state.trips.find((item) => item.id === expenseCollection[1]);
      return trip ? json(budgetPayload(state, trip)) : json({ error: 'Trip not found' }, 404);
    }
    if (expenseCollection && method === 'POST') {
      const trip = state.trips.find((item) => item.id === expenseCollection[1]);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      const payload = request.postDataJSON();
      state.expenses.push({ id: `expense-${state.expenses.length + 1}`, tripId: trip.id, category: payload.category, amount: Number(payload.amount), currency: payload.currency, description: payload.description || null, expenseDate: payload.expenseDate, createdByUserId: USER_ID, createdAt: NOW });
      return json(budgetPayload(state, trip));
    }
    const expenseItem = path.match(/^\/api\/trips\/([^/]+)\/expenses\/([^/]+)$/);
    if (expenseItem && method === 'DELETE') {
      const trip = state.trips.find((item) => item.id === expenseItem[1]);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      state.expenses = state.expenses.filter((item) => item.id !== expenseItem[2]);
      return json(budgetPayload(state, trip));
    }

    if (path === '/api/ai/navigation-guidance' && method === 'POST') return json({ destination: places[0], travelMode: 'driving', totalDistanceKm: 1.8, durationMinutes: 12, trafficCondition: 'Unavailable', aiSummary: 'Route ready.', steps: [{ id: 's1', distanceMeters: 80, instruction: 'Arrive', roadName: 'Kasbah', iconType: 'arrive' }], geometry: { coordinates: [[-5.82, 35.78], [-5.812, 35.788]] } });
    if (path === '/api/user/location' && method === 'POST') return json({ success: true });
    if (path === '/api/traces/passive' && method === 'POST') return json({ success: true });
    if (/^\/api\/places\/[^/]+\/checkin$/.test(path) && method === 'POST') return json({ success: true });
    return json({ error: `Unhandled E2E route: ${method} ${path}` }, 404);
  });
  return state;
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
}

async function signIn(page: Page) {
  await page.evaluate((userId) => localStorage.setItem(`sindbad_onboarding_complete:${userId}`, 'true'), USER_ID);
  await page.getByRole('button', { name: 'Account' }).first().click();
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.getByPlaceholder('Email address').fill('e2e@example.com');
  await page.getByPlaceholder('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Welcome Back')).toBeHidden();
}

async function goToTrips(page: Page) {
  await page.locator('#tab-trips').click();
  await expect(page.getByText('My Trips', { exact: true }).first()).toBeVisible();
}

async function createAgadirPlan(page: Page) {
  await goToTrips(page);
  await page.locator('#trip-destination-search').fill('Agadir');
  await expect(page.getByRole('button', { name: /Agadir Center/ })).toBeVisible();
  await page.getByRole('button', { name: /Agadir Center/ }).click();
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create Plan' }).click();
  await expect(page.getByText('Walk by the beach')).toBeVisible();
}

test('first load does not request or display default places without location', async ({ page }) => {
  const state = await installMocks(page);
  await openApp(page);
  await page.waitForTimeout(400);
  expect(state.placeRequests).toHaveLength(0);
  await expect(page.getByText('Share your location to see nearby places.')).toBeVisible();
  await expect(page.getByText('Akchour Waterfall')).toBeHidden();
});

test('shared location loads only nearby places', async ({ page, context }) => {
  const state = await installMocks(page);
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.788, longitude: -5.812 });
  await openApp(page);
  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();
  await expect(page.getByText('Agadir Center', { exact: true })).toBeHidden();
  expect(state.placeRequests.some((url) => url.searchParams.get('userLat') !== null)).toBeTruthy();
});

test('Explore performs live query search instead of showing cached defaults', async ({ page }) => {
  const state = await installMocks(page);
  await openApp(page);
  await page.locator('#tab-explore').click();
  await page.getByRole('searchbox', { name: 'Search places' }).fill('Agadir');
  await expect(page.getByText('Agadir Center', { exact: true })).toBeVisible();
  await expect(page.getByText('Akchour Waterfall', { exact: true })).toBeHidden();
  expect(state.placeRequests.some((url) => url.searchParams.get('query') === 'Agadir')).toBeTruthy();
});

test('My Trips destination search is live and saving switches to trip-relevant places', async ({ page }) => {
  const state = await installMocks(page);
  await openApp(page);
  await signIn(page);
  await createAgadirPlan(page);
  expect(state.placeRequests.some((url) => url.searchParams.get('query') === 'Agadir')).toBeTruthy();
  await page.getByRole('button', { name: 'Save Trip' }).click();
  await expect(page.getByText('Agadir Beach', { exact: true })).toBeVisible();
  await expect(page.getByText('Akchour Waterfall', { exact: true })).toBeHidden();
});

test('assistant has app deep links and no static destination chips', async ({ page }) => {
  await installMocks(page);
  await openApp(page);
  await page.locator('#tab-ai-assistant').click();
  await expect(page.getByText('Hidden natural spots in Akchour')).toBeHidden();
  await page.getByPlaceholder('Write a message').fill("I can't find how to add a trip");
  await page.locator('#send-ai-chat-btn').click();
  const addTrip = page.getByRole('button', { name: 'Add Trip' });
  await expect(addTrip).toBeVisible();
  await addTrip.click();
  await expect(page.getByText('My Trips', { exact: true }).first()).toBeVisible();
});

test('home voice command responds on Home without automatic Explore redirect', async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onstart: (() => void) | null = null;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      start() {
        this.onstart?.();
        setTimeout(() => {
          this.onresult?.({ results: { 0: { 0: { transcript: 'I want to go to Marrakech' } } } });
          this.onend?.();
        }, 10);
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });
  await installMocks(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Voice assistant' }).click();
  await expect(page.getByText('Marrakech. What would you like to do?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore Marrakech' })).toBeVisible();
  await expect(page.locator('#tab-home')).toHaveClass(/text-blue-600/);
});

test('account page contains real preferences and sign out is not in the drawer', async ({ page }) => {
  await installMocks(page);
  await openApp(page);
  await signIn(page);
  await page.locator('#tab-profile').click();
  await expect(page.getByText('e2e@example.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.locator('#tab-home').click();
  await page.locator('#home-side-menu-btn').click();
  const drawer = page.locator('aside');
  await expect(drawer).toBeVisible();
  expect(await drawer.evaluate((node) => node.getBoundingClientRect().width)).toBeLessThanOrEqual(260);
  await expect(drawer.getByRole('button', { name: /Sign out/i })).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Home', exact: true })).toBeVisible();
});

test('Arabic drawer keeps Home at the bottom and does not expose logout', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'ar'));
  await installMocks(page);
  await openApp(page);
  await page.locator('#home-side-menu-btn').click();
  const drawer = page.locator('aside');
  await expect(drawer.getByRole('button', { name: 'الرئيسية', exact: true })).toBeVisible();
  await expect(drawer.getByText('تسجيل الخروج')).toHaveCount(0);
});

test('expense flow still updates the saved trip budget', async ({ page }) => {
  const state = await installMocks(page, [existingTrip()]);
  await openApp(page);
  await signIn(page);
  await goToTrips(page);
  await page.getByText('Tangier Weekend', { exact: true }).click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Amount').fill('125');
  await page.getByLabel('Description').fill('Dinner');
  await page.getByRole('button', { name: 'Save expense' }).click();
  expect(state.expenses).toHaveLength(1);
  await expect(page.getByText('Dinner')).toBeVisible();
});

test('no internal seed/scoring implementation labels are shown', async ({ page, context }) => {
  await installMocks(page);
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.788, longitude: -5.812 });
  await openApp(page);
  await page.locator('#tab-explore').click();
  await expect(page.getByText(/Curated baseline|Community score connected|XP and levels are not shown yet/i)).toHaveCount(0);
});

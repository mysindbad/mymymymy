import { expect, test, type Page } from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-09-14T02:00:00.000Z';
const PIXEL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%23dbeafe"/%3E%3C/svg%3E';

const places = [
  {
    id: 'place-kasbah',
    name: 'Kasbah Museum',
    arabicName: 'متحف القصبة',
    frenchName: 'Musée de la Kasbah',
    category: 'tourist_poi',
    subCategory: 'Museum',
    region: 'Tanger-Tetouan-Al Hoceima',
    area: 'Tangier',
    coordinates: [35.788, -5.812],
    address: 'Kasbah, Tangier, Morocco',
    photos: [PIXEL],
    description: 'Historic museum in the Kasbah.',
    rating: 4.6,
    reviewCount: 120,
    reviews: [],
    priceLevel: '$',
    source: 'initial_seed',
    ownerVerified: false,
    checkInsCount: 12,
    seedData: true,
    distanceKm: 1.2,
  },
  {
    id: 'place-cafe',
    name: 'Medina Cafe',
    arabicName: 'مقهى المدينة',
    frenchName: 'Café de la Médina',
    category: 'restaurant',
    region: 'Tanger-Tetouan-Al Hoceima',
    area: 'Tangier Medina',
    coordinates: [35.786, -5.81],
    address: 'Medina, Tangier, Morocco',
    photos: [PIXEL],
    description: 'Local cafe in the old medina.',
    rating: 4.3,
    reviewCount: 45,
    reviews: [],
    priceLevel: '$$',
    source: 'community_traveler',
    ownerVerified: false,
    checkInsCount: 4,
    distanceKm: 2.4,
  },
];

const itinerary = {
  days: [
    {
      day: 1,
      title: 'Tangier essentials',
      dailyCost: 180,
      items: [
        {
          time: '10:00',
          activity: 'Visit the Kasbah Museum',
          category: 'sight',
          estimatedCost: 30,
          note: 'Start with the historic museum.',
        },
      ],
    },
  ],
  totalEstimatedCost: 180,
  currency: 'MAD',
  tips: ['Carry water and verify opening hours.'],
};

function existingTrip() {
  return {
    id: 'trip-existing',
    userId: USER_ID,
    name: 'Tangier Weekend',
    destinationId: 'place-kasbah',
    destinationName: 'Kasbah Museum',
    startDate: '2026-09-20',
    endDate: '2026-09-21',
    budget: 1500,
    spentTotal: 0,
    currency: 'MAD',
    participantsCount: 1,
    status: 'planning',
    preferences: [],
    aiItinerary: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

type MockState = {
  trips: ReturnType<typeof existingTrip>[];
  expenses: Array<{
    id: string;
    tripId: string;
    category: string;
    amount: number;
    currency: string;
    description: string | null;
    expenseDate: string;
    createdByUserId: string;
    createdAt: string;
  }>;
  passiveSamples: number;
};

function authUser() {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    email_confirmed_at: NOW,
    confirmed_at: NOW,
    last_sign_in_at: NOW,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'E2E Traveler' },
    identities: [],
    created_at: NOW,
    updated_at: NOW,
  };
}

function budgetPayload(state: MockState, trip = state.trips[0]) {
  const expenses = state.expenses.filter((expense) => expense.tripId === trip.id);
  const spentTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return {
    expenses,
    budget: trip.budget,
    currency: trip.currency,
    spentTotal,
    remaining: trip.budget - spentTotal,
    overBudget: spentTotal > trip.budget,
  };
}

async function installMocks(page: Page, seedTrips: ReturnType<typeof existingTrip>[] = []) {
  const state: MockState = { trips: seedTrips.map((trip) => ({ ...trip })), expenses: [], passiveSamples: 0 };

  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'e2e-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'e2e-refresh-token',
          user: authUser(),
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authUser()) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = async (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path === '/api/places' && method === 'GET') return json({ places });
    if (path === '/api/trips' && method === 'GET') return json({ trips: state.trips });
    if (path === '/api/ai/plan-trip' && method === 'POST') return json({ itinerary, overBudget: false, aiGenerated: true });

    if (path === '/api/trips' && method === 'POST') {
      const payload = request.postDataJSON();
      const trip = {
        id: `trip-${state.trips.length + 1}`,
        userId: USER_ID,
        name: payload.name,
        destinationId: payload.destinationId,
        destinationName: places.find((place) => place.id === payload.destinationId)?.name || null,
        startDate: payload.startDate,
        endDate: payload.endDate,
        budget: payload.budget,
        spentTotal: 0,
        currency: payload.currency,
        participantsCount: payload.participantsCount,
        status: 'planning' as const,
        preferences: payload.preferences || [],
        aiItinerary: payload.aiItinerary || null,
        createdAt: NOW,
        updatedAt: NOW,
      };
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

    const expenseCollectionMatch = path.match(/^\/api\/trips\/([^/]+)\/expenses$/);
    if (expenseCollectionMatch && method === 'GET') {
      const trip = state.trips.find((item) => item.id === expenseCollectionMatch[1]);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      return json(budgetPayload(state, trip));
    }
    if (expenseCollectionMatch && method === 'POST') {
      const trip = state.trips.find((item) => item.id === expenseCollectionMatch[1]);
      if (!trip) return json({ error: 'Trip not found' }, 404);
      const payload = request.postDataJSON();
      state.expenses.push({
        id: `expense-${state.expenses.length + 1}`,
        tripId: trip.id,
        category: payload.category,
        amount: Number(payload.amount),
        currency: payload.currency,
        description: payload.description || null,
        expenseDate: payload.expenseDate,
        createdByUserId: USER_ID,
        createdAt: NOW,
      });
      return json(budgetPayload(state, trip));
    }

    if (path === '/api/ai/navigation-guidance' && method === 'POST') {
      const payload = request.postDataJSON();
      return json({
        destination: places[0],
        travelMode: payload.travelMode || 'driving',
        totalDistanceKm: 1.8,
        durationMinutes: 12,
        trafficCondition: 'Live traffic unavailable',
        aiSummary: 'Route calculated from public routing data.',
        steps: [
          { id: 'step-1', distanceMeters: 500, instruction: 'Continue straight', roadName: 'Rue de la Kasbah', iconType: 'straight' },
          { id: 'step-2', distanceMeters: 80, instruction: 'Arrive at Kasbah Museum', roadName: 'Kasbah', iconType: 'arrive' },
        ],
        geometry: { coordinates: [[-5.82, 35.78], [-5.812, 35.788]] },
      });
    }

    if (path === '/api/traces/passive' && method === 'POST') {
      state.passiveSamples += 1;
      return json({ success: true });
    }
    if (path === '/api/user/location' && method === 'POST') return json({ success: true });
    if (/^\/api\/places\/[^/]+\/checkin$/.test(path) && method === 'POST') return json({ success: true });
    if (path === '/api/traces/summary') return json({ totalTraces: 0, recent: [] });

    return json({ error: `Unhandled E2E route: ${method} ${path}` }, 404);
  });

  return state;
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
  await expect(page.getByText('Loading places...')).toBeHidden();
}

async function signIn(page: Page) {
  await page.evaluate((userId) => {
    localStorage.setItem(`sindbad_onboarding_complete:${userId}`, 'true');
  }, USER_ID);

  await page.getByText('Traveler!', { exact: true }).click();
  await page.getByRole('button', { name: 'I already have an account' }).click();
  await page.getByPlaceholder('Email address').fill('e2e@example.com');
  await page.getByPlaceholder('Password').fill('correct-horse-battery-staple');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Welcome Back')).toBeHidden();
  await expect(page.getByText('E2E Traveler', { exact: true })).toBeVisible();
}

async function goToTrips(page: Page) {
  await page.locator('#tab-trips').click();
  await expect(page.getByText('AI Trip Planner')).toBeVisible();
}

async function buildTripPlan(page: Page) {
  await goToTrips(page);
  await page.getByRole('button', { name: /Kasbah Museum/ }).click();
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('button', { name: 'Plan with AI' }).click();
  await expect(page.getByText('Visit the Kasbah Museum')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save trip' })).toBeVisible();
}

test('login authenticates through the real UI without touching production', async ({ page }) => {
  await installMocks(page);
  await openApp(page);
  await signIn(page);
  await page.locator('#tab-trips').click();
  await expect(page.getByText('Sign in to view your trips')).toBeHidden();
  await expect(page.getByText('AI Trip Planner')).toBeVisible();
});

test('trip creation produces an itinerary', async ({ page }) => {
  await installMocks(page);
  await openApp(page);
  await signIn(page);
  await buildTripPlan(page);
});

test('saving persists the planned trip in the trips list', async ({ page }) => {
  const state = await installMocks(page);
  await openApp(page);
  await signIn(page);
  await buildTripPlan(page);
  await page.getByRole('button', { name: 'Save trip' }).click();
  await expect(page.getByText('Trip to Kasbah Museum', { exact: true })).toBeVisible();
  expect(state.trips.some((trip) => trip.name === 'Trip to Kasbah Museum')).toBeTruthy();
});

test('adding an expense updates the trip budget', async ({ page }) => {
  const state = await installMocks(page, [existingTrip()]);
  await openApp(page);
  await signIn(page);
  await goToTrips(page);

  await expect(page.getByText('Tangier Weekend', { exact: true })).toBeVisible();
  await page.getByTitle('Show budget').click();
  await page.getByRole('button', { name: 'Add expense' }).click();
  await page.getByLabel('Amount').fill('125');
  await page.getByLabel('Description').fill('Dinner in the medina');
  await page.getByRole('button', { name: 'Save expense' }).click();

  await expect(page.getByText('Dinner in the medina')).toBeVisible();
  await expect(page.getByText('125.00 MAD')).toBeVisible();
  expect(state.expenses).toHaveLength(1);
});

test('search filters places using the explore UI', async ({ page }) => {
  await installMocks(page);
  await openApp(page);
  await page.locator('#tab-explore').click();
  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search places' }).fill('Kasbah');
  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();
  await expect(page.getByText('Medina Cafe', { exact: true })).toBeHidden();
});

test('GPS contribution uses browser geolocation only after explicit opt-in', async ({ page, context }) => {
  const state = await installMocks(page);
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.788, longitude: -5.812 });
  await openApp(page);
  await signIn(page);

  await page.locator('#tab-explore').click();
  await page.getByRole('button', { name: 'Location contribution' }).click();
  await page.getByLabel('Allow manual GPS contributions').check();
  await page.getByRole('button', { name: 'Send Current Location Sample' }).click();
  await expect(page.getByText('Your current-location sample was recorded successfully.')).toBeVisible();
  expect(state.passiveSamples).toBe(1);
});

test('navigation calculates a route from the browser location and starts guidance', async ({ page, context }) => {
  await installMocks(page);
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.78, longitude: -5.82 });
  await openApp(page);
  await page.locator('#tab-explore').click();
  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();

  const card = page.locator('div.group').filter({ hasText: 'Kasbah Museum' }).first();
  await card.getByRole('button', { name: 'Start Navigation' }).click();
  await expect(page.getByText('AI-Guided Route')).toBeVisible();
  await expect(page.getByText('12 min', { exact: true })).toBeVisible();
  await page.locator('#start-turn-by-turn-btn').click();
  await expect(page.getByText('Continue straight', { exact: true })).toBeVisible();
});

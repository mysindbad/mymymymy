import { expect, test, type Page } from '@playwright/test';

const PIXEL = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%23dbeafe"/%3E%3C/svg%3E';

const nearbyPlace = {
  id: 'osm-node-42',
  name: 'Kasbah Museum',
  arabicName: 'متحف القصبة',
  category: 'tourist_poi',
  subCategory: 'Museum',
  region: 'Tanger-Tetouan-Al Hoceima',
  area: 'Tangier',
  coordinates: [35.788, -5.812],
  address: 'Kasbah, Tangier',
  photos: [PIXEL],
  description: 'Museum · Tangier',
  rating: null,
  reviewCount: 0,
  reviews: [],
  source: 'external',
  ownerVerified: false,
  checkInsCount: 0,
  seedData: false,
  dataSource: 'openstreetmap',
  trustLevel: 'external',
  distanceKm: 0.1,
};

async function installRoundTwoMocks(page: Page, options: { emptyDatabase?: boolean } = {}) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not signed in' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/places') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: options.emptyDatabase ? [] : [nearbyPlace] }) });
    }
    if (url.pathname === '/api/nearby-places') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [nearbyPlace], total: 1 }) });
    }
    if (url.pathname === '/api/ai/chat') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Here is a voice reply.' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
}

test('known location gets a city baseline when the database has no local places', async ({ page, context }) => {
  await installRoundTwoMocks(page, { emptyDatabase: true });
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.788, longitude: -5.812 });
  await openApp(page);

  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();
  await page.locator('#tab-explore').click();
  await expect(page.getByText('Kasbah Museum', { exact: true })).toBeVisible();
  await expect(page.getByText('© OpenStreetMap contributors')).toBeVisible();
});

test('night hours switch the complete interface to dark mode', async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 22;
  });
  await installRoundTwoMocks(page);
  await openApp(page);

  await expect(page.locator('html')).toHaveClass(/dark/);
  const bodyBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(bodyBackground).toBe('rgb(2, 6, 23)');
  const surface = page.locator('[data-surface="card"]').first();
  await expect(surface).toBeVisible();
  expect(await surface.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');

  await page.locator('#tab-profile').click();
  const accountSurface = page.locator('[data-surface="card"]').first();
  await expect(accountSurface).toBeVisible();
  expect(await accountSurface.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(15, 23, 42)');
});

test('AI assistant supports a spoken conversation with spoken replies', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__spokenReplies = [];
    (window as any).__recognitionStarts = 0;

    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }

    class MockSpeechRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onstart: (() => void) | null = null;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      start() {
        (window as any).__recognitionStarts += 1;
        this.onstart?.();
        if ((window as any).__recognitionStarts === 1) {
          setTimeout(() => {
            this.onresult?.({ results: { 0: { 0: { transcript: "I can't find how to add a trip" } } } });
            this.onend?.();
          }, 10);
        }
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }

    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: MockSpeechRecognition });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: MockUtterance) {
          (window as any).__spokenReplies.push(utterance.text);
          setTimeout(() => utterance.onend?.(), 10);
        },
      },
    });
  });

  await installRoundTwoMocks(page);
  await openApp(page);
  await page.locator('#tab-ai-assistant').click();
  await page.locator('#ai-voice-call-btn').click();

  await expect(page.getByText("I can't find how to add a trip", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Trip' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__spokenReplies.length)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__spokenReplies.join(' '))).toContain('Add Trip');
  await expect.poll(() => page.evaluate(() => (window as any).__recognitionStarts)).toBeGreaterThanOrEqual(2);
});

test('Arabic start flow uses clear copy and removes the garbled left-side trip slogans', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'ar'));
  await installRoundTwoMocks(page);
  await openApp(page);

  await page.locator('#tab-profile').click();
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page.getByRole('button', { name: 'ابدأ الآن' })).toBeVisible();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();

  await expect(page.getByText('اكتشف وجهتك وخطّط رحلتك بسهولة.')).toBeVisible();
  await expect(page.getByText(/سافر وتواصل وانتم|استكشف واكتشف وانتم|طرق مختلفة والرحلة واحدة/)).toHaveCount(0);
  await expect(page.locator('[class*="Caveat"]')).toHaveCount(0);
});

test('cleaned utility screens no longer expose implementation filler', async ({ page }) => {
  await installRoundTwoMocks(page);
  await openApp(page);

  await page.getByRole('button', { name: 'Flights' }).click();
  await expect(page.getByText(/live search and fares are not connected|flight inventory|seat availability/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.locator('#home-side-menu-btn').click();
  await page.getByRole('button', { name: 'Location sharing' }).click();
  await expect(page.getByText(/How the contribution is handled|Current capability|background trail learning|public live crowd heatmap/i)).toHaveCount(0);
  await expect(page.getByText('Your location is sent only when you tap Send.')).toBeVisible();
});

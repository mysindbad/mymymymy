import { expect, test, type BrowserContext, type Page } from '@playwright/test';

async function installBaseRoutes(page: Page) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/places') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [], total: 0 }) });
      return;
    }
    if (url.pathname === '/api/ai/chat') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Voice answer from Sindbad.' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
}

async function installPublicPlaceMocks(page: Page) {
  await page.route('https://nominatim.openstreetmap.org/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ address: { city: 'Tangier', state: 'Tanger-Tetouan-Al Hoceima' } }),
    });
  });
  const overpassPayload = {
    elements: [
      { type: 'node', id: 101, lat: 35.789, lon: -5.812, tags: { name: 'Kasbah Museum Tangier', tourism: 'museum', wikipedia: 'en:Kasbah Museum' } },
      { type: 'node', id: 102, lat: 35.792, lon: -5.81, tags: { name: 'Tangier Viewpoint', tourism: 'viewpoint' } },
      { type: 'node', id: 103, lat: 35.785, lon: -5.815, tags: { name: 'Historic Gate Tangier', historic: 'city_gate' } },
      { type: 'node', id: 104, lat: 35.787, lon: -5.817, tags: { name: 'Tangier City Park', leisure: 'park' } },
      { type: 'node', id: 105, lat: 35.786, lon: -5.818, tags: { name: 'Tangier Gallery', tourism: 'gallery' } },
    ],
  };
  await page.route('https://overpass-api.de/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(overpassPayload) });
  });
  await page.route('https://overpass.kumi.systems/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(overpassPayload) });
  });
}

async function setTangierLocation(context: BrowserContext) {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4173' });
  await context.setGeolocation({ latitude: 35.788, longitude: -5.812 });
}

test('location detection fills an empty local catalog with known nearby public places', async ({ page, context }) => {
  await installBaseRoutes(page);
  await installPublicPlaceMocks(page);
  await setTangierLocation(context);
  await openApp(page);
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByText('Kasbah Museum Tangier', { exact: true })).toBeVisible({ timeout: 12000 });
  await expect(page.getByText('Tangier Viewpoint', { exact: true })).toBeVisible();
  await expect(page.getByText('No nearby places found.')).toBeHidden();
});

test('night hours automatically render the app in dark mode', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeDate = Date;
    const fixed = new NativeDate('2026-09-15T22:15:00').valueOf();
    class NightDate extends NativeDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(fixed);
        else super(...(args as ConstructorParameters<typeof Date>));
      }
      static now() { return fixed; }
    }
    // @ts-expect-error deterministic browser clock for the test
    window.Date = NightDate;
  });
  await installBaseRoutes(page);
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bodyBackground = await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(bodyBackground).toBe('rgb(2, 6, 23)');
  const cardBackground = await page.locator('[class~="bg-white"]').first().evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(cardBackground).toBe('rgb(15, 23, 42)');
});

test('AI assistant supports a live voice turn and speaks its answer', async ({ page }) => {
  await page.addInitScript(() => {
    let recognitionStarts = 0;
    class MockRecognition {
      lang = '';
      interimResults = false;
      continuous = false;
      onstart: (() => void) | null = null;
      onresult: ((event: any) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: any) => void) | null = null;
      start() {
        recognitionStarts += 1;
        this.onstart?.();
        if (recognitionStarts === 1) {
          setTimeout(() => {
            this.onresult?.({ results: { 0: { 0: { transcript: "I can't find how to add a trip" } } } });
            this.onend?.();
          }, 20);
        }
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    (window as any).SpeechRecognition = MockRecognition;
    (window as any).webkitSpeechRecognition = MockRecognition;
    (window as any).SpeechSynthesisUtterance = MockUtterance;
    (window as any).__spoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: MockUtterance) {
          (window as any).__spoken.push(utterance.text);
          setTimeout(() => utterance.onend?.(), 10);
        },
      },
    });
  });
  await installBaseRoutes(page);
  await openApp(page);
  await page.locator('#home-ask-ai-btn').click();
  await page.locator('#ai-voice-call-btn').click();
  await expect(page.getByRole('button', { name: 'Add Trip' })).toBeVisible({ timeout: 8000 });
  const spoken = await page.evaluate(() => (window as any).__spoken as string[]);
  expect(spoken.some((value) => value.includes('Open Trips'))).toBeTruthy();
  await page.getByRole('button', { name: 'End voice call' }).click();
});

test('Arabic Start Now screen uses clear copy and no clipped trip slogan', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'ar'));
  await installBaseRoutes(page);
  await openApp(page);
  await page.getByRole('button', { name: 'الحساب' }).first().click();
  await page.getByRole('button', { name: 'ابدأ الآن' }).click();
  await expect(page.getByRole('heading', { name: 'ابدأ رحلتك' })).toBeVisible();
  await expect(page.getByText('اختر طريقة المتابعة.')).toBeVisible();
  await expect(page.getByText(/سافر وتواصل/)).toHaveCount(0);
  await expect(page.getByText(/طرق مختلفة والرحلة واحدة/)).toHaveCount(0);
});

import { expect, test } from '@playwright/test';

// Console/runtime cleanliness, in CI, without suppressing anything: the walk asserts
// that no uncaught exception fires and that no console error comes from the app's own
// code (React key warnings, unguarded property reads, minified React errors).
const APP_ERROR_PATTERNS = [
  /Warning:/i,
  /Each child in a list/i,
  /Minified React error/i,
  /Cannot read propert/i,
  /is not a function/i,
  /Unhandled/i,
  /Uncaught/i,
];

async function servePlaces(page: import('@playwright/test').Page) {
  const place = {
    id: 'p1',
    name: 'Kasbah Museum',
    arabicName: 'متحف القصبة',
    category: 'Museum',
    city: 'Tangier',
    coordinates: [35.78, -5.81],
    rating: null,
    photos: [],
    description: 'A museum in the kasbah.',
    tags: [],
    openingHours: 'Today 09:00-18:00',
    isVerified: false,
    distanceKm: 1.2,
  };
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/places' || url.pathname === '/api/nearby-places') return json({ places: [place], total: 1 });
    if (url.pathname === '/api/trips') return json({ trips: [] });
    if (url.pathname === '/api/saved-places') return json({ placeIds: [] });
    return json({});
  });
}

test('walking the app reports no runtime errors and renders a real surface', async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors: string[] = [];
  const appConsoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.message).slice(0, 160)));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (APP_ERROR_PATTERNS.some((pattern) => pattern.test(text))) appConsoleErrors.push(text.slice(0, 160));
  });

  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35.77, longitude: -5.82 });
  await servePlaces(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-home')).toBeVisible();

  for (const selector of ['#tab-explore', '#tab-trips', '#tab-profile', '#tab-ai-assistant']) {
    await page.locator(selector).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Every tab still renders usable content rather than a blank screen.
  await page.locator('#tab-home').click();
  await expect(page.locator('main button, main a[href]').first()).toBeVisible();
  const controls = await page.locator('main button, main a[href]').count();

  expect(pageErrors, `uncaught page errors: ${JSON.stringify(pageErrors)}`).toEqual([]);
  expect(appConsoleErrors, `app console errors: ${JSON.stringify(appConsoleErrors)}`).toEqual([]);
  expect(controls).toBeGreaterThan(4);
});

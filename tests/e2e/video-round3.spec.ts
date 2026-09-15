import { expect, test, type Page } from '@playwright/test';

async function installAnonymousMocks(page: Page) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not signed in' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/places') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#tab-home')).toBeVisible();
}

test('French language switch localizes the whole app shell', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'fr'));
  await installAnonymousMocks(page);
  await openApp(page);

  await expect(page.locator('#tab-home')).toContainText('Accueil');
  await expect(page.locator('#tab-explore')).toContainText('Explorer');
  await expect(page.locator('#tab-trips')).toContainText('Voyages');
  await expect(page.locator('#tab-profile')).toContainText('Compte');

  await page.locator('#tab-trips').click();
  await expect(page.getByText('Mes voyages', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('My Trips', { exact: true })).toHaveCount(0);

  await page.locator('#tab-explore').click();
  await page.getByRole('button', { name: 'Carte', exact: true }).click();
  await expect(page.getByText('Carte', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Liste', exact: true })).toBeVisible();
});

test('Arabic assistant handles field-video phrases without verbose backend filler', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sindbad_language', 'ar'));
  await installAnonymousMocks(page);
  await openApp(page);

  await page.locator('#tab-ai-assistant').click();
  const input = page.getByPlaceholder('اسأل عن السفر أو التطبيق');
  await input.fill('أريد أنشأ رحلة');
  await page.locator('#send-ai-chat-btn').click();
  await expect(page.getByRole('button', { name: 'إضافة رحلة', exact: true })).toBeVisible();

  await input.fill('مرحبا');
  await page.locator('#send-ai-chat-btn').click();
  await expect(page.getByText('مرحباً. كيف أساعدك؟', { exact: true })).toBeVisible();
  await expect(page.getByText(/أنا هنا لمساعدتك في التخطيط|صديقي المسافر/)).toHaveCount(0);
});

test('map switches to backup tiles after repeated primary tile failures', async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getHours = () => 12;
  });
  await installAnonymousMocks(page);

  let primaryFailures = 0;
  let fallbackRequests = 0;
  const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Z7sAAAAASUVORK5CYII=', 'base64');

  await page.route('https://tile.openstreetmap.org/**', async (route) => {
    primaryFailures += 1;
    await route.fulfill({ status: 503, contentType: 'text/plain', body: 'tile unavailable' });
  });
  await page.route('https://*.basemaps.cartocdn.com/**', async (route) => {
    fallbackRequests += 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
  });

  await openApp(page);
  await page.locator('#tab-explore').click();
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('[data-map-tile-fallback="enabled"]')).toBeVisible();
  await expect.poll(() => primaryFailures, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await expect.poll(() => fallbackRequests, { timeout: 10_000 }).toBeGreaterThan(0);
});

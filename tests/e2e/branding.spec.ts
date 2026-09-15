import { expect, test } from '@playwright/test';

test('renders the My Sindbad logo as a decoded image', async ({ page }) => {
  await page.goto('/');

  const logo = page.getByRole('img', { name: 'My Sindbad' }).first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/brand/my-sindbad-logo-v6.webp');

  await expect.poll(async () => logo.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  })).toBe(true);
});

test('serves the exact logo and PWA icons referenced by the app', async ({ request }) => {
  const logoResponse = await request.get('/brand/my-sindbad-logo-v6.webp');
  expect(logoResponse.ok()).toBeTruthy();
  expect(logoResponse.headers()['content-type']).toContain('image/webp');
  expect((await logoResponse.body()).byteLength).toBeGreaterThan(1_000);

  const manifestResponse = await request.get('/manifest.webmanifest?v=6');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/icons/my-sindbad-app-icon-v6-192.jpg', sizes: '192x192' }),
    expect.objectContaining({ src: '/icons/my-sindbad-app-icon-v6-512.jpg', sizes: '512x512' }),
  ]));

  for (const iconPath of [
    '/icons/my-sindbad-app-icon-v6-192.jpg',
    '/icons/my-sindbad-app-icon-v6-512.jpg',
  ]) {
    const iconResponse = await request.get(iconPath);
    expect(iconResponse.ok()).toBeTruthy();
    expect(iconResponse.headers()['content-type']).toContain('image/jpeg');
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(1_000);
  }
});

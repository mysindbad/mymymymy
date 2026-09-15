import { expect, test } from '@playwright/test';

test('renders and decodes the My Sindbad branding in Chromium', async ({ page }) => {
  await page.goto('/');

  const logo = page.getByRole('img', { name: 'My Sindbad' }).first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', '/brand/my-sindbad-logo-v7.png');

  await expect.poll(async () => logo.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  })).toBe(true);

  const decoded = await page.evaluate(async (paths) => Promise.all(paths.map((path) => (
    new Promise<{ path: string; width: number; height: number }>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ path, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ path, width: 0, height: 0 });
      image.src = path;
    })
  ))), [
    '/brand/my-sindbad-logo-v7.png',
    '/icons/my-sindbad-app-icon-v7-192.jpg',
    '/icons/my-sindbad-app-icon-v7-512.jpg',
  ]);

  expect(decoded[0]).toMatchObject({ width: 384, height: 384 });
  expect(decoded[1]).toMatchObject({ width: 192, height: 192 });
  expect(decoded[2]).toMatchObject({ width: 512, height: 512 });
});

test('serves the exact logo and PWA icons referenced by the app', async ({ request }) => {
  const logoResponse = await request.get('/brand/my-sindbad-logo-v7.png');
  expect(logoResponse.ok()).toBeTruthy();
  expect(logoResponse.headers()['content-type']).toContain('image/png');
  expect((await logoResponse.body()).byteLength).toBeGreaterThan(1_000);

  const manifestResponse = await request.get('/manifest.webmanifest?v=7');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: '/icons/my-sindbad-app-icon-v7-192.jpg', sizes: '192x192' }),
    expect.objectContaining({ src: '/icons/my-sindbad-app-icon-v7-512.jpg', sizes: '512x512' }),
  ]));

  for (const iconPath of [
    '/icons/my-sindbad-app-icon-v7-192.jpg',
    '/icons/my-sindbad-app-icon-v7-512.jpg',
  ]) {
    const iconResponse = await request.get(iconPath);
    expect(iconResponse.ok()).toBeTruthy();
    expect(iconResponse.headers()['content-type']).toContain('image/jpeg');
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(1_000);
  }
});

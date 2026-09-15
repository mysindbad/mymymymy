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
    '/icons/my-sindbad-app-icon-v8-maskable.svg',
    '/icons/my-sindbad-app-icon-v7-512.jpg',
  ]);

  expect(decoded[0]).toMatchObject({ width: 256, height: 256 });
  expect(decoded[1]).toMatchObject({ width: 512, height: 512 });
  expect(decoded[2]).toMatchObject({ width: 512, height: 512 });
});

test('serves a full-frame adaptive launcher icon referenced by the manifest', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest?v=8');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({
      src: '/icons/my-sindbad-app-icon-v8-maskable.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'maskable',
    }),
  ]));

  const iconResponse = await request.get('/icons/my-sindbad-app-icon-v8-maskable.svg');
  expect(iconResponse.ok()).toBeTruthy();
  expect(iconResponse.headers()['content-type']).toContain('image/svg+xml');
  const iconBody = await iconResponse.text();
  expect(iconBody.length).toBeGreaterThan(20_000);
  expect(iconBody).toContain('data:image/jpeg;base64,');
  expect(iconBody).toContain('x="-65"');
  expect(iconBody).toContain('y="-51"');
  expect(iconBody).toContain('width="642"');
  expect(iconBody).toContain('height="642"');
});

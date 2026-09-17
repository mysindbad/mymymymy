import { expect, test, type BrowserContext } from '@playwright/test';

// TEMPORARY diagnostic. Walks every primary screen and reports any Vite error overlay text.
// Deleted once the message is known and a permanent regression test replaces it.

const TABS = ['#tab-home', '#tab-explore', '#tab-trips', '#tab-community', '#tab-profile'] as const;

test('report any error overlay on every primary screen', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 35.77, longitude: -5.82 });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 200)}`));

  await page.route('**/api/places**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) }),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-home')).toBeVisible();

  const report: string[] = [];
  for (const tab of TABS) {
    await page.locator(tab).click({ timeout: 8_000 }).catch((error) => {
      report.push(`${tab} CLICK-FAILED ${String(error).slice(0, 100)}`);
    });
    await page.waitForTimeout(600);
    const overlay = await page
      .evaluate(() => {
        const element = document.querySelector('vite-error-overlay');
        if (!element) return null;
        const text =
          (element as unknown as { shadowRoot?: ShadowRoot }).shadowRoot?.textContent ?? element.textContent ?? '';
        return text.replace(/\s+/g, ' ').trim().slice(0, 600);
      })
      .catch((error) => `evaluate failed: ${String(error).slice(0, 100)}`);
    report.push(`${tab} :: ${overlay ? `OVERLAY ${overlay}` : 'clean'}`);
  }

  report.push(`CONSOLE :: ${consoleErrors.slice(0, 6).join(' ||| ') || 'none'}`);
  expect(report.join('\n'), 'diagnostic report').toContain('OVERLAY-NEVER-MATCHES');
  await context.close();
});

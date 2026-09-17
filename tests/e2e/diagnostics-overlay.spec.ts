import { expect, test, type BrowserContext } from '@playwright/test';

// TEMPORARY diagnostic. Walks every primary screen and reports any Vite error overlay text.
// Deleted once the message is known and a permanent regression test replaces it.

async function boot(context: BrowserContext): Promise<void> {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 35.77, longitude: -5.82 });
}

const TABS = ['#tab-home', '#tab-explore', '#tab-trips', '#tab-community', '#tab-profile'] as const;

test('report any error overlay on every primary screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await boot(context);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`));

  await page.route('**/api/places**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) }),
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-home')).toBeVisible();

  const report: string[] = [];
  for (const tab of TABS) {
    await page.locator(tab).click({ timeout: 10_000 }).catch((error) => {
      report.push(`${tab}: click failed - ${String(error).slice(0, 120)}`);
    });
    await page.waitForTimeout(1_500);
    const overlay = await page.evaluate(() => {
      const element = document.querySelector('vite-error-overlay');
      if (!element) return null;
      const text = (element as unknown as { shadowRoot?: ShadowRoot }).shadowRoot?.textContent ?? element.textContent ?? '';
      return text.replace(/\s+/g, ' ').trim().slice(0, 700);
    });
    report.push(`${tab}: overlay=${overlay ? `YES :: ${overlay}` : 'none'}`);
  }

  report.push(`console errors: ${consoleErrors.slice(0, 8).join(' ||| ') || 'none'}`);
  // The assertion carries the whole report into the CI log.
  expect(report.join('\n'), 'diagnostic report').toContain('overlay=none');
  await context.close();
});

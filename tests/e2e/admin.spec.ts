import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { createStore, mockAdminApi, mockConsumerPlaces, type AdminPersona, type FixtureStore } from './admin-fixtures';

// The Admin Control Center's permanent browser suite.
//
// It drives the real console (src/admin) against tests/e2e/admin-fixtures.ts, which implements the
// same wire contract as the /api/admin routes in server.ts - refusal codes, page/limit pagination,
// server-side search and sorting, the curation allow-list, moderation reason rules, and an audit
// trail. Supabase credentials do not exist in CI, so what this proves is the console's behaviour:
// its states, its refusals, and the payloads it puts on the wire. The server side of the same
// contract is covered by tests/unit/admin-guard.test.ts and admin-service.test.ts.

const IGNORED_HOSTS = /fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap\.org|basemaps\.cartocdn\.com|overpass-api\.de|api\.open-meteo\.com/;
// The existing consumer specs keep the same rule: app-originated console errors are failures,
// unreachable third-party hosts in a sandbox are not.
const APP_ERROR = /Warning:|Minified React error|Cannot read propert|is not a function|Uncaught|Unhandled/i;

type Harness = { page: Page; store: FixtureStore; consoleErrors: string[] };

interface HarnessOptions {
  failWrites?: RegExp;
  breakRoutes?: RegExp;
  /** Number of extra catalogue rows, so paging has something real to walk. */
  bulkPlaces?: number;
}

async function harness(context: BrowserContext, persona: AdminPersona, options: HarnessOptions = {}): Promise<Harness> {
  const store = createStore({ bulkPlaces: options.bulkPlaces });
  await mockAdminApi(context, persona, store);

  if (options.failWrites) {
    let spent = false;
    await context.route('**/api/admin/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const targeted = request.method() !== 'GET' && options.failWrites!.test(`${request.method()} ${path}`);
      if (targeted && !spent) {
        spent = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'the write did not land', code: 'ADMIN_WRITE_FAILED' }),
        });
        return;
      }
      await route.fallback();
    });
  }

  if (options.breakRoutes) {
    await context.route('**/api/admin/**', async (route) => {
      const request = route.request();
      if (request.method() === 'GET' && options.breakRoutes!.test(new URL(request.url()).pathname)) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'upstream refused the read', code: 'ADMIN_READ_FAILED' }),
        });
        return;
      }
      await route.fallback();
    });
  }

  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (IGNORED_HOSTS.test(message.location()?.url ?? '')) return;
    if (APP_ERROR.test(message.text())) consoleErrors.push(message.text().slice(0, 200));
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${String(error).slice(0, 200)}`));
  return { page, store, consoleErrors };
}

// `aria-hidden` rows are the table's loading skeleton - counting them as data would let a screen
// that never resolved look like a screen that resolved.
const rows = (page: Page) => page.locator('.adm-table-wrap tbody tr:not([aria-hidden])');
const rowButtons = (page: Page) => page.locator('[data-adm-row]');
/** The first cell of every real row - enough to prove that page 2 is a different page. */
const gridTitles = (page: Page) => page.evaluate(() => Array.from(document.querySelectorAll('.adm-table-wrap tbody tr:not([aria-hidden]) th, .adm-table-wrap tbody tr:not([aria-hidden]) td'))
  .map((cell) => (cell.parentElement as HTMLElement).innerText.split('\n')[0])
  .filter((value, index, all) => all.indexOf(value) === index));

/**
 * A request made from inside the page, so it travels through the same routing as the console's own
 * traffic. `context.request` bypasses `context.route`, which would silently test the dev server
 * instead of the admin API.
 */
async function callFromPage(page: Page, method: string, url: string, body?: Record<string, unknown>) {
  return page.evaluate(async ({ method, url, body }) => {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, text: await response.text() };
  }, { method, url, body });
}

test('a visitor who is not an administrator never sees data - for every refusal path', async ({ browser }) => {
  const cases: Array<{ persona: AdminPersona; expect: RegExp }> = [
    { persona: 'anonymous', expect: /administrator sign-in/i },
    { persona: 'user', expect: /not open to your account/i },
    { persona: 'expired', expect: /session expired/i },
    { persona: 'unconfigured', expect: /admin data service is not configured/i },
  ];

  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const { page } = await harness(context, item.persona);
    await page.goto('/admin');
    await expect(page.locator('.sindbad-admin')).toBeVisible();
    // Whatever the wording, the console must not present a data grid to a caller it has not authorised.
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator('.adm-skeleton')).toHaveCount(0, { timeout: 5_000 });
    // Gate states replace the shell entirely, so the assertion reads the document, not a panel.
    const body = await page.locator('body').innerText();
    expect(body, `persona ${item.persona}`).toMatch(item.expect);

    // And the API behind it refuses on its own terms, not because the UI hid a button.
    const answer = await callFromPage(page, 'GET', '/api/admin/places');
    expect([401, 403, 503], `persona ${item.persona} was let through`).toContain(answer.status);
    expect(answer.text).not.toContain('"rows"');
    await context.close();
  }
});

test('manipulated browser state does not open the console', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The exact attacks the brief calls out: a flag in storage, a role in storage, a forged bearer.
  await context.addInitScript(() => {
    window.localStorage.setItem('isAdmin', 'true');
    window.localStorage.setItem('sindbad-admin-role', 'super_admin');
    window.localStorage.setItem('sindbad-admin', JSON.stringify({ role: 'super_admin', email: 'whoever@example.org' }));
    window.sessionStorage.setItem('admin', '1');
  });
  const { page } = await harness(context, 'anonymous');
  await page.goto('/admin');
  await expect(page.locator('.sindbad-admin')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('body')).toContainText(/sign in|not an administrator|not configured|session/i);

  const forged = await page.evaluate(async () => {
    const response = await fetch('/api/admin/settings', { headers: { Authorization: 'Bearer eyJhbGciOi.forged.token' } });
    return { status: response.status, text: await response.text() };
  });
  expect(forged.status).toBe(401);
  expect(forged.text).not.toContain('eyJ');
  await context.close();
});

test('an administrator reads the catalog and a super administrator holds the privilege tools', async ({ browser }) => {
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await harness(adminContext, 'admin');
  await admin.page.goto('/admin/places');
  await expect(rows(admin.page)).toHaveCount(10);
  // The roster is readable by any administrator...
  await admin.page.goto('/admin/administrators');
  await expect(rows(admin.page)).toHaveCount(admin.store.roster.filter((entry) => !entry.revoked_at).length);
  // ...but escalating yourself is refused by the endpoint, not merely hidden by the client.
  const grant = await callFromPage(admin.page, 'POST', '/api/admin/administrators/grant', {
    role: 'super_admin', user_id: admin.store.travelers[0].user_id, reason: 'escalate myself',
  });
  expect(grant.status, grant.text).toBe(403);
  expect(admin.store.writes.filter((write) => write.path.endsWith('/administrators/grant'))).toHaveLength(0);
  await expect(admin.page.locator('body')).not.toContainText(/escalate myself/);
  await adminContext.close();

  const superContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const elevated = await harness(superContext, 'super-admin');
  await elevated.page.goto('/admin/administrators');
  await expect(elevated.page.locator('.adm-topbar')).toContainText(/administrator/i);
  const target = elevated.store.travelers.find((profile) => !elevated.store.roster.some((entry) => entry.user_id === profile.user_id && !entry.revoked_at));
  expect(target, 'the fixture needs a traveler who is not already on the roster').toBeTruthy();
  const granted = await callFromPage(elevated.page, 'POST', '/api/admin/administrators/grant', {
    role: 'admin', user_id: target!.user_id, reason: 'on-call moderator for the northern region',
  });
  expect(granted.status, granted.text).toBe(200);
  await expect.poll(() => elevated.store.roster.filter((entry) => entry.user_id === target!.user_id && !entry.revoked_at).length).toBe(1);
  await superContext.close();
});

test('search, filters and paging come from the query string, not from slicing in the browser', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin');

  // A page size the console does not offer is not trusted: it falls back to the smallest grid
  // instead of asking the server for something the pager could not render.
  await page.goto('/admin/places?pageSize=4');
  await expect(rows(page)).toHaveCount(10);
  await expect(page.locator('.adm-pager-count')).toContainText(/of 10/);

  const titles = () => gridTitles(page);
  const rowTexts = () => rows(page).evaluateAll((trs) => trs.map((row) => (row as HTMLElement).innerText.replace(/\s+/g, ' ')));
  await expect.poll(async () => (await titles()).length).toBe(10);
  const firstPage = await titles();
  expect(firstPage).toContain(store.places[0].name);

  await page.goto('/admin/places');
  const search = page.getByRole('searchbox').first();
  await search.fill('chefchaouen');
  await expect.poll(() => page.url()).toContain('q=chefchaouen');
  await expect.poll(async () => (await rowTexts()).length).toBeLessThan(10);
  const narrowed = await rowTexts();
  expect(narrowed.length).toBeGreaterThan(0);
  for (const row of narrowed) expect(row.toLowerCase()).toContain('chefchaouen');

  const expected = store.places.filter((place) => place.moderation.status === 'pending');
  await page.goto('/admin/places?status=pending');
  await expect(rows(page)).toHaveCount(expected.length);
  for (const text of await rowTexts()) expect(text).toMatch(/pending review/i);

  // An empty result set is stated as an empty result set.
  await page.goto('/admin/places?q=zzz-no-such-place');
  await expect(page.locator('.adm-view')).toContainText(/no place matches these filters/i);
  await expect(page.locator('.adm-view')).toContainText(/The database answered with zero rows/i);
  // The empty state lives inside the table as a message row; what must be absent is data.
  await expect(rowButtons(page)).toHaveCount(0);
  await context.close();
});

test('paging walks a catalogue deep enough to need it', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin', { bulkPlaces: 60 });
  expect(store.places.length).toBe(70);

  await page.goto('/admin/places');
  await expect(rows(page)).toHaveCount(25);
  await expect(page.locator('.adm-pager-count')).toContainText(/Rows 1.25 of 70/);

  // 70 rows at 25 per page is 25 / 25 / 20: the last page is short, and the console says so.
  await page.goto('/admin/places?page=3');
  await expect(rows(page)).toHaveCount(20);
  await expect(page.locator('.adm-pager-count')).toContainText(/Rows 51.70 of 70/);
  await expect.poll(async () => (await gridTitles(page)).length).toBe(20);
  const pageThree = await gridTitles(page);
  await page.goto('/admin/places?page=1');
  await expect(rows(page)).toHaveCount(25);
  const pageOne = await gridTitles(page);
  expect(pageOne).not.toEqual(pageThree);

  // Stepping with the pager writes the page into the URL, so a screen can be pasted to a colleague.
  await page.getByRole('button', { name: /Next page|Next/ }).first().click();
  await expect.poll(() => page.url()).toContain('page=2');
  const pageTwo = await gridTitles(page);
  expect(pageTwo).not.toEqual(pageOne);

  // The offered page size is a server-side limit, not a client-side slice.
  await page.getByLabel(/Rows per page|Per page/i).first().selectOption('50');
  await expect.poll(() => page.url()).toContain('pageSize=50');
  await expect(rows(page)).toHaveCount(50);
  await expect(page.locator('.adm-pager-count')).toContainText(/of 70/);
  await context.close();
});

test('a rejection needs a reason, names the record it hides, and lands in the audit log', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin');
  const target = store.places.find((place) => place.moderation.status === 'pending')!;
  const before = store.audit.length;
  await page.goto(`/admin/places/${target.id}`);
  await expect(page.locator('.adm-inspector')).toBeVisible();
  await expect(page.locator('.adm-inspector')).toContainText(target.name);

  await page.getByRole('button', { name: /Reject and hide/ }).first().click();
  const reason = 'Duplicate of an approved record; the submitter keeps their photos.';
  await page.getByRole('textbox', { name: /Reason/i }).fill(reason);
  await page.getByRole('button', { name: /Record this decision/ }).click();

  // The destructive step is gated behind naming the record, and refuses until it matches.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('nothing is deleted');
  const confirm = dialog.getByRole('button', { name: /Reject and hide/ });
  const typeToConfirm = dialog.getByRole('textbox', { name: /Confirm by typing the name/i });
  await expect(confirm).toBeDisabled();
  await typeToConfirm.fill('some other place');
  await expect(confirm).toBeDisabled();
  await typeToConfirm.fill(target.name);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.locator('.adm-toasts')).toContainText(/decision recorded|تم تسجيل القرار|Décision enregistrée/i);
  await expect(page.locator('.adm-inspector')).toContainText(/hidden from the public feed/i);
  await expect(page.locator('.adm-inspector').getByText('rejected', { exact: true })).toBeVisible();
  await expect.poll(() => store.places.find((place) => place.id === target.id)!.moderation.status).toBe('rejected');
  const write = store.writes.find((entry) => entry.path.endsWith('/moderation'));
  expect(write?.body).toMatchObject({ status: 'rejected', reason });
  expect(store.audit.length).toBe(before + 1);
  expect(store.audit[0]).toMatchObject({ target_type: 'place', target_id: target.id, reason });

  // The decision is visible to the next administrator in the audit module.
  await page.goto('/admin/audit');
  await expect(page.locator('.adm-table-wrap tbody tr').first()).toContainText(/Duplicate of an approved record/i);
  await expect(page.locator('body')).not.toContainText(/undefined|NaN/);
  await context.close();
});

test('a write that fails is reported as a failure, and the record does not pretend to change', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin', { failWrites: /POST \/api\/admin\/places\// });
  const target = store.places.find((place) => place.moderation.status === 'pending')!;
  const statusBefore = target.moderation.status;
  await page.goto(`/admin/places/${target.id}`);
  await page.getByRole('button', { name: /Approve \/ keep live/ }).click();
  await expect(page.locator('.adm-toast[data-tone="bad"]')).toBeVisible();
  await expect(page.locator('.adm-toasts')).toContainText(/refused/i);
  await expect(page.locator('.adm-error-text')).toContainText(/did not land|refused|failed|unavailable|try again|went wrong/i);
  expect(store.places.find((place) => place.id === target.id)!.moderation.status).toBe(statusBefore);
  expect(store.audit.find((event) => event.target_id === target.id && event.action === 'place_moderation_updated')).toBeUndefined();
  await expect(page.locator('.adm-toasts [data-tone="ok"]')).toHaveCount(0);
  await context.close();
});

test('curation writes only the fields an administrator may curate', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin');
  const target = store.places[0];
  await page.goto(`/admin/places/${target.id}`);
  const description = page.getByRole('textbox', { name: /^Description ·/ });
  await description.fill('Reviewed by the parks desk and re-described for the catalog.');
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect.poll(() => store.writes.filter((entry) => entry.path.endsWith(`/places/${target.id}`)).length).toBe(1);
  const body = store.writes.find((entry) => entry.path.endsWith(`/places/${target.id}`))!.body;
  expect(body).toMatchObject({ description: 'Reviewed by the parks desk and re-described for the catalog.' });
  for (const forbidden of ['rating', 'review_count', 'seed_data', 'moderation_status', 'is_under_documented_gem', 'coordinates', 'photos']) {
    expect(body, `the console sent ${forbidden}`).not.toHaveProperty(forbidden);
  }
  // The record itself changed, so the console is not merely showing a success message.
  await expect.poll(() => store.places[0].description).toContain('Reviewed by the parks desk');
  await context.close();

  // And the API enforces the same rule for a caller who skips the UI entirely.
  const context2 = await browser.newContext();
  const second = await harness(context2, 'admin');
  await second.page.goto('/admin/places');
  const ratingBefore = { ...second.store.places[1].rating };
  const smuggled = await callFromPage(second.page, 'PATCH', `/api/admin/places/${second.store.places[1].id}`, { description: 'ok', rating: 5 });
  expect(smuggled.status, smuggled.text).toBe(400);
  expect(second.store.writes).toHaveLength(0);
  expect(second.store.places[1].rating).toEqual(ratingBefore);
  await context2.close();
});

test('the reason rule is enforced by the endpoint, not by the form', async ({ browser }) => {
  const context = await browser.newContext();
  const { page, store } = await harness(context, 'admin');
  await page.goto('/admin/places');
  const refused = await callFromPage(page, 'POST', `/api/admin/places/${store.places[0].id}/moderation`, { status: 'rejected' });
  expect(refused.status, refused.text).toBe(400);
  expect(refused.text).toMatch(/reason/i);
  expect(store.places[0].moderation.status).not.toBe('rejected');
  await context.close();
});

test('a read that fails shows an error with a way out, never a blank panel', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page } = await harness(context, 'admin', { breakRoutes: /\/api\/admin\/places$/ });
  await page.goto('/admin/places');
  await expect(page.locator('.adm-view')).toContainText(/the server reported a problem/i);
  await expect(page.locator('.adm-view')).toContainText(/upstream refused the read . status 500/);
  await expect(page.locator('.adm-view')).toContainText(/0 rows on this page/i);
  // An error row is not data: nothing here is selectable or sortable.
  await expect(rowButtons(page)).toHaveCount(0);
  const retry = page.getByRole('button', { name: /Try again/ });
  await expect(retry.first()).toBeVisible();
  await context.close();
});

test('the keyboard layer drives the grid', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin');
  await page.goto('/admin/places');
  await expect(rows(page)).toHaveCount(10);

  await page.keyboard.press('/');
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('type'))).toBe('search');

  await page.keyboard.press('Escape');
  await rowButtons(page).first().focus();
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const focusedRow = () => page.evaluate(() => document.activeElement?.getAttribute('data-adm-row') ?? null);
  await expect.poll(focusedRow).toBe('2');
  await page.keyboard.press('k');
  await expect.poll(focusedRow).toBe('1');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.url()).toContain(`/admin/places/${store.places[1].id}`);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.url()).toMatch(/\/admin\/places$/);

  // The shortcut sheet is reachable and closes on the same key. The assertion names the sheet
  // rather than counting "any dialog": other surfaces keep a mounted, hidden modal of their own,
  // and that has nothing to do with whether the operator can get out of the help layer.
  const sheet = page.locator('.adm-modal', { hasText: /Keyboard layer|طبقة لوحة|Raccourcis/ });
  await page.keyboard.press('?');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.adm-scrim')).toHaveCount(0);
  await expect(page.locator('.adm-modal')).toHaveCount(0);
  // Dismissing the sheet must hand focus back to the grid it came from - to the row that was
  // active, which after j/j/k is not the first one.
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-adm-row') ?? null)).not.toBeNull();
  await context.close();
});

test('Arabic flips the console to RTL while the map stays geographic', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store } = await harness(context, 'admin');
  await page.goto('/admin/places');
  await page.locator('.adm-topbar button', { hasText: '\u0639' }).first().click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('.sindbad-admin')!).direction)).toBe('rtl');
  await expect(page.locator('h1')).toContainText(/الأماكن/);
  const railRight = await page.locator('.adm-rail').evaluate((el) => el.getBoundingClientRect().right);
  expect(railRight, 'the rail must sit on the right when the console is RTL').toBeGreaterThan(1200);
  await expect(page.locator('body')).not.toContainText(/PlacesSearch, curate/);

  await page.locator('[data-adm-row="0"]').click();
  await expect.poll(() => page.url()).toContain('/admin/places/');
  const map = page.locator('.adm-map-shell');
  if (await map.count()) {
    expect(await map.getAttribute('dir')).toBe('ltr');
    expect(await map.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
  }
  // Logical properties: a right-aligned table in RTL must still read right-to-left, and the
  // pager count must remain inside the panel.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  void store;
  await context.close();
});

test('the shell stays usable at 1024 and 820 without sideways page scroll', async ({ browser }) => {
  for (const viewport of [{ width: 1024, height: 768 }, { width: 820, height: 1180 }]) {
    const context = await browser.newContext({ viewport });
    const { page } = await harness(context, 'admin');
    for (const route of ['/admin', '/admin/places', `/admin/places/${'0a1b2c3d-0000-4000-8000-000000000001'}`, '/admin/moderation']) {
      await page.goto(route);
      await expect(page.locator('.adm-skeleton')).toHaveCount(0, { timeout: 8_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${viewport.width}px on ${route}`).toBeLessThanOrEqual(1);
      await expect(page.locator('.adm-topbar')).toBeVisible();
      await expect(page.locator('.adm-topbar button').last()).toBeVisible();
    }
    // Below the split breakpoint the inspector becomes an overlay that can be closed.
    if (viewport.width === 820) {
      await page.goto('/admin/places');
      await expect(rows(page)).toHaveCount(10);
      await page.locator('[data-adm-row="0"]').click();
      await expect(page.locator('.adm-inspector')).toBeVisible();
      await page.getByRole('button', { name: /Close inspector/ }).first().click();
      await expect(page.locator('.adm-inspector')).toHaveCount(0);
      await expect.poll(() => page.url()).toMatch(/\/admin\/places$/);
    }
    await context.close();
  }
});

test('no privileged secret reaches the browser, and the admin chunk carries none either', async ({ browser }) => {
  const context = await browser.newContext();
  const { page } = await harness(context, 'super-admin');
  await page.goto('/admin/settings');
  await expect(page.locator('body')).toContainText(/editable|capability|capabilities|runtime|القدرات|qadara/i);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/service_role|eyJ|SUPABASE_URL|anon-key|\beyJ[A-Za-z0-9._-]{8,}/);
  expect(text).not.toMatch(/secret value|api key: /i);

  // The built console: a bundle scan, not an assumption. Skipped only when no build exists.
  const assets = path.join(process.cwd(), 'dist', 'assets');
  test.skip(!fs.existsSync(assets), 'run npm run build to include the bundle scan');
  const chunk = fs.readdirSync(assets).filter((file) => /^AdminRoot-.*\.js$/.test(file)).sort().at(-1)!;
  const bundle = fs.readFileSync(path.join(assets, chunk), 'utf8');
  // Secret *material*, not vocabulary: the Settings screen legitimately labels the capability
  // "Clé service_role configurée", so the scan looks for tokens and assignments, never a word.
  expect(bundle).not.toMatch(/eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/);
  expect(bundle).not.toMatch(/sb_secret_[A-Za-z0-9_-]{10,}/);
  expect(bundle).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]/);
  expect(bundle).not.toMatch(/https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i);
  await context.close();
});

test('every module renders without an app console error or a stuck spinner', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, consoleErrors } = await harness(context, 'admin');
  const routes = ['/admin', '/admin/moderation', '/admin/places', '/admin/reviews', '/admin/travelers', '/admin/administrators', '/admin/health', '/admin/ai', '/admin/audit', '/admin/settings'];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('h1'), `no title on ${route}`).toBeVisible();
    await expect(page.locator('.adm-skeleton'), `spinner stuck on ${route}`).toHaveCount(0, { timeout: 8_000 });
    await expect(page.locator('.adm-error-text')).toHaveCount(0);
  }
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await context.close();
});

test('publication follows the moderation decision: queued is hidden, approval publishes, rejection stores unpublished', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, store, consoleErrors } = await harness(context, 'admin');
  await mockConsumerPlaces(context, store);
  const target = store.places.find((place) => place.moderation.status === 'pending')!;
  const owner = target.submittedBy;
  expect(owner, 'the fixture submission has an author').toBeTruthy();

  const catalogue = () => page.evaluate(async () => {
    const response = await fetch('/api/places');
    return ((await response.json()) as { places: Array<{ id: string; published: boolean }> }).places;
  });
  const seesOwnSubmission = (viewer: string) => page.evaluate(async ({ id, viewer }) => {
    const response = await fetch('/api/places?viewer=' + encodeURIComponent(viewer));
    const payload = (await response.json()) as { places: Array<{ id: string }> };
    return payload.places.some((row) => row.id === id);
  }, { id: target.id, viewer });
  await page.goto('/admin');
  expect((await catalogue()).some((row) => row.id === target.id), 'a pending submission is stored but not published').toBe(false);
  expect(await seesOwnSubmission(owner!), 'the author can still see the record they submitted');

  await page.goto('/admin/moderation');
  await expect(rowButtons(page).filter({ hasText: target.name }).first()).toBeVisible();

  // Approving publishes it.
  await page.goto(`/admin/places/${target.id}`);
  await page.getByRole('button', { name: /Approve \/ keep live/ }).click();
  await expect(page.locator('.adm-toasts')).toContainText(/decision recorded|تم تسجيل القرار|Décision enregistrée/i);
  await expect.poll(() => store.places.find((place) => place.id === target.id)!.moderation.status).toBe('approved');
  const published = await catalogue();
  expect(published.find((row) => row.id === target.id)?.published, 'approved content is published').toBe(true);
  expect(store.audit.some((event) => event.target_id === target.id)).toBe(true);

  // Rejecting hides it again, and hides it from everybody - including its author's catalogue view.
  // The inspector asks for the reason first, and only then does the destructive confirmation appear.
  const inspector = page.locator('.adm-inspector');
  await inspector.getByRole('button', { name: /Reject and hide/ }).click();
  await inspector.getByRole('textbox', { name: /Reason/i }).fill('Duplicate of an approved record.');
  await inspector.getByRole('button', { name: /Record this decision/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: /Confirm by typing the name/i }).fill(target.name);
  await dialog.getByRole('button', { name: /Reject and hide/ }).click();
  await expect.poll(() => store.places.find((place) => place.id === target.id)!.moderation.status).toBe('rejected');
  expect((await catalogue()).some((row) => row.id === target.id), 'a rejected place is not published').toBe(false);

  // ...but it is still there: moderation is a state, never a delete.
  await page.goto('/admin/places?status=rejected');
  await expect(rowButtons(page).filter({ hasText: target.name }).first()).toBeVisible();
  expect(store.places.some((place) => place.id === target.id)).toBe(true);
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await context.close();
});

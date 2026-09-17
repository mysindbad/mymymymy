import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { createStore, mockAdminApi } from './admin-fixtures';

// The sign-in entry points, driven the way a person drives them.
//
// The Admin Control Center opened the shared AuthFlowModal on its `welcome` screen, so an operator
// who had already clicked "Sign in" still had to click "Get Started" before Continue with Google
// appeared. These tests walk both entry points - admin and traveller - and assert on the options a
// person can actually see, plus that the Google button starts the real Supabase OAuth request
// (caught before it leaves the browser, never completed with anyone's credentials).

const GOOGLE = /continue with google/i;
const EMAIL = /continue with email/i;
const CREATE = /create an account/i;
const GET_STARTED = /^(get started|ابدأ الآن|commencer)$/i;

/** The stub Supabase E2E uses (scripts/start-e2e-web.mjs), so the OAuth hop stays inside CI. */
const SUPABASE_ORIGIN = 'http://127.0.0.1:54321';

async function adminGate(context: BrowserContext): Promise<Page> {
  const store = createStore({});
  await mockAdminApi(context, 'anonymous', store);
  const page = await context.newPage();
  await page.goto('/admin');
  await expect(page.locator('.sindbad-admin')).toBeVisible();
  return page;
}

/** The traveller app, booted the way the responsive matrix boots it. */
async function travellerApp(context: BrowserContext, language: 'en' | 'ar' | 'fr' = 'en'): Promise<Page> {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 35.77, longitude: -5.82 });
  const page = await context.newPage();
  await page.route('**/api/places**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) }),
  );
  await page.addInitScript((lang) => {
    localStorage.setItem('sindbad_language', lang);
    localStorage.setItem('sindbad_theme_preference', 'light');
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sindbad_onboarding_complete:')) localStorage.setItem(key, 'true');
      }
    } catch {
      /* the app reads what it can */
    }
  }, language);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-home')).toBeVisible();
  return page;
}

test('an operator who clicks Sign in reaches Google immediately, with no onboarding step', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await adminGate(context);

  await page.getByRole('button', { name: /^(sign in|تسجيل الدخول|se connecter)$/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The three ways in, all visible without another click.
  await expect(dialog.getByRole('button', { name: GOOGLE })).toBeVisible();
  await expect(dialog.getByRole('button', { name: EMAIL })).toBeVisible();
  await expect(dialog.getByRole('button', { name: CREATE })).toBeVisible();
  // The onboarding screen that used to stand between the operator and Google is not shown.
  await expect(dialog.getByRole('button', { name: GET_STARTED })).toHaveCount(0);

  await context.close();
});

test('the admin Google button starts the real Supabase OAuth request', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await adminGate(context);
  await page.getByRole('button', { name: /^(sign in|تسجيل الدخول|se connecter)$/i }).click();

  // Catch the authorization hop and answer it locally: the request proves which provider and
  // redirect the app asked for, and nothing leaves the browser.
  await page.route(`${SUPABASE_ORIGIN}/auth/v1/authorize**`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>oauth stub</body></html>' }),
  );
  const oauthRequest = page.waitForRequest(
    (request) => request.url().includes('/auth/v1/authorize'),
    { timeout: 15_000 },
  );

  await page.getByRole('dialog').getByRole('button', { name: GOOGLE }).click();

  const request = await oauthRequest;
  const url = new URL(request.url());
  expect(url.searchParams.get('provider'), 'the button must ask Supabase for Google, not a lookalike').toBe('google');
  expect(url.searchParams.get('redirect_to') ?? '', 'the OAuth hop must carry a redirect back to the app').toContain('/');

  await context.close();
});

test('the traveller sign-in flow still opens on the welcome screen and still offers Google', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await travellerApp(context);

  // The Profile screen carries a plainly-labelled Sign in control (the home header's control
  // includes the avatar in its accessible name, which is not a stable thing to assert on).
  await page.locator('#tab-profile').click();
  await page.getByRole('button', { name: /^(sign in|تسجيل الدخول|se connecter)$/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The redesign's onboarding step belongs to the traveller app; it must be intact.
  await expect(dialog.getByRole('button', { name: GET_STARTED })).toBeVisible();

  await dialog.getByRole('button', { name: GET_STARTED }).click();
  await expect(dialog.getByRole('button', { name: GOOGLE })).toBeVisible();
  await expect(dialog.getByRole('button', { name: EMAIL })).toBeVisible();

  await context.close();
});

test('an operator whose account is not on the roster can sign out or go back to the app', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const store = createStore({});
  await mockAdminApi(context, 'user', store);
  const page = await context.newPage();
  await page.goto('/admin');
  await expect(page.locator('.sindbad-admin')).toBeVisible();

  // The denial is stated, and the two ways out of it are real controls rather than dead ends.
  await expect(page.locator('body')).toContainText(/not open to your account/i);
  await expect(page.getByRole('button', { name: /^(switch account|تغيير الحساب|changer de compte)$/i })).toBeVisible();

  await page.getByRole('button', { name: /^(back to the app|العودة إلى التطبيق|retour à l’app)$/i }).click();
  await expect(page.locator('#tab-home')).toBeVisible({ timeout: 15_000 });

  await context.close();
});

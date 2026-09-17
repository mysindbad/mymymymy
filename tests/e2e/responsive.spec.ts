import { expect, test, type Page } from '@playwright/test';

// Responsive and ergonomic contracts.
//
// The behaviour specs cover the product at the desktop viewport; these assert
// that the same screens stay usable across the widths and pointer types real
// users have: nothing scrolls sideways, nothing clips, no control hides under
// the persistent bar, surfaces fit the viewport, and RTL mirrors the shell
// without mirroring the map. Screens are switched by tapping the product, and
// the viewport is resized in place, so one page load covers the whole matrix.

test.setTimeout(60_000);

const WIDTHS = [320, 390, 768, 1024, 1280, 1440];
// Every screen is walked at these widths; the two desktop widths that are
// cheaper to prove get their own rail-focused test below.
const LOOP_WIDTHS = [320, 390, 768, 1280];
const NARROW = [320, 390];

const place = {
  id: 'nearby-kasbah',
  name: 'Kasbah Museum',
  arabicName: 'متحف القصبة',
  frenchName: 'Musée de la Kasbah',
  category: 'tourist_poi',
  subCategory: 'Museum',
  region: 'Tanger-Tetouan-Al Hoceima',
  area: 'Tangier',
  coordinates: [35.788, -5.812],
  address: 'Kasbah, Tangier',
  photos: [],
  description: 'Historic museum above the strait, with the ramparts walk next to it.',
  dataSource: 'openstreetmap',
  source: 'community_traveler',
  rating: null,
  reviewCount: 0,
  reviews: [],
  distanceKm: 1.4,
  checkInsCount: 12,
  prominenceScore: 40,
};

const secondPlace = {
  ...place,
  id: 'nearby-gramme',
  name: 'Grand Theatre Cervantes',
  arabicName: 'مسرح سيرفانتس الكبير',
  frenchName: 'Grand théâtre Cervantes',
  category: 'landmark',
  subCategory: 'Theatre',
  address: 'Rue de Hollande, Tangier',
  distanceKm: 0.9,
};

async function servePlaces(page: Page) {
  await page.route('http://127.0.0.1:54321/auth/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/user')) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'not signed in' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/places') return json({ places: [place, secondPlace] });
    if (url.pathname === '/api/nearby-places') return json({ places: [place, secondPlace] });
    if (url.pathname === '/api/trips') return json({ trips: [] });
    if (url.pathname === '/api/saved-places') return json({ placeIds: [] });
    if (url.pathname === '/api/community/overview') return json({ places: [place, secondPlace], reviews: [] });
    return json({});
  });
}

type ScreenKey = 'home' | 'explore' | 'map' | 'trips' | 'account' | 'drawer' | 'assistant' | 'place detail' | 'flights';

const OPEN: Record<ScreenKey, (page: Page) => Promise<void>> = {
  home: async () => {},
  explore: async (page) => {
    await page.locator('#tab-explore').click();
    // The tab keeps the last view, so pin the list view this screen checks.
    const asList = page.getByRole('button', { name: /^(List|Liste|القائمة)$/ }).first();
    if (await asList.count()) await asList.click().catch(() => {});
    await expect(page.getByRole('heading', { name: /^(Explore|Explorer|استكشف)$/ }).first()).toBeVisible();
  },
  map: async (page) => {
    await page.locator('#tab-explore').click();
    await page.getByRole('button', { name: /^(Map|Carte)$/ }).first().click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  },
  trips: async (page) => {
    await page.locator('#tab-trips').click();
    await expect(page.getByRole('heading', { name: /^(My Trips|Mes voyages|رحلاتي)$/ }).first()).toBeVisible();
  },
  account: async (page) => {
    await page.locator('#tab-profile').click();
    await expect(page.getByRole('heading', { name: /^(Account|Compte|الحساب)$/ }).first()).toBeVisible();
  },
  drawer: async (page) => {
    await page.locator('#tab-home').click();
    await page.locator('#home-side-menu-btn').click();
    await expect(page.locator('aside')).toBeVisible();
  },
  assistant: async (page) => {
    await page.locator('#tab-ai-assistant').click();
    await expect(page.getByPlaceholder(/^(Write a message|اكتب رسالتك|Écrivez un message)$/)).toBeVisible();
  },
  'place detail': async (page) => {
    await page.locator('#tab-home').click();
    await expect(page.locator('#home-nearby-see-all')).toBeVisible();
    // The rail is horizontally scrollable, so a synthetic pointer click can loop on
    // scroll-into-view; the card's own handler is what opens the sheet, and reachability
    // of these controls is asserted by the blocked/target-size probes that follow.
    await page.locator('article button').first().evaluate((el) => (el as HTMLElement).click());
    await expect(page.locator('#modal-start-navigation-btn')).toBeVisible();
  },
  flights: async (page) => {
    await page.locator('#tab-home').click();
    await page.getByRole('button', { name: /^(Flights|Vols|الطيران)$/ }).first().click();
    await expect(page.getByRole('dialog').last()).toBeVisible();
  },
};

const CORE_SCREENS: ScreenKey[] = ['home', 'explore', 'map', 'trips', 'account'];
const OVERLAY_SCREENS: ScreenKey[] = ['drawer', 'assistant', 'place detail', 'flights'];
// Sheets and dialogs are the surfaces most likely to run out of room when text doubles.
const LARGE_TEXT_OVERLAYS: ScreenKey[] = ['drawer', 'assistant', 'place detail'];

type ProbeOptions = { walk?: boolean; touch?: boolean; hitTest?: boolean; dialog?: boolean };

// A full audit of a screen walks every element, every control and every layer; a test that
// asserts one of those oracles should not pay for the rest, because the matrix is wide
// enough that a 2-core runner needs the difference to stay inside its time budget.
const PROBE = (options: ProbeOptions) => {
  const opts = { walk: true, touch: true, hitTest: true, dialog: true, ...options };
  const vw = window.innerWidth;
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const label = (el: Element) => ((el.getAttribute('aria-label') || el.textContent || '') as string).replace(/\s+/g, ' ').trim().slice(0, 28);
  const name = (el: Element) => `${el.tagName.toLowerCase()}${(el as HTMLElement).id ? '#' + (el as HTMLElement).id : ''} "${label(el)}"`;
  const interactive = 'a[href], button, [role="button"], input:not([type=hidden]), select, textarea, summary';

  // Leaflet lays a tile grid wider than the viewport and slides it under a clipped container,
  // so tiles outside the visible area are deliberately off-screen: measured at 390px with 2x
  // text and 81 tiles requested, documentElement.scrollWidth stayed equal to innerWidth while
  // 12 tile <img> boxes sat past the edges. Exempt exactly that - elements rendered inside a
  // map pane whose container clips them. Controls, popups, attribution, and every application
  // surface stay measured, and a map that ever stopped clipping would stop being exempt.
  const clippedMapInternals = (el: Element) => {
    const pane = el.closest('.leaflet-map-pane, .leaflet-tile-pane, .leaflet-tile-container');
    if (!pane) return false;
    const map = el.closest('.leaflet-container');
    return !!map && /hidden|clip/.test(getComputedStyle(map).overflow);
  };

  // Persistent chrome (sticky header row, fixed bottom bar) may overlay a control at the
  // current scroll offset. Top chrome is recoverable by scrolling; the bottom bar is not.
  const chromeBandCovering = (el: Element): 'top' | 'bottom' | 'other' | null => {
    let node: Element | null = el;
    while (node && node !== document.body) {
      const pos = getComputedStyle(node).position;
      if (pos === 'sticky' || pos === 'fixed') {
        const r = node.getBoundingClientRect();
        if (r.top <= 1 && r.bottom < window.innerHeight * 0.4) return 'top';
        if (r.bottom >= window.innerHeight - 1) return 'bottom';
        return 'other';
      }
      node = node.parentElement;
    }
    return null;
  };

  const overflowing: string[] = [];
  const clipped: string[] = [];
  const tiny: string[] = [];

  if (opts.walk) for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < window.innerWidth - 2 && (r.right > vw + 1.5 || r.left < -1.5) && !el.closest('.sindbad-scroll-x') && !clippedMapInternals(el)) {
      overflowing.push(`${name(el)} ${Math.round(r.left)}→${Math.round(r.right)}`);
    }
    const node = el as HTMLElement;
    const cls = typeof node.className === 'string' ? node.className : '';
    const cs = getComputedStyle(node);
    const textOverflow = node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2;
    // Only horizontal bleed is a layout defect when overflow is visible: a line box can
    // round a couple of pixels shorter than its own glyph box without clipping anything.
    const bleedsHorizontally = node.scrollWidth > node.clientWidth + 2;
    if (/hidden|clip/.test(cs.overflowX + cs.overflowY) && !/truncate|line-clamp/.test(cls) && !node.querySelector('img, svg') && (node.textContent || '').trim()) {
      if (textOverflow) clipped.push(`${name(node)} ${node.scrollWidth}>${node.clientWidth}`);
    } else if (!/hidden|clip/.test(cs.overflowX + cs.overflowY) && el.children.length === 0 && (node.textContent || '').trim() && !node.closest('.sindbad-scroll-x, button, a') && bleedsHorizontally) {
      // Text that runs past its box without clipping is invisible to an overflow check:
      // it stays inside the viewport yet bleeds over the neighbours it should have wrapped away from.
      clipped.push(`${name(node)} ${node.scrollWidth}>${node.clientWidth} (runs past its box)`);
    }
  }

  if (opts.touch) for (const el of document.querySelectorAll<HTMLElement>(interactive)) {
    if (!visible(el) || el.closest('.sindbad-hit-expand') || el.closest('.leaflet-control-attribution')) continue;
    const r = el.getBoundingClientRect();
    const smallest = Math.min(r.width, r.height);
    if (smallest > 0 && smallest < 44) tiny.push(`${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  const surface = document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"], aside');
  const panels = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], aside')];
  const panel = panels[panels.length - 1];
  let dialog: { cls: string; top: number; bottom: number; lowestAction: number; vh: number } | null = null;
  if (opts.dialog && panel) {
    const r = panel.getBoundingClientRect();
    const actions = [...panel.querySelectorAll<HTMLElement>('button, a[href], input, textarea')].map((node) => node.getBoundingClientRect());
    dialog = {
      cls: String(panel.className).slice(0, 48),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      lowestAction: actions.length ? Math.round(Math.max(...actions.map((a) => a.bottom))) : Math.round(r.bottom),
      vh: window.innerHeight,
    };
  }

  // Tappability is measured by hit-testing the centre of each control, because
  // geometry alone both flags stacked layers that never steal a tap and misses
  // ones that do.
  const blocked: string[] = [];
  const bar = opts.hitTest
    ? [...document.querySelectorAll('nav')].find((node) => {
        const r = node.getBoundingClientRect();
        return Math.abs(r.bottom - window.innerHeight) < 6 && r.height > 8;
      })
    : null;
  if (bar) {
    for (const el of document.querySelectorAll<HTMLElement>(interactive)) {
      if (!visible(el) || bar.contains(el)) continue;
      // While a surface is open everything behind it is inert by design.
      if (surface && el.closest('[role="dialog"], [role="alertdialog"], aside') !== surface) continue;
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) continue;
      // A full-bleed control with no content is the scrim that dismisses a surface;
      // the panel sitting above it is the whole point of that pattern.
      if (el.textContent?.trim() === '' && !el.hasAttribute('href') && r.width >= vw - 1 && r.height >= window.innerHeight - 1) continue;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || top === el || el.contains(top) || top.contains(el)) continue;
      if (chromeBandCovering(top) === 'top') continue;
      const rr = top.getBoundingClientRect();
      blocked.push(`${name(el)} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}] blocked by ${name(top)} [${Math.round(rr.left)},${Math.round(rr.top)},${Math.round(rr.width)},${Math.round(rr.height)}]`);
    }
  }

  return {
    vw,
    vh: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: overflowing.slice(0, 6),
    clipped: clipped.slice(0, 6),
    tiny: tiny.slice(0, 12),
    blocked: blocked.slice(0, 6),
    dialog,
  };
};

async function probe(page: Page, label: string, options: ProbeOptions = {}) {
  const result = await page.evaluate(PROBE, options);
  return { ...result, label };
}

async function openScreen(page: Page, screen: ScreenKey) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.scrollTo(0, 0));
  // Exit animations remove the surface a beat later, and a surface left open keeps the
  // page behind it inert, which would turn every following click into a timeout.
  await page
    .waitForFunction(() => !document.querySelector('[role="dialog"], [role="alertdialog"]'), null, { timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(150);
  // A surface that ignores Escape would keep the page behind it inert.
  if (await page.locator('[role="dialog"], [role="alertdialog"], aside').count()) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#tab-home')).toBeVisible();
    await page.waitForTimeout(150);
  }
  await OPEN[screen](page).catch((error: Error) => {
    throw new Error(`opening "${screen}" at ${page.viewportSize()?.width}px failed: ${error.message.split('\n')[0].slice(0, 140)}`);
  });
  // Surface entrances are animated; measure once things have settled.
  await page.waitForTimeout(OVERLAY_SCREENS.includes(screen) ? 420 : 120);
}

async function boot(page: Page, language: 'en' | 'ar' | 'fr' = 'en') {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 35.77, longitude: -5.82 });
  await servePlaces(page);
  await page.addInitScript((lang) => {
    localStorage.setItem('sindbad_language', lang);
    localStorage.setItem('sindbad_theme_preference', 'light');
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('sindbad_onboarding_complete:')) localStorage.setItem(key, 'true');
    } catch { /* ignore */ }
  }, language);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#tab-home')).toBeVisible();
}

// Both oracles need the exact same walk of the exact same states, so they share one
// traversal: halving the wall time of the widest test in the file without dropping a check.
test('no screen scrolls sideways or clips its own text at any supported width', async ({ page }) => {
  test.setTimeout(150_000); // 4 widths x 9 screens, measured, with headroom for a 2-core runner
  await boot(page);
  for (const width of LOOP_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const screen of [...CORE_SCREENS, ...OVERLAY_SCREENS]) {
      await openScreen(page, screen);
      const result = await probe(page, `${screen} @ ${width}`, { touch: false, hitTest: false, dialog: false });
      expect(result.scrollWidth, `${result.label}: document is ${result.scrollWidth}px wide, overflowing=${JSON.stringify(result.overflowing)}`).toBeLessThanOrEqual(result.vw + 1);
      expect(result.overflowing, `${result.label}: overflowing`).toEqual([]);
      expect(result.clipped, `${result.label}: clipped=${JSON.stringify(result.clipped)}`).toEqual([]);
    }
  }
});

test('touch pointers get 44px targets on every screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  await boot(page);
  for (const screen of [...CORE_SCREENS, ...OVERLAY_SCREENS]) {
    await openScreen(page, screen);
    const result = await probe(page, screen, { walk: false, hitTest: false, dialog: false });
    expect(result.tiny, `${result.label}: small targets=${JSON.stringify(result.tiny)}`).toEqual([]);
  }
  await context.close();
});

test('nothing important is hidden behind the persistent bar', async ({ page }) => {
  test.setTimeout(150_000); // scrolls and hit-tests every screen at three widths
  await boot(page);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 720 });
    for (const screen of [...CORE_SCREENS, ...OVERLAY_SCREENS]) {
      await openScreen(page, screen);
      // Scroll to the end of the page so a bottom row cannot hide under the bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(150);
      const result = await probe(page, `${screen} @ ${width} bottom`, { walk: false, touch: false, dialog: false });
      expect(result.blocked, `${result.label}: ${JSON.stringify(result.blocked)}`).toEqual([]);
    }
  }
});

test('desktop widths keep their rails and headers inside the viewport', async ({ page }) => {
  await boot(page);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const screen of ['home', 'explore', 'trips'] as ScreenKey[]) {
      await openScreen(page, screen);
      const result = await probe(page, `${screen} @ ${width}`, { touch: false, dialog: false });
      expect(result.overflowing, `${result.label}: ${JSON.stringify(result.overflowing)}`).toEqual([]);
      expect(result.clipped, `${result.label}: ${JSON.stringify(result.clipped)}`).toEqual([]);
      expect(result.blocked, `${result.label}: ${JSON.stringify(result.blocked)}`).toEqual([]);
    }
  }
});

test('sheets and dialogs stay inside the viewport with their actions reachable', async ({ page }) => {
  test.setTimeout(120_000); // one animated open per width, then geometry
  await boot(page);
  for (const [width, height] of [[320, 640], [390, 700], [768, 900], [1280, 720]] as const) {
    await page.setViewportSize({ width, height });
    for (const screen of OVERLAY_SCREENS) {
      await openScreen(page, screen);
      const result = await probe(page, `${screen} @ ${width}x${height}`, { walk: false, touch: false, hitTest: false });
      expect(result.dialog, `${result.label}: no surface was rendered`).not.toBeNull();
      expect(result.dialog!.top, `${result.label}: escapes above the viewport (${result.dialog!.cls})`).toBeGreaterThanOrEqual(-1);
      expect(result.dialog!.bottom, `${result.label}: taller than the viewport (${result.dialog!.cls})`).toBeLessThanOrEqual(result.dialog!.vh + 1);
      expect(result.dialog!.lowestAction, `${result.label}: last action is below the fold (${result.dialog!.cls})`).toBeLessThanOrEqual(result.dialog!.vh + 1);
    }
  }
});

test('enlarged system text keeps core screens usable', async ({ page }) => {
  await boot(page);
  for (const width of NARROW) {
    await page.setViewportSize({ width, height: 800 });
    await page.addStyleTag({ content: 'html{font-size:200%!important}' });
    for (const screen of [...CORE_SCREENS, ...LARGE_TEXT_OVERLAYS]) {
      await openScreen(page, screen);
      const result = await probe(page, `${screen} @ ${width} 2x`, { touch: false, hitTest: false, dialog: false });
      expect(result.scrollWidth, `${result.label}: overflowing=${JSON.stringify(result.overflowing)}`).toBeLessThanOrEqual(result.vw + 1);
      expect(result.overflowing, `${result.label}: overflowing`).toEqual([]);
      expect(result.clipped, `${result.label}: clipped=${JSON.stringify(result.clipped)}`).toEqual([]);
    }
    await page.evaluate(() => [...document.querySelectorAll('style')].filter((node) => node.textContent?.includes('font-size:200%')).forEach((node) => node.remove()));
  }
});

test('Arabic mirrors the shell but never the map', async ({ browser }) => {
  const ltrContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ltr = await ltrContext.newPage();
  await boot(ltr, 'en');
  const ltrMenuLeft = await ltr.locator('#home-side-menu-btn').evaluate((el) => el.getBoundingClientRect().left);
  const ltrCardLeft = await ltr.locator('article').first().evaluate((el) => el.getBoundingClientRect().left);
  await ltrContext.close();

  const arContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ar = await arContext.newPage();
  await boot(ar, 'ar');
  expect(await ar.evaluate(() => document.documentElement.dir)).toBe('rtl');
  expect(await ar.evaluate(() => document.documentElement.lang)).toBe('ar');
  const rtlMenuLeft = await ar.locator('#home-side-menu-btn').evaluate((el) => el.getBoundingClientRect().left);
  expect(rtlMenuLeft, `the menu control did not mirror (${Math.round(ltrMenuLeft)}px → ${Math.round(rtlMenuLeft)}px)`).toBeGreaterThan(ltrMenuLeft);
  const rtlCardLeft = await ar.locator('article').first().evaluate((el) => el.getBoundingClientRect().left);
  expect(Math.abs(rtlCardLeft - ltrCardLeft), 'card flow did not follow the writing direction').toBeGreaterThan(2);

  await ar.locator('#tab-explore').click();
  await ar.getByRole('button', { name: /^(Carte|Map|الخريطة)$/ }).first().click();
  const map = ar.locator('.leaflet-container');
  await expect(map).toBeVisible();
  expect(await map.evaluate((el) => getComputedStyle(el).direction), 'the map must not be mirrored').toBe('ltr');
  expect(await ar.locator('.leaflet-map-pane').evaluate((el) => getComputedStyle(el).position)).toBe('absolute');
  const result = await probe(ar, 'arabic map @ 390', { touch: false, hitTest: false, dialog: false });
  expect(result.scrollWidth, `arabic map overflow=${JSON.stringify(result.overflowing)}`).toBeLessThanOrEqual(result.vw + 1);
  await arContext.close();
});

test('the longest translations do not break shell or drawer labels', async ({ browser }) => {
  for (const language of ['fr', 'ar'] as const) {
    for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      await boot(page, language);
      for (const tab of ['#tab-home', '#tab-explore', '#tab-trips', '#tab-profile', '#tab-ai-assistant']) {
        const state = await page.locator(tab).evaluate((el) => {
          const span = el.querySelector('span:last-of-type') as HTMLElement | null;
          return { clipped: span ? span.scrollWidth > span.clientWidth + 1 : false, text: span?.textContent?.trim() || '' };
        });
        expect(state.clipped, `${language} @ ${width}: nav label "${state.text}" is clipped in ${tab}`).toBe(false);
      }
      await page.locator('#home-side-menu-btn').click();
      const rows = await page.locator('aside').evaluate((el) => [...el.querySelectorAll('li button, footer button')].map((node) => {
        const span = node.querySelector('span:last-of-type') as HTMLElement | null;
        return { text: (node.textContent || '').trim().slice(0, 26), clipped: span ? span.scrollWidth > span.clientWidth + 1 : false };
      }));
      expect(rows.filter((row) => row.clipped).map((row) => row.text), `${language} @ ${width}: drawer labels clipped`).toEqual([]);
      await context.close();
    }
  }
});

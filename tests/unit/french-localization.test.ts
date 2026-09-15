import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { FALLBACK_WEATHER_PLACES, localizedFallbackLabel, weatherCodeToLabel } from '../../src/lib/weatherConditions.ts';

function source(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
}

// The app advertises three languages (ar / en / fr) in onboarding and in the
// language switcher. Several screens used a two-argument `isAr ? ar : en`
// helper, which silently served English to anyone who picked French. These
// tests keep the three-language contract from regressing.

test('weather conditions are translated into French, not silently English', () => {
  assert.equal(weatherCodeToLabel(0, 'fr'), 'Ciel dégagé');
  assert.equal(weatherCodeToLabel(3, 'fr'), 'Partiellement nuageux');
  assert.equal(weatherCodeToLabel(61, 'fr'), 'Pluie');
  assert.equal(weatherCodeToLabel(95, 'fr'), 'Orage');

  // Arabic and English must keep working exactly as before.
  assert.equal(weatherCodeToLabel(0, 'ar'), 'سماء صافية');
  assert.equal(weatherCodeToLabel(0, 'en'), 'Clear sky');
  assert.equal(weatherCodeToLabel(0), 'Clear sky');
});

test('an unknown weather code still resolves per language instead of falling back to English', () => {
  assert.equal(weatherCodeToLabel(12345, 'fr'), 'Inconnu');
  assert.equal(weatherCodeToLabel(12345, 'ar'), 'غير معروف');
  assert.equal(weatherCodeToLabel(12345, 'en'), 'Unknown');
});

test('weather place picker carries localized labels for every fallback city', () => {
  assert.ok(FALLBACK_WEATHER_PLACES.length > 0);

  for (const place of FALLBACK_WEATHER_PLACES) {
    for (const language of ['en', 'ar', 'fr'] as const) {
      const label = localizedFallbackLabel(place, language);
      assert.ok(label && label.trim().length > 0, `${place.id} has no ${language} label`);
    }
    // A French label that is byte-identical to English means the city was never
    // actually localized (Morocco is spelled "Maroc" in French).
    assert.notEqual(
      localizedFallbackLabel(place, 'fr'),
      localizedFallbackLabel(place, 'en'),
      `${place.id} is not localized for French`,
    );
    assert.match(localizedFallbackLabel(place, 'fr'), /Maroc/);
    assert.match(localizedFallbackLabel(place, 'ar'), /المغرب/);
  }
});

for (const file of [
  'src/components/OnboardingModal.tsx',
  'src/components/AddPlaceModal.tsx',
  'src/components/NavigationFlow.tsx',
]) {
  test(`${file} resolves user-facing copy in all three languages`, () => {
    const componentSource = source(file);

    // A French branch must exist at all.
    assert.match(componentSource, /isFr/, `${file} never checks for French`);

    // The two-argument bilingual helper signature must not come back.
    assert.doesNotMatch(
      componentSource,
      /const text = \(en: string, ar: string\) =>/,
      `${file} still defines an Arabic/English-only text helper`,
    );

    // No user-facing string should be chosen by `isAr ? ... : ...` alone,
    // which is exactly the pattern that dropped French speakers to English.
    // `isAr` legitimately still drives layout direction (dir="rtl"/"ltr") and
    // Arabic-name selection, so those are excluded before matching.
    const copyOnly = componentSource
      .replace(/dir=\{[^}]*\}/g, '')
      .replace(/\.lang = isAr[^;]*;/g, '');
    const arabicOnlyTernary = /isAr\s*\?\s*['"`][^'"`]+['"`]\s*:\s*['"`][^'"`]+['"`]/;
    assert.doesNotMatch(
      copyOnly,
      arabicOnlyTernary,
      `${file} still selects copy with an Arabic-or-English-only ternary`,
    );
  });
}

test('navigation shows a French place name when one exists', () => {
  const navigationSource = source('src/components/NavigationFlow.tsx');
  assert.match(navigationSource, /isFr && destination\.frenchName \? destination\.frenchName/);
});

// Dead code removed in the same pass: these modules were not imported anywhere
// (verified repo-wide) and still carried non-Moroccan sample content, which
// contradicts the Morocco-first, no-fake-global-coverage rule.
test('unused legacy modules and non-Moroccan assets stay deleted', () => {
  for (const removed of [
    'src/components/MapView.tsx',
    'src/components/NorthernMoroccoBanner.tsx',
    'src/assets/images/santorini_bg.jpg',
  ]) {
    assert.equal(
      existsSync(new URL(`../../${removed}`, import.meta.url)),
      false,
      `${removed} was reintroduced`,
    );
  }
});

test('no Santorini remnants remain in shipped translations or styles', () => {
  assert.doesNotMatch(source('src/data/translations.ts'), /santorini/i);
  assert.doesNotMatch(source('src/index.css'), /Santorini/i);
});

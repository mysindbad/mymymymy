import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { stripOAuthErrorUrl } from '../../src/lib/authUrlRecovery.ts';
import { TRANSLATIONS } from '../../src/data/translations.ts';

test('OAuth error query is removed without discarding unrelated parameters', () => {
  const result = stripOAuthErrorUrl('https://example.test/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+not+found&lang=ar');
  assert.deepEqual(result, { url: '/?lang=ar', code: 'bad_oauth_state' });
});

test('ordinary query strings are not rewritten as OAuth failures', () => {
  assert.equal(stripOAuthErrorUrl('https://example.test/?error=validation&field=email'), null);
});

test('Google auth uses the browser redirect flow instead of manually replaying the OAuth URL', () => {
  const source = readFileSync(new URL('../../src/components/AuthFlowModal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /skipBrowserRedirect\s*:\s*true/);
  assert.doesNotMatch(source, /window\.location\.assign\(data\.url\)/);
});

test('check-in labels do not promise XP that is not awarded', () => {
  assert.equal(TRANSLATIONS.en.checkIn, 'Check In');
  assert.equal(TRANSLATIONS.ar.checkIn, 'تسجيل الوصول');
  assert.equal(TRANSLATIONS.fr.checkIn, 'Enregistrer mon passage');
});

test('review UI no longer contains internal implementation filler', () => {
  const source = readFileSync(new URL('../../src/components/RatePlaceModal.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /does not award XP|AI-memory update|لم يؤكد الخادم التقييم/);
  assert.match(source, /createPlace/);
  assert.match(source, /Cuisine authentique/);
  assert.match(source, /طعام أصيل/);
});

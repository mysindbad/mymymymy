import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  formatVerifiedRating,
  hasVerifiedRating,
  liveReviewsLabel,
  unratedLabel,
} from '../../src/lib/placeRating';

test('formats only ratings backed by at least one review', () => {
  assert.equal(hasVerifiedRating(4.65, 12), true);
  assert.equal(formatVerifiedRating(4.65, 12), '4.7');
  assert.equal(formatVerifiedRating(null, 0), null);
  assert.equal(formatVerifiedRating(0, 0), null);
  assert.equal(formatVerifiedRating(4.8, 0), null);
});

test('provides Arabic, French, and English truth labels', () => {
  assert.equal(unratedLabel('ar'), 'لا يوجد تقييم موثوق بعد');
  assert.equal(unratedLabel('fr'), 'Aucune note vérifiée');
  assert.equal(unratedLabel('en'), 'No verified rating');
  assert.equal(liveReviewsLabel(3, 'ar'), '3 تقييم حي');
});

test('migration makes unrated state nullable and keeps seed reviews out of live aggregates', () => {
  const migration = readFileSync(
    'supabase/migrations/20260914221652_phase_2_rating_truth_model.sql',
    'utf8',
  );

  assert.match(migration, /alter column rating drop not null/i);
  assert.match(migration, /set rating = null/i);
  assert.match(migration, /r\.seed_data = false/i);
  assert.match(migration, /places_rating_truth_check/i);
  assert.doesNotMatch(migration, /coalesce\s*\(\s*\(select avg[\s\S]*?\),\s*0\s*\)/i);
});

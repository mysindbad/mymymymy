import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DUPLICATE_RADIUS_METERS,
  nameSimilarity,
  normalizePlaceName,
  rankDuplicateCandidates,
  type DuplicateCandidate,
} from '../../server/admin.ts';

const TARGET_ID = '11111111-1111-4111-8111-111111111111';

test('names are compared as a person would read them', () => {
  assert.equal(normalizePlaceName('  Musée   de la Kasbah!  '), 'musee de la kasbah');
  assert.equal(normalizePlaceName('KASBAH'), 'kasbah');
  assert.equal(normalizePlaceName('قصبة   طنجة'), 'قصبة طنجة', 'Arabic keeps its letters and only its spacing is normalised');
  // A typographic apostrophe is punctuation: it becomes a space, it does not glue words together.
  assert.equal(normalizePlaceName('Caves d\u2019Hercule'), 'caves d hercule');
  assert.equal(normalizePlaceName(''), '');
  assert.equal(normalizePlaceName(undefined as never), '');
});

test('similarity is a ratio, not a keyword match', () => {
  assert.equal(nameSimilarity('Kasbah Museum', 'Kasbah Museum'), 1);
  assert.equal(nameSimilarity('Kasbah Museum', 'Fortress of the Rising Sun'), 0);
  // Both names reduce to the one meaningful word, so they are the same name.
  assert.equal(nameSimilarity('KASBAH Museum', 'Kasbah mus\u00e9e'), 1);
  // One extra meaningful word halves the score rather than doubling the confidence.
  assert.equal(nameSimilarity('Kasbah Museum', 'Kasbah Grand Museum'), 0.5);
  // The raw score is a ratio; the ranking rounds it for display, the function itself does not.
  assert.equal(Number(nameSimilarity('Caves d Hercule', 'Caves d Hercule Hercules Caves').toFixed(3)), 0.667);
});

test('a name that reduces to stopwords falls back to the whole string', () => {
  // Two names that both vanish into stopwords must not read as identical.
  assert.equal(nameSimilarity('The Place', 'A Place'), 0);
  assert.equal(nameSimilarity('El Place', 'el place'), 1);
  assert.equal(nameSimilarity('', 'Museum'), 0);
});

test('a candidate is only flagged when the name and the ground agree', () => {
  const target = { id: TARGET_ID, name: 'Kasbah Museum', category: 'tourist_poi', coordinates: [35.7798, -5.8166] as [number, number] };
  const rows = [
    { candidate_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', candidate_name: 'Kasbah Museum', candidate_category: 'tourist_poi', candidate_area: 'Kasbah', candidate_distance_meters: undefined, distance_meters: 60, candidate_moderation_status: 'pending' },
    { candidate_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', candidate_name: 'Kasbah Museum of Moroccan Heritage', candidate_category: 'museum', distance_meters: 80 },
    { candidate_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', candidate_name: 'Kasbah Museum', candidate_category: 'tourist_poi', distance_meters: 450 },
    { candidate_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', candidate_name: 'Kasbah Museum', candidate_category: 'restaurant', distance_meters: 10 },
    { candidate_id: TARGET_ID, candidate_name: 'Kasbah Museum', distance_meters: 0 },
  ];

  const ranked = rankDuplicateCandidates(target, rows);
  assert.equal(ranked.length, 4, 'a place is never its own duplicate');
  const byId: Record<string, DuplicateCandidate> = Object.fromEntries(ranked.map((row) => [row.id, row]));
  // Both identical names inside the radius are flagged, and the closer one leads.
  assert.ok(byId['dddddddd-dddd-4ddd-8ddd-dddddddddddd'].likely, 'the same name 10 m away is a duplicate even if the categories disagree');
  assert.equal(byId['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'].likely, true);
  assert.equal(byId['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'].similarity, 1);
  assert.equal(byId['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'].distanceMeters, 60);
  assert.equal(byId['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'].moderationStatus, 'pending', 'a moderator needs to know the other row is itself awaiting review');
  assert.deepEqual(ranked.slice(0, 2).map((row) => row.likely), [true, true], 'flagged candidates are shown first');
  assert.equal(ranked[0].id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

  // Same name, but outside the radius: reported, never flagged.
  const far = ranked.find((row) => row.id === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')!;
  assert.equal(far.similarity, 1);
  assert.equal(far.likely, false);

  // Weak name overlap, close by: the category bonus only lowers the bar, it is not a verdict.
  // One word in common out of three, and a category that disagrees: surfaced for comparison,
  // never flagged. Only a category match lowers the bar (to 0.4), it does not remove it.
  const weak = byId['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  assert.equal(weak.similarity, 0.333);
  assert.equal(weak.likely, false);
  assert.equal(DUPLICATE_RADIUS_METERS, 400);
});

test('the radius can be widened for a dense area, and an unknown distance is not a veto', () => {
  const target = { id: TARGET_ID, name: 'Grand Socco', category: 'tourist_poi', coordinates: null };
  const rows = [{ candidate_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', candidate_name: 'Grand Socco Square', candidate_category: 'tourist_poi', distance_meters: 900 }];

  assert.equal(rankDuplicateCandidates(target, rows)[0].likely, false);
  assert.equal(rankDuplicateCandidates(target, rows, { radiusMeters: 1200 })[0].likely, true);

  const noDistance = [{ candidate_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', candidate_name: 'Grand Socco' }];
  const row = rankDuplicateCandidates(target, noDistance)[0];
  assert.equal(row.distanceMeters, null);
  assert.equal(row.likely, true, 'a database that returned no distance must not hide the match');
});

test('the list stays short, ordered by evidence, and never invents a target', () => {
  const target = { id: TARGET_ID, name: 'Kasbah Museum', category: 'tourist_poi', coordinates: [35.7798, -5.8166] as [number, number] };
  const rows = Array.from({ length: 12 }, (_, index) => ({
    candidate_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    candidate_name: index % 2 === 0 ? 'Kasbah Museum' : 'Some Other Place',
    candidate_category: 'tourist_poi',
    distance_meters: index % 2 === 0 ? 1000 - index * 10 : 10,
  }));

  const ranked = rankDuplicateCandidates(target, rows);
  assert.equal(ranked.length, 8, 'the inspector shows the strongest eight, not everything nearby');
  assert.ok(ranked.every((row, position) => position === 0 || ranked[position - 1].likely >= row.likely));
  const similarities = ranked.map((row) => row.similarity);
  assert.deepEqual(similarities, [...similarities].sort((a, b) => b - a));

  assert.deepEqual(rankDuplicateCandidates(target, []), []);
  assert.deepEqual(rankDuplicateCandidates(target, null), []);
  assert.deepEqual(rankDuplicateCandidates(target, undefined), []);
});

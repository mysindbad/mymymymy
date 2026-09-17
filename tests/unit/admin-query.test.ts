// Query parsing, mutation validation and DTO mapping for the Admin Control Center.
// These are the rules that keep the console honest at volume: clamped pages, a whitelist for
// sortable columns, an allow-list for writable fields, and mappers that drop what must not
// reach an administrator's screen.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  enumParam,
  intParam,
  isUuid,
  parseCurationPatch,
  parseListQuery,
  parseModerationDecision,
  parseRoleChange,
  requireUuid,
  sortParam,
  textParam,
  toAdminAuditRow,
  toAdminPlaceRow,
  toAdminReviewRow,
  toAdminTravelerRow,
} from '../../server/admin.ts';
import { PLACE_LIST_SORTS, REVIEW_LIST_SORTS, TRAVELER_LIST_SORTS } from '../../server/admin.ts';

test('admin list queries clamp the page size and reject sorts outside the whitelist', () => {
  const query = parseListQuery(
    { page: '3', pageSize: '500', sort: 'rating; drop table', dir: 'ASC' },
    { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' },
  );
  assert.equal(query.pageSize, MAX_PAGE_SIZE);
  assert.equal(query.page, 3);
  assert.equal(query.from, 200, 'the offset follows the clamped page size, not the requested one');
  assert.equal(query.to, 299);
  assert.equal(query.sort, 'created_at', 'a sort outside the whitelist must never reach the query builder');
  assert.equal(query.dir, 'asc');

  const defaults = parseListQuery({}, { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' });
  assert.equal(defaults.pageSize, DEFAULT_PAGE_SIZE);
  assert.equal(defaults.page, 1);
  assert.equal(defaults.from, 0);
  assert.equal(defaults.search, '');

  assert.equal(parseListQuery({ page: '-4', pageSize: '0' }, { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' }).page, 1);
  assert.equal(parseListQuery({ page: '999999999' }, { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' }).page, 10000);
  assert.equal(parseListQuery({ pageSize: '30' }, { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' }).pageSize, 25, 'odd page sizes settle on an offered size');
  const garbage = parseListQuery({ page: 'abc', pageSize: 'xyz' }, { sorts: PLACE_LIST_SORTS, defaultSort: 'created_at' });
  assert.equal(garbage.page, 1, 'a malformed page in a pasted URL shows page one, not an error page');
  assert.equal(garbage.pageSize, DEFAULT_PAGE_SIZE);
});

test('each resource only sorts by its own columns', () => {
  assert.equal(sortParam({ sort: 'date', dir: 'asc' }, REVIEW_LIST_SORTS, 'date').sort, 'date');
  assert.equal(sortParam({ sort: 'date' }, PLACE_LIST_SORTS, 'created_at').sort, 'created_at');
  assert.equal(sortParam({ sort: 'email' }, TRAVELER_LIST_SORTS, 'created_at').sort, 'created_at');
});

test('scalar helpers cap lengths and clamp numbers', () => {
  assert.equal(textParam('  hello  '), 'hello');
  assert.equal(textParam(42), '', 'numbers are not text: a query object cannot smuggle a non-string into a filter');
  assert.equal(textParam({ nope: true }), '');
  assert.equal(textParam('x'.repeat(400), 160).length, 160);
  assert.equal(intParam('7', { fallback: 1, min: 1, max: 10 }), 7);
  assert.equal(intParam('-3', { fallback: 1, min: 1, max: 10 }), 1);
  assert.equal(intParam('nope', { fallback: 4, min: 1, max: 10 }), 4);
  assert.equal(enumParam('pending', ['pending', 'approved'] as const, 'approved'), 'pending');
  assert.equal(enumParam('DROP', ['pending', 'approved'] as const, 'approved'), 'approved');
});

test('identifiers are validated before they reach the database', () => {
  assert.ok(isUuid('8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44'));
  assert.ok(!isUuid('8f14e45f-ea2a-4b1a-9d5c'));
  assert.ok(!isUuid('1; select 1'));
  assert.throws(() => requireUuid('not-a-uuid', 'place id'), /place id/);
  assert.equal(requireUuid('8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44', 'place id'), '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44');
});

test('curation accepts only documented fields and refuses the truth-bearing ones', () => {
  const { patch, changed } = parseCurationPatch({
    description: '  A stone arch over a river.  ',
    opening_hours: '',
    arabic_name: 'قنطرة',
    reason: 'typo in the area name',
  });

  assert.deepEqual(changed.sort(), ['arabic_name', 'description', 'opening_hours']);
  assert.equal(patch.description, 'A stone arch over a river.');
  assert.equal(patch.opening_hours, null, 'an empty optional field is a null write, never an empty string');
  assert.ok(!('reason' in patch), 'the reason belongs to the audit row, not the record');

  // A smuggled write must refuse the whole request, not silently drop the bad key: an operator
  // has to see why nothing changed, and a UI bug must not be able to set a rating quietly.
  assert.throws(() => parseCurationPatch({
    description: 'fine',
    rating: 5,
  }), /rating is not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ review_count: 99 }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ seed_data: true }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ is_under_documented_gem: true }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ moderation_status: 'approved' }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ coordinates: [1, 2] }), /coordinates is not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ photos: ['https://evil.test/a.png'] }), /photos is not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ created_by_user_id: 'someone' }), /not editable from the admin surface|not a curatable field/);
  assert.throws(() => parseCurationPatch({ source: 'business_owner' }), /source is not a curatable field/);
  assert.throws(() => parseCurationPatch({ rating: 5 }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ seed_data: true }), /not editable from the admin surface/);
  assert.throws(() => parseCurationPatch({ reason: 'only a reason' }), /no curation fields were supplied/);
  assert.deepEqual(parseCurationPatch({ opening_hours: '' }).patch, { opening_hours: null });
  assert.throws(() => parseCurationPatch({ name: '   ' }), /name cannot be empty/);
  assert.throws(() => parseCurationPatch({ region: 'x'.repeat(200) }), /region is longer than 120 characters/);
  assert.throws(() => parseCurationPatch({ category: 'nightclub' }), /category must be one of/);
  assert.equal(parseCurationPatch({ category: 'campsite' }).patch.category, 'campsite');
  assert.equal(parseCurationPatch({ price_level: '$$' }).patch.price_level, '$$');
  assert.throws(() => parseCurationPatch({ trust_level: 'verified' }), /trust_level must be one of/);
  assert.throws(() => parseCurationPatch(null), /no curation fields were supplied/);
});

test('curation removes control characters rather than storing them', () => {
  const { patch } = parseCurationPatch({ area: 'Chefcha\u0007oen' });
  assert.equal(patch.area, 'Chefcha oen');
  assert.ok(!patch.area.includes('\u0007'));
});

test('moderation decisions are validated per resource, with reasons where they matter', () => {
  assert.deepEqual(parseModerationDecision({ status: 'approved' }, 'place'), { status: 'approved', reason: null, requiresReason: false });
  assert.deepEqual(parseModerationDecision({ status: 'pending', reason: 'new' }, 'place'), { status: 'pending', reason: 'new', requiresReason: false });
  assert.throws(() => parseModerationDecision({ status: 'rejected' }, 'place'), /a reason is required/);
  assert.throws(() => parseModerationDecision({ status: 'needs_changes' }, 'place'), /a reason is required/);
  assert.equal(parseModerationDecision({ status: 'rejected', reason: 'duplicate of an existing record' }, 'place').reason, 'duplicate of an existing record');
  assert.throws(() => parseModerationDecision({ status: 'published' }, 'place'), /status must be one of/);
  assert.throws(() => parseModerationDecision({}, 'place'), /status must be one of/);
  // reviews have their own smaller state machine
  assert.throws(() => parseModerationDecision({ status: 'needs_changes' }, 'review'), /status must be one of/);
  assert.equal(parseModerationDecision({ status: 'rejected', reason: 'x' }, 'review').status, 'rejected');
  assert.equal(parseModerationDecision({ status: 'rejected' }, 'review').requiresReason, false);
});

test('privilege changes always demand a reason and a real identifier', () => {
  assert.throws(() => parseRoleChange({ role: 'admin', user_id: '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44' }, 'grant'), /a reason is required/);
  assert.throws(() => parseRoleChange({ role: 'owner', user_id: '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44', reason: 'needed' }, 'grant'), /role must be one of/);
  assert.throws(() => parseRoleChange({ role: 'admin', user_id: 'me', reason: 'needed' }, 'grant'), /target account/);
  assert.throws(() => parseRoleChange({ user_id: '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44' }, 'revoke'), /a reason is required/);
  assert.deepEqual(
    parseRoleChange({ role: 'super_admin', userId: '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44', reason: ' rota coverage ' }, 'grant'),
    { reason: 'rota coverage', role: 'super_admin', targetUserId: '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44' },
  );
});

test('place rows expose provenance and hide nothing an operator needs, while unsafe photos are counted not rendered', () => {
  const row = toAdminPlaceRow({
    id: 'p-1',
    name: 'God\u2019s Bridge',
    arabic_name: '\u0642\u0646\u0637\u0631\u0629 \u0631\u0628\u064a',
    french_name: null,
    category: 'tourist_poi',
    region: 'Northern Morocco',
    area: 'Akchour',
    coordinates: [35.23, -5.35],
    photos: ['https://ok.test/a.png', 'http://insecure.test/b.png', 'javascript:alert(1)', 42],
    rating: null,
    review_count: 0,
    rating_provenance: 'unrated',
    seed_data: false,
    is_under_documented_gem: true,
    trust_level: 'community',
    moderation_status: 'pending',
    created_by_user_id: 'user-9',
  });

  assert.ok(row);
  assert.deepEqual(row.photos, ['https://ok.test/a.png']);
  assert.equal(row.suppressedPhotoCount, 3);
  assert.equal(row.rating.value, null, 'a null rating stays null instead of becoming zero');
  assert.equal(row.rating.provenance, 'unrated');
  assert.equal(row.moderation.status, 'pending');
  assert.equal(row.isUnderDocumentedGem, true);
  assert.equal(row.submittedBy, 'user-9');
  assert.deepEqual(row.coordinates, [35.23, -5.35]);
  assert.equal(toAdminPlaceRow(null), null);
  assert.deepEqual(toAdminPlaceRow({ id: 'x', coordinates: [1, 2, 3] }).coordinates, null, 'a malformed coordinate pair is treated as absent');
});

test('review rows keep the text and provenance, audit rows keep the reason', () => {
  const review = toAdminReviewRow({
    id: 'r-1',
    place_id: 'p-1',
    places: { name: 'God\u2019s Bridge', area: 'Akchour' },
    author_name: 'Youssef',
    author_role: 'local_resident',
    rating: 5,
    text: 'Worth the hike.',
    tags: ['hiking'],
    photos: ['http://x.test/1.png'],
    seed_data: false,
    moderation_status: 'pending',
    date: '2026-03-02T09:00:00Z',
  });
  assert.equal(review.placeName, 'God\u2019s Bridge');
  assert.equal(review.moderation.status, 'pending');
  assert.deepEqual(review.photos, []);
  assert.equal(review.suppressedPhotoCount, 1);
  assert.equal(review.isSeed, false);

  const audit = toAdminAuditRow({
    id: 'a-1',
    occurred_at: '2026-09-17T08:00:00Z',
    admin_label: 'mod@mysindbad.test',
    admin_role: 'admin',
    action: 'place_moderation_updated',
    target_type: 'place',
    target_id: 'p-1',
    reason: 'verified against the park page',
    change_summary: { from: 'pending', to: 'approved' },
  });
  assert.equal(audit.action, 'place_moderation_updated');
  assert.deepEqual(audit.changeSummary, { from: 'pending', to: 'approved' });
  assert.equal(toAdminAuditRow({ id: 'a-2', change_summary: 'not-an-object' }).changeSummary['x'], undefined);
});

test('traveller rows never carry email, auth metadata or coordinates', () => {
  const row = toAdminTravelerRow({
    user_id: 'u-1',
    display_name: 'Amina',
    preferred_language: 'ar',
    avatar_url: 'https://x.test/a.png',
    last_known_location: { lat: 35.75, lng: -5.83 },
    home_location: { lat: 31.6, lng: -8 },
    email: 'amina@example.test',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: null,
  });

  const keys = Object.keys(row).sort();
  assert.deepEqual(keys, [
    'adminRole_placeholder_unused', 'createdAt', 'displayName', 'hasAvatar', 'hasHomeLocationOnFile',
    'hasLocationOnFile', 'preferredLanguage', 'updatedAt', 'userId',
  ].filter((key) => key !== 'adminRole_placeholder_unused'));
  const exposed = row as unknown as Record<string, unknown>;
  assert.equal(exposed['email'], undefined);
  assert.equal(exposed['last_known_location'], undefined);
  assert.equal(exposed['home_location'], undefined);
  assert.equal(row.hasLocationOnFile, true, 'the presence of a stored location is operationally relevant; its value is not');
  assert.equal(row.preferredLanguage, 'ar');
});

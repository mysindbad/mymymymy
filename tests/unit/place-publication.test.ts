import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Publication is enforced where consumers actually read from: the API server queries Supabase with
 * a privileged client (which row-level security does not bind), so the read filters and the
 * submission state are the enforceable half of the rule next to the policies in
 * supabase/migrations/20260917115914_admin_control_center.sql.
 *
 * These tests drive the real data-access layer against a stubbed PostgREST endpoint and assert on
 * the requests it makes and the records it returns - behaviour, not source text.
 */

const HOST = '127.0.0.1:54399';
process.env.SUPABASE_URL = `http://${HOST}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'unit-test-anon-key';
delete process.env.VITE_SUPABASE_URL;
delete process.env.VITE_SUPABASE_ANON_KEY;

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const PLACE_ID = '33333333-3333-4333-8333-333333333333';

type Captured = { method: string; path: string; search: string; body: any };

let captured: Captured[] = [];
let response: unknown = [];
let authUser: string | null = null;

function installFetchStub() {
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(String(input), init);
    const url = new URL(request.url);
    const raw = init?.body ? String(init.body) : null;
    captured.push({
      method: request.method,
      path: url.pathname,
      search: url.search,
      body: raw ? JSON.parse(raw) : null,
    });
    if (url.pathname.endsWith('/auth/v1/user')) {
      if (!authUser) return new Response(JSON.stringify({ message: 'invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({
        id: authUser,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'traveller@example.invalid',
        email_confirmed_at: '2024-01-01T00:00:00.000Z',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
}

function resetStub(next: { response?: unknown; authUser?: string | null } = {}) {
  captured = [];
  response = next.response ?? [];
  authUser = next.authUser === undefined ? null : next.authUser;
}

const restoreFetch = installFetchStub();
const { createDal } = await import('../../server/dal.ts');
test.after(() => restoreFetch());

function placeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PLACE_ID,
    name: 'Cascable',
    arabic_name: 'شلال',
    french_name: 'Cascades',
    category: 'tourist_poi',
    region: 'Tanger-Tetouan-Al Hoceima',
    area: 'near the port',
    coordinates: [35.7, -5.8],
    address: 'Corniche',
    photos: [],
    description: 'A short waterfall walk.',
    rating: null,
    review_count: 0,
    ratings_breakdown: null,
    features: null,
    price_level: null,
    opening_hours: null,
    contact_phone: null,
    is_under_documented_gem: false,
    source: 'community_traveler',
    owner_verified: false,
    business_owner_name: null,
    check_ins_count: 0,
    seed_data: false,
    seed_check_ins_count: 0,
    photo_provenance: 'user_submitted',
    rating_provenance: 'unrated',
    data_source: 'community_submission',
    last_verified_at: null,
    trust_level: 'unverified',
    created_by_user_id: UUID_A,
    moderation_status: 'approved',
    reviews: [],
    ...overrides,
  };
}

test('discovery and the headline count ask the database for published places only', async () => {
  resetStub({ response: [] });
  await createDal().places.getAll();
  const list = captured.find((entry) => entry.method === 'GET' && entry.path.endsWith('/places'));
  assert.ok(list, 'a places query should have been issued');
  const params = new URLSearchParams(list!.search);
  assert.equal(params.get('moderation_status'), 'eq.approved', 'discovery must be limited to approved places');
  assert.ok(!params.has('or'), 'publication must not be smuggled into an or() that search also uses');

  resetStub({ response: [] });
  await createDal().getSummary();
  const count = captured.find((entry) => entry.path.endsWith('/places'));
  assert.ok(count, 'the summary should count places');
  assert.match(count!.search, /moderation_status=eq\.approved/, 'the published count is the honest one');
});

test('a queued review stops showing up without being deleted from the row', async () => {
  resetStub({
    response: [placeRow({
      reviews: [
        { id: UUID_B, author_name: 'Amina', author_role: 'traveler', rating: 4.5, text: 'Nice', tags: [], photos: [], seed_data: false, moderation_status: 'approved', date: '2026-01-01' },
        { id: UUID_A, author_name: 'Spam', author_role: 'traveler', rating: 1, text: 'bad', tags: [], photos: [], seed_data: false, moderation_status: 'rejected', date: '2026-01-02' },
        { id: '44444444-4444-4444-8444-444444444444', author_name: 'Old', author_role: 'traveler', rating: 5, text: 'legacy', tags: [], photos: [], seed_data: false, date: '2025-11-01' },
      ],
    })],
  });
  const [place] = await createDal().places.getAll();
  assert.ok(place, 'the published place is returned');
  assert.deepEqual(place.reviews.map((review: { authorName: string }) => review.authorName), ['Amina', 'Old'],
    'a moderated-away review is hidden while a pre-moderation review keeps its place');
});

test('an unpublished place is not readable, except by the account that submitted it', async () => {
  resetStub({ response: [placeRow({ moderation_status: 'pending' })] });
  assert.equal(await createDal().places.getById(PLACE_ID), null, 'an anonymous visitor must not see a queued submission');

  resetStub({ response: [placeRow({ moderation_status: 'pending' })], authUser: UUID_A });
  const mine = await createDal(`viewer-token`).places.getById(PLACE_ID);
  assert.equal(mine?.id, PLACE_ID, 'the author still sees the record they submitted, so it never looks deleted');

  resetStub({ response: [placeRow({ moderation_status: 'pending' })], authUser: UUID_B });
  assert.equal(await createDal(`someone-else`).places.getById(PLACE_ID), null, 'another signed-in account gets the same not-found as an anonymous visitor');

  resetStub({ response: [placeRow({ moderation_status: 'approved' })] });
  assert.equal((await createDal(`someone-else`).places.getById(PLACE_ID))?.id, PLACE_ID, 'published content needs no ownership check');
  assert.equal(captured.filter((entry) => entry.path.endsWith('/auth/v1/user')).length, 0,
    'the published path must not pay for a user lookup');
});

test('a traveller submission enters the moderation queue instead of the catalogue', async () => {
  // single() asks PostgREST for one object, so the stub answers in that shape too.
  resetStub({ response: placeRow({ moderation_status: 'pending' }), authUser: UUID_A });
  const payload = {
    name: 'New submission',
    category: 'tourist_poi',
    region: 'Tanger',
    area: 'Kasbah',
    coordinates: [35.75, -5.9],
    address: 'Somewhere',
    description: 'Submitted from the app',
  };
  const created = await createDal('submitter-token').places.create(payload);
  const insert = captured.find((entry) => entry.method === 'POST' && entry.path.endsWith('/places'));
  assert.ok(insert, 'the submission should reach the places table');
  const row = Array.isArray(insert!.body) ? insert!.body[0] : insert!.body;
  assert.equal(row.moderation_status, 'pending', 'a new place is created as pending, never left to a column default');
  assert.equal(row.created_by_user_id, UUID_A, 'the author is recorded so they can still read their own submission');
  assert.equal(row.seed_data, undefined, 'a submission must not claim seed provenance to skip review');
  assert.equal(row.rating, null, 'a queued place has no rating');
  assert.equal(created.id, PLACE_ID, 'the response is the stored record, as the modal renders it');
});

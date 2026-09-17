import assert from 'node:assert/strict';
import test from 'node:test';

import { DataValidationError } from '../../server/dal.ts';
import {
  AdminNotFoundError,
  AdminNotConfiguredError,
  createAdminService,
  parseListQuery,
  type AdminClientLike,
  type AdminResult,
} from '../../server/admin.ts';

const PLACE_A = '11111111-1111-4111-8111-111111111111';
const PLACE_B = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b44';
const TRAVELER_ID = '7d2c0000-1a2b-4c3d-9e4f-0a1b2c3d4e5f';

type Row = Record<string, any>;
type Op = { name: string; args: any[] };

/**
 * A stand-in for the PostgREST builder that keeps the semantics the admin surface depends on
 * (filters narrow, `range` pages, `head` counts) and records every call. Asserting on the
 * recorded chain is what proves the queries are honest: a filter that quietly moved to the
 * browser, or a list that forgot to page, would still return the right rows here.
 */
function fakeDb(tables: Record<string, Row[]>, rpcImpl: Record<string, (args: Row) => unknown> = {}) {
  const queries: Array<{ table: string; mode: string; columns?: string; options?: any; ops: Op[]; values?: Row }> = [];
  const rpcs: Array<{ fn: string; args: Row }> = [];

  class Builder {
    ops: Op[] = [];

    constructor(public entry: (typeof queries)[number]) {}

    private push(name: string, ...args: any[]) {
      this.ops.push({ name, args });
      this.entry.ops = this.ops;
      return this;
    }

    eq(column: string, value: unknown) { return this.push('eq', column, value); }
    neq(column: string, value: unknown) { return this.push('neq', column, value); }
    ilike(column: string, pattern: string) { return this.push('ilike', column, pattern); }
    or(expression: string) { return this.push('or', expression); }
    gte(column: string, value: unknown) { return this.push('gte', column, value); }
    lte(column: string, value: unknown) { return this.push('lte', column, value); }
    in(column: string, values: readonly unknown[]) { return this.push('in', column, [...values]); }
    is(column: string, value: unknown) { return this.push('is', column, value); }
    order(column: string, options?: { ascending?: boolean }) { return this.push('order', column, options ?? {}); }
    range(from: number, to: number) { return this.push('range', from, to); }
    limit(count: number) { return this.push('limit', count); }

    private compute(): { rows: Row[]; total: number } {
      let rows = [...(tables[this.entry.table] ?? [])];
      // The count PostgREST reports for `head: true` is the filtered count, not the table size.
      let total = rows.length;
      for (const op of this.ops) {
        const [column, value] = op.args as [string, any];
        switch (op.name) {
          case 'eq': rows = rows.filter((row) => row[column] === value); break;
          case 'neq': rows = rows.filter((row) => row[column] !== value); break;
          case 'ilike': rows = rows.filter((row) => like(row[column], value)); break;
          case 'or': {
            const parts = String(column).split(',');
            rows = rows.filter((row) => parts.some((part) => {
              const [field, matcher] = part.split('.');
              return matcher === 'ilike' ? like(row[field], value?.[1] ?? part.split('.').slice(2).join('.')) : false;
            }));
            break;
          }
          case 'gte': rows = rows.filter((row) => compare(row[column], value) >= 0); break;
          case 'lte': rows = rows.filter((row) => compare(row[column], value) <= 0); break;
          case 'in': rows = rows.filter((row) => (value as unknown[]).includes(row[column])); break;
          case 'is': rows = rows.filter((row) => (row[column] ?? null) === value); break;
          case 'order': {
            const options = (op.args[1] ?? {}) as { ascending?: boolean };
            const ascending = options.ascending !== false;
            rows = [...rows].sort((a, b) => {
              const left = a[column]; const right = b[column];
              if (left === right) return 0;
              if (left === null || left === undefined) return 1;
              if (right === null || right === undefined) return -1;
              return (compare(left, right) > 0 ? 1 : -1) * (ascending ? 1 : -1);
            });
            break;
          }
          case 'range': { const [from, to] = op.args as [number, number]; rows = rows.slice(from, to + 1); break; }
          case 'limit': rows = rows.slice(0, value as number); break;
        }
        if (['eq', 'neq', 'ilike', 'or', 'gte', 'lte', 'in', 'is'].includes(op.name)) total = rows.length;
      }
      return { rows, total };
    }

    private result(single: boolean): Promise<AdminResult> {
      const { rows, total } = this.compute();
      const entry = this.entry;
      if (entry.mode === 'insert') {
        (tables[entry.table] ??= []).push({ ...(entry.values as Row) });
        return Promise.resolve({ data: entry.values ?? null, error: null });
      }
      if (entry.mode === 'update') {
        for (const row of rows) Object.assign(row, entry.values ?? {});
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      }
      if (entry.options?.head) return Promise.resolve({ data: null, count: total, error: null });
      if (single) return Promise.resolve({ data: rows[0] ?? null, count: total, error: null });
      return Promise.resolve({ data: rows, count: entry.options?.count ? total : null, error: null });
    }

    then(onFulfilled?: (value: AdminResult) => unknown, onRejected?: (reason: unknown) => unknown) {
      return this.result(false).then(onFulfilled, onRejected);
    }

    single() { return { then: (onFulfilled: (v: AdminResult) => unknown) => this.result(true).then(onFulfilled) }; }
    maybeSingle() { return { then: (onFulfilled: (v: AdminResult) => unknown) => this.result(true).then(onFulfilled) }; }
  }

  const client: AdminClientLike = {
    from(table: string) {
      return {
        select(columns: string, options?: any) {
          const entry = { table, mode: 'select' as const, columns, options, ops: [] as Op[] };
          queries.push(entry);
          return new Builder(entry) as never;
        },
        update(values: Row) {
          const entry = { table, mode: 'update' as const, values, ops: [] as Op[] };
          queries.push(entry);
          return new Builder(entry) as never;
        },
        insert(values: Row) {
          const entry = { table, mode: 'insert' as const, values, ops: [] as Op[] };
          queries.push(entry);
          return new Builder(entry) as never;
        },
      };
    },
    rpc: (async (fn: string, args: Row = {}) => {
      rpcs.push({ fn, args: args as Row });
      const impl = rpcImpl[fn];
      if (!impl) return { data: null, error: null };
      return { data: impl(args as Row), error: null };
    }) as AdminClientLike['rpc'],
  };

  const opsOf = (table: string, index = 0) => queries.filter((query) => query.table === table)[index]?.ops ?? [];
  return {
    client,
    queries,
    rpcs,
    opsOf,
    selectEntry: (table: string, index = 0) => queries.filter((query) => query.table === table && query.mode === 'select')[index],
  };
}

function like(value: unknown, pattern: unknown) {
  const needle = String(pattern ?? '').replace(/^%|%$/g, '');
  return String(value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function compare(left: unknown, right: unknown) {
  if (typeof left === 'number' || typeof right === 'number') return Number(left) - Number(right);
  const leftDate = Date.parse(String(left ?? ''));
  const rightDate = Date.parse(String(right ?? ''));
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) return leftDate - rightDate;
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function placeRow(overrides: Row = {}): Row {
  return {
    id: PLACE_A,
    name: 'Kasbah Museum',
    arabic_name: 'متحف القصبة',
    french_name: 'Musée de la Kasbah',
    description: 'Marine history in a restored dar.',
    category: 'tourist_poi',
    sub_category: 'museum',
    region: 'Tanger - Tetouan',
    area: 'Kasbah',
    address: 'Rampes de la Kasbah',
    coordinates: [35.7798, -5.8166],
    photos: ['https://cdn.example.org/kasbah-1.jpg'],
    rating: 4.4,
    review_count: 12,
    check_ins_count: 31,
    rating_provenance: 'traveler_reviews',
    trust_level: 'community',
    data_source: 'community_submission',
    last_verified_at: '2026-08-01T09:00:00.000Z',
    seed_data: false,
    is_under_documented_gem: false,
    moderation_status: 'pending',
    moderation_note: null,
    moderated_at: null,
    moderated_by: null,
    created_by_user_id: TRAVELER_ID,
    source: 'community_traveler',
    created_at: '2026-07-01T09:00:00.000Z',
    updated_at: '2026-07-20T09:00:00.000Z',
    ...overrides,
  };
}

const listQuery = (query: Record<string, unknown> = {}, sorts = ['created_at', 'name', 'rating', 'review_count', 'check_ins_count', 'updated_at', 'moderated_at']) =>
  parseListQuery(query, { sorts, defaultSort: 'created_at' });

test('a list query is paged in the database, not sliced in the service', async () => {
  const db = fakeDb({ places: [placeRow(), placeRow({ id: PLACE_B, name: 'Caves d\u2019Hercule' })] });
  const service = createAdminService(db.client);

  const result = await service.places(listQuery({ page: '1', pageSize: '25' }), {});
  assert.equal(result.total, 2);
  assert.equal(result.rows.length, 2);
  assert.equal(result.pageCount, 1);
  assert.deepEqual(db.opsOf('places').at(-1), { name: 'range', args: [0, 24] });
  assert.equal(db.selectEntry('places')?.options?.count, 'exact', 'the total must be an exact database count');

  // A client asking for 1-row pages is settled onto the smallest offered size: the table stays
  // usable and the server is not asked for one row at a time.
  const secondPage = await service.places(listQuery({ page: '2', pageSize: '1' }), {});
  assert.deepEqual(db.opsOf('places', 1).at(-1), { name: 'range', args: [25, 49] });
  assert.equal(secondPage.pageSize, 25);
  assert.equal(secondPage.page, 2);
});

test('every places filter is pushed down as an equality on the right column', async () => {
  const db = fakeDb({ places: [placeRow()] });
  const service = createAdminService(db.client);
  await service.places(listQuery(), { status: 'pending', category: 'tourist_poi', region: 'Tanger - Tetouan', source: 'community_traveler', gem: true });

  const equals = db.opsOf('places').filter((op) => op.name === 'eq').map((op) => [op.args[0], op.args[1]]);
  assert.deepEqual(equals, [
    ['moderation_status', 'pending'],
    ['category', 'tourist_poi'],
    ['region', 'Tanger - Tetouan'],
    ['source', 'community_traveler'],
    ['is_under_documented_gem', true],
  ]);
});

test('a search term cannot break out of the filter expression it is embedded in', async () => {
  const db = fakeDb({ places: [placeRow()] });
  const service = createAdminService(db.client);
  await service.places(listQuery({ q: 'kasbah, or(name.eq,x)"inject(' }), {});

  const orCall = db.opsOf('places').find((op) => op.name === 'or');
  assert.ok(orCall, 'search must be applied as a single database filter');
  const expression = String(orCall!.args[0]);
  // One clause per searchable column, each of the exact shape PostgREST expects. Anything the
  // caller typed must be inert text inside the pattern, never a clause of its own.
  const parts = expression.split(',');
  assert.equal(parts.length, 7);
  for (const part of parts) {
    const segments = part.split('.');
    assert.equal(segments.length, 4, `a clause grew extra structure: ${part}`);
    assert.ok(['name', 'arabic_name', 'french_name', 'area', 'region', 'sub_category', 'description'].includes(segments[0]));
    assert.equal(segments[1], 'ilike');
    const needle = segments.slice(2).join('.');
    assert.ok(/^[%.\s\w-]+$/.test(needle.replace(/^%|%$/g, '')) , `the pattern holds filter syntax: ${needle}`);
  }
});

test('sorting only ever uses a whitelisted column, in the requested direction', async () => {
  const db = fakeDb({ places: [placeRow()] });
  const service = createAdminService(db.client);
  await service.places(listQuery({ sort: 'rating', dir: 'asc' }), {});
  const order = db.opsOf('places').find((op) => op.name === 'order');
  assert.deepEqual(order, { name: 'order', args: ['rating', { ascending: true, nullsFirst: true }] });

  await service.places(listQuery({ sort: 'password_digest' }), {});
  const second = db.opsOf('places', 1).find((op) => op.name === 'order');
  assert.equal(second?.args[0], 'created_at', 'an unknown sort falls back to the default, never to the raw value');
});

test('identifiers are validated before any query is built', async () => {
  const db = fakeDb({ places: [] });
  const service = createAdminService(db.client);

  await assert.rejects(() => service.place('../etc/passwd'), (error: unknown) => (error as DataValidationError)?.status === 400);
  assert.equal(db.queries.length, 0, 'a malformed id must not reach the database at all');

  await assert.rejects(() => service.place(PLACE_A), (error: unknown) => error instanceof AdminNotFoundError && (error as AdminNotFoundError).status === 404);
  assert.equal(db.queries.length, 1, 'a real id that matches nothing is looked up once');
});

test('the place detail loads reviews, duplicates and history together', async () => {
  const db = fakeDb({
    places: [placeRow({ photos: ['http://insecure.example.org/a.jpg', 'https://cdn.example.org/b.jpg', 'javascript:alert(1)'] })],
    reviews: [
      { id: 'r1', place_id: PLACE_A, author_name: 'Yasmine', author_role: 'traveler', rating: 5, text: 'Worth the climb.', tags: ['view'], photos: ['https://cdn.example.org/r1.jpg'], seed_data: false, moderation_status: 'approved', date: '2026-07-30T00:00:00.000Z' },
      { id: 'r2', place_id: PLACE_A, author_name: 'Bilal', author_role: 'traveler', rating: 2, text: 'Closed when I arrived.', tags: [], photos: ['http://insecure.example.org/r2.jpg'], seed_data: false, moderation_status: 'pending', date: '2026-07-28T00:00:00.000Z' },
    ],
    admin_audit_events: [
      { id: 'a1', occurred_at: '2026-08-02T10:00:00.000Z', admin_label: 'nour@example.org', admin_role: 'admin', action: 'place.moderation.updated', target_type: 'place', target_id: PLACE_A, reason: 'photos verified', change_summary: { status: 'approved' } },
      { id: 'a2', occurred_at: '2026-07-05T10:00:00.000Z', admin_label: 'omar@example.org', admin_role: 'super_admin', action: 'place.moderation.updated', target_type: 'place', target_id: PLACE_B, reason: null, change_summary: {} },
    ],
  }, {
    admin_place_duplicate_candidates: () => ({
      admin_place_duplicate_candidates: [
        { candidate_id: '33333333-3333-4333-8333-333333333333', candidate_name: 'Kasbah Museum of Moroccan Heritage', candidate_category: 'tourist_poi', candidate_area: 'Kasbah', candidate_moderation_status: 'approved', distance_meters: 60 },
        { candidate_id: PLACE_B, candidate_name: 'Kasbah Museum', candidate_category: 'tourist_poi', candidate_area: 'Kasbah', candidate_moderation_status: 'approved', distance_meters: 120 },
        { candidate_id: PLACE_A, candidate_name: 'itself', distance_meters: 0 },
      ],
    }),
  });
  const service = createAdminService(db.client);
  const detail = await service.place(PLACE_A);

  assert.equal(detail.place.photos.length, 1);
  assert.equal(detail.place.suppressedPhotoCount, 2, 'unsafe photo rows are counted, not silently dropped');
  assert.equal(detail.reviews.length, 2);
  assert.deepEqual(detail.reviews.map((review: Row) => review.photos.flat()), [['https://cdn.example.org/r1.jpg'], []]);
  assert.equal(detail.history.length, 1, 'history is scoped to this place id');
  assert.equal(detail.duplicateCandidates.length, 2, 'the place is never its own duplicate');
  const ranked = Object.fromEntries(detail.duplicateCandidates.map((candidate: Row) => [candidate.id, candidate]));
  assert.equal(ranked[PLACE_B].likely, true, 'same name, same area, 120 m apart is a real duplicate');
  assert.equal(ranked['33333333-3333-4333-8333-333333333333'].likely, false, 'one shared word next door is evidence, not a verdict');
  assert.equal(detail.duplicateCandidates[0].id, PLACE_B, 'the likely duplicate leads the list');

  // One batched fan-out: no per-review or per-audit follow-up query.
  const tables = db.queries.map((query) => query.table);
  assert.deepEqual(tables, ['places', 'reviews', 'admin_audit_events']);
  assert.deepEqual(db.rpcs.map((rpc) => rpc.fn), ['admin_place_duplicate_candidates']);
  assert.deepEqual(db.rpcs[0].args, { p_place_id: PLACE_A, p_radius_meters: 400, p_limit: 8 });
});

test('moderation and curation go through the database function with the actor, and never write a table directly', async () => {
  const db = fakeDb({ places: [placeRow()] });
  const service = createAdminService(db.client);
  const actor = { userId: ADMIN_ID, role: 'admin' as const };

  await service.setPlaceModeration(actor, PLACE_A, { status: 'rejected', reason: 'duplicate of an existing record' });
  assert.deepEqual(db.rpcs[0], {
    fn: 'admin_set_place_moderation',
    args: { p_admin_user_id: ADMIN_ID, p_place_id: PLACE_A, p_status: 'rejected', p_reason: 'duplicate of an existing record', p_request_id: null },
  });

  await service.updatePlaceCuration(actor, PLACE_A, { description: 'Tightened by an editor', opening_hours: null }, 'house style');
  assert.deepEqual(db.rpcs[1].args, {
    p_admin_user_id: ADMIN_ID,
    p_place_id: PLACE_A,
    p_patch: { description: 'Tightened by an editor', opening_hours: null },
    p_reason: 'house style',
    p_request_id: null,
  });

  assert.equal(db.queries.some((query) => query.mode === 'update'), false, 'the service must not be able to patch a row itself');
});

test('a missing record is a 404 from the function, not a 500', async () => {
  const client: AdminClientLike = {
    from: () => ({ select: () => ({ then: (resolve: (value: AdminResult) => unknown) => Promise.resolve({ data: null, count: 0, error: null }).then(resolve) }), update: () => ({} as never), insert: () => ({} as never) }) as never,
    rpc: (async () => ({ data: null, error: { message: 'row not found', code: 'P0002' } })) as AdminClientLike['rpc'],
  };
  const service = createAdminService(client);
  await assert.rejects(
    () => service.setPlaceModeration({ userId: ADMIN_ID, role: 'admin' }, PLACE_A, { status: 'approved', reason: null }),
    (error: unknown) => error instanceof AdminNotFoundError && (error as AdminNotFoundError).status === 404,
  );
});

test('the moderation queue pages the pending set and counts each status with a head query', async () => {
  const db = fakeDb({
    places: [
      placeRow({ id: PLACE_A, moderation_status: 'pending' }),
      placeRow({ id: PLACE_B, moderation_status: 'needs_changes' }),
      placeRow({ id: '33333333-3333-4333-8333-333333333333', moderation_status: 'approved' }),
    ],
  });
  const service = createAdminService(db.client);
  const queue = await service.moderationQueue(listQuery());

  const inCall = db.opsOf('places')[0];
  assert.deepEqual(inCall, { name: 'in', args: ['moderation_status', ['pending', 'needs_changes']] });
  assert.equal(queue.rows.length, 2);
  assert.deepEqual(queue.queueCounts, [{ status: 'pending', total: 1 }, { status: 'needs_changes', total: 1 }]);
  assert.equal(queue.waitingTotal, 2);

  const headQueries = db.queries.filter((query) => query.options?.head);
  assert.equal(headQueries.length, 2, 'one exact count per status, no more');
  assert.ok(headQueries.every((query) => query.columns === 'id'));
});

test('traveler rows describe presence, never stored values', async () => {
  const db = fakeDb({
    user_profiles: [{
      user_id: TRAVELER_ID,
      display_name: 'Hafsa',
      preferred_language: 'ar',
      avatar_url: 'https://cdn.example.org/a.png',
      last_known_location: { lat: 12.345678, lng: 98.765432 },
      home_location: null,
      created_at: '2026-01-04T00:00:00.000Z',
      updated_at: '2026-06-04T00:00:00.000Z',
    }],
    admin_accounts: [
      { user_id: ADMIN_ID, role: 'admin', granted_at: '2026-02-01', revoked_at: null },
      { user_id: TRAVELER_ID, role: 'admin', granted_at: '2026-02-01', revoked_at: '2026-03-01' },
    ],
    places: [placeRow({ created_by_user_id: TRAVELER_ID })],
    reviews: [],
    trips: [],
  });
  const service = createAdminService(db.client);

  const list = await service.travelers(listQuery());
  assert.deepEqual(list.rows[0], {
    userId: TRAVELER_ID,
    displayName: 'Hafsa',
    preferredLanguage: 'ar',
    hasAvatar: true,
    hasLocationOnFile: true,
    hasHomeLocationOnFile: false,
    createdAt: '2026-01-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
    adminRole: null,
    grantedAt: null,
  }, 'a revoked grant must not show as an active role');

  const detail = await service.traveler(TRAVELER_ID);
  const serialized = JSON.stringify(detail);
  assert.ok(!serialized.includes('12.345678') && !serialized.includes('98.765432'), 'stored coordinates leaked into a traveler payload');
  assert.equal(detail.admin, null);
  assert.deepEqual(detail.activity, { placesSubmitted: 1, reviewsWritten: 0, tripsCreated: 0 });
});

test('the traveler list never asks for email or auth columns', async () => {
  const db = fakeDb({ user_profiles: [], admin_accounts: [] });
  const service = createAdminService(db.client);
  await service.travelers(listQuery());
  for (const query of db.queries) {
    assert.ok(!/email|password|token|metadata/i.test(query.columns ?? ''), `${query.table}.${query.columns} selected a credential column`);
  }
});

test('an audit filter that is not an identifier is dropped rather than interpolated', async () => {
  const db = fakeDb({ admin_audit_events: [] });
  const service = createAdminService(db.client);
  await service.auditEvents(listQuery(), { targetType: 'place', targetId: "1 OR 1=1", action: 'place.moderation.updated' });

  const ops = db.opsOf('admin_audit_events');
  assert.equal(ops.some((op) => JSON.stringify(op.args).includes('1 OR 1=1')), false);
  assert.ok(ops.some((op) => op.name === 'eq' && op.args[0] === 'target_type'));
  assert.ok(ops.some((op) => op.name === 'or' && String(op.args[0]).includes('place')), 'the action filter is applied as a scoped search');
});

test('privilege changes require a reason and reach the granting function untouched', async () => {
  const db = fakeDb({ admin_accounts: [] });
  const service = createAdminService(db.client);
  const actor = { userId: ADMIN_ID, role: 'super_admin' as const };

  await service.grantRole(actor, { role: 'admin', targetUserId: TRAVELER_ID, reason: 'on-call moderator' });
  assert.deepEqual(db.rpcs[0].args, {
    p_admin_user_id: ADMIN_ID, p_target_user_id: TRAVELER_ID, p_role: 'admin', p_reason: 'on-call moderator', p_request_id: null,
  });

  await service.revokeRole(actor, { targetUserId: TRAVELER_ID, reason: 'left the team' });
  assert.deepEqual(db.rpcs[1], { fn: 'admin_revoke_role', args: { p_admin_user_id: ADMIN_ID, p_target_user_id: TRAVELER_ID, p_reason: 'left the team', p_request_id: null } });
});

test('settings report which capabilities exist, and never a value', async () => {
  const canaries = {
    SUPABASE_URL: 'https://tenant.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-canary-do-not-print',
    GEMINI_API_KEY: 'gemini-canary-do-not-print',
    RATE_LIMIT_SALT: 'salt-canary-do-not-print',
    ALLOW_SEED_FALLBACK: 'true',
  };
  const previous = Object.fromEntries(Object.entries(canaries).map(([key]) => [key, process.env[key]]));
  Object.assign(process.env, canaries, { NODE_ENV: 'test', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_SHA: 'abc1234' });
  try {
    const db = fakeDb({ api_rate_limits: [{ scope: 'ai' }, { scope: 'weather' }], ai_usage_events: [] });
    const service = createAdminService(db.client);
    const settings = await service.settings();

    assert.deepEqual(settings.editable, [], 'nothing is editable until a store exists for it');
    assert.deepEqual(settings.capabilities, { supabase: true, serviceRole: true, aiProvider: true, rateLimitSalt: true, seedFallback: true });
    assert.equal(settings.counters.rateLimitWindowsActive, 2);
    assert.deepEqual(settings.runtime, { nodeEnvironment: 'test', hosting: 'preview', revision: 'abc1234' });

    const serialized = JSON.stringify(settings);
    for (const value of Object.values(canaries)) {
      if (value === 'true') continue;
      assert.ok(!serialized.includes(value), `${value} leaked into the settings payload`);
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('without a privileged client every module refuses before touching a query', async () => {
  const service = createAdminService(null);
  const calls: Array<() => Promise<unknown>> = [
    () => service.overview(),
    () => service.places(listQuery(), {}),
    () => service.place(PLACE_A),
    () => service.moderationQueue(listQuery()),
    () => service.reviews(listQuery(), {}),
    () => service.travelers(listQuery()),
    () => service.traveler(TRAVELER_ID),
    () => service.roster(),
    () => service.auditEvents(listQuery(), {}),
    () => service.aiOperations(),
    () => service.serviceHealth(),
    () => service.settings(),
    () => service.setPlaceModeration({ userId: ADMIN_ID, role: 'admin' }, PLACE_A, { status: 'approved', reason: null }),
    () => service.grantRole({ userId: ADMIN_ID, role: 'super_admin' }, { role: 'admin', targetUserId: TRAVELER_ID, reason: 'x' }),
  ];
  for (const call of calls) {
    await assert.rejects(call, (error: unknown) => error instanceof AdminNotConfiguredError && (error as AdminNotConfiguredError).status === 503);
  }
});

test('a degraded upstream surfaces as an error the route can translate, not as an empty list', async () => {
  const failure = { data: null, error: { message: 'connection reset', code: '08S01' } } as AdminResult;
  const builder = { then: (resolve: (value: AdminResult) => unknown) => Promise.resolve(failure).then(resolve), single: () => builder, maybeSingle: () => builder };
  const client: AdminClientLike = {
    from: () => ({ select: () => builder, update: () => builder, insert: () => builder }) as never,
    rpc: (async () => ({ data: null, error: { message: 'connection reset', code: '08S01' } })) as AdminClientLike['rpc'],
  };
  const service = createAdminService(client);
  await assert.rejects(() => service.places(listQuery(), {}));
  await assert.rejects(() => service.overview());
});

test('a malformed privilege-change target is refused before any query or RPC is issued', async () => {
  const actor = { userId: ADMIN_ID, role: 'super_admin' as const };
  for (const target of ['', '   ', 'nope', '8f14e45f-ea2a-4b1a-9d5c-2f7a1e6c3b4', "1 OR 1=1", null, undefined, 42]) {
    const db = fakeDb({ admin_accounts: [] });
    const service = createAdminService(db.client);
    await assert.rejects(
      () => service.revokeRole(actor, { targetUserId: target as string, reason: 'left the team' }),
      (error: unknown) => error instanceof DataValidationError && (error as DataValidationError & { status: number }).status === 400,
      `revoke should reject ${JSON.stringify(target)}`,
    );
    await assert.rejects(
      () => service.grantRole(actor, { role: 'admin', targetUserId: target as string, reason: 'on-call moderator' }),
      (error: unknown) => error instanceof DataValidationError && (error as DataValidationError & { status: number }).status === 400,
      `grant should reject ${JSON.stringify(target)}`,
    );
    assert.deepEqual(db.rpcs, [], 'no privileged function may run with an identifier Postgres cannot parse');
    assert.deepEqual(db.queries, [], 'validation happens before the database is asked anything');
  }
});

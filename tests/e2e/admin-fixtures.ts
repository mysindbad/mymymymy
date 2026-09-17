// Fixtures and request mocks for the Admin Control Center end-to-end tests.
//
// Why this exists: this repository's tests run without Supabase credentials, so the console is
// exercised against a mock that implements the *same* contract as server.ts: a role check per
// request, cursor-free page/limit pagination, server-side search and sorting, and mutation
// bodies validated by the same allow-lists the API uses. The catalogue rows themselves are read
// from server/data/places.json - the seed content this deployment ships - so names, regions,
// coordinates and photo hosts are real app data rather than invented demo rows. Operational
// figures (counts, telemetry) are computed from the fixture store, never typed by hand.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Route } from '@playwright/test';

export type AdminPersona = 'admin' | 'super-admin' | 'user' | 'anonymous' | 'expired' | 'unconfigured';

// Publication is decided by one implementation, shared with the API server (server/publication.ts),
// so the consumer half of the moderation tests cannot drift into agreeing with itself.
import { publishedRows, type PublicationRow } from '../../server/publication.ts';

interface SeedPlace {
  id: string;
  seed_data?: boolean;
  ownerVerified?: boolean;
  aiConfidenceScore?: number;
  name: string;
  arabicName?: string;
  frenchName?: string;
  category: string;
  subCategory?: string;
  region: string;
  area: string;
  address: string;
  coordinates: [number, number];
  photos: string[];
  description: string;
  formationInfo?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  openingHours?: string;
  contactPhone?: string;
  isUnderDocumentedGem?: boolean;
  source?: string;
  checkInsCount?: number;
  lastActivityTimestamp?: string;
  businessOwnerName?: string;
  reviews?: Array<{ id: string; authorName: string; authorRole: string; rating: number; date: string; text: string; tags?: string[] }>;
}

function seed(): SeedPlace[] {
  const file = path.join(process.cwd(), 'server', 'data', 'places.json');
  return JSON.parse(readFileSync(file, 'utf8')) as SeedPlace[];
}

const uuid = (index: number) => `0a1b2c3d-0000-4000-8000-${String(index).padStart(12, '0')}`;

const PLACE_MODERATION = ['pending', 'approved', 'needs_changes', 'rejected'] as const;
type ModerationStatus = (typeof PLACE_MODERATION)[number];

export interface FixturePlace {
  id: string;
  name: string;
  arabicName: string | null;
  frenchName: string | null;
  category: string | null;
  subCategory: string | null;
  region: string;
  area: string;
  address: string;
  description: string;
  formationInfo: string | null;
  coordinates: [number, number] | null;
  openingHours: string | null;
  priceLevel: string | null;
  contactPhone: string | null;
  businessOwnerName: string | null;
  rating: { value: number | null; reviewCount: number; provenance: string };
  seed: { isSeed: boolean; rating: number | null; reviewCount: number; source: string | null };
  checkInsCount: number;
  isUnderDocumentedGem: boolean;
  trustLevel: string;
  dataSource: string;
  source: string;
  photoProvenance: string | null;
  lastVerifiedAt: string | null;
  photos: string[];
  suppressedPhotoCount: number;
  moderation: { status: ModerationStatus; note: string | null; moderatedAt: string | null; moderatedBy: string | null };
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  lastActivityAt: string | null;
  [key: string]: unknown;
}

export interface FixtureReview {
  id: string;
  placeId: string;
  placeName: string | null;
  placeArea: string | null;
  authorName: string;
  authorRole: string;
  rating: number;
  text: string;
  tags: string[];
  photos: string[];
  suppressedPhotoCount: number;
  isSeed: boolean;
  moderation: { status: 'approved' | 'pending' | 'rejected'; note: string | null; moderatedAt: string | null };
  createdAt: string;
  updatedAt: string | null;
  [key: string]: unknown;
}

export interface FixtureAuditEvent {
  id: string;
  occurred_at: string;
  admin_label: string;
  admin_role: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  change_summary: Record<string, unknown>;
}

export interface FixtureStore {
  places: FixturePlace[];
  reviews: FixtureReview[];
  travelers: Array<{ user_id: string; display_name: string; preferred_language: string; avatar_url: string | null; last_known_location: unknown; home_location: unknown; created_at: string; updated_at: string }>;
  roster: Array<{ user_id: string; role: string; granted_by: string; granted_at: string; revoked_at: string | null; revoke_reason: string | null }>;
  audit: FixtureAuditEvent[];
  serviceEvents: Array<{ service: string; outcome: string; occurred_at: string; latency_ms: number }>;
  /** Every privileged write the UI attempted, so tests can assert on the payload the browser sent. */
  writes: Array<{ path: string; body: Record<string, unknown> }>;
  /** Every consumer catalogue read, with the rows the publication rule let through. */
  consumerReads: Array<{ viewer: string | null; ids: string[] }>;
}

const now = new Date('2026-09-17T09:00:00.000Z').getTime();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3600_000).toISOString();

export function createStore(options: { bulkPlaces?: number } = {}): FixtureStore {
  const rows = seed();
  const places: FixturePlace[] = rows.map((row, index) => {
    // A deterministic spread of moderation states so pagination and filters have something real
    // to operate on: two pending, one needs-changes, one rejected, the rest approved.
    const status: ModerationStatus = index % 5 === 1 ? 'pending' : index % 5 === 3 ? 'needs_changes' : index % 5 === 4 ? 'rejected' : 'approved';
    const liveReviews = Array.isArray(row.reviews) ? row.reviews : [];
    return {
      id: uuid(index + 1),
      name: row.name,
      arabicName: row.arabicName ?? null,
      frenchName: row.frenchName ?? null,
      category: row.category ?? null,
      subCategory: row.subCategory ?? null,
      region: row.region ?? '',
      area: row.area ?? '',
      address: row.address ?? '',
      description: row.description ?? '',
      formationInfo: row.formationInfo ?? null,
      coordinates: Array.isArray(row.coordinates) ? row.coordinates : null,
      openingHours: row.openingHours ?? null,
      priceLevel: row.priceLevel ?? null,
      contactPhone: row.contactPhone ?? null,
      businessOwnerName: row.businessOwnerName ?? null,
      rating: {
        value: liveReviews.length ? Number((liveReviews.reduce((sum, item) => sum + item.rating, 0) / liveReviews.length).toFixed(2)) : null,
        reviewCount: liveReviews.length,
        provenance: liveReviews.length ? 'traveler_reviews' : 'unrated',
      },
      seed: {
        isSeed: Boolean(row.seed_data),
        rating: row.seed_data ? (row.rating ?? null) : null,
        reviewCount: row.seed_data ? (row.reviewCount ?? 0) : 0,
        source: row.seed_data ? 'curated_seed_v1' : null,
      },
      checkInsCount: row.checkInsCount ?? 0,
      isUnderDocumentedGem: Boolean(row.isUnderDocumentedGem),
      trustLevel: row.ownerVerified ? 'official' : 'community',
      dataSource: row.seed_data ? 'curated' : 'community_submission',
      source: row.source ?? 'community_traveler',
      photoProvenance: row.photos?.length ? 'unsplash_licensed' : null,
      lastVerifiedAt: index % 3 === 0 ? iso(24 * 12) : null,
      photos: row.photos ?? [],
      suppressedPhotoCount: 0,
      moderation: {
        status,
        note: status === 'needs_changes' ? 'Coordinates land in the river instead of the trailhead.' : null,
        moderatedAt: status === 'pending' ? null : iso(12 + index),
        moderatedBy: status === 'pending' ? null : uuid(99),
      },
      submittedBy: index % 2 === 1 ? uuid(200 + index) : null,
      createdAt: iso(6 + index * 30),
      updatedAt: index % 4 === 0 ? iso(2 + index) : null,
      lastActivityAt: row.lastActivityTimestamp ?? null,
    };
  });

  const reviews: FixtureReview[] = places.flatMap((place, placeIndex) => {
    const source = rows[placeIndex]?.reviews ?? [];
    return source.map((review, index) => ({
      id: uuid(placeIndex * 10 + index + 500),
      placeId: place.id,
      placeName: place.name,
      placeArea: place.area,
      authorName: review.authorName ?? 'Traveller',
      authorRole: review.authorRole ?? 'traveler',
      rating: Number(review.rating ?? 0),
      text: review.text ?? '',
      tags: review.tags ?? [],
      photos: [],
      suppressedPhotoCount: 0,
      isSeed: false,
      moderation: {
        status: index === 0 && placeIndex === 1 ? 'pending' : 'approved',
        note: null,
        moderatedAt: iso(40 + index),
      },
      createdAt: review.date ? new Date(review.date).toISOString() : iso(80),
      updatedAt: null,
    }));
  });

  const travelers = places.slice(0, 6).map((place, index) => ({
    user_id: place.submittedBy ?? uuid(300 + index),
    display_name: ['Yassine B.', 'Amina Ouazzani', 'Fernand Klein', null, 'Salma T.', 'Ivan P.'][index] as string | null,
    preferred_language: ['ar', 'fr', 'ar', 'en', 'ar', 'fr'][index] as string,
    avatar_url: index % 2 === 0 ? 'https://i.pravatar.cc/120' : null,
    last_known_location: index % 3 === 0 ? { lat: 35.75, lng: -5.83 } : null,
    home_location: index % 4 === 0 ? { lat: 31.63, lng: -7.99 } : null,
    created_at: iso(24 * (20 - index)),
    updated_at: index % 2 === 0 ? iso(30 + index) : null,
  }));

  const store: FixtureStore = {
    places,
    reviews,
    travelers,
    roster: [
      { user_id: uuid(99), role: 'super_admin', granted_by: uuid(99), granted_at: iso(24 * 90), revoked_at: null, revoke_reason: null },
      { user_id: uuid(98), role: 'admin', granted_by: uuid(99), granted_at: iso(24 * 12), revoked_at: null, revoke_reason: null },
      { user_id: uuid(97), role: 'admin', granted_by: uuid(99), granted_at: iso(24 * 5), revoked_at: iso(24 * 2), revoke_reason: 'left the moderation rota' },
    ],
    audit: [
      {
        id: 'evt-1',
        occurred_at: iso(3),
        admin_label: 'moderator@mysindbad.test',
        admin_role: 'admin',
        action: 'place_moderation_updated',
        target_type: 'place',
        target_id: places[0].id,
        reason: 'Confirmed against the park authority page.',
        change_summary: { from: 'pending', to: 'approved', name: places[0].name },
      },
      {
        id: 'evt-2',
        occurred_at: iso(9),
        admin_label: 'lead@mysindbad.test',
        admin_role: 'super_admin',
        action: 'role_granted',
        target_type: 'admin_role',
        target_id: uuid(98),
        reason: 'Weekly rota coverage for the northern region.',
        change_summary: { role: 'admin' },
      },
    ],
    serviceEvents: [
      { service: 'weather', outcome: 'ok', occurred_at: iso(1), latency_ms: 220 },
      { service: 'weather', outcome: 'ok', occurred_at: iso(2), latency_ms: 310 },
      { service: 'tiles', outcome: 'error', occurred_at: iso(3), latency_ms: 4100 },
      { service: 'tiles', outcome: 'ok', occurred_at: iso(4), latency_ms: 900 },
      { service: 'place_discovery', outcome: 'ok', occurred_at: iso(5), latency_ms: 640 },
      { service: 'ai', outcome: 'ok', occurred_at: iso(6), latency_ms: 1450 },
      { service: 'ai', outcome: 'unavailable', occurred_at: iso(7), latency_ms: 300 },
    ],
    writes: [],
    consumerReads: [],
  };

  // A grid is only worth paginating if there is something to paginate. The bulk fill repeats the
  // shipped catalogue under fresh ids so page 2, page 3 and the "Rows x-y of z" arithmetic are
  // exercised against records with a real shape. This is fixture volume, not invented operations
  // data: nothing here pretends to be a metric or a trend.
  const baseCount = store.places.length;
  for (let index = 0; index < (options.bulkPlaces ?? 0); index += 1) {
    const base = store.places[index % baseCount];
    store.places.push({
      ...base,
      id: uuid(500 + index),
      name: `${base.name} (bulk ${index + 1})`,
      moderation: { ...base.moderation },
      rating: { ...base.rating },
      seed: { ...base.seed },
    });
  }


  return store;
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

function matchesSearch(place: FixturePlace, term: string) {
  if (!term) return true;
  const needle = term.toLowerCase();
  return [place.name, place.arabicName, place.frenchName, place.area, place.region, place.subCategory, place.description]
    .some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

function sortPlaces(rows: FixturePlace[], sort: string, dir: string) {
  const direction = dir === 'asc' ? 1 : -1;
  const key = (place: FixturePlace): number | string => {
    switch (sort) {
      case 'name': return place.name.toLowerCase();
      case 'review_count': return place.rating.reviewCount;
      case 'check_ins_count': return place.checkInsCount;
      case 'rating': return place.rating.value ?? -1;
      case 'updated_at': return place.updatedAt ? Date.parse(place.updatedAt) : 0;
      case 'moderated_at': return place.moderation.moderatedAt ? Date.parse(place.moderation.moderatedAt) : 0;
      default: return Date.parse(place.createdAt);
    }
  };
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (typeof left === 'string' || typeof right === 'string') return String(left).localeCompare(String(right)) * direction;
    return (left - right) * direction;
  });
}

function snapshot(store: FixtureStore) {
  const places = store.places;
  const byModeration = PLACE_MODERATION.reduce<Record<string, number>>((accumulator, status) => {
    accumulator[status] = places.filter((place) => place.moderation.status === status).length;
    return accumulator;
  }, {});
  const distribution = (pick: (place: FixturePlace) => string | null) => {
    const counts = new Map<string, number>();
    places.forEach((place) => {
      const key = pick(place) || '—';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
  };
  return {
    generated_at: new Date(now).toISOString(),
    places: {
      total: places.length,
      by_moderation: byModeration,
      by_category: distribution((place) => place.category),
      by_source: distribution((place) => place.source),
      top_regions: distribution((place) => place.region).slice(0, 6),
      with_live_rating: places.filter((place) => place.rating.reviewCount > 0).length,
      unrated: places.filter((place) => place.rating.reviewCount === 0).length,
      hidden_gems: places.filter((place) => place.isUnderDocumentedGem).length,
      officially_verified: places.filter((place) => place.trustLevel === 'official').length,
      created_last_24h: places.filter((place) => now - Date.parse(place.createdAt) < 24 * 3600_000).length,
      modified_last_24h: places.filter((place) => place.updatedAt && now - Date.parse(place.updatedAt) < 24 * 3600_000).length,
    },
    reviews: {
      live_total: store.reviews.filter((review) => !review.isSeed).length,
      approved: store.reviews.filter((review) => review.moderation.status === 'approved').length,
      pending: store.reviews.filter((review) => review.moderation.status === 'pending').length,
      rejected: store.reviews.filter((review) => review.moderation.status === 'rejected').length,
      last_24h: store.reviews.filter((review) => now - Date.parse(review.createdAt) < 24 * 3600_000).length,
    },
    checkins: { total: places.reduce((sum, place) => sum + place.checkInsCount, 0), last_7d: 0 },
    traces: { last_7d: 0 },
    trips: { total: 0, by_status: {}, created_last_7d: 0 },
    travelers: {
      profiles_total: store.travelers.length,
      created_last_7d: store.travelers.filter((row) => now - Date.parse(row.created_at) < 7 * 24 * 3600_000).length,
      with_language_preference: store.travelers.filter((row) => Boolean(row.preferred_language)).length,
    },
    moderators: {
      active_total: store.roster.filter((row) => !row.revoked_at).length,
      super_admins: store.roster.filter((row) => !row.revoked_at && row.role === 'super_admin').length,
    },
    ai: { last_24h: 0, by_endpoint: {} },
    services: {
      last_24h: store.serviceEvents.length,
      problems_last_24h: store.serviceEvents.filter((event) => event.outcome !== 'ok').length,
      by_service: [...new Set(store.serviceEvents.map((event) => event.service))].map((service) => ({
        service,
        ok: store.serviceEvents.filter((event) => event.service === service && event.outcome === 'ok').length,
        failed: store.serviceEvents.filter((event) => event.service === service && event.outcome !== 'ok').length,
      })),
      last_problem_at: store.serviceEvents.filter((event) => event.outcome !== 'ok').map((event) => event.occurred_at).sort().reverse()[0] ?? null,
    },
    audit: { last_24h: store.audit.length, last_event_at: store.audit[0]?.occurred_at ?? null },
  };
}

/**
 * Installs the admin API mock on a browser context. The persona decides what the "server"
 * answers: an administrator gets data, a signed-in non-administrator gets 403, a signed-out
 * visitor gets 401, an expired token gets 401, and `unconfigured` reproduces a deployment
 * without service credentials (503).
 */
export async function mockAdminApi(context: BrowserContext, persona: AdminPersona = 'admin', store = createStore()) {
  const roleFor = () => (persona === 'admin' ? 'admin' : persona === 'super-admin' ? 'super_admin' : null);

  const authorized = () => {
    if (persona === 'anonymous') return { status: 401, code: 'ADMIN_AUTH_REQUIRED', error: 'A signed-in session is required' };
    if (persona === 'expired') return { status: 401, code: 'ADMIN_AUTH_REQUIRED', error: 'Your session is no longer valid' };
    if (persona === 'unconfigured') return { status: 503, code: 'ADMIN_NOT_CONFIGURED', error: 'Admin data service is not configured' };
    if (!roleFor()) return { status: 403, code: 'ADMIN_NOT_AUTHORIZED', error: 'This account is not an administrator' };
    return null;
  };

  await context.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const segments = url.pathname.replace('/api/admin', '').split('/').filter(Boolean);
    const method = request.method();
    const body: Record<string, unknown> = request.postData() ? JSON.parse(request.postData() as string) : {};

    if (segments[0] === 'session') {
      if (persona === 'anonymous') return json(route, { status: 'anonymous', isConfigured: true });
      if (persona === 'expired') return json(route, { status: 'granted', role: 'admin', isConfigured: true });
      if (persona === 'unconfigured') return json(route, { status: 'unavailable', isConfigured: false });
      const role = roleFor();
      if (!role) return json(route, { status: 'denied', isConfigured: true });
      return json(route, { status: 'granted', role, isConfigured: true });
    }

    const refusal = authorized();
    if (refusal) return json(route, refusal, refusal.status);

    const query = Object.fromEntries(url.searchParams.entries());
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize ?? 25) || 25));
    const pageSlice = <T,>(rows: T[]) => ({
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      total: rows.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(rows.length / pageSize)),
    });

    if (segments.length === 1 && segments[0] === 'overview' && method === 'GET') {
      return json(route, {
        overview: {
          snapshot: snapshot(store),
          databaseLatencyMs: 7,
          recentActions: store.audit.slice(0, 8).map(toAuditRow),
        },
      });
    }

    if (segments[0] === 'places' && segments.length === 1 && method === 'GET') {
      let rows = store.places.filter((place) => matchesSearch(place, query.q ?? ''));
      if (query.status) rows = rows.filter((place) => place.moderation.status === query.status);
      if (query.category) rows = rows.filter((place) => place.category === query.category);
      if (query.region) rows = rows.filter((place) => place.region.toLowerCase().includes(query.region.toLowerCase()));
      if (query.source) rows = rows.filter((place) => place.source === query.source);
      if (query.gem === 'true') rows = rows.filter((place) => place.isUnderDocumentedGem);
      rows = sortPlaces(rows, query.sort ?? 'created_at', query.dir ?? 'desc');
      return json(route, pageSlice(rows));
    }

    if (segments[0] === 'places' && segments.length === 2 && method === 'GET') {
      const place = store.places.find((row) => row.id === segments[1]);
      if (!place) return json(route, { error: 'place not found', code: 'ADMIN_PLACE_NOT_FOUND' }, 404);
      return json(route, {
        detail: {
          place: toPlaceRow(place),
          reviews: store.reviews.filter((review) => review.placeId === place.id).map(toReviewRow),
          duplicateCandidates: store.places
            .filter((candidate) => candidate.id !== place.id && candidate.region === place.region)
            .slice(0, 2)
            .map((candidate, index) => ({
              id: candidate.id,
              name: candidate.name,
              area: candidate.area,
              category: candidate.category,
              moderationStatus: candidate.moderation.status,
              distanceMeters: 180 + index * 90,
              similarity: index === 0 ? 0.71 : 0.24,
              likely: index === 0,
            })),
          history: store.audit.filter((event) => event.target_id === place.id).map(toAuditRow),
        },
      });
    }

    if (segments[0] === 'places' && segments.length === 3 && segments[2] === 'moderation' && method === 'POST') {
      const place = store.places.find((row) => row.id === segments[1]);
      if (!place) return json(route, { error: 'place not found', code: 'ADMIN_PLACE_NOT_FOUND' }, 404);
      const allowed = ['pending', 'approved', 'needs_changes', 'rejected'];
      const status = String(body.status ?? '');
      if (!allowed.includes(status)) return json(route, { error: 'status must be one of: ' + allowed.join(', '), code: 'ADMIN_VALIDATION_FAILED' }, 400);
      if ((status === 'rejected' || status === 'needs_changes') && !String(body.reason ?? '').trim()) {
        return json(route, { error: 'a reason is required for this decision', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      }
      store.writes.push({ path: url.pathname, body });
      place.moderation = { status: status as ModerationStatus, note: body.reason ? String(body.reason) : null, moderatedAt: new Date().toISOString(), moderatedBy: uuid(99) };
      store.audit.unshift({
        id: `evt-${store.audit.length + 1}`,
        occurred_at: new Date().toISOString(),
        admin_label: 'e2e-admin@mysindbad.test',
        admin_role: roleFor() ?? 'admin',
        action: 'place_moderation_updated',
        target_type: 'place',
        target_id: place.id,
        reason: body.reason ? String(body.reason) : null,
        change_summary: { name: place.name },
      });
      return json(route, { moderation: { id: place.id, name: place.name, moderationStatus: place.moderation.status, moderatedAt: place.moderation.moderatedAt }, changedFields: ['moderation_status'], actorRole: roleFor() });
    }

    if (segments[0] === 'places' && segments.length === 2 && method === 'PATCH') {
      const place = store.places.find((row) => row.id === segments[1]);
      if (!place) return json(route, { error: 'place not found', code: 'ADMIN_PLACE_NOT_FOUND' }, 404);
      const forbidden = ['rating', 'review_count', 'seed_data', 'is_under_documented_gem', 'moderation_status', 'coordinates', 'photos'];
      const illegal = Object.keys(body).filter((key) => key !== 'reason' && (forbidden.includes(key) || !CURATION_ALLOW_LIST.includes(key)));
      if (illegal.length > 0) {
        return json(route, { error: `${illegal[0]} is not a curatable field`, code: 'ADMIN_VALIDATION_FAILED' }, 400);
      }
      const keys = Object.keys(body).filter((key) => key !== 'reason');
      if (keys.length === 0) return json(route, { error: 'no curation fields were supplied', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      for (const key of keys) {
        const value = body[key];
        if (typeof value !== 'string') return json(route, { error: `${key} must be text`, code: 'ADMIN_VALIDATION_FAILED' }, 400);
        if (value.trim() === '' && REQUIRED_CURATION.includes(key)) return json(route, { error: `${key} cannot be empty`, code: 'ADMIN_VALIDATION_FAILED' }, 400);
      }
      store.writes.push({ path: url.pathname, body });
      keys.forEach((key) => {
        const value = String(body[key]);
        if (key === 'name') place.name = value;
        if (key === 'arabic_name') place.arabicName = value || null;
        if (key === 'french_name') place.frenchName = value || null;
        if (key === 'description') place.description = value;
        if (key === 'region') place.region = value;
        if (key === 'area') place.area = value;
        if (key === 'address') place.address = value;
        if (key === 'sub_category') place.subCategory = value || null;
        if (key === 'opening_hours') place.openingHours = value || null;
        if (key === 'contact_phone') place.contactPhone = value || null;
        if (key === 'formation_info') place.formationInfo = value || null;
        if (key === 'category') place.category = value;
        if (key === 'price_level') place.priceLevel = value || null;
        if (key === 'trust_level') place.trustLevel = value;
      });
      place.updatedAt = new Date().toISOString();
      store.audit.unshift({
        id: `evt-${store.audit.length + 1}`,
        occurred_at: place.updatedAt,
        admin_label: 'e2e-admin@mysindbad.test',
        admin_role: roleFor() ?? 'admin',
        action: 'place_curated',
        target_type: 'place',
        target_id: place.id,
        reason: body.reason ? String(body.reason) : null,
        change_summary: { changed: keys.sort().join(',') },
      });
      return json(route, { updated: { id: place.id, name: place.name, updatedAt: place.updatedAt }, changedFields: keys.sort(), actorRole: roleFor() });
    }

    if (segments[0] === 'moderation' && segments[1] === 'queue' && method === 'GET') {
      let rows = store.places.filter((place) => place.moderation.status === 'pending' || place.moderation.status === 'needs_changes');
      if (query.q) rows = rows.filter((place) => matchesSearch(place, String(query.q)));
      rows = sortPlaces(rows, query.sort ?? 'created_at', query.dir ?? 'desc');
      return json(route, {
        queue: {
          ...pageSlice(rows),
          queueCounts: [
            { status: 'pending', total: store.places.filter((place) => place.moderation.status === 'pending').length },
            { status: 'needs_changes', total: store.places.filter((place) => place.moderation.status === 'needs_changes').length },
          ],
          waitingTotal: rows.length,
        },
      });
    }

    if (segments[0] === 'reviews' && segments.length === 1 && method === 'GET') {
      let rows = store.reviews;
      if (query.status) rows = rows.filter((review) => review.moderation.status === query.status);
      if (query.q) {
        const needle = String(query.q).toLowerCase();
        rows = rows.filter((review) => review.text.toLowerCase().includes(needle) || review.authorName.toLowerCase().includes(needle));
      }
      rows = [...rows].sort((a, b) => (query.dir === 'asc' ? 1 : -1) * (Date.parse(a.createdAt) - Date.parse(b.createdAt)));
      return json(route, pageSlice(rows));
    }

    if (segments[0] === 'reviews' && segments.length === 3 && segments[2] === 'moderation' && method === 'POST') {
      const review = store.reviews.find((row) => row.id === segments[1]);
      if (!review) return json(route, { error: 'review not found', code: 'ADMIN_REVIEW_NOT_FOUND' }, 404);
      const status = String(body.status ?? '');
      if (!['approved', 'pending', 'rejected'].includes(status)) return json(route, { error: 'invalid status', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      store.writes.push({ path: url.pathname, body });
      review.moderation.status = status as 'approved' | 'pending' | 'rejected';
      review.moderation.note = body.reason ? String(body.reason) : null;
      const place = store.places.find((row) => row.id === review.placeId);
      const aggregate = recomputeAggregate(store, review.placeId);
      store.audit.unshift({
        id: `evt-${store.audit.length + 1}`,
        occurred_at: new Date().toISOString(),
        admin_label: 'e2e-admin@mysindbad.test',
        admin_role: roleFor() ?? 'admin',
        action: 'review_moderation_updated',
        target_type: 'review',
        target_id: review.id,
        reason: body.reason ? String(body.reason) : null,
        change_summary: { placeId: review.placeId, status },
      });
      return json(route, {
        moderation: { id: review.id, placeId: review.placeId, moderationStatus: status, placeRating: aggregate.rating, placeReviewCount: aggregate.reviewCount },
        actorRole: roleFor(),
      });
      void place;
    }

    if (segments[0] === 'travelers' && segments.length === 1 && method === 'GET') {
      let rows = store.travelers;
      if (query.q) {
        const needle = String(query.q).toLowerCase();
        rows = rows.filter((row) => (row.display_name ?? '').toLowerCase().includes(needle));
      }
      const sorted = [...rows].sort((a, b) => (query.dir === 'asc' ? 1 : -1) * (Date.parse(a.created_at) - Date.parse(b.created_at)));
      return json(route, {
        ...pageSlice(sorted),
        rows: pageSlice(sorted).rows.map((row) => ({
          userId: row.user_id,
          displayName: row.display_name,
          preferredLanguage: row.preferred_language,
          hasAvatar: Boolean(row.avatar_url),
          hasLocationOnFile: Boolean(row.last_known_location),
          hasHomeLocationOnFile: Boolean(row.home_location),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          adminRole: store.roster.find((entry) => entry.user_id === row.user_id && !entry.revoked_at)?.role ?? null,
          grantedAt: store.roster.find((entry) => entry.user_id === row.user_id && !entry.revoked_at)?.granted_at ?? null,
        })),
      });
    }

    if (segments[0] === 'travelers' && segments.length === 2 && method === 'GET') {
      const profile = store.travelers.find((row) => row.user_id === segments[1]);
      if (!profile) return json(route, { error: 'account not found', code: 'ADMIN_TRAVELER_NOT_FOUND' }, 404);
      const admin = store.roster.find((entry) => entry.user_id === profile.user_id && !entry.revoked_at);
      return json(route, {
        traveler: {
          profile: {
            userId: profile.user_id,
            displayName: profile.display_name,
            preferredLanguage: profile.preferred_language,
            hasAvatar: Boolean(profile.avatar_url),
            hasLocationOnFile: Boolean(profile.last_known_location),
            hasHomeLocationOnFile: Boolean(profile.home_location),
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          },
          admin: admin ? { role: admin.role, grantedAt: admin.granted_at, grantedBy: admin.granted_by } : null,
          activity: {
            placesSubmitted: store.places.filter((place) => place.submittedBy === profile.user_id).length,
            reviewsWritten: store.reviews.filter((review) => review.authorName === profile.display_name).length,
            tripsCreated: 0,
          },
        },
      });
    }

    if (segments[0] === 'administrators' && segments.length === 1 && method === 'GET') {
      return json(route, {
        rows: store.roster.filter((entry) => !entry.revoked_at).map((entry) => ({
          userId: entry.user_id,
          displayName: store.travelers.find((row) => row.user_id === entry.user_id)?.display_name ?? null,
          role: entry.role,
          grantedAt: entry.granted_at,
          grantedBy: entry.granted_by,
        })),
      });
    }

    if (segments[0] === 'administrators' && segments[1] === 'grant' && method === 'POST') {
      if (roleFor() !== 'super_admin') return json(route, { error: 'Super administrator authorization required', code: 'SUPER_ADMIN_REQUIRED' }, 403);
      const reason = String(body.reason ?? '').trim();
      const targetUserId = String(body.user_id ?? '');
      if (!reason) return json(route, { error: 'a reason is required to change administrator access', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      if (!/^[0-9a-f-]{36}$/i.test(targetUserId)) return json(route, { error: 'target account must be an identifier', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      if (!['admin', 'super_admin'].includes(String(body.role))) return json(route, { error: 'role must be one of: admin, super_admin', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      store.writes.push({ path: url.pathname, body });
      store.roster.unshift({ user_id: targetUserId, role: String(body.role), granted_by: uuid(99), granted_at: new Date().toISOString(), revoked_at: null, revoke_reason: null });
      store.audit.unshift({
        id: `evt-${store.audit.length + 1}`,
        occurred_at: new Date().toISOString(),
        admin_label: 'e2e-admin@mysindbad.test',
        admin_role: 'super_admin',
        action: 'role_granted',
        target_type: 'admin_role',
        target_id: targetUserId,
        reason,
        change_summary: { role: String(body.role) },
      });
      return json(route, { grant: { userId: targetUserId, role: String(body.role) }, actorRole: 'super_admin' });
    }

    if (segments[0] === 'administrators' && segments[1] === 'revoke' && method === 'POST') {
      if (roleFor() !== 'super_admin') return json(route, { error: 'Super administrator authorization required', code: 'SUPER_ADMIN_REQUIRED' }, 403);
      const reason = String(body.reason ?? '').trim();
      const targetUserId = String(body.user_id ?? '');
      if (!reason) return json(route, { error: 'a reason is required to change administrator access', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      const entry = store.roster.find((row) => row.user_id === targetUserId && !row.revoked_at);
      if (!entry) return json(route, { error: 'that account is not an active administrator', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      const superAdmins = store.roster.filter((row) => !row.revoked_at && row.role === 'super_admin');
      if (entry.role === 'super_admin' && superAdmins.length <= 1) {
        return json(route, { error: 'the last super administrator cannot be revoked', code: 'ADMIN_VALIDATION_FAILED' }, 400);
      }
      store.writes.push({ path: url.pathname, body });
      entry.revoked_at = new Date().toISOString();
      entry.revoke_reason = reason;
      return json(route, { revoke: { userId: targetUserId, revoked: true }, actorRole: 'super_admin' });
    }

    if (segments[0] === 'audit-events' && method === 'GET') {
      let rows = store.audit;
      if (query.targetType) rows = rows.filter((event) => event.target_type === query.targetType);
      if (query.targetId) rows = rows.filter((event) => event.target_id === query.targetId);
      if (query.action) rows = rows.filter((event) => event.action.includes(String(query.action)));
      return json(route, { ...pageSlice(rows), rows: pageSlice(rows).rows.map(toAuditRow) });
    }

    if (segments[0] === 'service-health' && segments.length === 1 && method === 'GET') {
      const grouped = new Map<string, { ok: number; failed: number; latencies: number[]; lastProblemAt: string | null }>();
      store.serviceEvents.forEach((event) => {
        const entry = grouped.get(event.service) ?? { ok: 0, failed: 0, latencies: [], lastProblemAt: null };
        if (event.outcome === 'ok') { entry.ok += 1; entry.latencies.push(event.latency_ms); } else { entry.failed += 1; entry.lastProblemAt = event.occurred_at; }
        grouped.set(event.service, entry);
      });
      return json(route, {
        health: {
          services: ['weather', 'tiles', 'place_discovery'].map((service) => {
            const entry = grouped.get(service) ?? { ok: 0, failed: 0, latencies: [], lastProblemAt: null };
            const total = entry.ok + entry.failed;
            return {
              key: service,
              status: total === 0 ? 'unknown' : entry.failed === 0 ? 'healthy' : entry.failed / total > 0.5 ? 'unavailable' : 'degraded',
              latencyMs: entry.latencies.length ? entry.latencies.sort((a, b) => a - b)[Math.floor(entry.latencies.length / 2)] : null,
              checkedAt: new Date(now).toISOString(),
              source: 'observed-request',
              detail: total === 0 ? 'no request recorded' : `${entry.failed} failed of ${total}`,
              ok: entry.ok,
              failed: entry.failed,
              lastProblemAt: entry.lastProblemAt,
            };
          }),
          telemetryRows: store.serviceEvents.length,
          window: '24h',
          generatedAt: new Date(now).toISOString(),
        },
        configuration: { aiProvider: true, database: true },
      });
    }

    if (segments[0] === 'service-health' && segments[1] === 'probes' && method === 'POST') {
      return json(route, {
        probes: {
          services: [
            { key: 'database', status: 'healthy', latencyMs: 12, checkedAt: new Date().toISOString(), source: 'live-probe', detail: 'counted places in 12 ms' },
            { key: 'weather', status: 'healthy', latencyMs: 190, checkedAt: new Date().toISOString(), source: 'live-probe', detail: 'upstream answered 200' },
            { key: 'tiles', status: 'degraded', latencyMs: 2400, checkedAt: new Date().toISOString(), source: 'live-probe', detail: 'primary slow, backup answered' },
          ],
          checkedAt: new Date().toISOString(),
        },
      });
    }

    if (segments[0] === 'ai-operations' && method === 'GET') {
      return json(route, {
        usage: {
          total7d: 3,
          last24h: 1,
          perDay: Array.from({ length: 14 }).map((_, index) => ({ date: new Date(now - index * 86400000).toISOString().slice(0, 10), count: index === 2 ? 2 : index === 5 ? 1 : 0 })).reverse(),
          byEndpoint: [{ endpoint: 'chat', count: 2 }, { endpoint: 'plan_trip', count: 1 }],
        },
        outcomes: { total: 2, ok: 1, failed: 1, p50LatencyMs: 900, p95LatencyMs: 1450 },
        configuration: { provider: 'gemini', model: 'gemini-3.8-flash', keyConfigured: true },
      });
    }

    if (segments[0] === 'settings' && method === 'GET') {
      return json(route, {
        settings: {
          runtime: { nodeEnvironment: 'test', hosting: 'e2e', revision: 'e2efixture' },
          capabilities: { supabase: true, serviceRole: true, aiProvider: true, rateLimitSalt: true, seedFallback: false },
          counters: { rateLimitWindowsActive: 3, aiRequestsLastHour: 1 },
          editable: [],
        },
        role: roleFor() === 'super_admin' ? 'super_admin' : 'admin',
      });
    }

    return json(route, { error: 'Unknown admin route', code: 'ADMIN_NOT_FOUND' }, 404);
  });

  await context.route('**/api/health', (route) => json(route, { status: 'ok', time: new Date(now).toISOString(), revision: 'e2efixture' }));

  return store;
}

const CURATION_ALLOW_LIST = [
  'name', 'description', 'region', 'area', 'address', 'arabic_name', 'french_name',
  'formation_info', 'sub_category', 'opening_hours', 'contact_phone', 'category', 'price_level', 'trust_level',
];
const REQUIRED_CURATION = ['name', 'description', 'region', 'area', 'address'];

function toPlaceRow(place: FixturePlace) {
  return { ...place };
}

function toReviewRow(review: FixtureReview) {
  return { ...review };
}

function toAuditRow(event: FixtureAuditEvent) {
  return {
    id: event.id,
    occurredAt: event.occurred_at,
    adminLabel: event.admin_label,
    adminRole: event.admin_role,
    action: event.action,
    targetType: event.target_type,
    targetId: event.target_id,
    reason: event.reason,
    changeSummary: event.change_summary,
  };
}

function recomputeAggregate(store: FixtureStore, placeId: string) {
  const approved = store.reviews.filter((review) => review.placeId === placeId && review.moderation.status === 'approved' && !review.isSeed);
  const place = store.places.find((row) => row.id === placeId);
  if (place) {
    place.rating = {
      value: approved.length ? Number((approved.reduce((sum, review) => sum + review.rating, 0) / approved.length).toFixed(2)) : null,
      reviewCount: approved.length,
      provenance: approved.length ? 'traveler_reviews' : 'unrated',
    };
  }
  return { rating: place?.rating.value ?? null, reviewCount: approved.length };
}

/**
 * The traveller-facing catalogue read, served from the same store the console mutates.
 *
 * `GET /api/places?viewer=<user id>` answers with what the app would publish right now: rows the
 * publication rule considers live, plus a signed-in author's own queued submission. The rule is the
 * one `server/dal.ts` and the row-security policies use, applied to the fixture rows here - so a
 * moderation decision made in the console changes this response in the same page session.
 */
export async function mockConsumerPlaces(context: BrowserContext, store: FixtureStore) {
  await context.route('**/api/places*', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.fallback();
    const url = new URL(request.url());
    if (!/^\/api\/places\/?$/.test(url.pathname)) return route.fallback();
    const viewer = url.searchParams.get('viewer');
    // The fixture rows are re-shaped into the columns the rule reads, exactly as the table has them.
    const rows: Array<FixturePlace & PublicationRow> = store.places.map((place) => Object.assign({}, place, {
      moderation_status: place.moderation.status,
      created_by_user_id: place.submittedBy,
      author_user_id: null,
    }));
    const visible = publishedRows(rows, viewer).map((place) => ({
      id: place.id,
      name: place.name,
      moderationStatus: place.moderation.status,
      published: place.moderation.status === 'approved',
    }));
    store.consumerReads.push({ viewer: viewer ?? null, ids: visible.map((place) => place.id) });
    return json(route, { places: visible, total: visible.length });
  });
}

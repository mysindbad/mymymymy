// My Sindbad — Admin Control Center, server side.
//
// This module is the only place administrative authority is decided. The browser is
// never trusted with a role: every privileged request re-resolves the caller against
// the admin_accounts roster (a database fact, revoked instantly), and every privileged
// write is executed by a SECURITY DEFINER function that re-checks the same thing. If
// this file were deleted, the database would still refuse the mutation.
//
// It is deliberately free of Express types so the whole surface can be unit-tested
// with a stubbed PostgREST client, and so nothing here can reach the browser bundle.

import { DalAuthenticationError, DalAuthorizationError, DalServiceUnavailableError, DataValidationError, throwMappedSupabaseError } from './dal.ts';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const ADMIN_ROLES = ['admin', 'super_admin'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PLACE_MODERATION_STATUSES = ['pending', 'approved', 'needs_changes', 'rejected'] as const;
export type PlaceModerationStatus = (typeof PLACE_MODERATION_STATUSES)[number];

export const REVIEW_MODERATION_STATUSES = ['approved', 'pending', 'rejected'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export const PLACE_CATEGORIES = ['accommodation', 'tourist_poi', 'restaurant', 'emergency', 'campsite', 'service'] as const;
export const PLACE_TRUST_LEVELS = ['unverified', 'community', 'external', 'official'] as const;
export const PRICE_LEVELS = ['$', '$$', '$$$', '$$$$'] as const;

/** A status that must say why, so a submitter is never rejected silently. */
export const PLACE_STATUSES_REQUIRING_REASON: readonly PlaceModerationStatus[] = ['rejected', 'needs_changes'];

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const PLACE_LIST_SORTS = ['created_at', 'updated_at', 'name', 'review_count', 'check_ins_count', 'rating', 'moderated_at'] as const;
export const REVIEW_LIST_SORTS = ['date', 'updated_at', 'rating', 'moderated_at'] as const;
export const TRAVELER_LIST_SORTS = ['created_at', 'display_name', 'updated_at'] as const;
export const AUDIT_LIST_SORTS = ['occurred_at'] as const;

export class AdminNotFoundError extends Error {
  status = 404;
  code = 'NOT_FOUND';
  constructor(message = 'The record no longer exists') {
    super(message);
    this.name = 'AdminNotFoundError';
  }
}

/** Raised when a mutation is valid but this deployment cannot execute it. */
export class AdminNotConfiguredError extends Error {
  status = 503;
  code = 'ADMIN_BACKEND_UNAVAILABLE';
  ar = 'لا يمكن الوصول إلى بيانات الإدارة حالياً';
  constructor() {
    super('Admin data service is not configured for this deployment');
    this.name = 'AdminNotConfiguredError';
  }
}

// ---------------------------------------------------------------------------
// Input parsing. Every value that arrives from a query string or a body goes
// through one of these, so a hand-crafted request cannot smuggle an operator,
// an unbounded page, a free-form order column, or a PostgREST filter character.
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function requireUuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new DataValidationError(`${field} must be a valid identifier`);
  return value;
}

function asRaw(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function textParam(raw: unknown, maxLength = 160): string {
  const value = asRaw(raw);
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function intParam(raw: unknown, options: { fallback: number; min: number; max: number }): number {
  const value = asRaw(raw);
  if (value === undefined || value === null || value === '') return options.fallback;
  const parsed = Number(value);
  // This helper only reads list parameters. A malformed page or size in a pasted URL has to
  // fall back to the default rather than turn the whole table into an error page, and it can
  // never smuggle anything: the value is clamped and only ever used for limit/offset.
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return options.fallback;
  return Math.min(options.max, Math.max(options.min, parsed));
}

export function enumParam<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const value = textParam(raw, 40).toLowerCase();
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function sortParam(raw: unknown, allowed: readonly string[], fallback: string): { sort: string; dir: 'asc' | 'desc' } {
  const sort = textParam(raw, 40);
  const direction = textParam(raw === undefined ? '' : undefined, 4);
  return {
    sort: (allowed as readonly string[]).includes(sort) ? sort : fallback,
    dir: direction === 'asc' ? 'asc' : 'desc',
  };
}

/** Characters PostgREST uses inside `or=(...)` filter expressions. */
function escapeFilterTerm(value: string): string {
  return value.replace(/[,%()"']/g, ' ').trim();
}

export type ListQuery = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
  sort: string;
  dir: 'asc' | 'desc';
  search: string;
};

export function parseListQuery(
  query: Record<string, unknown>,
  options: { sorts: readonly string[]; defaultSort: string },
): ListQuery {
  const pageSizeRaw = intParam(query.pageSize, { fallback: DEFAULT_PAGE_SIZE, min: 1, max: MAX_PAGE_SIZE });
  const pageSize = PAGE_SIZES.reduce((best, size) => (Math.abs(size - pageSizeRaw) < Math.abs(best - pageSizeRaw) ? size : best), PAGE_SIZES[0]);
  const page = intParam(query.page, { fallback: 1, min: 1, max: 10_000 });
  const { sort, dir } = sortDirection(query, options);
  return {
    page,
    pageSize,
    from: (page - 1) * pageSize,
    to: (page - 1) * pageSize + pageSize - 1,
    sort,
    dir,
    search: textParam(query.q ?? query.search, 120),
  };
}

function sortDirection(query: Record<string, unknown>, options: { sorts: readonly string[]; defaultSort: string }) {
  const sort = textParam(query.sort, 40);
  const dir = textParam(query.dir, 8).toLowerCase();
  return {
    sort: (options.sorts as readonly string[]).includes(sort) ? sort : options.defaultSort,
    dir: dir === 'asc' ? ('asc' as const) : ('desc' as const),
  };
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export type AdminActor = { userId: string; role: AdminRole };

export type AdminResult = {
  data: any;
  error: { message?: string; code?: string } | null;
  count?: number | null;
};

/**
 * The narrow slice of the Supabase client this module uses. Keeping it structural (and
 * awaitable, like a real PostgREST builder) means the whole admin surface is unit
 * testable against a recording stub instead of a live database.
 */
export type AdminQuery = PromiseLike<AdminResult> & {
  eq(column: string, value: unknown): AdminQuery;
  neq(column: string, value: unknown): AdminQuery;
  ilike(column: string, pattern: string): AdminQuery;
  or(expression: string): AdminQuery;
  gte(column: string, value: unknown): AdminQuery;
  lte(column: string, value: unknown): AdminQuery;
  in(column: string, values: readonly unknown[]): AdminQuery;
  is(column: string, value: unknown): AdminQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): AdminQuery;
  range(from: number, to: number): AdminQuery;
  limit(count: number): AdminQuery;
  maybeSingle(): PromiseLike<AdminResult>;
  single(): PromiseLike<AdminResult>;
};

export type AdminClientLike = {
  from(table: string): {
    select(columns: string, options?: { count?: 'exact' | 'estimated' | 'planned'; head?: boolean }): AdminQuery;
    update(values: Record<string, unknown>): AdminQuery;
    insert(values: Record<string, unknown>): AdminQuery;
  };
  rpc<T = any>(name: string, args?: Record<string, unknown>): PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>;
};

export async function resolveAdminRole(client: AdminClientLike | null, userId: string | null | undefined): Promise<AdminRole | null> {
  if (!client || !isUuid(userId)) return null;
  const { data, error } = await client.rpc<{ admin_role_of: string | null } | string | null>('admin_role_of', { p_user_id: userId });
  if (error) throwMappedSupabaseError(error);
  // The PostgREST wrapper returns a scalar under the function name for some shapes.
  const role = typeof data === 'string' ? data : (data as { admin_role_of?: string | null } | null)?.admin_role_of ?? null;
  return (ADMIN_ROLES as readonly string[]).includes(String(role)) ? (role as AdminRole) : null;
}

/**
 * Turns a verified request user into an admin actor. Three distinct failures, never
 * conflated: no session (401), no configured admin store (503), session without the
 * role (403). The caller must not be able to tell them apart from the client bundle,
 * so each carries a code and no internals.
 */
export async function requireAdminActor(input: {
  user: { id: string } | null | undefined;
  client: AdminClientLike | null;
  superUser?: boolean;
}): Promise<AdminActor> {
  if (!input.user?.id) throw new DalAuthenticationError('A signed-in session is required');
  if (!input.client) throw new AdminNotConfiguredError();
  const role = await resolveAdminRole(input.client, input.user.id);
  if (!role) {
    const denied = new DalAuthorizationError('This account is not an administrator');
    (denied as Error & { code?: string }).code = 'ADMIN_REQUIRED';
    throw denied;
  }
  if (input.superUser && role !== 'super_admin') {
    const denied = new DalAuthorizationError('Super administrator authorization required');
    (denied as Error & { code?: string }).code = 'SUPER_ADMIN_REQUIRED';
    throw denied;
  }
  return { userId: input.user.id, role };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * The catalog stores what submitters gave us. The admin surface only ever renders
 * https imagery, and it says so instead of silently dropping rows - an http photo
 * is a real content problem a moderator should be able to see exists.
 */
export function splitPhotoUrls(values: unknown): { safe: string[]; suppressed: number } {
  const list = Array.isArray(values) ? values : [];
  const safe: string[] = [];
  let suppressed = 0;
  for (const value of list) {
    let url: URL | null = null;
    try {
      url = typeof value === 'string' ? new URL(value) : null;
    } catch {
      url = null;
    }
    if (url && url.protocol === 'https:') safe.push(url.toString());
    else suppressed += 1;
  }
  return { safe, suppressed };
}

// ---------------------------------------------------------------------------
// Mappers. Nothing sensitive is carried across: no emails, no auth metadata, no
// stored coordinates for travelers, no tokens, no raw upstream payloads.
// ---------------------------------------------------------------------------

export function toAdminPlaceRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const photos = splitPhotoUrls(row.photos);
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    arabicName: row.arabic_name ?? null,
    frenchName: row.french_name ?? null,
    category: row.category ?? null,
    subCategory: row.sub_category ?? null,
    region: row.region ?? '',
    area: row.area ?? '',
    address: row.address ?? '',
    description: row.description ?? '',
    formationInfo: row.formation_info ?? null,
    coordinates: Array.isArray(row.coordinates) && row.coordinates.length === 2
      ? [Number(row.coordinates[0]), Number(row.coordinates[1])] as [number, number]
      : null,
    openingHours: row.opening_hours ?? null,
    priceLevel: row.price_level ?? null,
    contactPhone: row.contact_phone ?? null,
    businessOwnerName: row.business_owner_name ?? null,
    rating: {
      value: row.rating === null || row.rating === undefined ? null : Number(row.rating),
      reviewCount: Number(row.review_count ?? 0),
      provenance: row.rating_provenance ?? 'unrated',
    },
    seed: {
      isSeed: Boolean(row.seed_data),
      rating: row.seed_rating === null || row.seed_rating === undefined ? null : Number(row.seed_rating),
      reviewCount: Number(row.seed_review_count ?? 0),
      source: row.seed_source ?? null,
    },
    checkInsCount: Number(row.check_ins_count ?? 0),
    isUnderDocumentedGem: Boolean(row.is_under_documented_gem),
    trustLevel: row.trust_level ?? 'unverified',
    dataSource: row.data_source ?? 'community_submission',
    source: row.source ?? 'community_traveler',
    photoProvenance: row.photo_provenance ?? null,
    lastVerifiedAt: row.last_verified_at ?? null,
    photos: photos.safe,
    suppressedPhotoCount: photos.suppressed,
    moderation: {
      status: (row.moderation_status ?? 'approved') as PlaceModerationStatus,
      note: row.moderation_note ?? null,
      moderatedAt: row.moderated_at ?? null,
      moderatedBy: row.moderated_by ?? null,
    },
    submittedBy: row.created_by_user_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    lastActivityAt: row.last_activity_timestamp ?? null,
  };
}

export type AdminPlaceRow = NonNullable<ReturnType<typeof toAdminPlaceRow>>;

export function toAdminReviewRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  const place = row.places ?? row.place ?? null;
  return {
    id: String(row.id),
    placeId: String(row.place_id ?? place?.id ?? ''),
    placeName: place?.name ?? null,
    placeArea: place?.area ?? null,
    authorName: String(row.author_name ?? ''),
    authorRole: row.author_role ?? 'traveler',
    rating: Number(row.rating ?? 0),
    text: String(row.text ?? ''),
    tags: Array.isArray(row.tags) ? row.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
    photos: splitPhotoUrls(row.photos).safe,
    suppressedPhotoCount: splitPhotoUrls(row.photos).suppressed,
    isSeed: Boolean(row.seed_data),
    moderation: {
      status: (row.moderation_status ?? 'approved') as ReviewModerationStatus,
      note: row.moderation_note ?? null,
      moderatedAt: row.moderated_at ?? null,
    },
    createdAt: row.date ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

/**
 * A traveler row for administrators. Deliberately narrower than what the database
 * holds: no email, no auth metadata, and never the stored location - an admin needs
 * to know that a preference exists, not where someone was standing.
 */
export function toAdminTravelerRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  return {
    userId: String(row.user_id),
    displayName: row.display_name ? String(row.display_name) : null,
    preferredLanguage: typeof row.preferred_language === 'string' ? row.preferred_language : null,
    hasAvatar: Boolean(row.avatar_url),
    hasLocationOnFile: Boolean(row.last_known_location),
    hasHomeLocationOnFile: Boolean(row.home_location),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function toAdminAuditRow(row: Record<string, any> | null | undefined) {
  if (!row) return null;
  return {
    id: String(row.id),
    occurredAt: row.occurred_at ?? null,
    adminLabel: row.admin_label ?? null,
    adminRole: row.admin_role ?? null,
    action: String(row.action ?? ''),
    targetType: String(row.target_type ?? ''),
    targetId: String(row.target_id ?? ''),
    reason: row.reason ?? null,
    changeSummary: row.change_summary && typeof row.change_summary === 'object' ? row.change_summary : {},
  };
}

// ---------------------------------------------------------------------------
// Curation patch
// ---------------------------------------------------------------------------


/** Fields the admin surface must never be able to write through curation. */
export const NON_CURATABLE_FIELDS = [
  'rating', 'review_count', 'ratings_breakdown', 'seed_data', 'seed_rating', 'seed_review_count',
  'seed_owner_verified', 'seed_source', 'seed_check_ins_count', 'check_ins_count', 'photos',
  'photo_provenance', 'rating_provenance', 'moderation_status', 'moderation_note', 'moderated_at',
  'moderated_by', 'owner_verified', 'is_under_documented_gem', 'created_by_user_id', 'coordinates',
] as const;

/** Fields an administrator may curate, with their limits and whether they may be emptied. */
const CURATION_FIELDS = [
  { key: 'name', max: 160, required: true },
  { key: 'description', max: 4000, required: true },
  { key: 'region', max: 120, required: true },
  { key: 'area', max: 120, required: true },
  { key: 'address', max: 320, required: true },
  { key: 'arabic_name', max: 160, required: false },
  { key: 'french_name', max: 160, required: false },
  { key: 'formation_info', max: 1000, required: false },
  { key: 'sub_category', max: 80, required: false },
  { key: 'opening_hours', max: 240, required: false },
  { key: 'contact_phone', max: 40, required: false },
] as const;

const CURATION_ENUMS = {
  category: PLACE_CATEGORIES,
  price_level: PRICE_LEVELS,
  trust_level: PLACE_TRUST_LEVELS,
} as const;

/**
 * The write path is deliberately narrower than the table: ratings, review counts, seed
 * baselines, photo provenance and moderation state are all refused here, so an admin UI
 * bug cannot recreate the historical problems this product has already fixed (a hand-set
 * rating, an automatic "gem" flag, a silently verified owner).
 */
export function parseCurationPatch(body: unknown): { patch: Record<string, string | null>; changed: string[] } {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (Object.keys(input).length === 0) throw new DataValidationError('no curation fields were supplied');

  const allowed = new Map<string, (typeof CURATION_FIELDS)[number]>(CURATION_FIELDS.map((field) => [field.key, field]));
  const patch: Record<string, string | null> = {};

  for (const [key, value] of Object.entries(input)) {
    if (key === 'reason') continue;
    if ((NON_CURATABLE_FIELDS as readonly string[]).includes(key)) {
      throw new DataValidationError(`${key} is not editable from the admin surface`);
    }
    if (key in CURATION_ENUMS) {
      const allowedValues = (CURATION_ENUMS as any)[key] as readonly string[];
      const text = typeof value === 'string' ? value.trim() : '';
      if (!text) throw new DataValidationError(`${key} must be one of: ${allowedValues.join(', ')}`);
      if (!allowedValues.includes(text)) throw new DataValidationError(`${key} must be one of: ${allowedValues.join(', ')}`);
      patch[key] = text;
      continue;
    }
    const field = allowed.get(key);
    if (!field) throw new DataValidationError(`${key} is not a curatable field`);
    const raw = typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim() : '';
    if (!raw) {
      if (field.required) throw new DataValidationError(`${field.key} cannot be empty`);
      patch[field.key] = null;
      continue;
    }
    if (raw.length > field.max) throw new DataValidationError(`${field.key} is longer than ${field.max} characters`);
    patch[field.key] = raw;
  }

  if (Object.keys(patch).length === 0) throw new DataValidationError('no curation fields were supplied');
  return { patch, changed: Object.keys(patch).sort() };
}

export function parseModerationDecision(
  body: unknown,
  kind: 'place',
): { status: PlaceModerationStatus; reason: string | null; requiresReason: boolean };
export function parseModerationDecision(
  body: unknown,
  kind: 'review',
): { status: ReviewModerationStatus; reason: string | null; requiresReason: boolean };
export function parseModerationDecision(body: unknown, kind: 'place' | 'review'): {
  status: PlaceModerationStatus | ReviewModerationStatus;
  reason: string | null;
  requiresReason: boolean;
} {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const status = kind === 'place'
    ? enumParam(input.status, PLACE_MODERATION_STATUSES, '' as any) as PlaceModerationStatus
    : enumParam(input.status, REVIEW_MODERATION_STATUSES, '' as any) as ReviewModerationStatus;
  if (!status) {
    throw new DataValidationError(kind === 'place'
      ? `status must be one of: ${PLACE_MODERATION_STATUSES.join(', ')}`
      : `status must be one of: ${REVIEW_MODERATION_STATUSES.join(', ')}`);
  }
  const reason = textParam(input.reason, 500);
  const requiresReason = kind === 'place' && (PLACE_STATUSES_REQUIRING_REASON as readonly string[]).includes(status);
  if (requiresReason && !reason) throw new DataValidationError('a reason is required for this decision');
  return { status, reason: reason || null, requiresReason };
}

export function parseRoleChange(body: unknown, action: 'grant' | 'revoke') {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const reason = textParam(input.reason, 500);
  if (!reason) throw new DataValidationError('a reason is required to change administrator access');
  const out: { reason: string; role?: AdminRole; targetUserId?: string } = { reason };
  if (action === 'grant') {
    out.role = enumParam(input.role, ADMIN_ROLES, '' as any) as AdminRole;
    if (!out.role) throw new DataValidationError(`role must be one of: ${ADMIN_ROLES.join(', ')}`);
    out.targetUserId = requireUuid(input.user_id ?? input.userId, 'target account');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Duplicate detection. The database narrows candidates by distance; this ranks
// them by how alike the names look, so a moderator sees "probably the same place"
// rather than a raw list of neighbours.
// ---------------------------------------------------------------------------

const DIACRITICS = /[\u0300-\u036f]/g;
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'el', 'la', 'le', 'les', 'de', 'du', 'al', 'as', 'at', 'in', 'on', 'place', 'lieu', 'museum', 'musee']);

export function normalizePlaceName(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value: string): string[] {
  return normalizePlaceName(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function nameSimilarity(a: string, b: string): number {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  if (left.size === 0 || right.size === 0) {
    // Both names reduce to stopwords: fall back to the raw normalized strings.
    const leftRaw = normalizePlaceName(a);
    const rightRaw = normalizePlaceName(b);
    if (!leftRaw || !rightRaw) return 0;
    return leftRaw === rightRaw ? 1 : 0;
  }
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

export type DuplicateCandidate = {
  id: string;
  name: string;
  area: string | null;
  category: string | null;
  moderationStatus: string | null;
  distanceMeters: number | null;
  similarity: number;
  likely: boolean;
};

export const DUPLICATE_RADIUS_METERS = 400;

export function rankDuplicateCandidates(
  target: { id: string; name: string; category?: string | null; coordinates?: [number, number] | null },
  rows: Record<string, any>[] | null | undefined,
  options: { radiusMeters?: number } = {},
): DuplicateCandidate[] {
  const radius = options.radiusMeters ?? DUPLICATE_RADIUS_METERS;
  const candidates = (rows || [])
    .filter((row) => String(row.candidate_id ?? row.id ?? '') !== String(target.id))
    .map((row) => {
      const name = String(row.candidate_name ?? row.name ?? '');
      const distance = row.distance_meters === null || row.distance_meters === undefined ? null : Number(row.distance_meters);
      const similarity = Number(nameSimilarity(target.name, name).toFixed(3));
      const categoryMatches = Boolean(row.candidate_category && target.category && row.candidate_category === target.category);
      const closeEnough = distance === null || distance <= radius;
      return {
        id: String(row.candidate_id ?? row.id ?? ''),
        name,
        area: row.candidate_area ?? row.area ?? null,
        category: row.candidate_category ?? row.category ?? null,
        moderationStatus: row.candidate_moderation_status ?? row.moderation_status ?? null,
        distanceMeters: distance,
        similarity,
        likely: closeEnough && (similarity >= 0.6 || (categoryMatches && similarity >= 0.4)),
      };
    });

  return candidates
    .sort((a, b) => (Number(b.likely) - Number(a.likely)) || (b.similarity - a.similarity) || ((a.distanceMeters ?? 1e9) - (b.distanceMeters ?? 1e9)))
    .slice(0, 8);
}

// ---------------------------------------------------------------------------
// Service probes. A probe reports what it actually observed, and "we have not
// looked" is a distinct answer from "it is fine".
// ---------------------------------------------------------------------------

export const SERVICE_KEYS = ['api', 'database', 'ai', 'weather', 'tiles', 'place_discovery'] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
export const SERVICE_STATUSES = ['healthy', 'degraded', 'unavailable', 'unknown'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export type ServiceProbeResult = {
  key: ServiceKey;
  status: ServiceStatus;
  latencyMs: number | null;
  checkedAt: string | null;
  source: 'live-probe' | 'observed-request' | 'telemetry' | 'configuration';
  detail: string | null;
};

export function classifyFetchOutcome(status: number | null, threw: boolean, latencyMs: number | null): ServiceStatus {
  if (threw || status === null) return 'unavailable';
  if (status >= 500) return 'unavailable';
  if (status >= 400) return 'degraded';
  if (status >= 200 && status < 400) return 'healthy';
  return 'degraded';
}

export async function probeUrl(url: string, timeoutMs = 6000): Promise<{ status: number | null; latencyMs: number | null; threw: boolean }> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: { 'user-agent': 'MySindbad-AdminHealthProbe/1.0 (operational check)' },
    });
    return { status: response.status, latencyMs: Date.now() - startedAt, threw: false };
  } catch {
    return { status: null, latencyMs: Date.now() - startedAt, threw: true };
  }
}

export const TILE_PROBE_URL = 'https://tile.openstreetmap.org/12/1982/1615.png';
export const CARTO_TILE_PROBE_URL = 'https://a.basemaps.cartocdn.com/dark_all/12/1982/1615.png';
export const WEATHER_PROBE_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.77&longitude=-5.82&current=temperature_2m';

/**
 * Turns per-service telemetry (counts of observed outcomes) into a status. Zero
 * observations is UNKNOWN, not healthy - the whole point of this panel is that it
 * never claims more than it has seen.
 */
export function statusFromTelemetry(input: { service: string; ok: number; failed: number; lastProblemAt?: string | null }): ServiceProbeResult {
  const total = input.ok + input.failed;
  let status: ServiceStatus = 'unknown';
  if (total === 0) status = 'unknown';
  else if (input.failed === 0) status = 'healthy';
  else if (input.failed / total >= 0.5) status = 'unavailable';
  else status = 'degraded';
  return {
    key: input.service as ServiceKey,
    status,
    latencyMs: null,
    checkedAt: input.lastProblemAt ?? null,
    source: 'telemetry',
    detail: total === 0 ? 'no requests observed in this window' : `${input.ok} ok · ${input.failed} failed`,
  };
}

// ---------------------------------------------------------------------------
// Audit + telemetry records (pure builders so the payload shape is tested)
// ---------------------------------------------------------------------------

export function buildServiceEventRow(input: {
  service: ServiceKey;
  outcome: 'ok' | 'error' | 'unavailable' | 'rate_limited' | 'rejected';
  endpoint?: string | null;
  latencyMs?: number | null;
  statusClass?: number | null;
  detail?: string | null;
}) {
  if (!(SERVICE_KEYS as readonly string[]).includes(input.service) || input.service === 'api' || input.service === 'database') {
    // api/database outcomes are derived per request, not stored: storing them would
    // write a row for every health poll and add nothing an operator cannot already see.
    throw new DataValidationError('service events are only recorded for outbound dependencies');
  }
  return {
    service: input.service,
    outcome: input.outcome,
    endpoint: (input.endpoint || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 96) || null,
    latency_ms: Math.max(0, Math.min(3_600_000, Math.round(Number(input.latencyMs ?? 0)) || 0)),
    status_class: input.statusClass && input.statusClass >= 100 && input.statusClass <= 599 ? Math.trunc(input.statusClass) : null,
    // Never a full upstream payload, never a token: the recorder is fed short facts.
    detail: (input.detail || '').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/eyJ[A-Za-z0-9._-]+/g, '[redacted]').slice(0, 240) || null,
  };
}

/**
 * Fire-and-forget telemetry. A failed insert must never change what a user sees, so
 * this swallows its own error after logging it - and it returns the row it wrote so
 * callers (and tests) can assert what was recorded.
 */
export function createServiceEventRecorder(client: AdminClientLike | null) {
  return function record(input: Parameters<typeof buildServiceEventRow>[0]): ReturnType<typeof buildServiceEventRow> | null {
    const row = buildServiceEventRow(input);
    if (!client) return null;
    try {
      void (client as any).from('service_events').insert(row).then?.(() => {})?.catch?.(() => {});
    } catch {
      // Telemetry is never allowed to break a user-visible request.
    }
    return row;
  };
}

// ---------------------------------------------------------------------------
// The admin data service
// ---------------------------------------------------------------------------

export function createAdminService(client: AdminClientLike | null) {
  const db = () => {
    if (!client) throw new AdminNotConfiguredError();
    return client;
  };

  const run = async <T,>(query: PromiseLike<AdminResult>): Promise<T> => {
    const result = await query;
    if (result.error) throwMappedSupabaseError(result.error);
    return result.data as T;
  };

  async function listPage(
    table: string,
    select: string,
    query: ListQuery,
    apply?: (builder: AdminQuery) => AdminQuery,
  ): Promise<{ rows: Record<string, any>[]; total: number; page: number; pageSize: number; pageCount: number }> {
    let builder = db().from(table).select(select, { count: 'exact' });
    if (apply) builder = apply(builder);
    builder = builder.order(query.sort, { ascending: query.dir === 'asc', nullsFirst: query.dir === 'asc' });
    const { data, error, count } = await builder.range(query.from, query.to);
    if (error) throwMappedSupabaseError(error);
    const rows = Array.isArray(data) ? data : [];
    const total = Number(count ?? rows.length);
    return {
      rows,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  function searchFilter(builder: AdminQuery, term: string, columns: string[]): AdminQuery {
    const needle = escapeFilterTerm(term);
    if (!needle) return builder;
    return builder.or(columns.map((column) => `${column}.ilike.%${needle}%`).join(','));
  }

  return {
    // ---- overview -------------------------------------------------------
    async overview() {
      const startedAt = Date.now();
      const { data, error } = await db().rpc('admin_operations_snapshot');
      if (error) throwMappedSupabaseError(error);
      const snapshot = (data ?? {}) as Record<string, any>;
      const recent = await listPage('admin_audit_events', 'id, occurred_at, admin_label, admin_role, action, target_type, target_id, reason, change_summary', {
        page: 1, pageSize: 8, from: 0, to: 7, sort: 'occurred_at', dir: 'desc', search: '',
      });
      return {
        snapshot,
        databaseLatencyMs: Date.now() - startedAt,
        recentActions: (recent.rows || []).map(toAdminAuditRow).filter(Boolean),
      };
    },

    // ---- places ---------------------------------------------------------
    async places(query: ListQuery, filters: { status?: PlaceModerationStatus | ''; category?: string; region?: string; source?: string; gem?: boolean } = {}) {
      const page = await listPage(
        'places',
        '*',
        query,
        (builder) => {
          let next = builder;
          if (filters.status) next = next.eq('moderation_status', filters.status);
          if (filters.category) next = next.eq('category', filters.category);
          if (filters.region) next = next.eq('region', filters.region);
          if (filters.source) next = next.eq('source', filters.source);
          if (filters.gem) next = next.eq('is_under_documented_gem', true);
          if (query.search) next = searchFilter(next, query.search, ['name', 'arabic_name', 'french_name', 'area', 'region', 'sub_category', 'description']);
          return next;
        },
      );
      return { ...page, rows: page.rows.map(toAdminPlaceRow).filter(Boolean) };
    },

    async place(id: string) {
      const placeId = requireUuid(id, 'place id');
      const { data, error } = await db().from('places').select('*').eq('id', placeId).maybeSingle();
      if (error) throwMappedSupabaseError(error);
      if (!data) throw new AdminNotFoundError('place not found');
      const place = toAdminPlaceRow(data)!;

      const [reviewsResult, candidatesResult, auditResult] = await Promise.all([
        db().from('reviews').select('id, place_id, author_name, author_role, rating, text, tags, photos, seed_data, moderation_status, moderation_note, moderated_at, date, updated_at').eq('place_id', placeId).order('date', { ascending: false }).limit(20),
        db().rpc<{ admin_place_duplicate_candidates: Record<string, any>[] } | Record<string, any>[]>('admin_place_duplicate_candidates', {
          p_place_id: placeId,
          p_radius_meters: DUPLICATE_RADIUS_METERS,
          p_limit: 8,
        }),
        db().from('admin_audit_events').select('id, occurred_at, admin_label, admin_role, action, target_type, target_id, reason, change_summary').eq('target_type', 'place').eq('target_id', placeId).order('occurred_at', { ascending: false }).limit(10),
      ]);
      if (reviewsResult.error) throwMappedSupabaseError(reviewsResult.error);

      const candidateRows = Array.isArray(candidatesResult.data)
        ? candidatesResult.data
        : ((candidatesResult.data as any)?.admin_place_duplicate_candidates ?? []);

      return {
        place,
        reviews: (reviewsResult.data || []).map(toAdminReviewRow).filter(Boolean),
        duplicateCandidates: rankDuplicateCandidates(
          { id: place.id, name: place.name, category: place.category as string, coordinates: place.coordinates as [number, number] | null },
          candidateRows as Record<string, any>[],
        ),
        history: (auditResult.data || []).map(toAdminAuditRow).filter(Boolean),
      };
    },

    async setPlaceModeration(actor: AdminActor, placeId: string, decision: { status: PlaceModerationStatus; reason: string | null }) {
      const id = requireUuid(placeId, 'place id');
      const { data, error } = await db().rpc('admin_set_place_moderation', {
        p_admin_user_id: actor.userId,
        p_place_id: id,
        p_status: decision.status,
        p_reason: decision.reason,
        p_request_id: null,
      });
      if (error) {
        if (String((error as any).code) === 'P0002') throw new AdminNotFoundError('place not found');
        throwMappedSupabaseError(error);
      }
      return { result: data ?? null };
    },

    async updatePlaceCuration(actor: AdminActor, placeId: string, patch: Record<string, string | null>, reason: string | null) {
      const id = requireUuid(placeId, 'place id');
      const { data, error } = await db().rpc('admin_update_place_curation', {
        p_admin_user_id: actor.userId,
        p_place_id: id,
        p_patch: patch,
        p_reason: reason,
        p_request_id: null,
      });
      if (error) {
        if (String((error as any).code) === 'P0002') throw new AdminNotFoundError('place not found');
        throwMappedSupabaseError(error);
      }
      return { result: data ?? null };
    },

    // ---- moderation queue ----------------------------------------------
    /**
     * What a moderator has to decide on. Filtered in the database rather than sliced
     * out of a page, so a pending submission on row 400 is still reachable - and the
     * per-status counts come from exact head counts, not from the current page.
     */
    async moderationQueue(query: ListQuery) {
      const statuses = ['pending', 'needs_changes'] as const;
      const page = await listPage(
        'places',
        '*',
        { ...query, sort: query.sort === 'moderated_at' ? 'created_at' : query.sort },
        (builder) => (query.search ? searchFilter(builder, query.search, ['name', 'arabic_name', 'french_name', 'area']) : builder)
          .in('moderation_status', statuses),
      );
      const counts = await Promise.all(statuses.map(async (status) => {
        const result = await db().from('places').select('id', { count: 'exact', head: true }).eq('moderation_status', status);
        return { status, total: Number(result.count ?? 0) };
      }));
      return {
        ...page,
        rows: page.rows.map(toAdminPlaceRow).filter(Boolean),
        queueCounts: counts,
        waitingTotal: counts.reduce((sum, entry) => sum + entry.total, 0),
      };
    },

    // ---- reviews --------------------------------------------------------
    async reviews(query: ListQuery, filters: { status?: ReviewModerationStatus | '' } = {}) {
      const page = await listPage(
        'reviews',
        'id, place_id, author_name, author_role, rating, text, tags, photos, seed_data, moderation_status, moderation_note, moderated_at, date, updated_at, places(id, name, area)',
        query,
        (builder) => {
          let next = builder;
          if (filters.status) next = next.eq('moderation_status', filters.status);
          if (query.search) next = searchFilter(next, query.search, ['text', 'author_name']);
          return next;
        },
      );
      return { ...page, rows: page.rows.map(toAdminReviewRow).filter(Boolean) };
    },

    async setReviewModeration(actor: AdminActor, reviewId: string, decision: { status: ReviewModerationStatus; reason: string | null }) {
      const id = requireUuid(reviewId, 'review id');
      const { data, error } = await db().rpc('admin_set_review_moderation', {
        p_admin_user_id: actor.userId,
        p_review_id: id,
        p_status: decision.status,
        p_reason: decision.reason,
        p_request_id: null,
      });
      if (error) {
        if (String((error as any).code) === 'P0002') throw new AdminNotFoundError('review not found');
        throwMappedSupabaseError(error);
      }
      return { result: data ?? null };
    },

    // ---- travelers ------------------------------------------------------
    async travelers(query: ListQuery) {
      const page = await listPage('user_profiles', 'user_id, display_name, preferred_language, avatar_url, last_known_location, home_location, created_at, updated_at', query, (builder) => (
        query.search ? searchFilter(builder, query.search, ['display_name']) : builder
      ));
      const ids = page.rows.map((row) => String(row.user_id)).filter(isUuid);
      const rosterResult = ids.length
        ? await db().from('admin_accounts').select('user_id, role, granted_at, revoked_at').in('user_id', ids)
        : { data: [] as Record<string, any>[], error: null };
      if (rosterResult.error) throwMappedSupabaseError(rosterResult.error);
      const byId = new Map<string, Record<string, any>>(
        (rosterResult.data || [])
          .filter((row) => !row.revoked_at)
          .map((row) => [String(row.user_id), row] as [string, Record<string, any>]),
      );
      return {
        ...page,
        rows: page.rows.map((row) => ({ ...toAdminTravelerRow(row), adminRole: byId.get(String(row.user_id))?.role ?? null, grantedAt: byId.get(String(row.user_id))?.granted_at ?? null })).filter((row) => row.userId),
      };
    },

    async traveler(userId: string) {
      const id = requireUuid(userId, 'account id');
      const [profileResult, adminResult, placesResult, reviewsResult, tripsResult] = await Promise.all([
        db().from('user_profiles').select('user_id, display_name, preferred_language, avatar_url, last_known_location, home_location, created_at, updated_at').eq('user_id', id).maybeSingle(),
        db().from('admin_accounts').select('user_id, role, granted_at, granted_by, revoked_at, revoke_reason').eq('user_id', id).maybeSingle(),
        db().from('places').select('id', { count: 'exact', head: true }).eq('created_by_user_id', id),
        db().from('reviews').select('id', { count: 'exact', head: true }).eq('author_user_id', id),
        db().from('trips').select('id', { count: 'exact', head: true }).eq('user_id', id),
      ]);
      if (profileResult.error) throwMappedSupabaseError(profileResult.error);
      if (!profileResult.data) throw new AdminNotFoundError('account not found');
      for (const partial of [adminResult, placesResult, reviewsResult, tripsResult]) if (partial.error) throwMappedSupabaseError(partial.error);
      const admin = adminResult.data && !adminResult.data.revoked_at ? adminResult.data : null;
      return {
        profile: toAdminTravelerRow(profileResult.data),
        admin: admin ? { role: admin.role, grantedAt: admin.granted_at, grantedBy: admin.granted_by } : null,
        activity: {
          placesSubmitted: Number(placesResult.count ?? 0),
          reviewsWritten: Number(reviewsResult.count ?? 0),
          tripsCreated: Number(tripsResult.count ?? 0),
        },
      };
    },

    async roster() {
      const { data, error } = await db().from('admin_accounts').select('user_id, role, granted_by, granted_at, revoked_at, revoke_reason').is('revoked_at', null).order('granted_at', { ascending: false });
      if (error) throwMappedSupabaseError(error);
      const rows = (data || []).map((row: Record<string, any>) => String(row.user_id)).filter(isUuid);
      const profilesResult = rows.length ? await db().from('user_profiles').select('user_id, display_name').in('user_id', rows) : { data: [] as Record<string, any>[], error: null };
      if (profilesResult.error) throwMappedSupabaseError(profilesResult.error);
      const names = new Map((profilesResult.data || []).map((profile: Record<string, any>) => [String(profile.user_id), profile.display_name ?? null]));
      return {
        rows: (data || []).map((row) => ({
          userId: String(row.user_id),
          displayName: names.get(String(row.user_id)) ?? null,
          role: row.role as AdminRole,
          grantedAt: row.granted_at,
          grantedBy: row.granted_by,
        })),
      };
    },

    async grantRole(actor: AdminActor, input: { role: AdminRole; targetUserId: string; reason: string }) {
      const { data, error } = await db().rpc('admin_grant_role', {
        p_admin_user_id: actor.userId,
        p_target_user_id: input.targetUserId,
        p_role: input.role,
        p_reason: input.reason,
        p_request_id: null,
      });
      if (error) throwMappedSupabaseError(error);
      return { result: data ?? null };
    },

    async revokeRole(actor: AdminActor, input: { targetUserId: string; reason: string }) {
      const { data, error } = await db().rpc('admin_revoke_role', {
        p_admin_user_id: actor.userId,
        p_target_user_id: input.targetUserId,
        p_reason: input.reason,
        p_request_id: null,
      });
      if (error) throwMappedSupabaseError(error);
      return { result: data ?? null };
    },

    // ---- audit ----------------------------------------------------------
    async auditEvents(query: ListQuery, filters: { targetType?: string; action?: string; targetId?: string } = {}) {
      const page = await listPage('admin_audit_events', 'id, occurred_at, admin_label, admin_role, action, target_type, target_id, reason, change_summary', query, (builder) => {
        let next = builder;
        if (filters.targetType) next = next.eq('target_type', filters.targetType);
        if (filters.targetId && isUuid(filters.targetId)) next = next.eq('target_id', filters.targetId);
        if (filters.action) next = searchFilter(next, filters.action, ['action']);
        return next;
      });
      return { ...page, rows: page.rows.map(toAdminAuditRow).filter(Boolean) };
    },

    /** Every mutation this deployment has recorded for one target, for evidence panels. */
    async auditFor(targetType: string, targetId: string, limit = 10) {
      const id = requireUuid(targetId, 'target id');
      const { data, error } = await db().from('admin_audit_events')
        .select('id, occurred_at, admin_label, admin_role, action, target_type, target_id, reason, change_summary')
        .eq('target_type', targetType).eq('target_id', id).order('occurred_at', { ascending: false }).limit(limit);
      if (error) throwMappedSupabaseError(error);
      return (data || []).map(toAdminAuditRow).filter(Boolean);
    },

    // ---- AI operations --------------------------------------------------
    async aiOperations(now = new Date()) {
      const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const [usage, outcomes] = await Promise.all([
        db().from('ai_usage_events').select('endpoint, created_at').gte('created_at', windowStart).limit(5000),
        db().from('service_events').select('outcome, latency_ms, occurred_at, status_class').eq('service', 'ai').gte('occurred_at', dayStart).order('occurred_at', { ascending: false }).limit(500),
      ]);
      if (usage.error) throwMappedSupabaseError(usage.error);
      if (outcomes.error) throwMappedSupabaseError(outcomes.error);
      return {
        usage: summarizeAiUsage(usage.data || [], now),
        outcomes: summarizeOutcomes(outcomes.data || []),
      };
    },

    // ---- service health -------------------------------------------------
    async serviceHealth(options: { now?: Date; includeProbes?: boolean } = {}) {
      const now = options.now ?? new Date();
      const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await db().from('service_events')
        .select('service, outcome, occurred_at, latency_ms')
        .gte('occurred_at', dayStart)
        .order('occurred_at', { ascending: false })
        .limit(2000);
      if (error) throwMappedSupabaseError(error);

      const grouped = new Map<string, { ok: number; failed: number; lastProblemAt: string | null; latencies: number[] }>();
      for (const row of data || []) {
        const key = String(row.service);
        const entry = grouped.get(key) ?? { ok: 0, failed: 0, lastProblemAt: null, latencies: [] as number[] };
        if (row.outcome === 'ok') entry.ok += 1;
        else entry.failed += 1;
        if (row.outcome !== 'ok' && !entry.lastProblemAt) entry.lastProblemAt = row.occurred_at ?? null;
        if (typeof row.latency_ms === 'number' && Number.isFinite(row.latency_ms)) entry.latencies.push(row.latency_ms);
        grouped.set(key, entry);
      }

      const services: ServiceProbeResult[] = ['weather', 'tiles', 'place_discovery'].map((service) => {
        const entry = grouped.get(service) ?? { ok: 0, failed: 0, lastProblemAt: null, latencies: [] };
        const result = statusFromTelemetry({ service, ok: entry.ok, failed: entry.failed, lastProblemAt: entry.lastProblemAt });
        const median = entry.latencies.length ? percentile(entry.latencies, 0.5) : null;
        return { ...result, latencyMs: median };
      });

      return {
        services,
        telemetryRows: (data || []).length,
        window: '24h',
        generatedAt: now.toISOString(),
      };
    },

    /**
     * Live upstream checks, run only when an operator asks for them. Results are also
     * written to telemetry, so the historical view keeps improving from real probes.
     */
    async serviceProbes(record: (input: Parameters<typeof buildServiceEventRow>[0]) => unknown) {
      const [weather, tiles, cartoTiles, database] = await Promise.all([
        probeUrl(WEATHER_PROBE_URL),
        probeUrl(TILE_PROBE_URL),
        probeUrl(CARTO_TILE_PROBE_URL),
        (async () => {
          const startedAt = Date.now();
          try {
            const { error } = await db().from('places').select('id', { count: 'exact', head: true });
            if (error) throwMappedSupabaseError(error);
            return { status: 200, latencyMs: Date.now() - startedAt, threw: false };
          } catch {
            return { status: null, latencyMs: Date.now() - startedAt, threw: true };
          }
        })(),
      ]);

      const results: ServiceProbeResult[] = [
        { key: 'database', ...outcomeToProbe(database), source: 'live-probe' },
        { key: 'weather', ...outcomeToProbe(weather), source: 'live-probe' },
        { key: 'tiles', ...outcomeToProbe(mergeTileProbe(tiles, cartoTiles)), source: 'live-probe' },
      ];

      for (const result of results) {
        if (result.key === 'database') continue;
        record({
          service: result.key as 'weather' | 'tiles',
          outcome: result.status === 'healthy' ? 'ok' : result.status === 'degraded' ? 'error' : 'unavailable',
          endpoint: result.key === 'weather' ? 'open-meteo/current' : result.key === 'tiles' ? 'osm+raster-tiles' : null,
          latencyMs: result.latencyMs,
          statusClass: null,
          detail: result.detail,
        });
      }
      return { services: results, checkedAt: new Date().toISOString() };
    },

    /** Where a place came from, without pretending to know what we do not store. */
    async settings() {
      const flags = process.env;
      const [limits, aiQuota] = await Promise.all([
        db().from('api_rate_limits').select('scope', { count: 'exact', head: true }),
        db().from('ai_usage_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 3_600_000).toISOString()),
      ]);
      if (limits.error) throwMappedSupabaseError(limits.error);
      if (aiQuota.error) throwMappedSupabaseError(aiQuota.error);
      return {
        runtime: {
          nodeEnvironment: flags.NODE_ENV || 'development',
          hosting: flags.VERCEL_ENV || 'self-hosted',
          revision: flags.VERCEL_GIT_COMMIT_SHA || flags.GIT_COMMIT_SHA || null,
        },
        capabilities: {
          supabase: Boolean(flags.SUPABASE_URL || flags.VITE_SUPABASE_URL),
          serviceRole: Boolean(flags.SUPABASE_SERVICE_ROLE_KEY),
          aiProvider: Boolean(flags.GEMINI_API_KEY),
          rateLimitSalt: Boolean(flags.RATE_LIMIT_SALT || flags.SUPABASE_SERVICE_ROLE_KEY),
          seedFallback: flags.ALLOW_SEED_FALLBACK === 'true',
        },
        counters: {
          rateLimitWindowsActive: Number(limits.count ?? 0),
          aiRequestsLastHour: Number(aiQuota.count ?? 0),
        },
        // Deliberately empty of editable toggles: every operational value here is
        // owned by environment configuration or a migration, and there is no store
        // for a UI switch to write to. Building toggles would be decoration.
        editable: [],
      };
    },
  };
}

function outcomeToProbe(outcome: { status: number | null; latencyMs: number | null; threw: boolean }): Omit<ServiceProbeResult, 'key' | 'source'> {
  return {
    status: classifyFetchOutcome(outcome.status, outcome.threw, outcome.latencyMs),
    latencyMs: outcome.latencyMs,
    checkedAt: new Date().toISOString(),
    detail: outcome.threw ? 'the request did not complete' : outcome.status === null ? 'no response' : `upstream answered ${outcome.status}`,
  };
}

function mergeTileProbe(primary: { status: number | null; latencyMs: number | null; threw: boolean }, backup: { status: number | null; latencyMs: number | null; threw: boolean }) {
  if (!primary.threw && primary.status && primary.status < 400) return primary;
  if (!backup.threw && backup.status && backup.status < 400) {
    return { ...backup, status: backup.status, threw: false, latencyMs: backup.latencyMs };
  }
  return primary;
}

export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

export type AiUsageSummary = {
  total7d: number;
  last24h: number;
  perDay: Array<{ date: string; count: number }>;
  byEndpoint: Array<{ endpoint: string; count: number }>;
};

/** Day-bucketed request counts, straight from ai_usage_events - no invented trend. */
export function summarizeAiUsage(rows: Record<string, any>[], now = new Date()): AiUsageSummary {
  const perDay = new Map<string, number>();
  const byEndpoint = new Map<string, number>();
  let last24h = 0;
  const dayMs = 24 * 60 * 60 * 1000;
  for (let offset = 0; offset < 14; offset += 1) {
    perDay.set(isoDay(new Date(now.getTime() - offset * dayMs)), 0);
  }
  for (const row of rows) {
    const at = row.created_at ? new Date(String(row.created_at)) : null;
    if (at && !Number.isNaN(at.getTime())) {
      const key = isoDay(at);
      if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
      if (now.getTime() - at.getTime() <= dayMs) last24h += 1;
    }
    const endpoint = String(row.endpoint ?? 'unknown');
    byEndpoint.set(endpoint, (byEndpoint.get(endpoint) ?? 0) + 1);
  }
  return {
    total7d: rows.length,
    last24h,
    perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
    byEndpoint: [...byEndpoint.entries()].sort((a, b) => b[1] - a[1]).map(([endpoint, count]) => ({ endpoint, count })),
  };
}

export function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type OutcomeSummary = {
  total: number;
  ok: number;
  failed: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
};

export function summarizeOutcomes(rows: Record<string, any>[]): OutcomeSummary {
  const latencies: number[] = [];
  let ok = 0;
  for (const row of rows) {
    if (row.outcome === 'ok') ok += 1;
    if (typeof row.latency_ms === 'number' && Number.isFinite(row.latency_ms)) latencies.push(row.latency_ms);
  }
  return {
    total: rows.length,
    ok,
    failed: rows.length - ok,
    p50LatencyMs: percentile(latencies, 0.5),
    p95LatencyMs: percentile(latencies, 0.95),
  };
}


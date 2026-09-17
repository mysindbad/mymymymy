/**
 * Moderation and publication contracts.
 *
 * R51 made publication a *state* of a row (`places.moderation_status`, `reviews.moderation_status`)
 * instead of an implicit property of "it exists". Two rules carry most of the product's trust:
 *
 *   1. a traveller submission is queued, never auto-published, and hidden from public reads until a
 *      moderator approves it;
 *   2. "published" is enforced by the database and by the API server's privileged reads - not only
 *      by a UI convention.
 *
 * A third rule protects the curation work administrators do: review traffic may change a place's
 * rating, but never its verification level.
 *
 * No Postgres is reachable from this repository's development sandbox (and CI has no database
 * service), so the SQL side is verified against the migration text, the same way
 * verify-user-truth-contracts.ts verifies the rating-truth rules. The TypeScript side is verified
 * by executing the data-access layer in tests/unit/place-publication.test.ts against a stubbed
 * PostgREST endpoint. Keep both halves in sync with the migration.
 */

import { readFileSync } from 'node:fs';

const MIGRATION = 'supabase/migrations/20260917115914_admin_control_center.sql';

/** Collapse whitespace so contract patterns can be written on one line. */
function flat(path: string) {
  return readFileSync(path, 'utf8').replace(/\s+/g, ' ');
}

function requires(path: string, patterns: string[]) {
  const source = flat(path);
  for (const pattern of patterns) {
    if (!source.includes(pattern)) {
      throw new Error(`${path} is missing required moderation contract: ${pattern}`);
    }
  }
}

function forbids(path: string, patterns: string[]) {
  const source = flat(path);
  for (const pattern of patterns) {
    if (source.includes(pattern)) {
      throw new Error(`${path} contains forbidden moderation pattern: ${pattern}`);
    }
  }
}

const migration = MIGRATION;

// ---------------------------------------------------------------- find the leak at its source
// The column is *added* as approved so existing rows (and the curated import) keep publishing,
// then the default for future rows is flipped. Both halves are load-bearing.
requires(migration, [
  "add column if not exists moderation_status text not null default 'approved'",
  'alter table public.places alter column moderation_status set default',
  "set default 'pending'",
]);

// Reviews keep publishing on write - the accepted product contract for a review is that the
// traveller sees it immediately - so the flip above must stay scoped to places.
requires(migration, [
  'create trigger places_enforce_submission_state before insert on public.places',
  'create or replace function public.enforce_places_submission_state() returns trigger',
  // Imported or curated baseline content is published on arrival; everything else is a submission.
  "if coalesce(new.seed_data, false) then",
  "new.moderation_status := 'approved'",
  "else new.moderation_status := 'pending'",
]);
// Reviews must keep their publish-on-write default: only places gain a queue default here.
forbids(migration, [
  'alter table public.reviews alter column moderation_status set default',
]);
requires(migration, [
  'create trigger reviews_enforce_submission_state',
  "new.moderation_status := 'approved'",
]);

// Nobody outside the moderation workflow moves a row in or out of publication, including the row's
// own author editing it through PostgREST.
requires(migration, [
  'create or replace function public.lock_moderation_columns() returns trigger',
  "if new.moderation_status is distinct from old.moderation_status",
  "raise exception 'moderation state can only be changed through the moderation workflow'",
  'create trigger places_lock_moderation_columns before update on public.places',
  'create trigger reviews_lock_moderation_columns before update on public.reviews',
  // The privileged context is claimed inside the two moderation RPCs only.
  "perform set_config('app.allow_moderation_write', 'on', true)",
]);
if ((flat(migration).match(/perform set_config\('app\.allow_moderation_write', 'on', true\)/g) ?? []).length !== 2) {
  throw new Error(`${migration}: exactly the place and review moderation RPCs may claim the moderation context`);
}

// ---------------------------------------------------------------- publication as a row-security fact
// The pre-R51 policies were `using (true)`; they must be gone, and the replacement must be the same
// rule the API applies, with the ownership exemption and no self-service publishing.
requires(migration, [
  'drop policy if exists places_public_select on public.places',
  'create policy places_public_select on public.places for select to anon using (moderation_status =',
  'create policy places_authenticated_select on public.places for select to authenticated using ( moderation_status = \'approved\' or created_by_user_id = (select auth.uid()) )',
  "create policy places_authenticated_insert on public.places for insert to authenticated with check ( created_by_user_id = (select auth.uid()) and moderation_status = 'pending' )",
  "create policy places_authenticated_update on public.places for update to authenticated using ( created_by_user_id = (select auth.uid()) and moderation_status <> 'approved' )",
  'drop policy if exists reviews_public_select on public.reviews',
  "create policy reviews_public_select on public.reviews for select to anon using (moderation_status = 'approved')",
  "create policy reviews_authenticated_select on public.reviews for select to authenticated using ( moderation_status = 'approved' or author_user_id = (select auth.uid()) )",
]);
forbids(migration, [
  'create policy places_public_select on public.places for select to anon, authenticated using (true)',
  'create policy reviews_public_select on public.reviews for select to anon, authenticated using (true)',
]);

// Ownership protections from the earlier migrations stay in force, and the privileged admin storage
// remains unreachable from a client.
requires(migration, [
  'enable row level security',
  'revoke all on table public.admin_accounts from public, anon, authenticated',
  'revoke all on table public.admin_audit_events from public, anon, authenticated',
  'revoke all on table public.service_events from public, anon, authenticated',
]);

// ---------------------------------------------------------------- trust survives moderation
// An administrator's verification is not review traffic's to undo.
requires(migration, [
  'create or replace function public.update_place_rating_aggregate()',
  'and r.seed_data = false and r.moderation_status =',
  "when p.trust_level in ('external', 'official') then p.trust_level",
  "when live_review_count > 0 then 'community' else 'unverified'",
]);
forbids(migration, [
  // A blanket overwrite is the defect this guards against, in either spelling.
  "trust_level = case when live_review_count > 0 then 'community' else 'unverified' end",
  "set rating = live_rating, review_count = live_review_count, rating_provenance = case when live_review_count > 0 then 'community' else 'unrated' end, trust_level = case when live_review_count > 0 then 'community' else 'unverified' end",
]);
// last_verified_at belongs to curation: the aggregate must not write it at all.
if (/update\s+public\.places\s+p\s+set[^;]*last_verified_at/s.test(readFileSync(MIGRATION, 'utf8'))) {
  throw new Error(`${migration}: review aggregation must not write places.last_verified_at`);
}

// ---------------------------------------------------------------- nothing destroys user data
forbids(migration, [
  'delete from public.places',
  'delete from public.reviews',
  'truncate',
  'drop table',
  'drop policy if exists places_authenticated_select_public',
]);
requires(migration, [
  // Rejection is a state, so a moderated row is still there to inspect.
  "check (moderation_status in ('pending', 'approved', 'needs_changes', 'rejected'))",
]);

// ---------------------------------------------------------------- the API half of the same rule
// The API server queries with a privileged client, which RLS does not bind, so its reads apply the
// published filter explicitly, and its create path never trusts a column default.
requires('server/publication.ts', [
  "export const PUBLISHED_MODERATION_STATUS = 'approved'",
  "export const PENDING_MODERATION_STATUS = 'pending'",
  'export function isPublished(',
  'export function publishedForEveryone',
  'export function publishedRows',
]);
requires('server/dal.ts', [
  "import { isPublished, PUBLISHED_MODERATION_STATUS, PENDING_MODERATION_STATUS, publishedForEveryone } from './publication.ts'",
  "moderation_status: PENDING_MODERATION_STATUS",
  '.eq(\'moderation_status\', PUBLISHED_MODERATION_STATUS)',
  'reviews: publishedForEveryone(row.reviews).map(mapReview)',
  'if (!data) return null;',
  'return viewer && isPublished(data, viewer.id) ? mapPlace(data) : null;',
]);
forbids('server/dal.ts', [
  // "Not rejected" is not "published": it would leak queued submissions back into the app.
  ".not('moderation_status', 'eq', 'rejected')",
]);
for (const path of ['api/index.ts', 'api/navigation.ts', 'api/plan-trip.ts']) {
  requires(path, [".eq('moderation_status', 'approved')"]);
  forbids(path, [".not('moderation_status', 'eq', 'rejected')"]);
}
forbids('server.ts', [".not('moderation_status', 'eq', 'rejected')"]);

// The seed importer must keep declaring its provenance, or a re-import would land in the queue and
// the bundled catalogue would stop publishing itself.
requires('scripts/seed-supabase.ts', ['seed_data: true']);

// ---------------------------------------------------------------- the administrator surface
// A privileged list read must not be narrowed to published rows: moderators inspect every state.
if (!/async moderationQueue\([\s\S]*?\['pending', 'needs_changes'\]/.test(readFileSync('server/admin.ts', 'utf8'))) {
  throw new Error('server/admin.ts: the moderation queue must offer pending and needs_changes to a moderator');
}
for (const method of ['grantRole', 'revokeRole']) {
  const source = readFileSync('server/admin.ts', 'utf8');
  const body = source.slice(source.indexOf(`async ${method}(`));
  const head = body.slice(0, body.indexOf('await db()') === -1 ? body.length : body.indexOf('await db()'));
  if (!head.includes("requireUuid(input.targetUserId, 'target account')")) {
    throw new Error(`server/admin.ts: ${method} must validate the target account before touching the database`);
  }
}

// ---------------------------------------------------------------- role cache: one documented shape
// The cache is keyed by account (not by token) and a role change invalidates that account's entry.
requires('server.ts', [
  'const cacheKey = `${options.superUser ? \'super\' : \'admin\'}:${req.user.id}`;',
  'function invalidateAdminActorCache(userId: string)',
  'adminActorCache.delete(`admin:${userId}`);',
  'adminActorCache.delete(`super:${userId}`);',
  'invalidateAdminActorCache(input.targetUserId as string);',
]);
forbids('server.ts', [
  // The comment used to promise a token-hash key that the code never implemented.
  'keyed by a hash of the access token',
  'admin:${hash',
  'cacheKey = adminTokenHash',
]);
if ((flat('server.ts').match(/invalidateAdminActorCache\(input\.targetUserId as string\)/g) ?? []).length !== 2) {
  throw new Error('server.ts: both the grant and the revoke route must invalidate the affected account');
}

console.log('Moderation and publication contract verification passed');

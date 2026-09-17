-- My Sindbad — Admin Control Center: moderation state, persistent admin roles,
-- audit trail, operational telemetry, and the database-side authorization that
-- makes every privileged write independently verifiable.
--
-- Design rules encoded here:
--   * No client (anon/authenticated) access to any new table: RLS is enabled with
--     no policies and grants are revoked, so only the service role (the API server)
--     can read or write them.
--   * Privileged writes go through SECURITY DEFINER functions that re-check that the
--     administrator id they were given is an active admin, and that refuse unknown
--     input keys. They are executable by service_role only, so a browser cannot
--     reach them directly through PostgREST at all.
--   * Existing rating-truth semantics are extended, never bypassed: aggregates count
--     only approved, non-seed reviews, and an empty result set still means
--     rating = null / review_count = 0 / provenance = 'unrated'.
--   * Nothing here deletes user data. Moderation is a reversible state, and there is
--     no purge or reset function in this migration.

begin;

-- ---------------------------------------------------------------------------
-- 1. Place moderation state.
--
--    The column is *added* with default 'approved' so that every row already in the
--    table - the published catalogue, the curated seed import - is backfilled to the
--    state it is effectively in today and keeps being published. The default for
--    future writes is then deliberately flipped to 'pending': a traveller submission
--    has to be decided on by a moderator instead of inheriting visibility from a
--    schema accident. enforce_places_submission_state() below applies the same rule
--    to writers that name a status explicitly, so no client can self-publish.
-- ---------------------------------------------------------------------------
alter table public.places
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'needs_changes', 'rejected')),
  add column if not exists moderation_note text
    check (moderation_note is null or length(moderation_note) <= 500),
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

-- New rows are a submission until a moderator says otherwise; existing rows are untouched.
alter table public.places alter column moderation_status set default 'pending';

create index if not exists places_moderation_created_idx
  on public.places (moderation_status, created_at desc);

-- The author's own queued submission (RLS below) and "my submissions" style counts.
create index if not exists places_author_moderation_idx
  on public.places (created_by_user_id, moderation_status);

-- The queue facets and the consumer filters both group on these.
create index if not exists places_category_idx on public.places (category);
create index if not exists places_region_idx on public.places (region);
create index if not exists places_source_idx on public.places (source);

-- ---------------------------------------------------------------------------
-- 2. Review moderation state, and aggregates that follow it.
--
--    Reviews keep an 'approved' default on purpose: publishing a traveller's review at
--    the moment they write it is the accepted product contract of this app (see the
--    rating-truth constraints), and moderation is the after-the-fact tool that withdraws
--    a review. Places are the opposite: they enter the catalogue through a queue. Both
--    are protected by the same column lock below, so neither state can be edited away by
--    whoever owns the row.
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'pending', 'rejected')),
  add column if not exists moderation_note text
    check (moderation_note is null or length(moderation_note) <= 500),
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null;

create index if not exists reviews_moderation_date_idx
  on public.reviews (moderation_status, "date" desc);

create or replace function public.update_place_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_place_id uuid;
  live_rating numeric(3,2);
  live_review_count integer;
begin
  target_place_id := coalesce(new.place_id, old.place_id);

  select avg(r.rating)::numeric(3,2), count(*)::integer
  into live_rating, live_review_count
  from public.reviews r
  where r.place_id = target_place_id
    and r.seed_data = false
    and r.moderation_status = 'approved';

  update public.places p
  set rating = live_rating,
      review_count = live_review_count,
      rating_provenance = case when live_review_count > 0 then 'community' else 'unrated' end,
      -- Review traffic describes what the crowd thinks of a place; it is not evidence about how
      -- well documented the record is. A place an administrator verified against an official or
      -- external source keeps that verification through review inserts, edits, moderation and
      -- deletes - otherwise moderating one review would silently downgrade a verified record.
      -- Aggregation may only lift an unverified record to 'community' and drop it back when the
      -- real community reviews that justified it appear or disappear.
      trust_level = case
        when p.trust_level in ('external', 'official') then p.trust_level
        when live_review_count > 0 then 'community'
        else 'unverified'
      end
  where id = target_place_id;
  return coalesce(new, old);
end;
$$;

-- Moderating a review is an UPDATE, so the aggregate trigger has to watch updates too.
drop trigger if exists reviews_update_place_rating on public.reviews;
create trigger reviews_update_place_rating
after insert or update or delete on public.reviews
for each row execute function public.update_place_rating_aggregate();

-- ---------------------------------------------------------------------------
-- 2b. The state machine, enforced here rather than in a caller.
--
--     app.allow_moderation_write is a transaction-local flag that only the moderation RPCs
--     set. Without it: a new place is a submission, a new review keeps the accepted
--     publish-on-write behaviour, and nobody - including the row's own author - may move a
--     row in or out of publication by editing the moderation columns directly.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_places_submission_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_moderation_write', true), '') = 'on' then
    return new;
  end if;
  if coalesce(new.seed_data, false) then
    -- Curated baseline content (scripts/seed-supabase.ts and any future import that marks its
    -- provenance) is published on arrival; it has already been through review off-platform.
    new.moderation_status := 'approved';
  else
    new.moderation_status := 'pending';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_reviews_submission_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_moderation_write', true), '') = 'on' then
    return new;
  end if;
  if not coalesce(new.seed_data, false) then
    new.moderation_status := 'approved';
    new.moderation_note := null;
    new.moderated_at := null;
    new.moderated_by := null;
  end if;
  return new;
end;
$$;

-- Reads NEW and a GUC only, so clients legitimately need EXECUTE to fire them.
grant execute on function public.enforce_places_submission_state() to anon, authenticated, service_role;
grant execute on function public.enforce_reviews_submission_state() to anon, authenticated, service_role;

drop trigger if exists places_enforce_submission_state on public.places;
create trigger places_enforce_submission_state
before insert on public.places
for each row execute function public.enforce_places_submission_state();

drop trigger if exists reviews_enforce_submission_state on public.reviews;
create trigger reviews_enforce_submission_state
before insert on public.reviews
for each row execute function public.enforce_reviews_submission_state();

create or replace function public.lock_moderation_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.allow_moderation_write', true), '') = 'on' then
    return new;
  end if;
  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_note is distinct from old.moderation_note
     or new.moderated_at is distinct from old.moderated_at
     or new.moderated_by is distinct from old.moderated_by then
    raise exception 'moderation state can only be changed through the moderation workflow'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

grant execute on function public.lock_moderation_columns() to anon, authenticated, service_role;

drop trigger if exists places_lock_moderation_columns on public.places;
create trigger places_lock_moderation_columns
before update on public.places
for each row execute function public.lock_moderation_columns();

drop trigger if exists reviews_lock_moderation_columns on public.reviews;
create trigger reviews_lock_moderation_columns
before update on public.reviews
for each row execute function public.lock_moderation_columns();

-- ---------------------------------------------------------------------------
-- 3. Persistent admin authorization. Deliberately not a column on user_profiles
--    and never readable from a client: a role is a server-side fact checked on
--    every privileged request, so revocation is immediate (no stale JWT claim to
--    wait out) and no client-writable storage can grant it.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'super_admin')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason is null or length(revoke_reason) <= 500),
  constraint admin_accounts_revocation_order check (revoked_at is null or granted_at <= revoked_at)
);

create index if not exists admin_accounts_active_idx
  on public.admin_accounts (user_id) where revoked_at is null;

alter table public.admin_accounts enable row level security;
revoke all on table public.admin_accounts from public, anon, authenticated;
grant select on table public.admin_accounts to service_role;

-- ---------------------------------------------------------------------------
-- 4. Audit trail for administrative mutations. Append-only by construction: no
--    policy, no update or delete grant to any role, and no purge function, so
--    retention stays a storage decision instead of a button in this UI.
-- ---------------------------------------------------------------------------
create or replace function public.admin_write_audit(
  p_admin_user_id uuid,
  p_admin_role text,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_change_summary jsonb,
  p_request_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_events (
    admin_user_id, admin_label, admin_role, action, target_type, target_id, reason, change_summary, request_id
  )
  values (
    p_admin_user_id,
    (select coalesce(nullif(trim(display_name), ''), 'Administrator')
       from public.user_profiles where user_id = p_admin_user_id),
    p_admin_role,
    p_action,
    p_target_type,
    p_target_id,
    nullif(trim(coalesce(p_reason, '')), ''),
    coalesce(p_change_summary, '{}'::jsonb),
    nullif(trim(coalesce(p_request_id, '')), '')
  );
$$;

create table if not exists public.admin_audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  admin_user_id uuid references auth.users(id) on delete set null,
  -- Snapshot of the acting administrator's display name so the record stays
  -- readable if the account is later deleted. Never an email, token or secret.
  admin_label text check (admin_label is null or length(admin_label) <= 120),
  admin_role text check (admin_role in ('admin', 'super_admin')),
  action text not null check (length(action) between 2 and 64),
  target_type text not null check (target_type in ('place', 'review', 'traveler', 'admin_role')),
  target_id text not null check (length(target_id) <= 64),
  reason text check (reason is null or length(reason) <= 500),
  change_summary jsonb not null default '{}'::jsonb,
  request_id text check (request_id is null or length(request_id) <= 64)
);

create index if not exists admin_audit_events_recent_idx
  on public.admin_audit_events (occurred_at desc);
create index if not exists admin_audit_events_target_idx
  on public.admin_audit_events (target_type, target_id, occurred_at desc);

alter table public.admin_audit_events enable row level security;
revoke all on table public.admin_audit_events from public, anon, authenticated;
grant select, insert on table public.admin_audit_events to service_role;
grant usage, select on sequence public.admin_audit_events_id_seq to service_role;

revoke all on function public.admin_write_audit(uuid, text, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.admin_write_audit(uuid, text, text, text, text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Operational telemetry: bounded, non-personal service outcomes. Carries no
--    user id, no request body, no prompt text and no upstream URLs — just enough
--    to answer "what failed, when, and how slowly".
-- ---------------------------------------------------------------------------
create table if not exists public.service_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  service text not null check (service in ('ai', 'weather', 'place_discovery', 'tiles')),
  outcome text not null check (outcome in ('ok', 'error', 'unavailable', 'rate_limited', 'rejected')),
  endpoint text check (endpoint is null or length(endpoint) <= 96),
  latency_ms integer check (latency_ms is null or (latency_ms >= 0 and latency_ms <= 3600000)),
  status_class smallint check (status_class is null or status_class between 100 and 599),
  detail text check (detail is null or length(detail) <= 240)
);

create index if not exists service_events_recent_idx on public.service_events (occurred_at desc);
create index if not exists service_events_service_recent_idx
  on public.service_events (service, occurred_at desc);
create index if not exists service_events_problem_idx
  on public.service_events (occurred_at desc) where outcome <> 'ok';

alter table public.service_events enable row level security;
revoke all on table public.service_events from public, anon, authenticated;
grant select, insert on table public.service_events to service_role;
grant usage, select on sequence public.service_events_id_seq to service_role;

create or replace function public.admin_record_service_event(
  p_service text,
  p_outcome text,
  p_endpoint text,
  p_latency_ms integer,
  p_status_class smallint,
  p_detail text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.service_events (service, outcome, endpoint, latency_ms, status_class, detail)
  values (
    case when p_service in ('ai', 'weather', 'place_discovery', 'tiles') then p_service else null end,
    case when p_outcome in ('ok', 'error', 'unavailable', 'rate_limited', 'rejected') then p_outcome else null end,
    left(nullif(trim(coalesce(p_endpoint, '')), ''), 96),
    greatest(0, least(coalesce(p_latency_ms, 0), 3600000)),
    case when p_status_class between 100 and 599 then p_status_class else null end,
    left(nullif(trim(coalesce(p_detail, '')), ''), 240)
  )
  where p_service in ('ai', 'weather', 'place_discovery', 'tiles')
    and p_outcome in ('ok', 'error', 'unavailable', 'rate_limited', 'rejected');
$$;

revoke all on function public.admin_record_service_event(text, text, text, integer, smallint, text)
  from public, anon, authenticated;
grant execute on function public.admin_record_service_event(text, text, text, integer, smallint, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. The authorization primitive everything else uses.
-- ---------------------------------------------------------------------------
create or replace function public.admin_role_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.admin_accounts
  where user_id = p_user_id
    and revoked_at is null;
$$;

revoke all on function public.admin_role_of(uuid) from public, anon, authenticated;
grant execute on function public.admin_role_of(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Privileged writes. Each re-checks the administrator id it was handed, so an
--    API-layer mistake cannot by itself produce an unauthorized mutation, and each
--    records its audit row in the same transaction as the change.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_place_moderation(
  p_admin_user_id uuid,
  p_place_id uuid,
  p_status text,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_previous text;
  v_row public.places;
begin
  v_role := public.admin_role_of(p_admin_user_id);
  if v_role is null then
    raise exception 'administrator authorization required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('pending', 'approved', 'needs_changes', 'rejected') then
    raise exception 'unsupported moderation status' using errcode = '22023';
  end if;

  select moderation_status into v_previous from public.places where id = p_place_id;
  if v_previous is null then
    raise exception 'place not found' using errcode = 'P0002';
  end if;

  -- Claim the moderation context for this transaction: the insert/update guards in section 2b
  -- accept a moderation-state change only when the workflow that owns it is the one asking.
  perform set_config('app.allow_moderation_write', 'on', true);

  update public.places
  set moderation_status = p_status,
      moderation_note = nullif(trim(coalesce(p_reason, '')), ''),
      moderated_at = now(),
      moderated_by = p_admin_user_id
  where id = p_place_id
  returning * into v_row;

  perform public.admin_write_audit(
    p_admin_user_id, v_role, 'place.moderation.' || p_status, 'place', v_row.id::text,
    p_reason,
    jsonb_build_object('from', v_previous, 'to', v_row.moderation_status, 'name', v_row.name),
    p_request_id
  );

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'moderationStatus', v_row.moderation_status,
    'moderatedAt', v_row.moderated_at
  );
end;
$$;

create or replace function public.admin_update_place_curation(
  p_admin_user_id uuid,
  p_place_id uuid,
  p_patch jsonb,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_field_count integer;
  v_key text;
  v_row public.places;
begin
  v_role := public.admin_role_of(p_admin_user_id);
  if v_role is null then
    raise exception 'administrator authorization required' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'curation patch must be an object' using errcode = '22023';
  end if;
  select count(*) into v_field_count from jsonb_object_keys(p_patch) as keys;
  if v_field_count = 0 then
    raise exception 'no curation fields supplied' using errcode = '22023';
  end if;

  -- Anything outside the curated content set is refused before the table is touched,
  -- so rating fields, seed baselines and moderation state cannot be smuggled through
  -- the curation path.
  for v_key in select jsonb_object_keys(p_patch) as keys loop
    if v_key not in ('name', 'arabic_name', 'french_name', 'description', 'formation_info', 'region', 'area',
                     'address', 'category', 'sub_category', 'opening_hours', 'price_level', 'contact_phone',
                     'trust_level') then
      raise exception 'curation field is not editable: %', v_key using errcode = '42802';
    end if;
  end loop;

  if p_patch ? 'category' and p_patch->>'category' not in
     ('accommodation', 'tourist_poi', 'restaurant', 'emergency', 'campsite', 'service') then
    raise exception 'invalid category' using errcode = '22023';
  end if;
  if p_patch ? 'price_level' and (p_patch->>'price_level') is not null
     and p_patch->>'price_level' not in ('$', '$$', '$$$', '$$$$') then
    raise exception 'invalid price level' using errcode = '22023';
  end if;
  if p_patch ? 'trust_level' and p_patch->>'trust_level' not in
     ('unverified', 'community', 'external', 'official') then
    raise exception 'invalid trust level' using errcode = '22023';
  end if;
  if (p_patch ? 'name' and btrim(coalesce(p_patch->>'name', '')) = '')
     or (p_patch ? 'description' and btrim(coalesce(p_patch->>'description', '')) = '')
     or (p_patch ? 'region' and btrim(coalesce(p_patch->>'region', '')) = '')
     or (p_patch ? 'area' and btrim(coalesce(p_patch->>'area', '')) = '')
     or (p_patch ? 'address' and btrim(coalesce(p_patch->>'address', '')) = '') then
    raise exception 'required place fields cannot be emptied' using errcode = '22023';
  end if;

  update public.places
  set name = case when p_patch ? 'name' then btrim(p_patch->>'name') else name end,
      arabic_name = case when p_patch ? 'arabic_name' then nullif(btrim(p_patch->>'arabic_name'), '') else arabic_name end,
      french_name = case when p_patch ? 'french_name' then nullif(btrim(p_patch->>'french_name'), '') else french_name end,
      description = case when p_patch ? 'description' then btrim(p_patch->>'description') else description end,
      formation_info = case when p_patch ? 'formation_info' then nullif(btrim(p_patch->>'formation_info'), '') else formation_info end,
      region = case when p_patch ? 'region' then btrim(p_patch->>'region') else region end,
      area = case when p_patch ? 'area' then btrim(p_patch->>'area') else area end,
      address = case when p_patch ? 'address' then btrim(p_patch->>'address') else address end,
      category = case when p_patch ? 'category' then (p_patch->>'category')::public.place_category else category end,
      sub_category = case when p_patch ? 'sub_category' then nullif(btrim(p_patch->>'sub_category'), '') else sub_category end,
      opening_hours = case when p_patch ? 'opening_hours' then nullif(btrim(p_patch->>'opening_hours'), '') else opening_hours end,
      price_level = case when p_patch ? 'price_level' then nullif(p_patch->>'price_level', '') else price_level end,
      contact_phone = case when p_patch ? 'contact_phone' then nullif(btrim(p_patch->>'contact_phone'), '') else contact_phone end,
      trust_level = case when p_patch ? 'trust_level' then p_patch->>'trust_level' else trust_level end,
      last_verified_at = case
        when p_patch ? 'trust_level' and p_patch->>'trust_level' in ('external', 'official') then now()
        when p_patch ? 'trust_level' and p_patch->>'trust_level' = 'unverified' then null
        else last_verified_at end
  where id = p_place_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'place not found' using errcode = 'P0002';
  end if;

  perform public.admin_write_audit(
    p_admin_user_id, v_role, 'place.curation.update', 'place', v_row.id::text,
    p_reason,
    jsonb_build_object(
      'fields', (select jsonb_agg(k.key) from jsonb_object_keys(p_patch) as k(key)),
      'result', jsonb_build_object(
        'name', v_row.name,
        'category', v_row.category::text,
        'region', v_row.region,
        'area', v_row.area,
        'trust_level', v_row.trust_level,
        'last_verified_at', v_row.last_verified_at
      )
    ),
    p_request_id
  );

  return jsonb_build_object('id', v_row.id, 'name', v_row.name, 'updatedAt', v_row.updated_at);
end;
$$;

create or replace function public.admin_set_review_moderation(
  p_admin_user_id uuid,
  p_review_id uuid,
  p_status text,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_previous text;
  v_row public.reviews;
  v_place public.places;
begin
  v_role := public.admin_role_of(p_admin_user_id);
  if v_role is null then
    raise exception 'administrator authorization required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'pending', 'rejected') then
    raise exception 'unsupported moderation status' using errcode = '22023';
  end if;

  select moderation_status into v_previous from public.reviews where id = p_review_id;
  if v_previous is null then
    raise exception 'review not found' using errcode = 'P0002';
  end if;

  -- Claim the moderation context for this transaction: the insert/update guards in section 2b
  -- accept a moderation-state change only when the workflow that owns it is the one asking.
  perform set_config('app.allow_moderation_write', 'on', true);

  -- The reviews trigger recomputes the place aggregate for this row.
  update public.reviews
  set moderation_status = p_status,
      moderation_note = nullif(trim(coalesce(p_reason, '')), ''),
      moderated_at = now(),
      moderated_by = p_admin_user_id
  where id = p_review_id
  returning * into v_row;

  select * into v_place from public.places where id = v_row.place_id;

  perform public.admin_write_audit(
    p_admin_user_id, v_role, 'review.moderation.' || p_status, 'review', v_row.id::text,
    p_reason,
    jsonb_build_object(
      'from', v_previous,
      'to', v_row.moderation_status,
      'place_id', v_row.place_id,
      'place_rating_after', v_place.rating,
      'place_review_count_after', v_place.review_count
    ),
    p_request_id
  );

  return jsonb_build_object(
    'id', v_row.id,
    'placeId', v_row.place_id,
    'moderationStatus', v_row.moderation_status,
    'placeRating', v_place.rating,
    'placeReviewCount', v_place.review_count
  );
end;
$$;

create or replace function public.admin_grant_role(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_role text,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  v_role := public.admin_role_of(p_admin_user_id);
  if v_role is distinct from 'super_admin' then
    raise exception 'super administrator authorization required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('admin', 'super_admin') then
    raise exception 'unsupported administrator role' using errcode = '22023';
  end if;
  if p_target_user_id is null then
    raise exception 'a target account is required' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'a reason is required to change an administrator role' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'target account does not exist' using errcode = 'P0002';
  end if;

  insert into public.admin_accounts (user_id, role, granted_by, granted_at, revoked_at, revoke_reason)
  values (p_target_user_id, p_role, p_admin_user_id, now(), null, null)
  on conflict (user_id) do update
    set role = excluded.role,
        granted_by = excluded.granted_by,
        granted_at = excluded.granted_at,
        revoked_at = null,
        revoke_reason = null;

  perform public.admin_write_audit(
    p_admin_user_id, v_role, 'admin_role.grant', 'admin_role', p_target_user_id::text,
    p_reason, jsonb_build_object('role', p_role), p_request_id
  );

  return jsonb_build_object('userId', p_target_user_id, 'role', p_role);
end;
$$;

create or replace function public.admin_revoke_role(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_target_role text;
  v_others integer;
begin
  v_role := public.admin_role_of(p_admin_user_id);
  if v_role is distinct from 'super_admin' then
    raise exception 'super administrator authorization required' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'a reason is required to revoke an administrator' using errcode = '22023';
  end if;

  v_target_role := public.admin_role_of(p_target_user_id);
  select count(*) into v_others
  from public.admin_accounts
  where revoked_at is null
    and role = 'super_admin'
    and user_id <> p_target_user_id;

  if v_target_role = 'super_admin' and v_others = 0 then
    raise exception 'the last super administrator cannot be revoked' using errcode = '22023';
  end if;

  update public.admin_accounts
  set revoked_at = now(), revoke_reason = btrim(p_reason)
  where user_id = p_target_user_id and revoked_at is null;

  perform public.admin_write_audit(
    p_admin_user_id, v_role, 'admin_role.revoke', 'admin_role', p_target_user_id::text,
    p_reason, jsonb_build_object('previous_role', v_target_role), p_request_id
  );

  return jsonb_build_object('userId', p_target_user_id, 'revoked', true);
end;
$$;

revoke all on function
  public.admin_set_place_moderation(uuid, uuid, text, text, text),
  public.admin_update_place_curation(uuid, uuid, jsonb, text, text),
  public.admin_set_review_moderation(uuid, uuid, text, text, text),
  public.admin_grant_role(uuid, uuid, text, text, text),
  public.admin_revoke_role(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function
  public.admin_set_place_moderation(uuid, uuid, text, text, text),
  public.admin_update_place_curation(uuid, uuid, jsonb, text, text),
  public.admin_set_review_moderation(uuid, uuid, text, text, text),
  public.admin_grant_role(uuid, uuid, text, text, text),
  public.admin_revoke_role(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 8. Duplicate candidates for a submission, computed in the database so the
--    queue never transfers the catalog to a browser. The search uses the btree
--    indexes above; a trigram index is documented as the next step if the catalog
--    grows past the point where ilike over thousands of rows stops being fast.
-- ---------------------------------------------------------------------------
create or replace function public.admin_place_duplicate_candidates(
  p_place_id uuid,
  p_radius_meters numeric default 400,
  p_limit integer default 5
)
returns table (
  candidate_id uuid,
  candidate_name text,
  candidate_area text,
  candidate_category text,
  candidate_moderation_status text,
  candidate_lat numeric,
  candidate_lng numeric,
  distance_meters numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select
      p.id,
      (p.coordinates->>0)::double precision as lat,
      (p.coordinates->>1)::double precision as lng
    from public.places p
    where p.id = p_place_id
  )
  select
    p.id as candidate_id,
    p.name as candidate_name,
    p.area as candidate_area,
    p.category::text as candidate_category,
    p.moderation_status as candidate_moderation_status,
    round((p.coordinates->>0)::numeric, 6) as candidate_lat,
    round((p.coordinates->>1)::numeric, 6) as candidate_lng,
    round((2 * 6371000 * asin(sqrt(
      power(sin(radians(((p.coordinates->>0)::double precision - t.lat) / 2)), 2) +
      cos(radians(t.lat)) * cos(radians((p.coordinates->>0)::double precision)) *
      power(sin(radians(((p.coordinates->>1)::double precision - t.lng) / 2)), 2)
    )))::numeric) as distance_meters
  from target t
  join public.places p on p.id <> t.id
  where (p.coordinates->>0)::double precision between t.lat - (p_radius_meters / 111000.0)
                                         and t.lat + (p_radius_meters / 111000.0)
    and (p.coordinates->>1)::double precision between t.lng - (p_radius_meters / 85000.0)
                                         and t.lng + (p_radius_meters / 85000.0)
  order by distance_meters asc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$$;

revoke all on function public.admin_place_duplicate_candidates(uuid, numeric, integer) from public, anon, authenticated;
grant execute on function public.admin_place_duplicate_candidates(uuid, numeric, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 9. One aggregate round trip for the operations overview. Every number in it is
--    computed from real rows and every figure is a count or a distribution - no
--    trend is reported because no history table exists to derive one from.
-- ---------------------------------------------------------------------------
create or replace function public.admin_operations_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'generated_at', now(),
    'places', (
      select jsonb_build_object(
        'total', count(*),
        'by_moderation', (
          select coalesce(jsonb_object_agg(key, count), '{}'::jsonb)
          from (
            select p2.moderation_status as key, count(*) as count
            from public.places p2
            group by p2.moderation_status
          ) m
        ),
        'by_category', (
          select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc), '[]'::jsonb)
          from (
            select p2.category::text as k, count(*) as c
            from public.places p2
            group by p2.category
            order by count(*) desc
          ) cat
        ),
        'by_source', (
          select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc), '[]'::jsonb)
          from (
            select p2.source::text as k, count(*) as c
            from public.places p2
            group by p2.source
            order by count(*) desc
          ) src
        ),
        'top_regions', (
          select coalesce(jsonb_agg(jsonb_build_object('key', k, 'count', c) order by c desc), '[]'::jsonb)
          from (
            select coalesce(nullif(trim(p2.region), ''), '—') as k, count(*) as c
            from public.places p2
            group by 1
            order by count(*) desc
            limit 6
          ) reg
        ),
        'with_live_rating', count(*) filter (where p1.review_count > 0),
        'unrated', count(*) filter (where p1.review_count = 0),
        'hidden_gems', count(*) filter (where p1.is_under_documented_gem),
        'officially_verified', count(*) filter (where p1.trust_level = 'official'),
        'created_last_24h', count(*) filter (where p1.created_at >= now() - interval '24 hours'),
        'modified_last_24h', count(*) filter (where p1.updated_at >= now() - interval '24 hours')
      )
      from public.places p1
    ),
    'reviews', (
      select jsonb_build_object(
        'live_total', count(*) filter (where r.seed_data = false),
        'approved', count(*) filter (where r.seed_data = false and r.moderation_status = 'approved'),
        'pending', count(*) filter (where r.seed_data = false and r.moderation_status = 'pending'),
        'rejected', count(*) filter (where r.seed_data = false and r.moderation_status = 'rejected'),
        'last_24h', count(*) filter (where r.seed_data = false and r."date" >= now() - interval '24 hours')
      )
      from public.reviews r
    ),
    'checkins', (
      select jsonb_build_object(
        'total', count(*),
        'last_7d', count(*) filter (where c.checked_in_at >= now() - interval '7 days')
      )
      from public.place_checkins c
    ),
    'traces', (
      select jsonb_build_object(
        'last_7d', count(*)
      )
      from public.traces tr
      where tr.timestamp >= now() - interval '7 days'
    ),
    'trips', (
      select jsonb_build_object(
        'total', count(*),
        'by_status', (
          select coalesce(jsonb_object_agg(k, c), '{}'::jsonb)
          from (
            select t2.status as k, count(*) as c
            from public.trips t2
            group by t2.status
          ) s
        ),
        'created_last_7d', count(*) filter (where t1.created_at >= now() - interval '7 days')
      )
      from public.trips t1
    ),
    'travelers', (
      select jsonb_build_object(
        'profiles_total', count(*),
        'created_last_7d', count(*) filter (where u.created_at >= now() - interval '7 days'),
        'with_language_preference', count(*) filter (where u.preferred_language is not null)
      )
      from public.user_profiles u
    ),
    'moderators', (
      select jsonb_build_object(
        'active_total', count(*),
        'super_admins', count(*) filter (where a.role = 'super_admin')
      )
      from public.admin_accounts a
      where a.revoked_at is null
    ),
    'ai', (
      select jsonb_build_object(
        'last_24h', count(*),
        'by_endpoint', (
          select coalesce(jsonb_object_agg(k, c), '{}'::jsonb)
          from (
            select e.endpoint as k, count(*) as c
            from public.ai_usage_events e
            where e.created_at >= now() - interval '24 hours'
            group by e.endpoint
          ) x
        )
      )
      from public.ai_usage_events e2
      where e2.created_at >= now() - interval '24 hours'
    ),
    'services', (
      select jsonb_build_object(
        'last_24h', count(*),
        'problems_last_24h', count(*) filter (where s.outcome <> 'ok'),
        'by_service', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'service', g.service,
            'ok', g.ok,
            'failed', g.failed
          ) order by g.failed desc, g.service), '[]'::jsonb)
          from (
            select
              s2.service as service,
              count(*) filter (where s2.outcome = 'ok') as ok,
              count(*) filter (where s2.outcome <> 'ok') as failed
            from public.service_events s2
            where s2.occurred_at >= now() - interval '24 hours'
            group by s2.service
          ) g
        ),
        'last_problem_at', (select max(occurred_at) from public.service_events where outcome <> 'ok')
      )
      from public.service_events s
      where s.occurred_at >= now() - interval '24 hours'
    ),
    'audit', (
      select jsonb_build_object(
        'last_24h', count(*),
        'last_event_at', max(occurred_at)
      )
      from public.admin_audit_events
      where occurred_at >= now() - interval '24 hours'
    )
  );
$$;

revoke all on function public.admin_operations_snapshot() from public, anon, authenticated;
grant execute on function public.admin_operations_snapshot() to service_role;

-- ---------------------------------------------------------------------------
-- 10. Publication at the row-security boundary.
--
--     Places and reviews were readable by any client (`using (true)`), so moderation was a
--     convention inside the API only: a direct PostgREST call with the anon key could still read
--     a queued or rejected row. The rules below make publication a property of the database, the
--     same rule server/publication.ts applies to the reads the API performs with a privileged
--     client (service_role bypasses RLS by design, so the API half is not optional either).
--
--     Ownership protections are kept, never relaxed: the author predicates from the earlier
--     migrations stay in every policy here, and an author's reach stops at publication - they can
--     read and edit their own queued submission, but cannot mark it published.
-- ---------------------------------------------------------------------------
drop policy if exists places_public_select on public.places;
create policy places_public_select on public.places
for select to anon
using (moderation_status = 'approved');

drop policy if exists places_authenticated_select on public.places;
create policy places_authenticated_select on public.places
for select to authenticated
using (
  moderation_status = 'approved'
  or created_by_user_id = (select auth.uid())
);

drop policy if exists places_authenticated_insert on public.places;
create policy places_authenticated_insert on public.places
for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and moderation_status = 'pending'
);

drop policy if exists places_authenticated_update on public.places;
create policy places_authenticated_update on public.places
for update to authenticated
using (
  created_by_user_id = (select auth.uid())
  and moderation_status <> 'approved'
)
with check (
  created_by_user_id = (select auth.uid())
  and moderation_status <> 'approved'
);

drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews
for select to anon
using (moderation_status = 'approved');

drop policy if exists reviews_authenticated_select on public.reviews;
create policy reviews_authenticated_select on public.reviews
for select to authenticated
using (
  moderation_status = 'approved'
  or author_user_id = (select auth.uid())
);

-- The accepted review write rules from 20260913232538 (own row, traveler role, never seed data)
-- stay exactly as they were; no review policy is redefined here.

comment on table public.admin_accounts is 'Persistent administrator roster. Server-side only; never exposed to clients.';
comment on table public.admin_audit_events is 'Append-only record of administrative mutations.';
comment on table public.service_events is 'Bounded operational telemetry. No user data, tokens, or request bodies.';
comment on column public.places.moderation_status is 'Publication state. Only ''approved'' is published; pending and needs_changes are queued, rejected stays stored and unpublished. Row-security policies and the API reads both apply it.';
comment on column public.places.trust_level is 'Verification of the record, owned by curation. Review aggregation never lowers external/official; see update_place_rating_aggregate().';
comment on column public.reviews.moderation_status is 'Only approved, non-seed reviews are counted by update_place_rating_aggregate() or readable through row-level security.';

commit;

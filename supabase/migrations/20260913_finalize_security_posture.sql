begin;

-- Make the backward-compatible wrapper explicitly invoker security. The fixed
-- one-argument implementation remains SECURITY DEFINER by design because it
-- performs an atomic counter update after validating auth.uid().
alter function public.record_place_checkin(uuid, integer) security invoker;

-- These tables are intentionally server-internal. Explicit deny policies keep
-- the RLS posture machine-readable for Supabase Advisor in addition to revoked grants.
drop policy if exists api_rate_limits_deny_client_access on public.api_rate_limits;
create policy api_rate_limits_deny_client_access
on public.api_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists review_seed_archive_deny_client_access on public.review_seed_archive;
create policy review_seed_archive_deny_client_access
on public.review_seed_archive
for all
to anon, authenticated
using (false)
with check (false);

commit;

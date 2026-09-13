begin;

drop policy if exists api_rate_limits_deny_client_access
  on public.api_rate_limits;

commit;

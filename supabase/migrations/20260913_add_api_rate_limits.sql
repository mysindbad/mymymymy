begin;

create table if not exists public.api_rate_limits (
  key_hash text not null,
  scope text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (key_hash, scope)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_started_at timestamptz;
  v_request_count integer;
  v_now timestamptz := now();
begin
  if p_key_hash is null or length(p_key_hash) < 16 then
    raise exception 'invalid rate-limit key';
  end if;
  if p_scope is null or length(trim(p_scope)) = 0 or length(p_scope) > 100 then
    raise exception 'invalid rate-limit scope';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate-limit limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate-limit window';
  end if;

  insert into public.api_rate_limits (key_hash, scope, window_started_at, request_count)
  values (p_key_hash, p_scope, v_now, 1)
  on conflict (key_hash, scope) do update
  set
    request_count = case
      when public.api_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.api_rate_limits.window_started_at <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else public.api_rate_limits.window_started_at
    end
  returning public.api_rate_limits.window_started_at, public.api_rate_limits.request_count
    into v_window_started_at, v_request_count;

  allowed := v_request_count <= p_limit;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from ((v_window_started_at + make_interval(secs => p_window_seconds)) - v_now)))::integer)
  end;
  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

commit;

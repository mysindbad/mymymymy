begin;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (endpoint in ('chat','plan_trip')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_endpoint_time_idx
  on public.ai_usage_events(user_id, endpoint, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on public.ai_usage_events from anon, authenticated;

create or replace function public.consume_ai_quota(
  endpoint_input text,
  max_requests integer default 30,
  window_seconds integer default 3600
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  used integer;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  if endpoint_input not in ('chat','plan_trip') then
    raise exception 'invalid endpoint';
  end if;

  if max_requests < 1 or max_requests > 1000
     or window_seconds < 60 or window_seconds > 86400 then
    raise exception 'invalid quota configuration';
  end if;

  perform pg_advisory_xact_lock(hashtext(caller_id::text || ':' || endpoint_input));

  delete from public.ai_usage_events
   where created_at < now() - interval '2 days';

  select count(*)::integer
    into used
    from public.ai_usage_events
   where user_id = caller_id
     and endpoint = endpoint_input
     and created_at >= now() - make_interval(secs => window_seconds);

  if used >= max_requests then
    raise exception 'ai_rate_limited';
  end if;

  insert into public.ai_usage_events(user_id, endpoint)
  values (caller_id, endpoint_input);

  return max_requests - used - 1;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated;

commit;

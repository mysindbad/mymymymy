begin;

create index if not exists place_checkins_place_id_idx on public.place_checkins(place_id);
create index if not exists traces_user_id_idx on public.traces(user_id);

drop policy if exists ai_usage_deny_direct_access on public.ai_usage_events;
create policy ai_usage_deny_direct_access
on public.ai_usage_events
for all
to authenticated
using (false)
with check (false);

-- Authenticated users may update only their own profile through RLS, so this
-- helper does not need SECURITY DEFINER privileges.
alter function public.update_user_location(uuid, numeric, numeric, numeric) security invoker;

-- Fixed 60-second cooldown. Clients cannot weaken it by supplying parameters.
create or replace function public.record_place_checkin(place_id_input uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  last_checkin timestamptz;
  updated_count integer;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  select p.check_ins_count
    into updated_count
    from public.places p
   where p.id = place_id_input
   for update;

  if not found then
    raise exception 'place not found';
  end if;

  select pc.checked_in_at
    into last_checkin
    from public.place_checkins pc
   where pc.user_id = caller_id
     and pc.place_id = place_id_input
   order by pc.checked_in_at desc
   limit 1;

  if last_checkin is not null
     and last_checkin > now() - interval '60 seconds' then
    raise exception 'check_in_rate_limited';
  end if;

  insert into public.place_checkins (user_id, place_id)
  values (caller_id, place_id_input);

  update public.places
     set check_ins_count = check_ins_count + 1,
         last_activity_timestamp = now()
   where id = place_id_input
   returning check_ins_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.record_place_checkin(uuid) from public, anon;
grant execute on function public.record_place_checkin(uuid) to authenticated;

-- Backward-compatible overload: the supplied cooldown is intentionally ignored.
-- Existing deployed code can keep calling the old signature without being able
-- to weaken the database-enforced 60-second rule.
create or replace function public.record_place_checkin(
  place_id_input uuid,
  cooldown_seconds integer default 60
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select public.record_place_checkin(place_id_input);
$$;
revoke all on function public.record_place_checkin(uuid, integer) from public, anon;
grant execute on function public.record_place_checkin(uuid, integer) to authenticated;

-- Endpoint limits are fixed server-side: chat=30/hour, plan_trip=10/hour.
create or replace function public.consume_ai_quota(endpoint_input text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  request_limit integer;
  used integer;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  request_limit := case endpoint_input
    when 'chat' then 30
    when 'plan_trip' then 10
    else null
  end;

  if request_limit is null then
    raise exception 'invalid endpoint';
  end if;

  perform pg_advisory_xact_lock(hashtext(caller_id::text || ':' || endpoint_input));

  select count(*)::integer
    into used
    from public.ai_usage_events
   where user_id = caller_id
     and endpoint = endpoint_input
     and created_at >= now() - interval '1 hour';

  if used >= request_limit then
    raise exception 'ai_rate_limited';
  end if;

  insert into public.ai_usage_events(user_id, endpoint)
  values (caller_id, endpoint_input);

  return request_limit - used - 1;
end;
$$;

revoke all on function public.consume_ai_quota(text) from public, anon;
grant execute on function public.consume_ai_quota(text) to authenticated;

-- Backward-compatible overload: max_requests/window_seconds are intentionally
-- ignored so clients cannot weaken the fixed database quota.
create or replace function public.consume_ai_quota(
  endpoint_input text,
  max_requests integer default 30,
  window_seconds integer default 3600
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select public.consume_ai_quota(endpoint_input);
$$;
revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated;

commit;

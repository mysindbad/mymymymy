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

alter function public.update_user_location(uuid, numeric, numeric, numeric) security invoker;

-- Remove configurable/default overloads first so the fixed signatures are not
-- ambiguous. They are re-created below only as compatibility wrappers.
drop function if exists public.record_place_checkin(uuid, integer);
drop function if exists public.consume_ai_quota(text, integer, integer);

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

-- Existing Vercel code passes two arguments. Keep that signature, but ignore
-- the client-supplied cooldown and delegate to the fixed 60-second function.
create function public.record_place_checkin(place_id_input uuid, cooldown_seconds integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select public.record_place_checkin(place_id_input::uuid);
$$;
revoke all on function public.record_place_checkin(uuid, integer) from public, anon;
grant execute on function public.record_place_checkin(uuid, integer) to authenticated;

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

-- Existing Vercel code passes three arguments. Keep that signature, but ignore
-- max_requests/window_seconds so callers cannot weaken the fixed quota.
create function public.consume_ai_quota(endpoint_input text, max_requests integer, window_seconds integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select public.consume_ai_quota(endpoint_input::text);
$$;
revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer, integer) to authenticated;

commit;

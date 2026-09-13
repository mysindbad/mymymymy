begin;

create or replace function public.record_place_checkin_server(
  p_user_id uuid,
  p_place_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  last_checkin timestamptz;
  updated_count integer;
begin
  if p_user_id is null then
    raise exception 'user id required';
  end if;

  select p.check_ins_count
    into updated_count
    from public.places p
   where p.id = p_place_id
   for update;

  if not found then
    raise exception 'place not found';
  end if;

  select pc.checked_in_at
    into last_checkin
    from public.place_checkins pc
   where pc.user_id = p_user_id
     and pc.place_id = p_place_id
   order by pc.checked_in_at desc
   limit 1;

  if last_checkin is not null
     and last_checkin > now() - interval '60 seconds' then
    raise exception 'check_in_rate_limited';
  end if;

  insert into public.place_checkins (user_id, place_id, checked_in_at)
  values (p_user_id, p_place_id, now());

  update public.places
     set check_ins_count = check_ins_count + 1,
         last_activity_timestamp = now()
   where id = p_place_id
   returning check_ins_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.record_place_checkin_server(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_place_checkin_server(uuid, uuid) to service_role;

revoke all on function public.record_place_checkin(uuid) from public, anon, authenticated;
revoke all on function public.record_place_checkin(uuid, integer) from public, anon, authenticated;
revoke all on function public.increment_place_checkins(uuid) from public, anon, authenticated;
grant execute on function public.increment_place_checkins(uuid) to service_role;

revoke all on function public.consume_ai_quota(text) from public, anon, authenticated;
revoke all on function public.consume_ai_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(text) to service_role;
grant execute on function public.consume_ai_quota(text, integer, integer) to service_role;

drop policy if exists api_rate_limits_deny_clients on public.api_rate_limits;
create policy api_rate_limits_deny_clients
on public.api_rate_limits
for all
to anon, authenticated
using (false)
with check (false);

commit;

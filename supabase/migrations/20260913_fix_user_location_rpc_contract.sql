begin;

drop function if exists public.update_user_location(uuid, numeric, numeric, numeric);

create function public.update_user_location(
  p_user_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_accuracy numeric default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text := auth.role();
begin
  if caller_role <> 'service_role' and p_user_id is distinct from caller_id then
    raise exception 'cannot update another user profile';
  end if;

  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates';
  end if;

  if p_accuracy is not null and p_accuracy < 0 then
    raise exception 'invalid accuracy';
  end if;

  insert into public.user_profiles (user_id, last_known_location, updated_at)
  values (
    p_user_id,
    jsonb_build_object('lat', p_lat, 'lng', p_lng, 'accuracy', p_accuracy, 'captured_at', now()),
    now()
  )
  on conflict (user_id) do update
    set last_known_location = excluded.last_known_location,
        updated_at = now();

  return 1;
end;
$$;

revoke all on function public.update_user_location(uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_user_location(uuid, numeric, numeric, numeric) to authenticated, service_role;

commit;

begin;

-- Raw passive GPS traces are private server-side data. Tie every trace to the
-- authenticated user that created it and never expose the raw table to anon.
alter table public.traces
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create or replace function public.set_trace_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists traces_set_user_id on public.traces;
create trigger traces_set_user_id
before insert on public.traces
for each row execute function public.set_trace_user_id();

-- Production currently has no trace rows, but keep this migration safe if a
-- deployment races with us: any legacy null rows are removed rather than left
-- publicly readable without ownership.
delete from public.traces where user_id is null;
alter table public.traces alter column user_id set not null;

alter table public.traces enable row level security;
drop policy if exists traces_public_select on public.traces;
drop policy if exists traces_authenticated_insert on public.traces;

create policy traces_authenticated_insert
on public.traces
for insert
to authenticated
with check (user_id = (select auth.uid()));

revoke select on public.traces from anon, authenticated;
revoke all on function public.set_trace_user_id() from public, anon;
grant execute on function public.set_trace_user_id() to authenticated, service_role;

-- Persist check-ins in Postgres and enforce cooldown atomically. This replaces
-- the per-process in-memory Map that cannot work reliably across serverless
-- instances.
create table if not exists public.place_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create index if not exists place_checkins_user_place_time_idx
  on public.place_checkins (user_id, place_id, checked_in_at desc);

alter table public.place_checkins enable row level security;

drop policy if exists place_checkins_select_own on public.place_checkins;
create policy place_checkins_select_own
on public.place_checkins
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on public.place_checkins from anon;
grant select on public.place_checkins to authenticated;

create or replace function public.record_place_checkin(
  place_id_input uuid,
  cooldown_seconds integer default 60
)
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

  if cooldown_seconds < 1 or cooldown_seconds > 3600 then
    raise exception 'invalid cooldown';
  end if;

  -- Lock the place row so two concurrent requests cannot both pass cooldown.
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
     and last_checkin > now() - make_interval(secs => cooldown_seconds) then
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

-- The legacy increment RPC remains temporarily for compatibility with the
-- currently deployed server, but it is no longer callable by public clients.
revoke all on function public.increment_place_checkins(uuid) from public, anon, authenticated;
grant execute on function public.increment_place_checkins(uuid) to service_role;

revoke all on function public.record_place_checkin(uuid, integer) from public, anon;
grant execute on function public.record_place_checkin(uuid, integer) to authenticated;

-- SECURITY DEFINER trigger helpers should not be exposed as REST RPCs.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_place_rating_aggregate() from public, anon, authenticated;

-- User-location RPC is intended for an authenticated user JWT, not anon.
revoke all on function public.update_user_location(uuid, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_user_location(uuid, numeric, numeric, numeric) to authenticated, service_role;

-- Silence the mutable search_path finding on the timestamp trigger helper.
alter function public.set_updated_at() set search_path = '';
revoke all on function public.set_updated_at() from public, anon, authenticated;

commit;

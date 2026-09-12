create extension if not exists pgcrypto;

create type public.place_category as enum (
  'accommodation',
  'tourist_poi',
  'restaurant',
  'emergency',
  'campsite',
  'service'
);

create type public.review_author_role as enum (
  'traveler',
  'local_resident',
  'guide',
  'owner'
);

create type public.place_source as enum (
  'initial_seed',
  'community_traveler',
  'business_owner'
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  arabic_name text,
  french_name text,
  category public.place_category not null,
  sub_category text,
  region text not null,
  area text not null,
  coordinates jsonb not null,
  address text not null,
  photos text[] not null default '{}',
  description text not null,
  formation_info text,
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  ratings_breakdown jsonb,
  features jsonb,
  price_level text check (price_level in ('$', '$$', '$$$', '$$$$')),
  opening_hours text,
  contact_phone text,
  is_under_documented_gem boolean not null default false,
  source public.place_source not null default 'community_traveler',
  owner_verified boolean not null default false,
  business_owner_name text,
  check_ins_count integer not null default 0 check (check_ins_count >= 0),
  ai_confidence_score numeric(5,2) check (ai_confidence_score is null or ai_confidence_score between 0 and 100),
  last_activity_timestamp timestamptz,
  rank_text text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  seed_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_coordinates_shape check (
    jsonb_typeof(coordinates) = 'array'
    and jsonb_array_length(coordinates) = 2
    and jsonb_typeof(coordinates->0) = 'number'
    and jsonb_typeof(coordinates->1) = 'number'
    and (coordinates->>0)::numeric between -90 and 90
    and (coordinates->>1)::numeric between -180 and 180
  )
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_name text not null,
  author_role public.review_author_role not null,
  rating numeric(2,1) not null check (rating between 1 and 5),
  date timestamptz not null default now(),
  text text not null,
  tags text[] not null default '{}',
  photos text[],
  author_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.traces (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null,
  anonymous_user_id text not null,
  coordinates jsonb not null,
  mode text not null,
  speed_kmh numeric(8,3) check (speed_kmh is null or speed_kmh >= 0),
  near_place_id uuid references public.places(id) on delete set null,
  region text,
  constraint traces_coordinates_shape check (
    jsonb_typeof(coordinates) = 'array'
    and jsonb_array_length(coordinates) = 2
    and jsonb_typeof(coordinates->0) = 'number'
    and jsonb_typeof(coordinates->1) = 'number'
    and (coordinates->>0)::numeric between -90 and 90
    and (coordinates->>1)::numeric between -180 and 180
  )
);

create index reviews_place_id_idx on public.reviews(place_id);
create index reviews_author_user_id_idx on public.reviews(author_user_id);
create index traces_timestamp_idx on public.traces(timestamp desc);
create index traces_near_place_id_idx on public.traces(near_place_id);
create index places_created_by_user_id_idx on public.places(created_by_user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create or replace function public.increment_place_checkins(place_id_input uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare updated_count integer;
begin
  update public.places
  set check_ins_count = check_ins_count + 1,
      last_activity_timestamp = now()
  where id = place_id_input
  returning check_ins_count into updated_count;
  if updated_count is null then
    raise exception 'Place not found';
  end if;
  return updated_count;
end;
$$;

create or replace function public.update_place_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_place_id uuid;
begin
  target_place_id = coalesce(new.place_id, old.place_id);
  update public.places
  set rating = coalesce((select avg(rating)::numeric(3,2) from public.reviews where place_id = target_place_id), 0),
      review_count = (select count(*)::integer from public.reviews where place_id = target_place_id)
  where id = target_place_id;
  return coalesce(new, old);
end;
$$;

create trigger reviews_update_place_rating
after insert or delete on public.reviews
for each row execute function public.update_place_rating_aggregate();

alter table public.places enable row level security;
alter table public.reviews enable row level security;
alter table public.traces enable row level security;

create policy places_public_select on public.places
for select to anon, authenticated using (true);

create policy reviews_public_select on public.reviews
for select to anon, authenticated using (true);

create policy traces_public_select on public.traces
for select to anon, authenticated using (true);

create policy places_authenticated_insert on public.places
for insert to authenticated
with check (created_by_user_id = auth.uid());

create policy places_authenticated_update on public.places
for update to authenticated
using (created_by_user_id = auth.uid())
with check (created_by_user_id = auth.uid());

create policy reviews_authenticated_insert on public.reviews
for insert to authenticated
with check (author_user_id = auth.uid());

create policy reviews_authenticated_update on public.reviews
for update to authenticated
using (author_user_id = auth.uid())
with check (author_user_id = auth.uid());

create policy traces_authenticated_insert on public.traces
for insert to authenticated
with check (true);
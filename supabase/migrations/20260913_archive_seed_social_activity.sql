begin;

alter table public.places
  add column if not exists seed_rating numeric,
  add column if not exists seed_review_count integer not null default 0 check (seed_review_count >= 0),
  add column if not exists seed_owner_verified boolean not null default false,
  add column if not exists seed_source text;

create table if not exists public.review_seed_archive (
  original_id uuid primary key,
  place_id uuid not null,
  author_name text not null,
  author_role text not null,
  rating numeric not null,
  review_date date,
  review_text text not null,
  tags text[] not null default '{}',
  photos text[] not null default '{}',
  archived_at timestamptz not null default now()
);

alter table public.review_seed_archive enable row level security;
revoke all on public.review_seed_archive from public, anon, authenticated;

insert into public.review_seed_archive (
  original_id, place_id, author_name, author_role, rating,
  review_date, review_text, tags, photos
)
select
  r.id, r.place_id, r.author_name, r.author_role, r.rating,
  r.date, r.text, coalesce(r.tags, '{}'), coalesce(r.photos, '{}')
from public.reviews r
where r.seed_data = true
on conflict (original_id) do nothing;

update public.places
set seed_rating = coalesce(seed_rating, rating),
    seed_review_count = case when seed_review_count = 0 then review_count else seed_review_count end,
    seed_owner_verified = case when seed_owner_verified = false then owner_verified else seed_owner_verified end,
    seed_source = coalesce(seed_source, source::text)
where seed_data = true;

delete from public.reviews where seed_data = true;

update public.places
set rating = 0,
    review_count = 0,
    ratings_breakdown = '{}'::jsonb,
    owner_verified = false,
    source = 'seed_baseline',
    ai_confidence_score = 0,
    is_under_documented_gem = false
where seed_data = true;

comment on table public.review_seed_archive is
  'Internal archive of pre-production/reference reviews. Not exposed to anon/authenticated roles and excluded from live community metrics.';
comment on column public.places.seed_rating is
  'Reference rating preserved from the original seed baseline; excluded from live community rating.';
comment on column public.places.seed_review_count is
  'Reference review count preserved from the seed baseline; excluded from live community review_count.';
comment on column public.places.seed_owner_verified is
  'Original seed owner_verified flag retained as provenance only; not treated as live verification.';

commit;

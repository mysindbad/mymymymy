begin;

alter table public.places
  alter column rating drop not null,
  alter column rating drop default;

alter table public.places
  drop constraint if exists places_rating_provenance_check;

alter table public.places
  alter column rating_provenance set default 'unrated';

update public.places
set rating = null,
    ratings_breakdown = null,
    rating_provenance = 'unrated'
where review_count = 0;

alter table public.places
  add column if not exists data_source text not null default 'community_submission',
  add column if not exists last_verified_at timestamptz,
  add column if not exists trust_level text not null default 'unverified';

update public.places
set data_source = case
      when seed_data then 'curated_seed'
      when source = 'business_owner' then 'owner_submission'
      else 'community_submission'
    end,
    trust_level = case
      when review_count > 0 then 'community'
      else 'unverified'
    end;

alter table public.places
  add constraint places_rating_provenance_check
    check (rating_provenance in ('unrated', 'community', 'seed_reference', 'external_reference', 'verified_owner')),
  add constraint places_rating_truth_check
    check (
      (review_count = 0 and rating is null and rating_provenance = 'unrated')
      or
      (review_count > 0 and rating is not null and rating_provenance <> 'unrated')
    ),
  add constraint places_data_source_nonempty_check
    check (length(btrim(data_source)) > 0),
  add constraint places_trust_level_check
    check (trust_level in ('unverified', 'community', 'external', 'official'));

create or replace function public.update_place_rating_aggregate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_place_id uuid;
  live_rating numeric(3,2);
  live_review_count integer;
begin
  target_place_id := coalesce(new.place_id, old.place_id);

  select avg(r.rating)::numeric(3,2), count(*)::integer
  into live_rating, live_review_count
  from public.reviews r
  where r.place_id = target_place_id
    and r.seed_data = false;

  update public.places
  set rating = live_rating,
      review_count = live_review_count,
      rating_provenance = case when live_review_count > 0 then 'community' else 'unrated' end,
      trust_level = case when live_review_count > 0 then 'community' else 'unverified' end
  where id = target_place_id;

  return coalesce(new, old);
end;
$$;

comment on column public.places.rating is
  'Average of live, non-seed community reviews. NULL means no verified live rating exists.';
comment on column public.places.review_count is
  'Count of live, non-seed community reviews included in rating.';
comment on column public.places.data_source is
  'Primary origin of the current place record, such as curated_seed or community_submission.';
comment on column public.places.last_verified_at is
  'Timestamp of the latest successful verification against an accountable source; NULL means not verified.';
comment on column public.places.trust_level is
  'Trust classification for the current place record: unverified, community, external, or official.';

revoke all on function public.update_place_rating_aggregate() from public, anon, authenticated;

commit;

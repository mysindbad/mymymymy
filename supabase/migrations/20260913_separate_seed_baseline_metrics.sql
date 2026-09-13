begin;

alter table public.places
  add column if not exists seed_check_ins_count integer not null default 0 check (seed_check_ins_count >= 0),
  add column if not exists photo_provenance text not null default 'user_submitted'
    check (photo_provenance in ('user_submitted','stock_reference','verified_owner','external_reference')),
  add column if not exists rating_provenance text not null default 'community'
    check (rating_provenance in ('community','seed_reference','external_reference','verified_owner'));

alter table public.reviews
  add column if not exists seed_data boolean not null default false;

-- Preserve preloaded demo/reference counts, then expose only verified check-in
-- events through the existing check_ins_count field from this point forward.
update public.places
set seed_check_ins_count = check_ins_count,
    check_ins_count = 0
where seed_data = true
  and seed_check_ins_count = 0
  and check_ins_count > 0;

-- Current historical reviews pre-date this production project and are not
-- linked to an authenticated user. Keep them for reference, but mark their
-- provenance so they can never be counted as organic community activity.
update public.reviews
set seed_data = true
where author_user_id is null;

update public.places
set rating_provenance = case
      when owner_verified then 'verified_owner'
      else 'seed_reference'
    end,
    photo_provenance = case
      when exists (
        select 1
        from unnest(photos) as photo
        where photo like 'https://images.unsplash.com/%'
      ) then 'stock_reference'
      else photo_provenance
    end
where seed_data = true;

comment on column public.places.check_ins_count is
  'Verified organic check-in events recorded after production hardening. Seed baseline counts are stored separately in seed_check_ins_count.';
comment on column public.places.seed_check_ins_count is
  'Historical/preloaded check-in baseline; never count as verified user activity.';
comment on column public.reviews.seed_data is
  'True for preloaded/reference reviews that are not verified organic user submissions.';
comment on column public.places.photo_provenance is
  'Origin classification for place photos; stock_reference means illustrative, not user/owner proof.';

commit;

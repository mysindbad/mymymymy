-- Keep trust-bearing review roles server-authoritative.
-- Authenticated users may create and edit only ordinary traveler reviews.
-- Future verified guide/owner roles must be assigned through a privileged server workflow.

drop policy if exists reviews_authenticated_insert on public.reviews;
create policy reviews_authenticated_insert
on public.reviews
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and author_role = 'traveler'
  and seed_data = false
);

drop policy if exists reviews_authenticated_update on public.reviews;
create policy reviews_authenticated_update
on public.reviews
for update
to authenticated
using (author_user_id = (select auth.uid()))
with check (
  author_user_id = (select auth.uid())
  and author_role = 'traveler'
  and seed_data = false
);

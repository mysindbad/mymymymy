begin;

create index if not exists trips_destination_id_idx on public.trips(destination_id);
create index if not exists trip_expenses_created_by_user_id_idx on public.trip_expenses(created_by_user_id);

drop policy if exists places_authenticated_insert on public.places;
create policy places_authenticated_insert on public.places for insert to authenticated with check (created_by_user_id = (select auth.uid()));
drop policy if exists places_authenticated_update on public.places;
create policy places_authenticated_update on public.places for update to authenticated using (created_by_user_id = (select auth.uid())) with check (created_by_user_id = (select auth.uid()));

drop policy if exists reviews_authenticated_insert on public.reviews;
create policy reviews_authenticated_insert on public.reviews for insert to authenticated with check (author_user_id = (select auth.uid()));
drop policy if exists reviews_authenticated_update on public.reviews;
create policy reviews_authenticated_update on public.reviews for update to authenticated using (author_user_id = (select auth.uid())) with check (author_user_id = (select auth.uid()));

drop policy if exists users_select_own_profile on public.user_profiles;
create policy users_select_own_profile on public.user_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists users_update_own_profile on public.user_profiles;
create policy users_update_own_profile on public.user_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists users_insert_own_profile on public.user_profiles;
create policy users_insert_own_profile on public.user_profiles for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists trips_select_own on public.trips;
create policy trips_select_own on public.trips for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists trips_update_own on public.trips;
create policy trips_update_own on public.trips for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists trips_delete_own on public.trips;
create policy trips_delete_own on public.trips for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists expenses_select_own on public.trip_expenses;
create policy expenses_select_own on public.trip_expenses for select to authenticated using (trip_id in (select id from public.trips where user_id = (select auth.uid())));
drop policy if exists expenses_insert_own on public.trip_expenses;
create policy expenses_insert_own on public.trip_expenses for insert to authenticated with check (trip_id in (select id from public.trips where user_id = (select auth.uid())) and created_by_user_id = (select auth.uid()));
drop policy if exists expenses_update_own on public.trip_expenses;
create policy expenses_update_own on public.trip_expenses for update to authenticated using (trip_id in (select id from public.trips where user_id = (select auth.uid()))) with check (trip_id in (select id from public.trips where user_id = (select auth.uid())));
drop policy if exists expenses_delete_own on public.trip_expenses;
create policy expenses_delete_own on public.trip_expenses for delete to authenticated using (trip_id in (select id from public.trips where user_id = (select auth.uid())));

commit;

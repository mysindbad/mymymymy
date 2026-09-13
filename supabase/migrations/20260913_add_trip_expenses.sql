CREATE TABLE IF NOT EXISTS public.trip_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('accommodation','food','transport','activity','souvenir','other')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'MAD',
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX trip_expenses_trip_id_idx ON public.trip_expenses(trip_id);
ALTER TABLE public.trip_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_select_own ON public.trip_expenses FOR SELECT TO authenticated
  USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));
CREATE POLICY expenses_insert_own ON public.trip_expenses FOR INSERT TO authenticated
  WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()) AND created_by_user_id = auth.uid());
CREATE POLICY expenses_update_own ON public.trip_expenses FOR UPDATE TO authenticated
  USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()))
  WITH CHECK (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));
CREATE POLICY expenses_delete_own ON public.trip_expenses FOR DELETE TO authenticated
  USING (trip_id IN (SELECT id FROM public.trips WHERE user_id = auth.uid()));
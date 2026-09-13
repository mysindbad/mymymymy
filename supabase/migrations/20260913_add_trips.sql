CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  destination_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  budget numeric(10,2) NOT NULL CHECK (budget > 0),
  currency text NOT NULL DEFAULT 'MAD',
  participants_count integer NOT NULL DEFAULT 1 CHECK (participants_count >= 1),
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','completed','cancelled')),
  preferences jsonb DEFAULT '[]',
  ai_itinerary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX trips_user_id_idx ON public.trips(user_id);
CREATE INDEX trips_status_idx ON public.trips(status);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY trips_select_own ON public.trips FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY trips_insert_own ON public.trips FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY trips_update_own ON public.trips FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY trips_delete_own ON public.trips FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trips_set_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

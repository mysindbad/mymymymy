DROP FUNCTION IF EXISTS public.update_user_location(numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.update_user_location(
  p_user_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_accuracy numeric DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'cannot update another user profile';
  END IF;
  UPDATE public.user_profiles
  SET last_known_location = jsonb_build_object(
    'lat', p_lat,
    'lng', p_lng,
    'accuracy', p_accuracy,
    'captured_at', now()
  ),
  updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_user_location(uuid, numeric, numeric, numeric) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_location(uuid, numeric, numeric, numeric) TO authenticated;


CREATE OR REPLACE FUNCTION public.check_owner_has_fiskaly(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_owner_id
    AND fiskaly_system_id IS NOT NULL
  );
$$;

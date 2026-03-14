
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(p_ids uuid[])
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.email
  FROM profiles p
  WHERE p.id = ANY(p_ids);
$$;

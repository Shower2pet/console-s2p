
-- Function to get note author info (bypasses profiles RLS)
CREATE OR REPLACE FUNCTION public.get_note_authors(author_ids uuid[])
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  role user_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.email, p.role
  FROM profiles p
  WHERE p.id = ANY(author_ids);
$$;

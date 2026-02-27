
-- 1. Create user_notes table
CREATE TABLE public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- 2. get_console_user_detail function
CREATE OR REPLACE FUNCTION public.get_console_user_detail(target_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT p.role, p.id AS uid
    FROM profiles p
    WHERE p.id = auth.uid()
  ),
  has_access AS (
    SELECT 1 AS ok FROM caller c WHERE c.role = 'admin'
    UNION ALL
    SELECT 1 AS ok FROM (
      SELECT ws.user_id FROM wash_sessions ws
      JOIN stations s ON s.id = ws.station_id
      JOIN structures st ON st.id = s.structure_id
      JOIN caller c ON c.role = 'partner' AND st.owner_id = c.uid
      WHERE ws.user_id = target_id
      LIMIT 1
    ) sub1
    UNION ALL
    SELECT 1 AS ok FROM (
      SELECT ws.user_id FROM wash_sessions ws
      JOIN stations s ON s.id = ws.station_id
      JOIN structure_managers sm ON sm.structure_id = s.structure_id
      JOIN caller c ON c.role = 'manager' AND sm.user_id = c.uid
      WHERE ws.user_id = target_id
      LIMIT 1
    ) sub2
  )
  SELECT p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at
  FROM profiles p
  WHERE p.id = target_id AND EXISTS (SELECT 1 FROM has_access)
  LIMIT 1;
$$;

-- 3. RLS policies for user_notes
CREATE POLICY "Staff can insert user notes"
ON public.user_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.get_console_user_detail(target_user_id))
);

CREATE POLICY "Staff can read user notes"
ON public.user_notes FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.get_console_user_detail(target_user_id))
);

-- 4. Staff wallet policies
CREATE POLICY "Staff can view user wallets"
ON public.structure_wallets FOR SELECT TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM structures st
    WHERE st.id = structure_wallets.structure_id AND st.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM structure_managers sm
    WHERE sm.structure_id = structure_wallets.structure_id AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can update user wallets"
ON public.structure_wallets FOR UPDATE TO authenticated
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM structures st
    WHERE st.id = structure_wallets.structure_id AND st.owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM structure_managers sm
    WHERE sm.structure_id = structure_wallets.structure_id AND sm.user_id = auth.uid()
  )
);

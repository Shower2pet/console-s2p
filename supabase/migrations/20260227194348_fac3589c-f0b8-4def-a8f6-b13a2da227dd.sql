
-- Drop policies first, then function, then recreate all
DROP POLICY IF EXISTS "Staff can insert user notes" ON public.user_notes;
DROP POLICY IF EXISTS "Staff can read user notes" ON public.user_notes;
DROP FUNCTION IF EXISTS public.get_console_user_detail(uuid);

CREATE FUNCTION public.get_console_user_detail(target_id uuid)
RETURNS TABLE(
  id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz,
  is_guest boolean,
  total_washes bigint
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
  visible_stations AS (
    SELECT s.id FROM stations s, caller c WHERE c.role = 'admin'
    UNION
    SELECT s.id FROM stations s
    JOIN structures st ON st.id = s.structure_id
    JOIN caller c ON c.role = 'partner' AND st.owner_id = c.uid
    UNION
    SELECT s.id FROM stations s
    JOIN structure_managers sm ON sm.structure_id = s.structure_id
    JOIN caller c ON c.role = 'manager' AND sm.user_id = c.uid
  ),
  registered AS (
    SELECT
      p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at,
      false AS is_guest,
      COUNT(ws.id) AS total_washes
    FROM profiles p
    JOIN wash_sessions ws ON ws.user_id = p.id
    JOIN visible_stations vs ON vs.id = ws.station_id
    WHERE p.id = target_id
    GROUP BY p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at
  ),
  guest AS (
    SELECT
      target_id AS id,
      ws.guest_email AS email,
      NULL::text AS first_name,
      NULL::text AS last_name,
      NULL::text AS phone,
      MIN(ws.created_at) AS created_at,
      true AS is_guest,
      COUNT(ws.id) AS total_washes
    FROM wash_sessions ws
    JOIN visible_stations vs ON vs.id = ws.station_id
    WHERE ws.user_id IS NULL
      AND ws.guest_email IS NOT NULL
      AND extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, ws.guest_email) = target_id
    GROUP BY ws.guest_email
  )
  SELECT * FROM registered
  UNION ALL
  SELECT * FROM guest
  LIMIT 1;
$$;

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

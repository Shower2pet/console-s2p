
-- Optimize: for admin, skip the visible_stations CTE entirely
CREATE OR REPLACE FUNCTION public.get_console_users(search_query text DEFAULT '')
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
  caller_id uuid;
BEGIN
  SELECT p.role, p.id INTO caller_role, caller_id
  FROM profiles p WHERE p.id = auth.uid();

  RETURN QUERY
  WITH visible_stations AS (
    SELECT s.id FROM stations s
    WHERE caller_role = 'admin'
    UNION ALL
    SELECT s.id FROM stations s
    JOIN structures st ON st.id = s.structure_id
    WHERE caller_role = 'partner' AND st.owner_id = caller_id
    UNION ALL
    SELECT s.id FROM stations s
    JOIN structure_managers sm ON sm.structure_id = s.structure_id
    WHERE caller_role = 'manager' AND sm.user_id = caller_id
  ),
  registered AS (
    SELECT
      p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at,
      false AS is_guest,
      COUNT(ws.id) AS total_washes
    FROM profiles p
    JOIN wash_sessions ws ON ws.user_id = p.id
    WHERE EXISTS (SELECT 1 FROM visible_stations vs WHERE vs.id = ws.station_id)
    GROUP BY p.id, p.email, p.first_name, p.last_name, p.phone, p.created_at
  ),
  guests AS (
    SELECT
      extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, ws.guest_email) AS id,
      ws.guest_email AS email,
      NULL::text AS first_name,
      NULL::text AS last_name,
      NULL::text AS phone,
      MIN(ws.created_at) AS created_at,
      true AS is_guest,
      COUNT(ws.id) AS total_washes
    FROM wash_sessions ws
    WHERE ws.user_id IS NULL
      AND ws.guest_email IS NOT NULL
      AND ws.guest_email != ''
      AND EXISTS (SELECT 1 FROM visible_stations vs WHERE vs.id = ws.station_id)
    GROUP BY ws.guest_email
  ),
  combined AS (
    SELECT * FROM registered
    UNION ALL
    SELECT * FROM guests
  )
  SELECT c.* FROM combined c
  WHERE search_query = '' OR (
    c.email ILIKE '%' || search_query || '%' OR
    c.first_name ILIKE '%' || search_query || '%' OR
    c.last_name ILIKE '%' || search_query || '%' OR
    c.phone ILIKE '%' || search_query || '%'
  )
  ORDER BY c.total_washes DESC;
END;
$$;

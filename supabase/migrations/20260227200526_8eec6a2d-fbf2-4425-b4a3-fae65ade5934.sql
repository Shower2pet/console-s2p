
CREATE OR REPLACE FUNCTION public.get_station_users(
  p_station_id text,
  p_search text DEFAULT ''
)
RETURNS TABLE(
  id uuid,
  email text,
  first_name text,
  last_name text,
  phone text,
  is_guest boolean,
  total_washes bigint,
  last_wash_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role user_role;
  caller_id uuid;
BEGIN
  SELECT p.role, p.id INTO caller_role, caller_id
  FROM profiles p WHERE p.id = auth.uid();

  -- Verify caller has access to this station
  IF caller_role = 'admin' THEN
    -- OK
    NULL;
  ELSIF caller_role = 'partner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM stations s
      JOIN structures st ON st.id = s.structure_id
      WHERE s.id = p_station_id AND st.owner_id = caller_id
    ) AND NOT EXISTS (
      SELECT 1 FROM stations s WHERE s.id = p_station_id AND s.owner_id = caller_id
    ) THEN
      RETURN;
    END IF;
  ELSIF caller_role = 'manager' THEN
    IF NOT EXISTS (
      SELECT 1 FROM stations s
      JOIN structure_managers sm ON sm.structure_id = s.structure_id
      WHERE s.id = p_station_id AND sm.user_id = caller_id
    ) THEN
      RETURN;
    END IF;
  ELSE
    RETURN;
  END IF;

  RETURN QUERY
  WITH registered AS (
    SELECT
      p.id,
      p.email,
      p.first_name,
      p.last_name,
      p.phone,
      false AS is_guest,
      COUNT(ws.id) AS total_washes,
      MAX(ws.created_at) AS last_wash_at
    FROM wash_sessions ws
    JOIN profiles p ON p.id = ws.user_id
    WHERE ws.station_id = p_station_id
      AND ws.user_id IS NOT NULL
    GROUP BY p.id, p.email, p.first_name, p.last_name, p.phone
  ),
  guests AS (
    SELECT
      extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, ws.guest_email) AS id,
      ws.guest_email AS email,
      NULL::text AS first_name,
      NULL::text AS last_name,
      NULL::text AS phone,
      true AS is_guest,
      COUNT(ws.id) AS total_washes,
      MAX(ws.created_at) AS last_wash_at
    FROM wash_sessions ws
    WHERE ws.station_id = p_station_id
      AND ws.user_id IS NULL
      AND ws.guest_email IS NOT NULL
      AND ws.guest_email != ''
    GROUP BY ws.guest_email
  ),
  combined AS (
    SELECT * FROM registered
    UNION ALL
    SELECT * FROM guests
  )
  SELECT c.* FROM combined c
  WHERE p_search = '' OR (
    c.email ILIKE '%' || p_search || '%' OR
    c.first_name ILIKE '%' || p_search || '%' OR
    c.last_name ILIKE '%' || p_search || '%' OR
    c.phone ILIKE '%' || p_search || '%'
  )
  ORDER BY c.total_washes DESC;
END;
$$;

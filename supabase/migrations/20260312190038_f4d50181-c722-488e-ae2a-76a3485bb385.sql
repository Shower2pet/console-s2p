
CREATE OR REPLACE FUNCTION public.get_public_stations()
 RETURNS TABLE(id text, type text, status text, visibility text, geo_lat numeric, geo_lng numeric, image_url text, last_heartbeat_at timestamp with time zone, structure_id uuid, washing_options jsonb, created_at timestamp with time zone, category text, has_access_gate boolean, structure_name text, structure_address text, structure_description text, structure_geo_lat numeric, structure_geo_lng numeric, structure_owner_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.type,
    CASE
      WHEN s.status::text = 'AVAILABLE' AND s.last_heartbeat_at < now() - interval '90 seconds' THEN 'OFFLINE'
      WHEN s.status::text = 'AVAILABLE' AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.station_id = s.id) THEN 'OFFLINE'
      WHEN s.status::text = 'AVAILABLE' AND EXISTS (
        SELECT 1 FROM public.wash_sessions ws
        WHERE ws.station_id = s.id
          AND ws.status = 'ACTIVE'
          AND ws.ends_at > now()
          AND ws.step != 'ready'
      ) THEN 'BUSY'
      ELSE s.status::text
    END AS status,
    s.visibility::text,
    s.geo_lat, s.geo_lng, s.image_url, s.last_heartbeat_at,
    s.structure_id, s.washing_options, s.created_at,
    CASE WHEN UPPER(s.type) = 'BRACCO' THEN 'SHOWER' ELSE 'TUB' END AS category,
    COALESCE(s.has_access_gate, false) AS has_access_gate,
    st.name AS structure_name,
    st.address AS structure_address,
    st.description AS structure_description,
    st.geo_lat AS structure_geo_lat,
    st.geo_lng AS structure_geo_lng,
    st.owner_id AS structure_owner_id
  FROM public.stations s
  INNER JOIN public.structures st ON st.id = s.structure_id
  WHERE s.visibility IN ('PUBLIC', 'RESTRICTED')
    AND s.structure_id IS NOT NULL
    AND s.owner_id IS NOT NULL;
$function$;


CREATE OR REPLACE FUNCTION public.get_station_ratings_with_user(
  p_station_id text,
  p_limit int DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  station_id text,
  user_id uuid,
  session_id uuid,
  rating smallint,
  comment text,
  created_at timestamptz,
  user_first_name text,
  user_last_name text,
  user_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.station_id,
    sr.user_id,
    sr.session_id,
    sr.rating,
    sr.comment,
    sr.created_at,
    p.first_name AS user_first_name,
    p.last_name AS user_last_name,
    p.email AS user_email
  FROM station_ratings sr
  LEFT JOIN profiles p ON p.id = sr.user_id
  WHERE sr.station_id = p_station_id
  ORDER BY sr.created_at DESC
  LIMIT p_limit;
$$;

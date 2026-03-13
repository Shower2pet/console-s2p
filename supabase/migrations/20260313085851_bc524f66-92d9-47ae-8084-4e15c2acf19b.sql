
-- Station Ratings table
CREATE TABLE public.station_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id text NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.wash_sessions(id) ON DELETE CASCADE UNIQUE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.station_ratings ENABLE ROW LEVEL SECURITY;

-- Users insert their own ratings
CREATE POLICY "Users insert own ratings"
  ON public.station_ratings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users read own ratings
CREATE POLICY "Users read own ratings"
  ON public.station_ratings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Staff reads ratings for their stations
CREATE POLICY "Staff reads station ratings"
  ON public.station_ratings FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM stations s
      JOIN structures st ON st.id = s.structure_id
      WHERE s.id = station_ratings.station_id AND st.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM stations s
      WHERE s.id = station_ratings.station_id AND is_manager_of(s.structure_id)
    )
  );

-- Function to get average rating
CREATE OR REPLACE FUNCTION public.get_station_avg_rating(p_station_id text)
RETURNS TABLE(avg_rating numeric, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
    COUNT(*) AS total_count
  FROM station_ratings
  WHERE station_id = p_station_id;
$$;

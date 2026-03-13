
-- Allow tester to INSERT stations (in TESTING phase, owned by self)
CREATE POLICY "Tester inserts own testing stations"
ON public.stations
FOR INSERT
TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'tester'::user_role
  ))
  AND phase = 'TESTING'::station_phase
  AND owner_id = auth.uid()
);

-- Update SELECT: tester only sees own TESTING stations (no more PRODUCTION)
DROP POLICY IF EXISTS "Tester reads production and own testing stations" ON public.stations;
CREATE POLICY "Tester reads own testing stations"
ON public.stations
FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'tester'::user_role
  ))
  AND phase = 'TESTING'::station_phase
  AND owner_id = auth.uid()
);

-- Update UPDATE: tester only updates own TESTING stations (no more PRODUCTION)
DROP POLICY IF EXISTS "Tester updates production and own testing stations" ON public.stations;
CREATE POLICY "Tester updates own testing stations"
ON public.stations
FOR UPDATE
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'tester'::user_role
  ))
  AND phase = 'TESTING'::station_phase
  AND owner_id = auth.uid()
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'tester'::user_role
  ))
  AND (
    (phase = 'TESTING'::station_phase AND owner_id = auth.uid())
    OR (phase = 'STOCK'::station_phase AND owner_id IS NULL)
  )
);

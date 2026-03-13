-- Allow testers to DELETE their own TESTING stations
CREATE POLICY "Tester deletes own testing stations"
ON public.stations
FOR DELETE
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
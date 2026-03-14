
-- Allow managers to read boards for stations in their assigned structures
CREATE POLICY "Manager reads boards for assigned stations"
ON public.boards
FOR SELECT
TO authenticated
USING (
  station_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stations s
    WHERE s.id = boards.station_id
    AND is_manager_of(s.structure_id)
  )
);

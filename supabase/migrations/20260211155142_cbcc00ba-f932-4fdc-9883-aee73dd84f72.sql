-- Allow station owner to update their own stations (needed for onboarding assignment)
CREATE POLICY "Owner updates own stations"
ON public.stations
FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
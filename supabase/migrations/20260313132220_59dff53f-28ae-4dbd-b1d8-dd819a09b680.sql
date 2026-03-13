
-- RLS: Tester can read/manage boards (create, delete, update)
CREATE POLICY "Tester manages boards"
ON public.boards
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
);

-- RLS: Tester can read own stations + stock (no owner, no structure)
CREATE POLICY "Tester reads own and stock stations"
ON public.stations
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
  AND (owner_id = auth.uid() OR (owner_id IS NULL AND structure_id IS NULL))
);

-- RLS: Tester can update own stations
CREATE POLICY "Tester manages own stations"
ON public.stations
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
  AND owner_id = auth.uid()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
  AND owner_id = auth.uid()
);

-- RLS: Tester can insert stations
CREATE POLICY "Tester inserts stations"
ON public.stations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
);

-- RLS: Tester can delete own stations
CREATE POLICY "Tester deletes own stations"
ON public.stations
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
  AND owner_id = auth.uid()
);

-- RLS: Allow tester to insert gate_commands  
CREATE POLICY "Tester can create gate commands"
ON public.gate_commands
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester')
  AND user_id = auth.uid()
);

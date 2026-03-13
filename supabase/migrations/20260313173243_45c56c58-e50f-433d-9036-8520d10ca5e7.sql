DROP POLICY IF EXISTS "Tester updates own testing stations" ON stations;

CREATE POLICY "Tester updates own testing stations" ON stations
FOR UPDATE TO authenticated
USING (
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester'))
  AND phase = 'TESTING'
  AND owner_id = auth.uid()
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'tester'))
  AND (
    (phase = 'TESTING' AND owner_id = auth.uid())
    OR (phase = 'STOCK' AND owner_id IS NULL)
  )
);